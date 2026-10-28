"use client";

import { Check, Loader2, Play, Plus, Trash2, X } from "lucide-react";
import { estimateTokens, fmtInt } from "@/lib/limits";
import { PRESETS, modelById, newQuestion } from "@/lib/mock-data";
import { fullStateText } from "@/lib/mock-run";
import type { Fact, Mode, ModelId, Question, QuestionType } from "@/lib/types";

export const MAX_OPTIONS = 10;
export const MAX_QUESTIONS = 5;

export function validate(state: string, questions: Question[]): string | null {
  if (!state.trim()) return "State fehlt.";
  for (const q of questions) {
    if (!q.text.trim()) return "Jede Frage braucht einen Text.";
    if (q.type === "choice" && q.options.filter((o) => o.trim()).length < 2) return "Choice braucht mindestens 2 Optionen.";
  }
  return null;
}

type Props = {
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
  average: number;
  onAverage: (n: number) => void;
  running: boolean;
  onRun: () => void;
};

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  size?: "sm" | "md";
}) {
  return (
    <div className="inline-flex rounded-lg bg-sunken-2/70 p-0.5" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-md font-medium transition-all ${size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-sm"} ${
            value === o.value ? "bg-panel text-ink shadow-sm" : "text-muted hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function InputPanel(p: Props) {
  const fullText = fullStateText(p.state, p.facts);
  const tokens =
    estimateTokens(fullText) + p.questions.reduce((s, q) => s + estimateTokens(q.text + q.options.join(" ")) + 24, 0);
  const limited = p.models.map(modelById).sort((a, b) => a.contextTokens - b.contextTokens);
  const limit = limited[0]?.contextTokens ?? 8000;
  const over = limited.filter((m) => tokens > m.contextTokens);
  const error = validate(p.state, p.questions);
  const hasChoice = p.questions.some((q) => q.type === "choice");
  const activePreset = PRESETS.find((x) => x.id === p.presetId);

  const update = (id: string, patch: Partial<Question>) =>
    p.onQuestions(
      p.questions.map((q) =>
        q.id === id ? { ...q, ...patch, ...(patch.type ? { mockTruth: undefined, mockSecond: undefined } : {}) } : q,
      ),
    );

  return (
    <section className="flex min-h-0 w-full shrink-0 flex-col rounded-2xl border border-line bg-panel shadow-card lg:w-[460px] xl:w-[500px]">
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
        <div className="flex items-center justify-between">
          <span className="eyebrow">Eingabe</span>
          <Segmented
            value={p.mode}
            onChange={p.onMode}
            options={[
              { value: "single", label: "Einzelfrage" },
              { value: "multi", label: "Mehrere Fragen" },
            ]}
            size="sm"
          />
        </div>

        <div>
          <div className="eyebrow mb-2 !normal-case !tracking-wide">Beispiel wählen – direkt lauffähig</div>
          <div className="-mx-1 flex flex-wrap gap-1.5 px-1">
            {PRESETS.filter((x) => x.mode === p.mode).map((x) => (
              <button
                key={x.id}
                onClick={() => p.onPreset(x.id)}
                className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
                  p.presetId === x.id ? "border-accent/40 bg-accent-soft text-accent-ink" : "border-line bg-sunken/50 text-muted hover:border-faint hover:text-ink"
                }`}
              >
                {x.title}
                <span className="font-mono text-[9px] uppercase tracking-wider opacity-70">{x.badge}</span>
              </button>
            ))}
          </div>
        </div>

        {activePreset && (
          <div className="flex items-center gap-2 rounded-lg border border-accent/25 bg-accent-soft px-3 py-2 text-xs text-accent-ink">
            <Check className="size-3.5" /> Beispiel geladen – direkt ausführen oder jedes Feld ändern.
          </div>
        )}

        {/* State */}
        <div>
          <div className="mb-1 flex items-baseline justify-between">
            <label htmlFor="state" className="text-sm font-semibold">State</label>
            <span className={`font-mono text-xs ${over.length ? "text-bad" : "text-muted"}`} title="Schätzung: Zeichen / 2,6">
              ≈ {fmtInt(tokens)} / {fmtInt(limit)}
            </span>
          </div>
          <p className="mb-2 text-xs text-muted">
            Kontext, den das Modell liest. {p.mode === "multi" ? "Gilt für alle Fragen unten." : "Nur relevante Felder – kürzen statt Kontext vergrößern."}
          </p>
          <textarea
            id="state"
            value={p.state}
            onChange={(e) => p.onState(e.target.value)}
            rows={7}
            spellCheck={false}
            className="field resize-y font-mono text-[12.5px] leading-relaxed"
          />
          {p.facts.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-faint">vom Code berechnet:</span>
              {p.facts.map((f) => (
                <span key={f.key} className="rounded-md bg-sunken px-1.5 py-0.5 font-mono text-[11px] text-muted">
                  {f.key}=<b className="font-medium text-ink">{f.value}</b>
                </span>
              ))}
            </div>
          )}
          {over.length > 0 && (
            <p className="mt-2 rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn">
              Über dem Limit von {over.map((m) => `${m.label} (${fmtInt(m.contextTokens)})`).join(", ")}. Das Modell antwortet mit einem Overflow-Fehler.
            </p>
          )}
        </div>

        {/* Fragen */}
        <div className="space-y-3">
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
          {p.mode === "multi" && (
            <div className="flex items-center justify-between">
              <button
                onClick={() => p.onQuestions([...p.questions, newQuestion("noul")])}
                disabled={p.questions.length >= MAX_QUESTIONS}
                className="btn-ghost !px-2"
              >
                <Plus className="size-4" /> Frage hinzufügen
              </button>
              <span className="text-xs text-muted">{p.questions.length} von {MAX_QUESTIONS}</span>
            </div>
          )}
        </div>

        {/* Reihenfolge mitteln */}
        <div className={`rounded-xl border border-line p-3 ${hasChoice ? "" : "opacity-50"}`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">Reihenfolge mitteln</div>
              <p className="text-xs text-muted">Optionen zyklisch verschieben, gegen Positions-Bias. Nur Choice.</p>
            </div>
            <Segmented
              value={String(p.average)}
              onChange={(v) => p.onAverage(Number(v))}
              options={["1", "2", "3", "4"].map((v) => ({ value: v, label: v === "1" ? "Aus" : `${v}×` }))}
              size="sm"
            />
          </div>
        </div>
      </div>

      <footer className="border-t border-line p-4">
        <button onClick={p.onRun} disabled={!!error || p.running || p.models.length === 0} className="btn-primary w-full !py-2.5 text-[15px]">
          {p.running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4 fill-current" />}
          {p.running ? "Läuft …" : p.models.length > 1 ? `Auf ${p.models.length} Modellen ausführen` : "Ausführen"}
        </button>
        <p className="mt-2 text-center text-xs text-muted">{error ?? "⌘ + Enter zum Ausführen · Mock: keine echten Modellaufrufe"}</p>
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

  return (
    <div className={multi ? "rounded-xl border border-line bg-sunken/40 p-3.5" : ""}>
      {multi && (
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold">Frage {index + 1}</span>
          {onRemove && (
            <button onClick={onRemove} className="inline-flex items-center gap-1 text-xs text-bad hover:underline">
              <Trash2 className="size-3" /> Entfernen
            </button>
          )}
        </div>
      )}
      <label className="mb-1 block text-sm font-semibold">{multi ? "Fragetext" : "Frage"}</label>
      {!multi && <p className="mb-2 text-xs text-muted">Atomar stellen – die Entscheidung trifft der Code.</p>}
      <input
        value={q.text}
        onChange={(e) => onChange({ text: e.target.value })}
        placeholder="z. B. Wird die DLL von einem Prozess geladen?"
        className="field"
      />

      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-xs text-muted">Antworttyp</span>
        <Segmented
          value={q.type}
          onChange={setType}
          options={[
            { value: "choice", label: "Choice" },
            { value: "noul", label: "Noul" },
            { value: "score", label: "Score" },
          ]}
          size="sm"
        />
      </div>

      <div className="mt-3 rounded-lg border border-dashed border-line bg-panel/70 p-3">
        {q.type === "choice" && (
          <>
            <p className="eyebrow mb-1">Eine Option wählen</p>
            <p className="mb-3 text-xs text-muted">Das Modell verteilt Wahrscheinlichkeit über die Optionen (≤ 10).</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {q.options.map((o, i) => (
                <div key={i} className="flex items-center gap-1.5 rounded-lg border border-line bg-panel pl-2.5">
                  <span className="font-mono text-[10px] text-faint">{String(i + 1).padStart(2, "0")}</span>
                  <input
                    value={o}
                    onChange={(e) => setOption(i, e.target.value)}
                    placeholder={`Option ${i + 1}`}
                    className="min-w-0 flex-1 bg-transparent py-1.5 text-sm outline-none placeholder:text-faint"
                  />
                  <button
                    onClick={() => onChange({ options: q.options.filter((_, j) => j !== i) })}
                    disabled={q.options.length <= 2}
                    className="p-1.5 text-faint hover:text-bad disabled:opacity-30"
                    aria-label="Option entfernen"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center justify-between">
              <button onClick={() => onChange({ options: [...q.options, ""] })} disabled={q.options.length >= MAX_OPTIONS} className="btn-ghost !px-2 !py-1 text-xs">
                <Plus className="size-3.5" /> Option
              </button>
              <span className="text-xs text-muted">{q.options.length} von {MAX_OPTIONS}</span>
            </div>
          </>
        )}
        {q.type === "noul" && (
          <>
            <p className="eyebrow mb-1">Ja / Nein</p>
            <p className="text-xs text-muted">Das Modell liefert P(wahr). P(Nein) ist das Komplement. Zwischen 0,3 und 0,7 gilt die Antwort als „unklar“.</p>
          </>
        )}
        {q.type === "score" && (
          <>
            <p className="eyebrow mb-1">Skala</p>
            <p className="mb-3 text-xs text-muted">Verteilung über 2–10 Level; angezeigt werden Modus und Erwartungswert.</p>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                Level
                <input
                  type="number"
                  min={2}
                  max={10}
                  value={q.levels}
                  onChange={(e) => onChange({ levels: Math.min(10, Math.max(2, Number(e.target.value) || 2)) })}
                  className="field !w-16 !py-1 text-center font-mono"
                />
              </label>
              <input value={q.scoreLow} onChange={(e) => onChange({ scoreLow: e.target.value })} className="field !w-32 !py-1 text-xs" aria-label="Label Level 1" />
              <span className="text-faint">→</span>
              <input value={q.scoreHigh} onChange={(e) => onChange({ scoreHigh: e.target.value })} className="field !w-32 !py-1 text-xs" aria-label="Label höchstes Level" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
