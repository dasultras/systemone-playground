"use client";

import { Loader2, Play, Plus, Trash2, TriangleAlert, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Textarea } from "@/components/ui/textarea";
import { estimateTokens, fmtInt } from "@/lib/limits";
import { MODELS, PRESETS, newQuestion } from "@/lib/mock-data";
import { fullStateText } from "@/lib/mock-run";
import type { Fact, Mode, ModelId, Question, QuestionType } from "@/lib/types";
import { Segmented } from "./segmented";
import { Dot } from "./viz";

export const MAX_OPTIONS = 10;
export const MAX_QUESTIONS = 5;
export const MAX_MODELS = 3;

export type Invalid = { id: string; message: string };

export function validate(state: string, questions: Question[]): Invalid | null {
  if (!state.trim()) return { id: "state", message: "State fehlt. Beschreibe, was das Modell lesen soll." };
  for (const q of questions) {
    if (!q.text.trim()) return { id: `q-${q.id}`, message: "Jede Frage braucht einen Text." };
    if (q.type === "choice" && q.options.filter((o) => o.trim()).length < 2)
      return { id: `q-${q.id}`, message: "Choice braucht mindestens 2 Optionen." };
  }
  return null;
}

type Props = {
  title: string;
  mode: Mode;
  onMode: (m: Mode) => void;
  presetId: string | null;
  onPreset: (id: string) => void;
  state: string;
  onState: (s: string) => void;
  facts: Fact[];
  questions: Question[];
  onQuestions: (q: Question[]) => void;
  models: ModelId[];
  onModels: (m: ModelId[]) => void;
  average: number;
  onAverage: (n: number) => void;
  running: boolean;
  invalid: Invalid | null;
  onRun: () => void;
};

function Section({ title, aside, children, className = "" }: { title: string; aside?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`px-5 py-4 ${className}`}>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="text-[13px] font-semibold">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function InputPanel(p: Props) {
  const fullText = fullStateText(p.state, p.facts);
  const tokens =
    estimateTokens(fullText) + p.questions.reduce((s, q) => s + estimateTokens(q.text + q.options.join(" ")) + 24, 0);
  const hasChoice = p.questions.some((q) => q.type === "choice");
  const hosted = p.models.some((id) => MODELS.find((m) => m.id === id)?.hosted);

  const update = (id: string, patch: Partial<Question>) =>
    p.onQuestions(
      p.questions.map((q) =>
        q.id === id ? { ...q, ...patch, ...(patch.type ? { mockTruth: undefined, mockSecond: undefined } : {}) } : q,
      ),
    );

  const setModel = (id: ModelId, on: boolean) => {
    if (!on && p.models.length > 1) p.onModels(p.models.filter((m) => m !== id));
    if (on && p.models.length < MAX_MODELS && !p.models.includes(id)) p.onModels([...p.models, id]);
  };

  return (
    <section aria-label="Eingabe" className="flex w-full shrink-0 flex-col lg:min-h-0 lg:w-[420px] lg:border-r">
      <header className="flex h-11 shrink-0 items-center gap-2 border-b px-3">
        <SidebarTrigger aria-label="Verlauf ein- oder ausblenden" className="text-muted-foreground" />
        <h1 className="min-w-0 flex-1 truncate text-[13px] font-semibold">{p.title}</h1>
        <Segmented
          label="Modus"
          value={p.mode}
          onChange={p.onMode}
          options={[
            { value: "single", label: "Einzelfrage" },
            { value: "multi", label: "Mehrere Fragen" },
          ]}
        />
      </header>

      <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain">
        <Section title="Vorlage" className="pb-3">
          <div className="-mx-2 flex flex-wrap gap-0.5">
            {PRESETS.filter((x) => x.mode === p.mode).map((x) => (
              <Button
                key={x.id}
                variant="ghost"
                aria-pressed={p.presetId === x.id}
                onClick={() => p.onPreset(x.id)}
                className="text-[13px] font-normal text-muted-foreground aria-pressed:bg-accent aria-pressed:font-medium aria-pressed:text-foreground"
              >
                {x.title}
              </Button>
            ))}
          </div>
        </Section>

        <Separator />

        <section className="px-5 py-4">
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <Label htmlFor="state" className="text-[13px] font-semibold">
              State
            </Label>
            <span className="text-xs tabular-nums text-muted-foreground" title="Schätzung: Zeichen geteilt durch 2,6">
              ≈&nbsp;{fmtInt(tokens)} Tokens
            </span>
          </div>
          <p id="state-hint" className="mb-2 text-xs text-muted-foreground">
            Der Kontext, den das Modell liest.{p.mode === "multi" ? " Er gilt für alle Fragen." : " Nur relevante Felder, kürzen statt vergrößern."}
          </p>
          <Textarea
            id="state"
            name="state"
            value={p.state}
            onChange={(e) => p.onState(e.target.value)}
            rows={7}
            spellCheck={false}
            autoComplete="off"
            aria-describedby="state-hint"
            aria-invalid={p.invalid?.id === "state" || undefined}
            placeholder="z. B. Hostname, OS, installierte Programme …"
            className="min-h-32 resize-y font-mono text-xs leading-relaxed md:text-xs"
          />
          {p.facts.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1">
              <span className="sr-only">Vom Code berechnete Fakten:</span>
              {p.facts.map((f) => (
                <Badge key={f.key} variant="outline" className="h-auto rounded-sm py-0.5 font-mono text-[11px] font-normal text-muted-foreground">
                  {f.key} <span className="font-sans font-semibold tabular-nums text-foreground">{f.value}</span>
                </Badge>
              ))}
              <span className="ml-1 text-xs text-faint">vom Code berechnet</span>
            </div>
          )}
        </section>

        <Separator />

        <Section title={p.mode === "multi" ? "Fragen" : "Frage"}>
          <div className="space-y-5">
            {p.questions.map((q, i) => (
              <QuestionEditor
                key={q.id}
                q={q}
                index={i}
                multi={p.mode === "multi"}
                invalid={p.invalid?.id === `q-${q.id}`}
                onChange={(patch) => update(q.id, patch)}
                onRemove={p.questions.length > 1 ? () => p.onQuestions(p.questions.filter((x) => x.id !== q.id)) : undefined}
              />
            ))}
          </div>
          {p.mode === "multi" && (
            <div className="mt-3 flex items-center justify-between">
              <Button variant="outline" onClick={() => p.onQuestions([...p.questions, newQuestion("noul")])} disabled={p.questions.length >= MAX_QUESTIONS}>
                <Plus aria-hidden /> Frage hinzufügen
              </Button>
              <span className="text-xs tabular-nums text-muted-foreground">
                {p.questions.length} von {MAX_QUESTIONS}
              </span>
            </div>
          )}
        </Section>

        <Separator />

        <Section title="Modelle" aside={<span className="text-xs text-muted-foreground">bis zu {MAX_MODELS} zum Vergleich</span>}>
          <ul className="-mx-2" aria-label="Modelle">
            {MODELS.map((m) => {
              const on = p.models.includes(m.id);
              const locked = (!on && p.models.length >= MAX_MODELS) || (on && p.models.length === 1);
              const over = tokens > m.contextTokens;
              const id = `model-${m.id}`;
              return (
                <li key={m.id}>
                  <Label
                    htmlFor={id}
                    className={`flex min-h-10 items-center gap-2.5 rounded-md px-2 py-1 font-normal ${locked ? "opacity-60" : "cursor-pointer hover:bg-muted"}`}
                  >
                    <Checkbox id={id} checked={on} disabled={locked} onCheckedChange={(v) => setModel(m.id, v === true)} />
                    <Dot color={m.color} />
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block truncate text-[13px] font-medium">{m.label}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {m.backend === "typesafe" ? "TypeSafe, gehostet" : "Ollama, lokal"} · {m.size}
                      </span>
                    </span>
                    <span className={`text-xs tabular-nums ${over ? "font-medium text-destructive" : "text-muted-foreground"}`}>
                      {fmtInt(tokens)} / {fmtInt(m.contextTokens)}
                      {over && <span className="sr-only"> überschreitet das Limit</span>}
                    </span>
                  </Label>
                </li>
              );
            })}
          </ul>
          {hosted && (
            <Alert className="mt-2 border-warn/40 bg-warn-soft text-warn">
              <TriangleAlert aria-hidden />
              <AlertDescription className="text-warn">TypeSafe hostet in den USA. Nur synthetische Daten senden, keine echten Inventurdaten.</AlertDescription>
            </Alert>
          )}
        </Section>

        <Separator />

        <section className={`flex items-center justify-between gap-3 px-5 py-4 ${hasChoice ? "" : "opacity-55"}`}>
          <div>
            <h2 className="text-[13px] font-semibold">Reihenfolge mitteln</h2>
            <p className="text-xs text-muted-foreground">Verschiebt Optionen zyklisch, gegen Positions-Bias. Nur Choice.</p>
          </div>
          <Segmented
            label="Reihenfolge mitteln"
            value={String(p.average)}
            onChange={(v) => p.onAverage(Number(v))}
            options={["1", "2", "3", "4"].map((v) => ({ value: v, label: v === "1" ? "Aus" : `${v}×` }))}
          />
        </section>
      </div>

      <footer className="sticky bottom-0 border-t bg-background px-5 py-3">
        <Button size="lg" onClick={p.onRun} disabled={p.running} className="h-9 w-full text-[13px]">
          {p.running ? <Loader2 aria-hidden className="animate-spin" /> : <Play aria-hidden className="fill-current" />}
          {p.running ? "Läuft …" : p.models.length > 1 ? `Auf ${p.models.length} Modellen ausführen` : "Ausführen"}
        </Button>
        {p.invalid ? (
          <p role="alert" className="mt-1.5 text-xs text-destructive">
            {p.invalid.message}
          </p>
        ) : (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <KbdGroup>
              <Kbd>⌘</Kbd>
              <Kbd>↵</Kbd>
            </KbdGroup>
            führt aus. Mock: keine echten Modellaufrufe.
          </p>
        )}
      </footer>
    </section>
  );
}

function QuestionEditor({
  q,
  index,
  multi,
  invalid,
  onChange,
  onRemove,
}: {
  q: Question;
  index: number;
  multi: boolean;
  invalid: boolean;
  onChange: (patch: Partial<Question>) => void;
  onRemove?: () => void;
}) {
  const setType = (type: QuestionType) =>
    onChange({ type, options: type === "choice" && q.options.length < 2 ? ["", "", ""] : q.options });
  const setOption = (i: number, v: string) => onChange({ options: q.options.map((o, j) => (j === i ? v : o)) });
  const id = `q-${q.id}`;

  return (
    <div className={multi ? "border-l-2 pl-3" : ""}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <Label htmlFor={id} className="text-xs text-muted-foreground">
          {multi ? `Frage ${index + 1}` : "Fragetext"}
        </Label>
        {onRemove && (
          <Button variant="ghost" size="sm" onClick={onRemove} className="text-muted-foreground hover:text-destructive">
            <Trash2 aria-hidden /> Entfernen<span className="sr-only">: Frage {index + 1}</span>
          </Button>
        )}
      </div>
      <Input
        id={id}
        name={id}
        value={q.text}
        onChange={(e) => onChange({ text: e.target.value })}
        placeholder="z. B. Wird die DLL von einem Prozess geladen?"
        autoComplete="off"
        aria-invalid={invalid || undefined}
        className="h-8 text-[13px] md:text-[13px]"
      />
      {!multi && <p className="mt-1 text-xs text-muted-foreground">Atomar fragen, die Entscheidung trifft der Code.</p>}

      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">Antworttyp</span>
        <Segmented
          label={`Antworttyp Frage ${index + 1}`}
          value={q.type}
          onChange={setType}
          options={[
            { value: "choice", label: "Choice" },
            { value: "noul", label: "Noul" },
            { value: "score", label: "Score" },
          ]}
        />
      </div>

      <div className="mt-3">
        {q.type === "choice" && (
          <>
            <p className="mb-1.5 text-xs text-muted-foreground">Das Modell verteilt Wahrscheinlichkeit auf 2 bis {MAX_OPTIONS} Optionen.</p>
            <ul className="space-y-1">
              {q.options.map((o, i) => (
                <li key={i} className="group relative">
                  <Input
                    value={o}
                    onChange={(e) => setOption(i, e.target.value)}
                    placeholder={`Option ${i + 1}`}
                    aria-label={`Option ${i + 1}`}
                    autoComplete="off"
                    className="pr-8"
                  />
                  {q.options.length > 2 && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => onChange({ options: q.options.filter((_, j) => j !== i) })}
                      aria-label={`Option ${i + 1} entfernen`}
                      className="absolute right-1 top-1 text-muted-foreground opacity-0 hover:text-destructive focus-visible:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100"
                    >
                      <X aria-hidden />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            <div className="mt-1.5 flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => onChange({ options: [...q.options, ""] })} disabled={q.options.length >= MAX_OPTIONS}>
                <Plus aria-hidden /> Option
              </Button>
              <span className="text-xs tabular-nums text-muted-foreground">
                {q.options.length} von {MAX_OPTIONS}
              </span>
            </div>
          </>
        )}
        {q.type === "noul" && <p className="text-xs text-muted-foreground">Das Modell liefert P(wahr). Zwischen 0,3 und 0,7 gilt die Antwort als unklar.</p>}
        {q.type === "score" && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Verteilung über 2 bis 10 Level, angezeigt mit Modus und Erwartungswert.</p>
            <div className="flex items-center gap-2">
              <Label htmlFor={`${id}-levels`} className="text-xs font-normal text-muted-foreground">
                Level
              </Label>
              <Input
                id={`${id}-levels`}
                type="number"
                inputMode="numeric"
                min={2}
                max={10}
                value={q.levels}
                onChange={(e) => onChange({ levels: Math.min(10, Math.max(2, Number(e.target.value) || 2)) })}
                className="w-14 text-center tabular-nums"
              />
              <Input value={q.scoreLow} onChange={(e) => onChange({ scoreLow: e.target.value })} aria-label="Bezeichnung Level 1" autoComplete="off" />
              <span aria-hidden className="text-faint">
                bis
              </span>
              <Input value={q.scoreHigh} onChange={(e) => onChange({ scoreHigh: e.target.value })} aria-label="Bezeichnung höchstes Level" autoComplete="off" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
