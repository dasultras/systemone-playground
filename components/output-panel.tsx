"use client";

import { ChevronRight, Code2, Scale, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { fmtInt } from "@/lib/limits";
import { labelsFor, modelById } from "@/lib/mock-data";
import { expectedScore, fmtNum, fmtPct, noulVerdict } from "@/lib/metrics";
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
      <header className="flex h-11 shrink-0 items-center gap-4 border-b px-6">
        <h2 id="ergebnis-h" className="text-[13px] font-semibold">
          Ergebnis
        </h2>
        <ul className="hidden min-w-0 flex-1 items-center gap-3 text-xs text-muted-foreground sm:flex">
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
        <div className="ml-auto">{toolbar}</div>
      </header>

      <p role="status" className="sr-only">
        {running ? "Läuft …" : anyActive ? `Ergebnis für ${models.length} ${models.length === 1 ? "Modell" : "Modelle"} liegt vor.` : ""}
      </p>

      {!anyActive ? (
        <div className="px-6 py-16">
          <div className="max-w-sm">
            <h3 className="text-[15px] font-semibold">Noch kein Ergebnis</h3>
            <p className="mt-1 text-muted-foreground">Wähle links eine Vorlage oder gib State und Frage ein. Mit ⌘&nbsp;↵ startet der Lauf.</p>
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
    <Table className="mt-4">
      <TableHeader>
        <TableRow>
          <TableHead>Modell</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Latenz</TableHead>
          <TableHead className="text-right">Tokens (ein / aus)</TableHead>
          <TableHead className="w-8">
            <span className="sr-only">Raw</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {models.map((id) => {
          const m = modelById(id);
          const s = stateOf(states, id);
          return (
            <TableRow key={id}>
              <TableCell className="font-medium">
                <span className="inline-flex items-center gap-2">
                  <Dot color={m.color} />
                  {m.label}
                </span>
              </TableCell>
              <TableCell>
                {s.status === "running" && <span className="text-muted-foreground">läuft …</span>}
                {s.status === "idle" && <span className="text-faint">–</span>}
                {s.status === "done" && (s.run.error ? <span className="text-destructive">Fehler</span> : <span className="text-ok">fertig</span>)}
              </TableCell>
              <TableCell className="text-right tabular-nums">{s.status === "done" ? `${fmtNum(s.run.latencyMs / 1000, 1)} s` : "–"}</TableCell>
              <TableCell className="text-right tabular-nums">
                {s.status === "done" ? `${fmtInt(s.run.tokensIn)} / ${fmtInt(s.run.tokensOut)}` : "–"}
              </TableCell>
              <TableCell className="py-0 text-right">
                {s.status === "done" && (
                  <Tooltip>
                    <TooltipTrigger
                      render={<Button variant="ghost" size="icon-sm" onClick={() => onInspect(id)} aria-label={`Raw-Payload von ${m.label} öffnen`} />}
                    >
                      <Code2 aria-hidden />
                    </TooltipTrigger>
                    <TooltipContent>Request und Response</TooltipContent>
                  </Tooltip>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function RuleBlock({ rule, questions, models, states }: { rule: NonNullable<Props["rule"]>; questions: Question[]; models: ModelId[]; states: States }) {
  return (
    <div className="mt-6 border-t pt-5">
      <h3 className="flex items-center gap-2 text-[15px] font-semibold">
        <Scale aria-hidden className="size-4 text-muted-foreground" />
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
            no: { t: "Behalten", c: "text-foreground" },
            unclear: { t: "Manuell prüfen", c: "text-warn" },
            pending: { t: "…", c: "text-faint" },
            error: { t: "Kein Ergebnis", c: "text-destructive" },
          }[outcome];
          return (
            <li key={id} className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                <Dot color={m.color} />
                {m.label}
              </span>
              <span className={`font-medium ${view.c}`}>{view.t}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">
        {rule.yes}. {rule.no}. Unklare Antworten (0,3 bis 0,7) lösen nie eine Löschung aus.
      </p>
    </div>
  );
}

function ErrorNote({ run }: { run: ModelRun }) {
  const title = run.error?.kind === "timeout" ? "Timeout" : run.error?.kind === "overflow" ? "Kontext zu groß" : "Fehler";
  return (
    <Alert variant="destructive" className="border-destructive/40 bg-bad-soft">
      <TriangleAlert aria-hidden />
      <AlertTitle className="text-[13px]">{title}: keine Antwort</AlertTitle>
      <AlertDescription>
        <p>{run.error?.message}</p>
        <p className="opacity-80">Fehler werden nie als Antwort angezeigt. Kürze den State oder starte den Lauf erneut.</p>
      </AlertDescription>
    </Alert>
  );
}

function Loading() {
  return (
    <div aria-hidden className="space-y-2 py-1">
      {[80, 45, 25].map((w) => (
        <Skeleton key={w} className="h-2" style={{ width: `${w}%` }} />
      ))}
    </div>
  );
}

type Row = { id: ModelId; name: string; color: string; s: ModelState; a?: Answer };

function GridRow({ n, label, children, strong }: { n: number; label: string; children: ReactNode; strong?: boolean }) {
  return (
    <div role="row" className="grid items-baseline gap-x-3 border-t py-1.5" style={{ gridTemplateColumns: gridTemplate(n) }}>
      <div role="rowheader" className={strong ? "font-medium" : "text-muted-foreground"}>
        {label}
      </div>
      {children}
    </div>
  );
}

function Cell({ row, children }: { row: Row; children: (a: Answer) => ReactNode }) {
  let content: ReactNode = <span className="text-faint">–</span>;
  if (row.s.status === "running") content = <span className="text-muted-foreground">läuft …</span>;
  else if (row.s.status === "done" && row.s.run.error) content = <span className="text-destructive">Fehler</span>;
  else if (row.a) content = <span className="tabular-nums">{children(row.a)}</span>;
  return (
    <div role="cell" className="min-w-0 truncate">
      {content}
    </div>
  );
}

function StatRows({ q, labels, rows }: { q: Question; labels: string[]; rows: Row[] }) {
  const n = rows.length;
  return (
    <div role="table" aria-label="Kennzahlen je Modell">
      <GridRow n={n} label="Antwort" strong>
        {rows.map((r) => (
          <Cell key={r.id} row={r}>
            {(a) => <span className="font-semibold">{answerText(q, labels, a)}</span>}
          </Cell>
        ))}
      </GridRow>
      <GridRow n={n} label="Confidence">
        {rows.map((r) => (
          <Cell key={r.id} row={r}>
            {(a) => fmtNum(a.metrics.confidence)}
          </Cell>
        ))}
      </GridRow>
      <GridRow n={n} label="Margin">
        {rows.map((r) => (
          <Cell key={r.id} row={r}>
            {(a) => fmtNum(a.metrics.margin)}
          </Cell>
        ))}
      </GridRow>
      <GridRow n={n} label="Urteil">
        {rows.map((r) => (
          <Cell key={r.id} row={r}>
            {(a) => <Verdict light={a.metrics.light} />}
          </Cell>
        ))}
      </GridRow>
    </div>
  );
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
    <article className="mt-6 border-t pt-5" aria-labelledby={`h-${q.id}`}>
      <header className="mb-4">
        <h3 id={`h-${q.id}`} className="text-[15px] font-semibold leading-snug">
          {total > 1 && <span className="mr-2 font-normal text-faint">{index + 1}.</span>}
          {q.text || <span className="text-faint">(ohne Text)</span>}
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{TYPE_META[q.type](q)}</p>
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
                  <span key={r.id} className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Dot color={r.color} />
                    <span className="truncate">{r.name}</span>
                  </span>
                ))}
              </div>
              <div className="grid gap-x-3" style={{ gridTemplateColumns: gridTemplate(n) }}>
                <span className="text-muted-foreground">{q.type === "noul" ? "P(wahr)" : "Verteilung"}</span>
                {rows.map((r) => (
                  <div key={r.id} className="min-w-0">
                    {r.s.status === "running" ? (
                      <Loading />
                    ) : r.s.status === "done" && r.s.run.error ? (
                      <span className="text-destructive">Fehler</span>
                    ) : r.a ? (
                      q.type === "noul" ? (
                        <NoulScale pTrue={r.a.probs[0]} color={r.color} />
                      ) : (
                        <ScoreChart probs={r.a.probs} color={r.color} low={q.scoreLow} high={q.scoreHigh} />
                      )
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          )}
          <StatRows q={q} labels={labels} rows={rows} />
          {!loading && <Details rows={rows} />}
        </div>
      )}
    </article>
  );
}

function SingleBody({ q, labels, row, loading }: { q: Question; labels: string[]; row: Row; loading: boolean }) {
  if (loading) return <Loading />;
  if (row.s.status === "done" && row.s.run.error) return <ErrorNote run={row.s.run} />;
  const a = row.a;
  if (!a) return null;
  return (
    <div className="space-y-5">
      <dl className="flex flex-wrap gap-x-10 gap-y-3">
        <Stat label="Antwort" big>
          {answerText(q, labels, a)}
        </Stat>
        {q.type === "choice" && <Stat label="Wahrscheinlichkeit">{fmtPct(a.metrics.pMax)}</Stat>}
        {q.type === "noul" && <Stat label="P(wahr)">{fmtPct(a.probs[0])}</Stat>}
        {q.type === "score" && <Stat label="Erwartungswert">{fmtNum(expectedScore(a.probs))}</Stat>}
        <Stat label="Confidence">{fmtNum(a.metrics.confidence)}</Stat>
        <Stat label="Margin">{fmtNum(a.metrics.margin)}</Stat>
        <Stat label="Urteil">
          <Verdict light={a.metrics.light} />
        </Stat>
      </dl>

      {q.type === "choice" && <ChoiceMatrix labels={labels} cols={[{ key: row.id, name: row.name, color: row.color, probs: a.probs }]} />}
      {q.type === "noul" && <NoulScale pTrue={a.probs[0]} color={row.color} />}
      {q.type === "score" && <ScoreChart probs={a.probs} color={row.color} low={q.scoreLow} high={q.scoreHigh} />}

      <Details rows={[row]} />
    </div>
  );
}

function Stat({ label, children, big }: { label: string; children: ReactNode; big?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`tabular-nums ${big ? "text-xl font-semibold leading-tight tracking-tight" : "text-[15px] font-medium leading-tight"}`}>{children}</dd>
    </div>
  );
}

function Details({ rows }: { rows: Row[] }) {
  const n = rows.length;
  return (
    <Collapsible>
      <CollapsibleTrigger render={<Button variant="ghost" size="sm" className="group -ml-2 text-muted-foreground" />}>
        <ChevronRight aria-hidden className="transition-transform group-data-[panel-open]:rotate-90" />
        Kennzahlen im Detail
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1 text-xs">
        <div role="table" aria-label="Weitere Kennzahlen">
          <GridRow n={n} label="p_max">
            {rows.map((r) => (
              <Cell key={r.id} row={r}>
                {(a) => fmtNum(a.metrics.pMax, 3)}
              </Cell>
            ))}
          </GridRow>
          <GridRow n={n} label="zweiter Platz">
            {rows.map((r) => (
              <Cell key={r.id} row={r}>
                {(a) => fmtNum(a.metrics.p2, 3)}
              </Cell>
            ))}
          </GridRow>
          <GridRow n={n} label="Entropie (norm.)">
            {rows.map((r) => (
              <Cell key={r.id} row={r}>
                {(a) => fmtNum(a.metrics.entropy, 3)}
              </Cell>
            ))}
          </GridRow>
          <GridRow n={n} label="Optionen K">
            {rows.map((r) => (
              <Cell key={r.id} row={r}>
                {(a) => String(a.metrics.k)}
              </Cell>
            ))}
          </GridRow>
          <GridRow n={n} label="Reihenfolge gemittelt">
            {rows.map((r) => (
              <Cell key={r.id} row={r}>
                {() => (r.s.status === "done" && r.s.run.averaged > 1 ? `${r.s.run.averaged}×` : "aus")}
              </Cell>
            ))}
          </GridRow>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function SingleMeta({ id, state, onInspect }: { id: ModelId; state: ModelState; onInspect: (m: ModelId) => void }) {
  if (state.status !== "done" || state.run.error) return null;
  return (
    <>
      <Separator className="mt-6" />
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 pt-3 text-xs text-muted-foreground">
        <span className="tabular-nums">{fmtNum(state.run.latencyMs / 1000, 1)} s</span>
        <span className="tabular-nums">
          {fmtInt(state.run.tokensIn)} Tokens ein, {fmtInt(state.run.tokensOut)} aus
        </span>
        <span className="font-mono text-[11px]">{id}</span>
        <Button variant="ghost" size="sm" onClick={() => onInspect(id)} className="ml-auto">
          <Code2 aria-hidden />
          Request und Response ansehen
        </Button>
      </div>
    </>
  );
}
