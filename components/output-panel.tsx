"use client";

import { ChevronRight, Code2, Scale, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { fmtInt } from "@/lib/limits";
import { labelsFor, modelById } from "@/lib/mock-data";
import { fmtNum, fmtPct, noulVerdict } from "@/lib/metrics";
import type { Answer, ModelId, ModelRun, ModelState, Preset, Question } from "@/lib/types";
import { ChoiceMatrix, Dot, NoulScale, ScoreChart, Verdict, gridTemplate, type Col } from "./viz";

type States = Record<string, ModelState | undefined>;

type Props = {
  questions: Question[];
  models: ModelId[];
  states: States;
  rule?: Preset["rule"];
  onInspect: (m: ModelId) => void;
  toolbar: ReactNode;
};

const stateOf = (states: States, id: ModelId): ModelState => states[id] ?? { status: "idle" };
const answerOf = (s: ModelState, qid: string): Answer | undefined =>
  s.status === "done" ? s.run.answers.find((a) => a.questionId === qid) : undefined;

const TYPE_META = {
  choice: (q: Question) => `Choice · ${q.options.length} Optionen`,
  noul: () => "Noul · Ja oder Nein",
  score: (q: Question) => `Score · ${q.levels} Level`,
} as const;

const VERDICT_WORD = { yes: "Ja", no: "Nein", unclear: "Unklar" } as const;

function answerText(q: Question, labels: string[], a: Answer): string {
  if (q.type === "choice") return labels[a.metrics.topIndex];
  if (q.type === "noul") return VERDICT_WORD[noulVerdict(a.probs[0])];
  return `Level ${a.metrics.topIndex + 1}`;
}

export function OutputPanel({ questions, models, states, rule, onInspect, toolbar }: Props) {
  const list = models.map((id) => stateOf(states, id));
  const anyActive = list.some((s) => s.status !== "idle");
  const running = list.some((s) => s.status === "running");
  const only = models.length === 1 ? list[0] : null;
  const singleError = only?.status === "done" && only.run.error ? only.run : null;

  return (
    <section id="ergebnis" tabIndex={-1} aria-labelledby="ergebnis-h" className="flex min-w-0 shrink-0 flex-col outline-none lg:min-h-0 lg:flex-1 lg:shrink">
      <header className="flex h-11 shrink-0 items-center gap-4 border-b border-line px-6">
        <h2 id="ergebnis-h" className="section-title">Ergebnis</h2>
        <ul className="hidden min-w-0 flex-1 items-center gap-3 text-xs text-muted sm:flex">
          {models.map((id) => {
            const m = modelById(id);
            return (
              <li key={id} className="flex items-center gap-1.5 truncate">
                <Dot color={m.color} />
                {m.label}
              </li>
            );
          })}
        </ul>
        <div className="ml-auto flex items-center gap-0.5">{toolbar}</div>
      </header>

      <p role="status" className="sr-only">
        {running ? "Läuft …" : anyActive ? `Ergebnis für ${models.length} ${models.length === 1 ? "Modell" : "Modelle"} liegt vor.` : ""}
      </p>

      {!anyActive ? (
        <div className="px-6 py-16">
          <div className="max-w-sm">
            <h3 className="text-[15px] font-semibold">Noch kein Ergebnis</h3>
            <p className="mt-1 text-muted">Wähle links eine Vorlage oder gib State und Frage ein. Mit ⌘&nbsp;↵ startet der Lauf.</p>
          </div>
        </div>
      ) : (
        <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
          <div className="mx-auto max-w-[860px] px-6 pb-10">
            {singleError ? (
              <div className="pt-6">
                <ErrorNote run={singleError} />
              </div>
            ) : (
              <>
                {models.length > 1 && <RunTable models={models} states={states} onInspect={onInspect} />}
                {rule && <RuleBlock rule={rule} questions={questions} models={models} states={states} />}
                {questions.map((q, i) => (
                  <QuestionBlock key={q.id} index={i} total={questions.length} q={q} models={models} states={states} />
                ))}
                {models.length === 1 && <SingleMeta id={models[0]} state={list[0]} onInspect={onInspect} />}
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function RunTable({ models, states, onInspect }: Pick<Props, "models" | "states" | "onInspect">) {
  return (
    <table className="mt-5 w-full text-left text-xs">
      <caption className="sr-only">Läufe je Modell</caption>
      <thead>
        <tr className="text-muted">
          <th scope="col" className="py-1.5 pr-3 font-medium">Modell</th>
          <th scope="col" className="py-1.5 pr-3 font-medium">Status</th>
          <th scope="col" className="py-1.5 pr-3 text-right font-medium">Latenz</th>
          <th scope="col" className="py-1.5 text-right font-medium">Tokens (ein / aus)</th>
          <th scope="col" className="w-8"><span className="sr-only">Raw</span></th>
        </tr>
      </thead>
      <tbody>
        {models.map((id) => {
          const m = modelById(id);
          const s = stateOf(states, id);
          return (
            <tr key={id} className="border-t border-line">
              <th scope="row" className="py-1.5 pr-3 font-medium">
                <span className="inline-flex items-center gap-2"><Dot color={m.color} />{m.label}</span>
              </th>
              <td className="py-1.5 pr-3">
                {s.status === "running" && <span className="text-muted">läuft …</span>}
                {s.status === "idle" && <span className="text-faint">–</span>}
                {s.status === "done" && (s.run.error ? <span className="text-bad">Fehler</span> : <span className="text-ok">fertig</span>)}
              </td>
              <td className="py-1.5 pr-3 text-right tabular-nums">{s.status === "done" ? `${fmtNum(s.run.latencyMs / 1000, 1)} s` : "–"}</td>
              <td className="py-1.5 text-right tabular-nums">{s.status === "done" ? `${fmtInt(s.run.tokensIn)} / ${fmtInt(s.run.tokensOut)}` : "–"}</td>
              <td className="text-right">
                {s.status === "done" && (
                  <button onClick={() => onInspect(id)} className="icon-btn !size-7" aria-label={`Raw-Payload von ${m.label} öffnen`}>
                    <Code2 aria-hidden className="size-3.5" />
                  </button>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function RuleBlock({ rule, questions, models, states }: { rule: NonNullable<Props["rule"]>; questions: Question[]; models: ModelId[]; states: States }) {
  return (
    <div className="mt-6 border-t border-line pt-5">
      <h3 className="flex items-center gap-2 text-[15px] font-semibold">
        <Scale aria-hidden className="size-4 text-muted" />
        Entscheidung im Code: {rule.label}
      </h3>
      <ul className="mt-3 space-y-1.5">
        {models.map((id) => {
          const m = modelById(id);
          const s = stateOf(states, id);
          let outcome: "yes" | "no" | "unclear" | "pending" | "error" = "pending";
          if (s.status === "done") {
            if (s.run.error) outcome = "error";
            else {
              const vs = questions.map((q) => noulVerdict(answerOf(s, q.id)?.probs[0] ?? 0.5));
              outcome = vs.some((v) => v === "yes") ? "no" : vs.every((v) => v === "no") ? "yes" : "unclear";
            }
          }
          const view = {
            yes: { t: rule.label, c: "text-ok" },
            no: { t: "Behalten", c: "text-ink" },
            unclear: { t: "Manuell prüfen", c: "text-warn" },
            pending: { t: "…", c: "text-faint" },
            error: { t: "Kein Ergebnis", c: "text-bad" },
          }[outcome];
          return (
            <li key={id} className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-muted"><Dot color={m.color} />{m.label}</span>
              <span className={`font-medium ${view.c}`}>{view.t}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-muted">
        {rule.yes}. {rule.no}. Unklare Antworten (0,3 bis 0,7) lösen nie eine Löschung aus.
      </p>
    </div>
  );
}

function ErrorNote({ run }: { run: ModelRun }) {
  const title = run.error?.kind === "timeout" ? "Timeout" : run.error?.kind === "overflow" ? "Kontext zu groß" : "Fehler";
  return (
    <div role="alert" className="hatch flex items-start gap-2.5 border-l-2 border-bad bg-bad-soft px-3 py-2.5 text-bad">
      <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div>
        <p className="font-semibold">{title}: keine Antwort</p>
        <p className="text-xs">{run.error?.message}</p>
        <p className="mt-1 text-xs opacity-80">Fehler werden nie als Antwort angezeigt. Kürze den State oder starte den Lauf erneut.</p>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div aria-hidden className="space-y-2 py-1">
      {[80, 45, 25].map((w) => (
        <div key={w} className="shimmer h-2 rounded-full" style={{ width: `${w}%` }} />
      ))}
    </div>
  );
}

type Row = { id: ModelId; name: string; color: string; s: ModelState; a?: Answer };

function GridRow({ n, label, children, strong }: { n: number; label: string; children: ReactNode; strong?: boolean }) {
  return (
    <div className="grid items-baseline gap-x-3 border-t border-line py-1.5" style={{ gridTemplateColumns: gridTemplate(n) }}>
      <div className={strong ? "font-medium text-ink" : "text-muted"}>{label}</div>
      {children}
    </div>
  );
}

function Cell({ row, children }: { row: Row; children: (a: Answer) => ReactNode }) {
  if (row.s.status === "running") return <span className="text-muted">läuft …</span>;
  if (row.s.status === "done" && row.s.run.error) return <span className="text-bad">Fehler</span>;
  return row.a ? <span className="tabular-nums">{children(row.a)}</span> : <span className="text-faint">–</span>;
}

function QuestionBlock({ q, index, total, models, states }: { q: Question; index: number; total: number; models: ModelId[]; states: States }) {
  const labels = labelsFor(q);
  const rows: Row[] = models.map((id) => {
    const m = modelById(id);
    const s = stateOf(states, id);
    return { id, name: m.label, color: m.color, s, a: answerOf(s, q.id) };
  });
  const n = rows.length;
  const cols: Col[] = rows.map((r) => ({ key: r.id, name: r.name, color: r.color, probs: r.a?.probs ?? null }));
  const loading = rows.some((r) => r.s.status === "running");

  return (
    <article className="mt-6 border-t border-line pt-5" aria-labelledby={`h-${q.id}`}>
      <header className="mb-4">
        <h3 id={`h-${q.id}`} className="text-[15px] font-semibold leading-snug">
          {total > 1 && <span className="mr-2 font-normal text-faint">{index + 1}.</span>}
          {q.text || <span className="text-faint">(ohne Text)</span>}
        </h3>
        <p className="mt-0.5 text-xs text-muted">{TYPE_META[q.type](q)}</p>
      </header>

      {n === 1 ? (
        <SingleBody q={q} labels={labels} row={rows[0]} loading={loading} />
      ) : (
        <div className="space-y-4">
          {q.type === "choice" ? (
            <ChoiceMatrix labels={labels} cols={cols} />
          ) : (
            <div>
              <div className="grid gap-x-3 pb-2" style={{ gridTemplateColumns: gridTemplate(n) }}>
                <span />
                {rows.map((r) => (
                  <span key={r.id} className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-muted">
                    <Dot color={r.color} /><span className="truncate">{r.name}</span>
                  </span>
                ))}
              </div>
              <div className="grid gap-x-3" style={{ gridTemplateColumns: gridTemplate(n) }}>
                <span className="text-muted">{q.type === "noul" ? "P(wahr)" : "Verteilung"}</span>
                {rows.map((r) => (
                  <div key={r.id} className="min-w-0">
                    {r.s.status === "running" ? <Skeleton /> : r.s.status === "done" && r.s.run.error ? <span className="text-bad">Fehler</span> : r.a ? (
                      q.type === "noul" ? <NoulScale pTrue={r.a.probs[0]} color={r.color} /> : <ScoreChart probs={r.a.probs} color={r.color} low={q.scoreLow} high={q.scoreHigh} />
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <GridRow n={n} label="Antwort" strong>
              {rows.map((r) => <div key={r.id} className="min-w-0 truncate font-semibold"><Cell row={r}>{(a) => answerText(q, labels, a)}</Cell></div>)}
            </GridRow>
            <GridRow n={n} label="Confidence">
              {rows.map((r) => <div key={r.id}><Cell row={r}>{(a) => fmtNum(a.metrics.confidence)}</Cell></div>)}
            </GridRow>
            <GridRow n={n} label="Margin">
              {rows.map((r) => <div key={r.id}><Cell row={r}>{(a) => fmtNum(a.metrics.margin)}</Cell></div>)}
            </GridRow>
            <GridRow n={n} label="Urteil">
              {rows.map((r) => <div key={r.id}><Cell row={r}>{(a) => <Verdict light={a.metrics.light} />}</Cell></div>)}
            </GridRow>
          </div>

          <Details n={n} rows={rows} loading={loading} />
        </div>
      )}
    </article>
  );
}

function SingleBody({ q, labels, row, loading }: { q: Question; labels: string[]; row: Row; loading: boolean }) {
  if (loading) return <Skeleton />;
  if (row.s.status === "done" && row.s.run.error) return <ErrorNote run={row.s.run} />;
  const a = row.a;
  if (!a) return null;
  return (
    <div className="space-y-5">
      <dl className="flex flex-wrap gap-x-10 gap-y-3">
        <Stat label="Antwort" big>{answerText(q, labels, a)}</Stat>
        {q.type === "choice" && <Stat label="Wahrscheinlichkeit">{fmtPct(a.metrics.pMax)}</Stat>}
        {q.type === "noul" && <Stat label="P(wahr)">{fmtPct(a.probs[0])}</Stat>}
        {q.type === "score" && <Stat label="Erwartungswert">{fmtNum(a.probs.reduce((s, p, i) => s + (i + 1) * p, 0))}</Stat>}
        <Stat label="Confidence">{fmtNum(a.metrics.confidence)}</Stat>
        <Stat label="Margin">{fmtNum(a.metrics.margin)}</Stat>
        <Stat label="Urteil"><Verdict light={a.metrics.light} /></Stat>
      </dl>

      {q.type === "choice" && <ChoiceMatrix labels={labels} cols={[{ key: row.id, name: row.name, color: row.color, probs: a.probs }]} />}
      {q.type === "noul" && <NoulScale pTrue={a.probs[0]} color={row.color} />}
      {q.type === "score" && <ScoreChart probs={a.probs} color={row.color} low={q.scoreLow} high={q.scoreHigh} />}

      <Details n={1} rows={[row]} loading={false} />
    </div>
  );
}

function Stat({ label, children, big }: { label: string; children: ReactNode; big?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={`tabular-nums ${big ? "text-xl font-semibold leading-tight tracking-tight" : "text-[15px] font-medium leading-tight"}`}>{children}</dd>
    </div>
  );
}

function Details({ n, rows, loading }: { n: number; rows: Row[]; loading: boolean }) {
  if (loading) return null;
  return (
    <details className="group">
      <summary className="flex w-fit cursor-pointer list-none items-center gap-1 text-xs font-medium text-muted hover:text-ink">
        <ChevronRight aria-hidden className="size-3.5 transition-transform group-open:rotate-90" />
        Kennzahlen im Detail
      </summary>
      <div className="mt-2 text-xs">
        <GridRow n={n} label="p_max"><>{rows.map((r) => <div key={r.id}><Cell row={r}>{(a) => fmtNum(a.metrics.pMax, 3)}</Cell></div>)}</></GridRow>
        <GridRow n={n} label="zweiter Platz"><>{rows.map((r) => <div key={r.id}><Cell row={r}>{(a) => fmtNum(a.metrics.p2, 3)}</Cell></div>)}</></GridRow>
        <GridRow n={n} label="Entropie (norm.)"><>{rows.map((r) => <div key={r.id}><Cell row={r}>{(a) => fmtNum(a.metrics.entropy, 3)}</Cell></div>)}</></GridRow>
        <GridRow n={n} label="Optionen K"><>{rows.map((r) => <div key={r.id}><Cell row={r}>{(a) => `${a.metrics.k}`}</Cell></div>)}</></GridRow>
        <GridRow n={n} label="Reihenfolge gemittelt"><>{rows.map((r) => <div key={r.id} className="tabular-nums">{r.s.status === "done" ? (r.s.run.averaged > 1 ? `${r.s.run.averaged}×` : "aus") : "–"}</div>)}</></GridRow>
      </div>
    </details>
  );
}

function SingleMeta({ id, state, onInspect }: { id: ModelId; state: ModelState; onInspect: (m: ModelId) => void }) {
  if (state.status !== "done" || state.run.error) return null;
  return (
    <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-line pt-3 text-xs text-muted">
      <span className="tabular-nums">{fmtNum(state.run.latencyMs / 1000, 1)} s</span>
      <span className="tabular-nums">{fmtInt(state.run.tokensIn)} Tokens ein, {fmtInt(state.run.tokensOut)} aus</span>
      <span className="font-mono text-[11px]">{id}</span>
      <button onClick={() => onInspect(id)} className="ml-auto inline-flex items-center gap-1.5 font-medium text-ink hover:underline">
        <Code2 aria-hidden className="size-3.5" />
        Request und Response ansehen
      </button>
    </div>
  );
}
