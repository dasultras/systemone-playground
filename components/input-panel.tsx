"use client";

import { Loader2, PanelLeft, Play, Plus, Trash2, X } from "lucide-react";
import { estimateTokens, fmtInt } from "@/lib/limits";
import { MODELS, PRESETS, newQuestion } from "@/lib/mock-data";
import { fullStateText } from "@/lib/mock-run";
import type { Fact, Mode, ModelId, Question, QuestionType } from "@/lib/types";
import { Dot } from "./viz";
import { Segmented } from "./ui";

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
  onToggleSidebar: () => void;
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

  const toggleModel = (id: ModelId) => {
    if (p.models.includes(id)) {
      if (p.models.length > 1) p.onModels(p.models.filter((m) => m !== id));
    } else if (p.models.length < MAX_MODELS) p.onModels([...p.models, id]);
  };

  return (
    <section aria-label="Eingabe" className="flex w-full shrink-0 flex-col border-line lg:min-h-0 lg:w-[420px] lg:border-r">
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-line px-3">
        <button onClick={p.onToggleSidebar} className="icon-btn" aria-label="Verlauf ein- oder ausblenden">
          <PanelLeft aria-hidden className="size-4" />
        </button>
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
        {/* Vorlagen */}
        <div className="px-5 pb-3 pt-4">
          <h2 className="section-title mb-2">Vorlage</h2>
          <div className="-mx-1.5 flex flex-wrap gap-x-0.5 gap-y-0.5">
            {PRESETS.filter((x) => x.mode === p.mode).map((x) => (
              <button
                key={x.id}
                onClick={() => p.onPreset(x.id)}
                aria-pressed={p.presetId === x.id}
                className={`rounded-md px-1.5 py-1 text-[13px] transition-colors ${
                  p.presetId === x.id ? "bg-sunken-2 font-medium text-ink" : "text-muted hover:bg-sunken hover:text-ink"
                }`}
              >
                {x.title}
              </button>
            ))}
          </div>
        </div>

        {/* State */}
        <div className="border-t border-line px-5 py-4">
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <label htmlFor="state" className="section-title">State</label>
            <span className="text-xs tabular-nums text-muted" title="Schätzung: Zeichen geteilt durch 2,6">
              ≈&nbsp;{fmtInt(tokens)} Tokens
            </span>
          </div>
          <p className="mb-2 text-xs text-muted">
            Der Kontext, den das Modell liest.{p.mode === "multi" ? " Er gilt für alle Fragen." : " Nur relevante Felder, kürzen statt vergrößern."}
          </p>
          <textarea
            id="state"
            name="state"
            value={p.state}
            onChange={(e) => p.onState(e.target.value)}
            rows={7}
            spellCheck={false}
            autoComplete="off"
            placeholder="z. B. Hostname, OS, installierte Programme …"
            className="field h-auto resize-y py-2 font-mono text-xs leading-relaxed"
          />
          {p.facts.length > 0 && (
            <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
              <dt className="sr-only">Vom Code berechnete Fakten</dt>
              {p.facts.map((f) => (
                <dd key={f.key} className="text-muted">
                  <span className="font-mono text-[11px]">{f.key}</span> <span className="font-medium tabular-nums text-ink">{f.value}</span>
                </dd>
              ))}
              <span className="text-faint">vom Code berechnet</span>
            </dl>
          )}
        </div>

        {/* Fragen */}
        <div className="border-t border-line px-5 py-4">
          <h2 className="section-title mb-3">{p.mode === "multi" ? "Fragen" : "Frage"}</h2>
          <div className="space-y-5">
            {p.questions.map((q, i) => (
              <QuestionEditor
                key={q.id}
                q={q}
                index={i}
                multi={p.mode === "multi"}
                onChange={(patch) => update(q.id, patch)}
                onRemove={p.questions.length > 1 ? () => p.onQuestions(p.questions.filter((x) => x.id !== q.id)) : undefined}
              />
            ))}
          </div>
          {p.mode === "multi" && (
            <div className="mt-3 flex items-center justify-between">
              <button
                onClick={() => p.onQuestions([...p.questions, newQuestion("noul")])}
                disabled={p.questions.length >= MAX_QUESTIONS}
                className="btn-outline"
              >
                <Plus aria-hidden className="size-3.5" /> Frage hinzufügen
              </button>
              <span className="text-xs tabular-nums text-muted">{p.questions.length} von {MAX_QUESTIONS}</span>
            </div>
          )}
        </div>

        {/* Modelle */}
        <fieldset className="border-t border-line px-5 py-4">
          <legend className="sr-only">Modelle</legend>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="section-title" aria-hidden>Modelle</h2>
            <span className="text-xs text-muted">bis zu {MAX_MODELS} zum Vergleich</span>
          </div>
          <ul className="-mx-2">
            {MODELS.map((m) => {
              const on = p.models.includes(m.id);
              const locked = (!on && p.models.length >= MAX_MODELS) || (on && p.models.length === 1);
              const over = tokens > m.contextTokens;
              return (
                <li key={m.id}>
                  <label className={`flex min-h-9 items-center gap-2.5 rounded-md px-2 py-1 ${locked ? "opacity-60" : "cursor-pointer hover:bg-sunken"}`}>
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={locked}
                      onChange={() => toggleModel(m.id)}
                      className="size-3.5 accent-[var(--ink)]"
                    />
                    <Dot color={m.color} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{m.label}</span>
                      <span className="block truncate text-xs text-muted">{m.backend === "typesafe" ? "TypeSafe, gehostet" : "Ollama, lokal"} · {m.size}</span>
                    </span>
                    <span className={`text-xs tabular-nums ${over ? "font-medium text-bad" : "text-muted"}`}>
                      {fmtInt(tokens)} / {fmtInt(m.contextTokens)}
                      {over && <span className="sr-only"> überschreitet das Limit</span>}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          {hosted && (
            <p className="mt-2 border-l-2 border-warn bg-warn-soft px-2.5 py-1.5 text-xs text-warn">
              TypeSafe hostet in den USA. Nur synthetische Daten senden, keine echten Inventurdaten.
            </p>
          )}
        </fieldset>

        {/* Optionen */}
        <div className={`border-t border-line px-5 py-4 ${hasChoice ? "" : "opacity-55"}`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="section-title">Reihenfolge mitteln</h2>
              <p className="text-xs text-muted">Verschiebt Optionen zyklisch, gegen Positions-Bias. Nur Choice.</p>
            </div>
            <Segmented
              label="Reihenfolge mitteln"
              value={String(p.average)}
              onChange={(v) => p.onAverage(Number(v))}
              options={["1", "2", "3", "4"].map((v) => ({ value: v, label: v === "1" ? "Aus" : `${v}×` }))}
            />
          </div>
        </div>
      </div>

      <footer className="sticky bottom-0 border-t border-line bg-canvas px-5 py-3">
        <button onClick={p.onRun} disabled={p.running} className="btn-primary h-9 w-full">
          {p.running ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Play aria-hidden className="size-3.5 fill-current" />}
          {p.running ? "Läuft …" : p.models.length > 1 ? `Auf ${p.models.length} Modellen ausführen` : "Ausführen"}
        </button>
        <p className={`mt-1.5 text-xs ${p.invalid ? "text-bad" : "text-muted"}`} role={p.invalid ? "alert" : undefined}>
          {p.invalid ? p.invalid.message : "⌘ ↵ führt aus. Mock: keine echten Modellaufrufe."}
        </p>
      </footer>
    </section>
  );
}

function QuestionEditor({
  q,
  index,
  multi,
  onChange,
  onRemove,
}: {
  q: Question;
  index: number;
  multi: boolean;
  onChange: (patch: Partial<Question>) => void;
  onRemove?: () => void;
}) {
  const setType = (type: QuestionType) =>
    onChange({ type, options: type === "choice" && q.options.length < 2 ? ["", "", ""] : q.options });
  const setOption = (i: number, v: string) => onChange({ options: q.options.map((o, j) => (j === i ? v : o)) });
  const id = `q-${q.id}`;

  return (
    <div className={multi ? "border-l-2 border-line pl-3" : ""}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-xs font-medium text-muted">
          {multi ? `Frage ${index + 1}` : "Fragetext"}
        </label>
        {onRemove && (
          <button onClick={onRemove} className="inline-flex items-center gap-1 text-xs text-muted hover:text-bad">
            <Trash2 aria-hidden className="size-3" /> Entfernen<span className="sr-only">: Frage {index + 1}</span>
          </button>
        )}
      </div>
      <input
        id={id}
        name={id}
        value={q.text}
        onChange={(e) => onChange({ text: e.target.value })}
        placeholder="z. B. Wird die DLL von einem Prozess geladen?"
        autoComplete="off"
        className="field"
      />
      {!multi && <p className="mt-1 text-xs text-muted">Atomar fragen, die Entscheidung trifft der Code.</p>}

      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-xs text-muted">Antworttyp</span>
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
            <p className="mb-1.5 text-xs text-muted">Das Modell verteilt Wahrscheinlichkeit auf 2 bis {MAX_OPTIONS} Optionen.</p>
            <ul className="space-y-1">
              {q.options.map((o, i) => (
                <li key={i} className="group flex items-center gap-1 rounded-md border border-line-strong bg-canvas focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-accent hover:border-faint">
                  <input
                    value={o}
                    onChange={(e) => setOption(i, e.target.value)}
                    placeholder={`Option ${i + 1}`}
                    aria-label={`Option ${i + 1}`}
                    autoComplete="off"
                    className="h-7 min-w-0 flex-1 bg-transparent px-2.5 text-[13px] outline-none placeholder:text-faint"
                  />
                  <button
                    onClick={() => onChange({ options: q.options.filter((_, j) => j !== i) })}
                    disabled={q.options.length <= 2}
                    className="mr-0.5 grid size-6 place-items-center rounded text-faint opacity-0 hover:text-bad focus-visible:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100 disabled:hidden"
                    aria-label={`Option ${i + 1} entfernen`}
                  >
                    <X aria-hidden className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-1.5 flex items-center justify-between">
              <button onClick={() => onChange({ options: [...q.options, ""] })} disabled={q.options.length >= MAX_OPTIONS} className="btn-ghost !h-7 !px-2 text-xs">
                <Plus aria-hidden className="size-3.5" /> Option
              </button>
              <span className="text-xs tabular-nums text-muted">{q.options.length} von {MAX_OPTIONS}</span>
            </div>
          </>
        )}
        {q.type === "noul" && (
          <p className="text-xs text-muted">Das Modell liefert P(wahr). Zwischen 0,3 und 0,7 gilt die Antwort als unklar.</p>
        )}
        {q.type === "score" && (
          <div className="space-y-2">
            <p className="text-xs text-muted">Verteilung über 2 bis 10 Level, angezeigt mit Modus und Erwartungswert.</p>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-xs text-muted">
                Level
                <input
                  type="number"
                  inputMode="numeric"
                  min={2}
                  max={10}
                  value={q.levels}
                  onChange={(e) => onChange({ levels: Math.min(10, Math.max(2, Number(e.target.value) || 2)) })}
                  className="field !w-14 text-center tabular-nums"
                />
              </label>
              <input value={q.scoreLow} onChange={(e) => onChange({ scoreLow: e.target.value })} className="field min-w-0 flex-1" aria-label="Bezeichnung Level 1" autoComplete="off" />
              <span aria-hidden className="text-faint">bis</span>
              <input value={q.scoreHigh} onChange={(e) => onChange({ scoreHigh: e.target.value })} className="field min-w-0 flex-1" aria-label="Bezeichnung höchstes Level" autoComplete="off" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
