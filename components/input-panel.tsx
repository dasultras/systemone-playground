"use client";

import { LayoutTemplate, Loader2, Play, Plus, Trash2, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { fmtInt, requestTokens } from "@/lib/limits";
import { modelMeta } from "@/lib/models";
import { newQuestion } from "@/lib/questions";
import type { Fact, Mode, ModelId, ModelsResponse, Preset, Question, QuestionType } from "@/lib/types";
import { Group, GroupRow } from "./group";
import { ModelPicker } from "./model-picker";
import { OptionsEditor } from "./options-editor";
import { Segmented } from "./segmented";

export const MAX_OPTIONS = 10;
export const MAX_QUESTIONS = 5;

export type Invalid = { id: string; message: string };

/** Felder ohne eigenen Rahmen; die Gruppe zeigt Fokus und Fehler. */
const BARE =
  "rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0 aria-invalid:ring-0 dark:bg-transparent";
const FOCUS_CARD =
  "focus-within:border-ring/70 focus-within:ring-2 focus-within:ring-ring/20 has-aria-invalid:border-destructive has-aria-invalid:ring-2 has-aria-invalid:ring-destructive/20";

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
  /** Wunschbreite ab lg; CSS hält sie zwischen 320 px und „Rest minus 420 px“. */
  width: number;
  title: string;
  onTitle: (t: string) => void;
  presets: Preset[];
  onPreset: (id: string) => void;
  mode: Mode;
  onMode: (m: Mode) => void;
  state: string;
  onState: (s: string) => void;
  facts: Fact[];
  questions: Question[];
  onQuestions: (q: Question[]) => void;
  /** Verfügbare Modelle aus `/api/models`; `null`, solange sie laden. */
  catalog: ModelsResponse | null;
  onRefreshModels: () => Promise<void>;
  models: ModelId[];
  onModels: (m: ModelId[]) => void;
  average: number;
  onAverage: (n: number) => void;
  running: boolean;
  invalid: Invalid | null;
  onRun: () => void;
};

export function InputPanel(p: Props) {
  const tokens = requestTokens(p.state, p.facts, p.questions);
  const hasChoice = p.questions.some((q) => q.type === "choice");
  const hosted = p.models.some((id) => modelMeta(id).hosted);
  // Nur mit mindestens einem verfügbaren Modell; sonst scheitert jeder Lauf mit „Modell nicht verfügbar“.
  const ready = p.models.some((id) => p.catalog?.models.some((m) => m.id === id));

  const update = (id: string, patch: Partial<Question>) =>
    p.onQuestions(p.questions.map((q) => (q.id === id ? { ...q, ...patch } : q)));

  return (
    <section
      aria-label="Eingabe"
      style={{ "--input-w": `${p.width}px` } as React.CSSProperties}
      className="flex w-full shrink-0 flex-col bg-canvas lg:min-h-0 lg:w-[clamp(320px,var(--input-w),calc(100%_-_420px))] lg:border-r"
    >
      <header className="flex h-11 shrink-0 items-center gap-2 border-b bg-background px-3">
        <SidebarTrigger aria-label="Verlauf ein- oder ausblenden" className="text-muted-foreground" />
        <Input
          aria-label="Titel des Laufs"
          placeholder="Neuer Lauf"
          maxLength={80}
          autoComplete="off"
          value={p.title}
          onChange={(e) => p.onTitle(e.target.value)}
          className={`${BARE} h-7 min-w-0 flex-1 truncate rounded-md px-1 text-[13px] font-semibold hover:bg-muted/60 focus-visible:bg-muted/60 md:text-[13px] dark:hover:bg-muted/60 dark:focus-visible:bg-muted/60`}
        />
        {p.presets.length >= 2 && <PresetMenu presets={p.presets} onPreset={p.onPreset} />}
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

      <div className="relative space-y-5 px-4 py-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain">
        <Group
          title="State"
          titleFor="state"
          aside={
            <span className="text-xs text-muted-foreground tabular-nums" title="Schätzung: Zeichen geteilt durch 2,6">
              ≈&nbsp;{fmtInt(tokens)} Tokens
            </span>
          }
          hintId="state-hint"
          hint={
            p.mode === "multi"
              ? "Der Kontext, den das Modell liest. Er gilt für alle Fragen."
              : "Der Kontext, den das Modell liest. Nur relevante Felder, kürzen statt vergrößern."
          }
          bodyClassName={`divide-y ${FOCUS_CARD}`}
        >
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
            placeholder="z. B. eine Nachricht, ein Datensatz oder ein Textauszug …"
            className={`${BARE} min-h-32 resize-y px-3 py-2.5 font-mono text-[11.5px] leading-relaxed md:text-[11.5px]`}
          />
          {p.facts.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 bg-strip px-3 py-2">
              <span className="mr-1 text-xs text-faint">Vom Code berechnet</span>
              {p.facts.map((f) => (
                <Badge
                  key={f.key}
                  variant="outline"
                  className="h-auto rounded-sm bg-card py-0.5 font-mono text-[11px] font-normal text-muted-foreground"
                >
                  {f.key} <span className="font-sans font-semibold text-foreground tabular-nums">{f.value}</span>
                </Badge>
              ))}
            </div>
          )}
        </Group>

        {p.questions.map((q, i) => (
          <QuestionEditor
            key={q.id}
            q={q}
            index={i}
            multi={p.mode === "multi"}
            invalid={p.invalid?.id === `q-${q.id}`}
            onChange={(patch) => update(q.id, patch)}
            onRemove={
              p.questions.length > 1 ? () => p.onQuestions(p.questions.filter((x) => x.id !== q.id)) : undefined
            }
          />
        ))}
        {p.mode === "multi" && (
          <div className="-mt-2 flex items-center justify-between px-1">
            <Button
              variant="outline"
              onClick={() => p.onQuestions([...p.questions, newQuestion("noul")])}
              disabled={p.questions.length >= MAX_QUESTIONS}
              className="bg-card"
            >
              <Plus aria-hidden /> Frage hinzufügen
            </Button>
            <span className="text-xs text-muted-foreground tabular-nums">
              {p.questions.length} von {MAX_QUESTIONS}
            </span>
          </div>
        )}

        <div>
          <ModelPicker
            catalog={p.catalog}
            selected={p.models}
            onSelected={p.onModels}
            tokens={tokens}
            onRefresh={p.onRefreshModels}
          />
          {hosted && (
            <Alert className="mt-2 border-warn/40 bg-warn-soft text-warn">
              <TriangleAlert aria-hidden />
              <AlertDescription className="text-warn">
                TypeSafe hostet in den USA. Nur synthetische Daten senden, keine echten oder personenbezogenen Daten.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <Group
          title="Reihenfolge mitteln"
          hint={
            hasChoice
              ? "Verschiebt die Optionen zyklisch im selben Request, gegen Positions-Bias."
              : "Wirkt nur bei Choice-Fragen."
          }
          className={hasChoice ? "" : "opacity-55"}
        >
          <GroupRow label="Verschiebungen">
            <Segmented
              label="Reihenfolge mitteln"
              value={String(p.average)}
              onChange={(v) => p.onAverage(Number(v))}
              options={["1", "2", "3", "4"].map((v) => ({ value: v, label: v === "1" ? "Aus" : `${v}×` }))}
            />
          </GroupRow>
        </Group>
      </div>

      <footer className="sticky bottom-0 border-t bg-background px-4 py-3">
        <Button size="lg" onClick={p.onRun} disabled={p.running || !ready} className="h-9 w-full text-[13px]">
          {p.running ? <Loader2 aria-hidden className="animate-spin" /> : <Play aria-hidden className="fill-current" />}
          {p.running ? "Läuft …" : p.models.length > 1 ? `Auf ${p.models.length} Modellen ausführen` : "Ausführen"}
        </Button>
        {p.invalid ? (
          <p role="alert" className="mt-1.5 text-xs text-destructive">
            {p.invalid.message}
          </p>
        ) : p.catalog && p.models.length > 0 && !ready ? (
          <p className="mt-1.5 text-xs text-muted-foreground">Kein ausgewähltes Modell verfügbar.</p>
        ) : (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground pointer-coarse:hidden">
            <KbdGroup>
              <Kbd>⌘</Kbd>
              <Kbd>↵</Kbd>
            </KbdGroup>
            führt aus.
          </p>
        )}
      </footer>
    </section>
  );
}

const TYPE_LABEL: Record<QuestionType, string> = { choice: "Choice", noul: "Noul", score: "Score" };

/** Kompaktes Menü statt Leiste: Vorlagen sind Startpunkte, die eigene Eingabe steht im Vordergrund. */
function PresetMenu({ presets, onPreset }: { presets: Preset[]; onPreset: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Vorlage laden"
                  className="text-muted-foreground data-popup-open:bg-accent"
                />
              }
            />
          }
        >
          <LayoutTemplate aria-hidden />
        </TooltipTrigger>
        <TooltipContent>Vorlage laden</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="w-64 gap-0 p-1">
        <p className="px-2 pt-1 pb-1.5 text-xs text-faint">Vorlage laden</p>
        {presets.map((x) => (
          <Button
            key={x.id}
            variant="ghost"
            onClick={() => {
              onPreset(x.id);
              setOpen(false);
            }}
            className="h-auto w-full flex-col items-start justify-start gap-0 py-1.5 text-left"
          >
            <span className="w-full truncate text-[13px] font-medium">{x.title}</span>
            <span className="text-xs font-normal text-muted-foreground">
              {x.mode === "multi" ? `${x.questions.length} Fragen` : TYPE_LABEL[x.questions[0].type]}
            </span>
          </Button>
        ))}
      </PopoverContent>
    </Popover>
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
  const id = `q-${q.id}`;

  const TYPE_HINT = {
    choice: `Das Modell verteilt Wahrscheinlichkeit auf 2 bis ${MAX_OPTIONS} Optionen, eine pro Zeile. Listen lassen sich direkt einfügen.`,
    noul: "Das Modell liefert P(wahr). Zwischen 0,3 und 0,7 gilt die Antwort als unklar.",
    score: "Verteilung über 2 bis 10 Level, angezeigt mit Modus und Erwartungswert.",
  };

  return (
    <Group
      title={multi ? `Frage ${index + 1}` : "Frage"}
      titleFor={id}
      aside={
        onRemove && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="-my-1 -mr-1 text-muted-foreground hover:text-destructive"
          >
            <Trash2 aria-hidden /> Entfernen<span className="sr-only">: Frage {index + 1}</span>
          </Button>
        )
      }
      hint={multi ? undefined : `Atomar fragen, die Entscheidung trifft der Code. ${TYPE_HINT[q.type]}`}
      bodyClassName={`divide-y ${FOCUS_CARD}`}
    >
      <Input
        id={id}
        name={id}
        value={q.text}
        onChange={(e) => onChange({ text: e.target.value })}
        placeholder="z. B. Erwähnt der Text eine Frist?"
        autoComplete="off"
        aria-invalid={invalid || undefined}
        className={`${BARE} h-10 px-3 text-[13px] font-medium md:text-[13px]`}
      />

      <GroupRow label="Antworttyp">
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
      </GroupRow>

      {q.type === "choice" && (
        <>
          <OptionsEditor
            id={`${id}-options`}
            options={q.options}
            onChange={(options) => onChange({ options })}
            min={2}
            max={MAX_OPTIONS}
          />
          <div className="flex items-center justify-between px-1.5 py-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onChange({ options: [...q.options, ""] })}
              disabled={q.options.length >= MAX_OPTIONS}
            >
              <Plus aria-hidden /> Option
            </Button>
            <span className="pr-1.5 text-xs text-muted-foreground tabular-nums">
              {q.options.length} von {MAX_OPTIONS}
            </span>
          </div>
        </>
      )}

      {q.type === "score" && (
        <div className="flex items-center gap-2 px-3 py-2">
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
            className="w-14 shrink-0 text-center tabular-nums"
          />
          <Input
            value={q.scoreLow}
            onChange={(e) => onChange({ scoreLow: e.target.value })}
            aria-label="Bezeichnung Level 1"
            autoComplete="off"
          />
          <span aria-hidden className="text-faint">
            bis
          </span>
          <Input
            value={q.scoreHigh}
            onChange={(e) => onChange({ scoreHigh: e.target.value })}
            aria-label="Bezeichnung höchstes Level"
            autoComplete="off"
          />
        </div>
      )}
    </Group>
  );
}
