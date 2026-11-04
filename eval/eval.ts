// oxlint-disable no-await-in-loop -- Läufe bewusst sequenziell (Rate-Limit, ein lokales Modell)
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import {
  accuracy,
  bootstrap,
  brier,
  ece,
  fitTemperature,
  nll,
  riskCoverage,
  scale,
  type Pred,
} from "../lib/calibration.ts";
import { legacyModelId } from "../lib/models.ts";
import type { RunRequest } from "../lib/run.ts";
import type { ModelRun, QuestionType } from "../lib/types.ts";
import { generate, items, type Item } from "./items.ts";

/**
 * Evaluation über `POST /api/run`: läuft sequenziell, cacht Rohantworten je Frage unter dem Hash von State, Fakten und
 * Frage als JSONL (Resume; geänderte Fragen werden neu geholt) und schreibt einen Bericht zum Test-Split. Aufruf: `npm run eval -- [--limit 2] [--report-only]`.
 */
const { values: args } = parseArgs({
  options: {
    "base-url": { type: "string", default: "http://localhost:3000" },
    models: { type: "string", default: "ollama:elephant-1:9b-q4-ctx8k" },
    average: { type: "string", default: "1,3" },
    limit: { type: "string" },
    seed: { type: "string", default: "42" },
    "report-only": { type: "boolean", default: false },
  },
});

// IDs ohne Präfix wie in der UI auf ihr Backend abbilden (`jev-latest` → `typesafe:jev-latest`).
const models = args.models.split(",").map((m) => legacyModelId(m.trim()));
const averages = args.average.split(",").map(Number);
const seed = Number(args.seed);
if (models.some((m) => m.startsWith("typesafe:")) && process.env.EVAL_ALLOW_TYPESAFE !== "1") {
  console.error(
    "typesafe:-Modelle gehen an TypeSafe (US-Hosting): nur mit EVAL_ALLOW_TYPESAFE=1 und synthetischen Daten.",
  );
  process.exit(1);
}

const OUT = seed === 42 ? "eval/out" : `eval/out/seed${seed}`;
const RAW = `${OUT}/raw`;
mkdirSync(RAW, { recursive: true });

const all = generate(seed);
const limit = args.limit ? Number(args.limit) : Infinity;
const states = (["calib", "test"] as const).flatMap((split) => all.filter((s) => s.split === split).slice(0, limit));
const flat = items(states);

type Raw = {
  stateId: string;
  modelId: string;
  average: number;
  answers: { questionId: string; hash: string; probs: number[] }[];
  latencyMs: number;
};

// Eine abgebrochen geschriebene letzte Zeile wird übersprungen und beim Resume neu geholt.
const load = (file: string): Raw[] =>
  existsSync(file)
    ? readFileSync(file, "utf8")
        .split("\n")
        .flatMap((line) => {
          try {
            return line ? [JSON.parse(line)] : [];
          } catch {
            return [];
          }
        })
    : [];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** HTTP 429 → Backoff 5, 10, … 60 s und derselbe State erneut; andere Fehler als Text. */
async function post(body: RunRequest): Promise<ModelRun | string> {
  for (let wait = 5_000; ; wait = Math.min(2 * wait, 60_000)) {
    try {
      const res = await fetch(`${args["base-url"]}/api/run`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(180_000),
      });
      const json = await res.json();
      if (res.status === 429 && !/Tagesbudget/.test(json.error?.message)) {
        console.log(`  429, warte ${wait / 1000} s`);
        await sleep(wait);
        continue;
      }
      return res.ok ? json : `HTTP ${res.status} ${json.error?.message ?? ""}`;
    } catch (e) {
      return `network ${e instanceof Error ? e.message : String(e)}`;
    }
  }
}

/** Gecachte Antworten nach Frage-Hash; Einträge ohne passenden Hash (alter Generator) bleiben ungenutzt. */
const cached = (records: Raw[]) =>
  new Map(records.flatMap((r) => r.answers.filter((a) => a.hash).map((a) => [a.hash, a.probs] as const)));

async function run(modelId: RunRequest["modelId"], average: number) {
  // Ohne `ollama:`, damit Rohdaten aus der Zeit vor den Präfixen weiter passen.
  const file = `${RAW}/${`${modelId.replace(/^ollama:/, "")}__avg${average}`.toLowerCase().replace(/[^a-z0-9.-]/g, "_")}.jsonl`;
  const done = cached(load(file));
  for (const [i, s] of states.entries()) {
    const tag = `[${modelId} ×${average}] ${i + 1}/${states.length} ${s.id}`;
    // Nur fehlende oder veränderte Fragen des States anfragen.
    const todo = flat.filter((it) => it.stateId === s.id && !done.has(it.hash));
    if (!todo.length) continue;
    const { state, facts } = s;
    const questions = todo.map((it) => it.question);
    const res = await post({ modelId, state, facts, questions, average });
    // Fehler nur mit Metadaten loggen und nicht cachen, damit ein Resume sie erneut versucht.
    const error = typeof res === "string" ? res : res.error && `${res.error.kind} ${res.error.message}`;
    if (error || typeof res === "string") {
      console.log(`${tag} Fehler: ${String(error).slice(0, 120)}`);
      continue;
    }
    const answers = res.answers.map(({ questionId, probs }, k) => ({ questionId, hash: todo[k].hash, probs }));
    const record: Raw = { stateId: s.id, modelId, average, answers, latencyMs: res.latencyMs };
    appendFileSync(file, `${JSON.stringify(record)}\n`);
    console.log(`${tag} ok ${questions.length} Fragen ${res.latencyMs} ms`);
  }
}

if (!args["report-only"]) for (const m of models) for (const a of averages) await run(m, a);

// ── Bericht ─────────────────────────────────────────────────────────────

type P = Pred & { type: QuestionType; stateId: string };
const TYPES: QuestionType[] = ["choice", "noul", "score"];
const STATS = { Accuracy: accuracy, Brier: brier, NLL: nll, ECE: ece, AURC: (p: Pred[]) => riskCoverage(p).aurc };

/** Vorhersagen eines Splits; Wahrscheinlichkeiten sicherheitshalber normiert. */
function preds(cache: Map<string, number[]>, split: Item["split"]) {
  const out: P[] = [];
  let missing = 0;
  for (const it of flat.filter((x) => x.split === split)) {
    const probs = cache.get(it.hash);
    if (!probs) {
      missing++;
      continue;
    }
    const sum = probs.reduce((x, y) => x + y, 0);
    out.push({ probs: probs.map((p) => p / sum), label: it.gold, type: it.type, stateId: it.stateId });
  }
  return { preds: out, missing };
}

// Die 5 Fragen eines States teilen Kontext und Request: Bootstrap zieht ganze States (Cluster).
const ci = (p: P[], f: (p: P[]) => number) => bootstrap(p, f, 1000, 1, (x) => x.stateId);

function column(name: string, test: P[], missing: number, T: number | null, calibN = 0) {
  const p = T === null ? test : test.map((x) => ({ ...x, probs: scale(x.probs, T) }));
  const rc = riskCoverage(p);
  return {
    name,
    T,
    calibN,
    n: p.length,
    missing,
    metrics: Object.fromEntries(Object.entries(STATS).map(([k, f]) => [k, { value: f(p), ci: ci(p, f) }])),
    byType: Object.fromEntries(
      TYPES.map((t) => {
        const sub = p.filter((x) => x.type === t);
        return [t, { n: sub.length, accuracy: accuracy(sub), ece: ece(sub) }];
      }),
    ),
    riskCoverage: Array.from({ length: 10 }, (_, i) => {
      const k = Math.ceil(((i + 1) / 10) * p.length);
      return { coverage: (i + 1) / 10, risk: rc.risk[k - 1] };
    }),
  };
}

// Alle vorhandenen Rohdaten, also auch jev-latest, falls dafür Läufe existieren.
const columns = readdirSync(RAW)
  .filter((f) => f.endsWith(".jsonl"))
  .toSorted()
  .flatMap((f) => {
    const records = load(`${RAW}/${f}`);
    if (!records.length) return [];
    const { modelId, average } = records[0];
    const cache = cached(records);
    const calib = preds(cache, "calib");
    const { preds: test, missing } = preds(cache, "test");
    if (!test.length) return [];
    const label = `${modelId} ${average > 1 ? `gemittelt ×${average}` : "roh"}`;
    const raw = column(label, test, missing, null);
    // T nur mit vollständigem Kalibrierungs-Split, sonst passt es sich an wenige, zufällig leichte Items an.
    if (calib.missing || !calib.preds.length) return [raw];
    const T = fitTemperature(calib.preds);
    return [raw, column(`${label} + TS`, test, missing, T, calib.preds.length)];
  });

const f3 = (x: number) => x.toFixed(3);
const row = (cells: string[]) => `| ${cells.join(" | ")} |`;
const table = (head: string[], rows: string[][]) =>
  [row(head), row(head.map(() => "---")), ...rows.map(row)].join("\n");
const testStates = states.filter((s) => s.split === "test").length;
const testItems = flat.filter((it) => it.split === "test");

const md = [
  "# Evaluation (Test-Split)",
  "",
  `Seed ${seed} · ${testStates} States · Werte mit 95-%-KI (Cluster-Bootstrap über States, 1000 Resamples) · ` +
    "T per NLL auf dem vollständigen Kalibrierungs-Split derselben Konfiguration gefittet (n in Klammern).",
  "",
  table(
    ["Kennzahl", ...columns.map((c) => c.name)],
    [
      ["n (fehlend)", ...columns.map((c) => `${c.n} (${c.missing})`)],
      ...Object.keys(STATS).map((k) => [
        k,
        ...columns.map(({ metrics: { [k]: m } }) => `${f3(m.value)} [${f3(m.ci[0])}, ${f3(m.ci[1])}]`),
      ]),
      ["T (n Kalib.)", ...columns.map((c) => (c.T === null ? "–" : `${f3(c.T)} (${c.calibN})`))],
    ],
  ),
  "",
  "## Nach Fragetyp (Accuracy / ECE)",
  "",
  table(
    ["Typ", ...columns.map((c) => c.name)],
    TYPES.map((t) => [
      `${t} (${testItems.filter((it) => it.type === t).length})`,
      ...columns.map(({ byType: { [t]: b } }) => (b.n ? `${f3(b.accuracy)} / ${f3(b.ece)}` : "–")),
    ]),
  ),
  "",
].join("\n");

writeFileSync(`${OUT}/report.md`, md);
writeFileSync(`${OUT}/report.json`, `${JSON.stringify({ seed, testStates, columns }, null, 2)}\n`);
console.log(`\n${md}\nBericht: ${OUT}/report.md, ${OUT}/report.json`);
