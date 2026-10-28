"use client";

import { AlertTriangle, ChevronRight, Clock, Code2, Scale } from "lucide-react";
import { fmtInt } from "@/lib/limits";
import { labelsFor, modelById } from "@/lib/mock-data";
import { fmtNum, fmtPct, noulVerdict } from "@/lib/metrics";
import type { Answer, ModelId, ModelRun, ModelState, Preset, Question } from "@/lib/types";
import { Ampel, ChoiceBars, ChoiceCompare, MetricRow, NoulGauge, ScoreHistogram } from "./viz";

type Props = {
  questions: Question[];
  models: ModelId[];
  states: Record<string, ModelState | undefined>;
  rule?: Preset["rule"];
  onInspect: (m: ModelId) => void;
};

const stateOf = (states: Props["states"], id: ModelId): ModelState => states[id] ?? { status: "idle" };
const answerOf = (s: ModelState, qid: string): Answer | undefined =>
  s.status === "done" ? s.run.answers.find((a) => a.questionId === qid) : undefined;

export function OutputPanel({ questions, models, states, rule, onInspect }: Props) {
  const anyActive = models.some((m) => stateOf(states, m).status !== "idle");
  const only = models.length === 1 ? stateOf(states, models[0]) : null;
  const singleError = only?.status === "done" && only.run.error ? only.run : null;

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col rounded-2xl border border-line bg-sunken/60">
      <header className="flex items-center justify-between gap-3 px-5 pt-4">
        <span className="eyebrow">Ausgabe</span>
        <div className="flex flex-wrap justify-end gap-1.5">
          {models.map((id) => {
            const m = modelById(id);
            return (
              <span key={id} className="inline-flex items-center gap-1.5 rounded-md border border-line bg-panel px-2 py-0.5 font-mono text-[11px] text-muted">
                <span className="size-1.5 rounded-full" style={{ background: m.color }} />
                {m.label}
              </span>
            );
          })}
        </div>
      </header>

      {!anyActive ? (
        <EmptyState />
      ) : (
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          {models.length > 1 && <RunTable models={models} states={states} onInspect={onInspect} />}
          {singleError ? (
            <ErrorNote run={singleError} />
          ) : (
            <>
              {rule && <RuleCard rule={rule} questions={questions} models={models} states={states} />}
              {questions.map((q, i) => (
                <QuestionBlock key={q.id} index={i} total={questions.length} q={q} models={models} states={states} onInspect={onInspect} />
              ))}
            </>
          )}
          {models.length === 1 && <SingleRunMeta id={models[0]} state={stateOf(states, models[0])} onInspect={onInspect} />}
        </div>
      )}
    </section>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="font-mono text-3xl text-faint">[ · ]</div>
      <p className="text-base font-medium">Die Entscheidung erscheint hier.</p>
      <p className="max-w-xs text-sm text-muted">Gib ein State und eine typisierte Frage ein, dann lies Verteilung, confidence und Margin ab.</p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2 font-mono text-[11px] text-muted">
        <span className="rounded-md border border-line bg-panel px-2 py-1">State + Frage</span>→
        <span className="rounded-md border border-line bg-panel px-2 py-1">Modell(e)</span>→
        <span className="rounded-md border border-line bg-panel px-2 py-1">Antwort + Wahrscheinlichkeit</span>
      </div>
    </div>
  );
}

function RunTable({ models, states, onInspect }: Pick<Props, "models" | "states" | "onInspect">) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-panel">
      <table className="w-full text-left text-xs">
        <thead className="text-muted">
          <tr className="border-b border-line">
            <th className="px-3 py-2 font-medium">Modell</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 text-right font-medium">Latenz</th>
            <th className="px-3 py-2 text-right font-medium">Tokens ein/aus</th>
            <th className="w-8" />
          </tr>
        </thead>
        <tbody>
          {models.map((id) => {
            const m = modelById(id);
            const s = stateOf(states, id);
            return (
              <tr key={id} className="border-b border-line last:border-0">
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-2 font-medium">
                    <span className="size-2 rounded-full" style={{ background: m.color }} />
                    {m.label}
                  </span>
                </td>
                <td className="px-3 py-2">
                  {s.status === "running" && <span className="text-muted">läuft …</span>}
                  {s.status === "idle" && <span className="text-faint">—</span>}
                  {s.status === "done" && (s.run.error ? <span className="text-bad">Fehler</span> : <span className="text-ok">fertig</span>)}
                </td>
                <td className="px-3 py-2 text-right font-mono">{s.status === "done" ? `${fmtNum(s.run.latencyMs / 1000, 1)} s` : "—"}</td>
                <td className="px-3 py-2 text-right font-mono">{s.status === "done" ? `${fmtInt(s.run.tokensIn)} / ${fmtInt(s.run.tokensOut)}` : "—"}</td>
                <td className="px-2">
                  {s.status === "done" && (
                    <button onClick={() => onInspect(id)} className="btn-ghost !p-1" title="Raw-Payload">
                      <Code2 className="size-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RuleCard({ rule, questions, models, states }: { rule: NonNullable<Props["rule"]>; questions: Question[]; models: ModelId[]; states: Props["states"] }) {
  return (
    <div className="rounded-xl border border-line bg-panel p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium">
        <Scale className="size-4 text-accent" />
        Entscheidung im Code: {rule.label}
      </div>
      <div className="space-y-2">
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
            yes: { t: rule.label, c: "bg-ok-soft text-ok" },
            no: { t: "Behalten", c: "bg-sunken text-ink" },
            unclear: { t: "Manuell prüfen", c: "bg-warn-soft text-warn" },
            pending: { t: "…", c: "bg-sunken text-faint" },
            error: { t: "Kein Ergebnis", c: "bg-bad-soft text-bad" },
          }[outcome];
          return (
            <div key={id} className="flex items-center justify-between gap-3 text-sm">
              <span className="inline-flex items-center gap-2 text-muted">
                <span className="size-2 rounded-full" style={{ background: m.color }} />
                {m.label}
              </span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${view.c}`}>{view.t}</span>
            </div>
          );
        })}
      </div>
      <p className="mt-3 border-t border-line pt-3 text-xs text-muted">{rule.yes}. {rule.no}. Unklare Antworten (0,3–0,7) führen nie zu einer Löschung.</p>
    </div>
  );
}

function ErrorNote({ run }: { run: ModelRun }) {
  return (
    <div className="hatch flex items-start gap-2.5 rounded-lg border border-bad/30 bg-bad-soft px-3 py-2.5 text-sm text-bad">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <div>
        <div className="font-medium">{run.error?.kind === "timeout" ? "Timeout" : run.error?.kind === "overflow" ? "Kontext-Overflow" : "Fehler"}: keine Antwort</div>
        <div className="text-xs opacity-90">{run.error?.message}</div>
        <div className="mt-1 text-xs opacity-75">Fehler werden nie als Antwort dargestellt.</div>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-2.5 py-1">
      {[70, 40, 25].map((w) => (
        <div key={w} className="shimmer h-2 rounded-full" style={{ width: `${w}%` }} />
      ))}
    </div>
  );
}

function QuestionBlock({
  q,
  index,
  total,
  models,
  states,
  onInspect,
}: {
  q: Question;
  index: number;
  total: number;
  models: ModelId[];
  states: Props["states"];
  onInspect: (m: ModelId) => void;
}) {
  const labels = labelsFor(q);
  const compare = models.length > 1;
  const typeLabel = { choice: "Choice", noul: "Noul", score: "Score" }[q.type];

  return (
    <article className="rounded-xl border border-line bg-panel p-4 shadow-card">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          {total > 1 && <div className="eyebrow mb-1">Frage {index + 1}</div>}
          <h3 className="text-[15px] font-medium leading-snug">{q.text || <span className="text-faint">(ohne Text)</span>}</h3>
        </div>
        <span className="eyebrow shrink-0 rounded-md bg-sunken px-1.5 py-0.5">{typeLabel}</span>
      </div>

      {!compare ? (
        <SingleView q={q} labels={labels} id={models[0]} state={stateOf(states, models[0])} onInspect={onInspect} />
      ) : (
        <CompareView q={q} labels={labels} models={models} states={states} />
      )}
    </article>
  );
}

function SingleView({ q, labels, id, state, onInspect }: { q: Question; labels: string[]; id: ModelId; state: ModelState; onInspect: (m: ModelId) => void }) {
  const m = modelById(id);
  if (state.status === "running") return <Skeleton />;
  if (state.status === "idle") return null;
  if (state.run.error) return <ErrorNote run={state.run} />;
  const a = answerOf(state, q.id);
  if (!a) return null;
  const top = labels[a.metrics.topIndex];
  return (
    <div className="space-y-4">
      {q.type === "choice" && (
        <>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-xl font-semibold tracking-tight">{top}</span>
            <span className="font-mono text-sm text-muted">{fmtPct(a.metrics.pMax)}</span>
          </div>
          <ChoiceBars labels={labels} probs={a.probs} color={m.color} />
        </>
      )}
      {q.type === "noul" && <NoulGauge pTrue={a.probs[0]} color={m.color} />}
      {q.type === "score" && <ScoreHistogram probs={a.probs} low={q.scoreLow} high={q.scoreHigh} color={m.color} />}

      <MetricRow m={a.metrics} />

      <details className="group rounded-lg bg-sunken/70 text-xs">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-muted">
          <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" />
          Details
        </summary>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 px-3 pb-3 pt-1 sm:grid-cols-3">
          <Detail k="p_max" v={fmtNum(a.metrics.pMax, 3)} />
          <Detail k="2. Platz" v={fmtNum(a.metrics.p2, 3)} />
          <Detail k="Entropie (norm.)" v={fmtNum(a.metrics.entropy, 3)} />
          <Detail k="K / 1/K" v={`${a.metrics.k} / ${fmtNum(1 / a.metrics.k, 3)}`} />
          <Detail k="Modell-ID" v={id} />
          {state.run.averaged > 1 && <Detail k="Reihenfolge gemittelt" v={`${state.run.averaged} Verschiebungen`} />}
        </dl>
        <div className="border-t border-line px-3 py-2">
          <button onClick={() => onInspect(id)} className="inline-flex items-center gap-1.5 font-medium text-accent-ink hover:underline">
            <Code2 className="size-3.5" /> Raw-Request/Response ansehen
          </button>
        </div>
      </details>
    </div>
  );
}

function Detail({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-faint">{k}</dt>
      <dd className="truncate font-mono text-ink" title={v}>{v}</dd>
    </div>
  );
}

function CompareView({ q, labels, models, states }: { q: Question; labels: string[]; models: ModelId[]; states: Props["states"] }) {
  const rows = models.map((id) => {
    const m = modelById(id);
    const s = stateOf(states, id);
    return { id, m, s, a: answerOf(s, q.id) };
  });

  return (
    <div className="space-y-4">
      {q.type === "choice" && (
        <ChoiceCompare
          labels={labels}
          cols={rows.map((r) => ({ key: r.id, name: r.m.label, color: r.m.color, probs: r.a?.probs ?? null }))}
        />
      )}

      {q.type !== "choice" &&
        rows.map((r) => (
          <div key={r.id} className="rounded-lg bg-sunken/60 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted">
              <span className="size-2 rounded-full" style={{ background: r.m.color }} />
              {r.m.label}
            </div>
            {r.s.status === "running" ? (
              <Skeleton />
            ) : r.s.status === "done" && r.s.run.error ? (
              <p className="text-xs text-bad">Fehler: {r.s.run.error.message}</p>
            ) : r.a && q.type === "noul" ? (
              <NoulGauge pTrue={r.a.probs[0]} color={r.m.color} />
            ) : r.a ? (
              <ScoreHistogram probs={r.a.probs} low={q.scoreLow} high={q.scoreHigh} color={r.m.color} compact />
            ) : null}
          </div>
        ))}

      <div className="space-y-1.5 border-t border-line pt-3">
        {rows.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="inline-flex w-28 shrink-0 items-center gap-2 font-medium">
              <span className="size-2 rounded-full" style={{ background: r.m.color }} />
              <span className="truncate">{r.m.label}</span>
            </span>
            {r.s.status === "running" && <span className="text-muted">läuft …</span>}
            {r.s.status === "done" && r.s.run.error && <span className="text-bad">Fehler – {r.s.run.error.kind}</span>}
            {r.a && (
              <>
                <span className="font-medium text-ink">{q.type === "choice" ? labels[r.a.metrics.topIndex] : q.type === "noul" ? { yes: "Ja", no: "Nein", unclear: "Unklar" }[noulVerdict(r.a.probs[0])] : `Level ${r.a.metrics.topIndex + 1}`}</span>
                <Ampel light={r.a.metrics.light} />
                <span className="text-muted">
                  conf <b className="font-mono font-medium text-ink">{fmtNum(r.a.metrics.confidence)}</b> · Margin <b className="font-mono font-medium text-ink">{fmtNum(r.a.metrics.margin)}</b>
                </span>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SingleRunMeta({ id, state, onInspect }: { id: ModelId; state: ModelState; onInspect: (m: ModelId) => void }) {
  if (state.status !== "done") return null;
  const m = modelById(id);
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-1 text-xs text-muted">
      <span className="inline-flex items-center gap-1.5"><Clock className="size-3.5" />{fmtNum(state.run.latencyMs / 1000, 1)} s</span>
      <span>{fmtInt(state.run.tokensIn)} Tokens ein · {fmtInt(state.run.tokensOut)} aus</span>
      <span className="font-mono">{m.id}</span>
      <button onClick={() => onInspect(id)} className="ml-auto inline-flex items-center gap-1.5 hover:text-ink"><Code2 className="size-3.5" />Raw</button>
    </div>
  );
}
