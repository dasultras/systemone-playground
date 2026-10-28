"use client";

import { MotionConfig } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { NO_HISTORY, download, readHistory, subscribeHistory, toCsv, toJson, writeHistory } from "@/lib/history";
import { DEFAULT_MODEL, PRESETS, newQuestion, presetById, uid } from "@/lib/mock-data";
import { postRun } from "@/lib/run";
import type { Fact, HistoryEntry, Mode, ModelId, ModelState, Question } from "@/lib/types";
import { AppSidebar } from "./app-sidebar";
import { InputPanel, validate, type Invalid } from "./input-panel";
import { Inspector } from "./inspector";
import { OutputPanel } from "./output-panel";
import { ResizeHandle, useStoredSize } from "./resize-handle";
import { Toolbar } from "./toolbar";

const FIRST = PRESETS[0];

/** Spaltenbreiten in px. CSS begrenzt zusätzlich: Verlauf höchstens 28 vw, Ergebnis mindestens 420 px. */
const SIDEBAR = { initial: 240, min: 200, max: 380 };
const INPUT = { initial: 420, min: 320, max: 760 };

export function Playground() {
  const [sidebarWidth, setSidebarWidth] = useStoredSize(
    "playground.sidebar",
    SIDEBAR.initial,
    SIDEBAR.min,
    SIDEBAR.max,
  );
  const [inputWidth, setInputWidth] = useStoredSize("playground.input", INPUT.initial, INPUT.min, INPUT.max);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectModel, setInspectModel] = useState<ModelId>(DEFAULT_MODEL);

  const [mode, setMode] = useState<Mode>(FIRST.mode);
  const [presetId, setPresetId] = useState<string | null>(FIRST.id);
  const [state, setState] = useState(FIRST.state);
  const [facts, setFacts] = useState<Fact[]>(FIRST.facts);
  const [questions, setQuestions] = useState<Question[]>(FIRST.questions);
  const [models, setModels] = useState<ModelId[]>([DEFAULT_MODEL]);
  const [average, setAverage] = useState(1);
  const [invalid, setInvalid] = useState<Invalid | null>(null);

  const [states, setStates] = useState<Record<string, ModelState | undefined>>({});
  // Server und erster Client-Render ohne Verlauf; er erscheint nach der Hydration.
  const history = useSyncExternalStore(subscribeHistory, readHistory, () => NO_HISTORY);
  const [activeId, setActiveId] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  const running = models.some((m) => states[m]?.status === "running");

  const reset = () => {
    abort.current?.abort();
    setStates({});
    setActiveId(null);
    setInvalid(null);
  };

  const loadPreset = (id: string) => {
    const p = presetById(id);
    if (!p) return;
    reset();
    setPresetId(id);
    setMode(p.mode);
    setState(p.state);
    setFacts(p.facts);
    setQuestions(p.questions);
  };

  const changeMode = (m: Mode) => {
    if (m === mode) return;
    const first = PRESETS.find((p) => p.mode === m);
    if (first) loadPreset(first.id);
  };

  const newRun = () => {
    reset();
    setPresetId(null);
    setMode("single");
    setState("");
    setFacts([]);
    setQuestions([newQuestion("choice")]);
  };

  const run = useCallback(async () => {
    const bad = validate(state, questions);
    setInvalid(bad);
    if (bad) {
      document.getElementById(bad.id)?.focus();
      return;
    }
    abort.current?.abort();
    const ctrl = (abort.current = new AbortController());
    // Leere Optionen fallen weg, damit Anzeige und Request dieselben Labels haben.
    const sent = questions.map((q) => ({ ...q, options: q.options.filter((o) => o.trim()) }));
    setQuestions(sent);
    const snapshot = { state, facts, questions: sent, average };
    const started = Date.now();
    setStates(Object.fromEntries(models.map((id) => [id, { status: "running", startedAt: started } as ModelState])));
    setActiveId(null);

    const runs = await Promise.all(
      models.map(async (modelId) => {
        const r = await postRun({ modelId, ...snapshot }, ctrl.signal);
        if (!ctrl.signal.aborted) setStates((s) => ({ ...s, [modelId]: { status: "done", run: r } }));
        return r;
      }),
    );
    if (ctrl.signal.aborted) return;
    const first = sent[0].text;
    const id = uid("h");
    writeHistory([
      {
        id,
        title: presetById(presetId ?? "")?.title ?? (first.length > 36 ? `${first.slice(0, 36)}…` : first),
        at: Date.now(),
        mode,
        presetId,
        ...snapshot,
        models,
        runs,
      },
      ...readHistory(),
    ]);
    setActiveId(id);
  }, [state, facts, questions, average, models, presetId, mode]);

  const selectHistory = (h: HistoryEntry) => {
    reset();
    setPresetId(h.presetId);
    setMode(h.mode);
    setState(h.state);
    setFacts(h.facts);
    setQuestions(h.questions);
    setModels(h.models);
    setAverage(h.average);
    setStates(Object.fromEntries(h.runs.map((r) => [r.modelId, { status: "done", run: r } as ModelState])));
    setActiveId(h.id);
  };

  const deleteHistory = (id: string) => {
    const entry = history.find((h) => h.id === id);
    if (!entry) return;
    writeHistory(history.filter((x) => x.id !== id));
    toast(`„${entry.title}“ gelöscht`, {
      duration: 8000,
      action: {
        label: "Rückgängig",
        // Nach Zeitpunkt einsortieren, auch wenn inzwischen neue Läufe dazugekommen sind.
        onClick: () => {
          const h = readHistory();
          const i = h.findIndex((x) => x.at < entry.at);
          writeHistory(i < 0 ? [...h, entry] : [...h.slice(0, i), entry, ...h.slice(i)]);
        },
      },
    });
  };

  const exportHistory = (kind: "json" | "csv") =>
    kind === "json"
      ? download("playground-historie.json", toJson(history), "application/json")
      : // BOM, damit Excel die Datei als UTF-8 liest (Umlaute).
        download("playground-historie.csv", `\uFEFF${toCsv(history)}`, "text/csv");

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") run();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [run]);

  const activeRule = useMemo(() => (mode === "multi" ? presetById(presetId ?? "")?.rule : undefined), [mode, presetId]);
  const title = presetById(presetId ?? "")?.title ?? "Neuer Lauf";

  const changeModels = (m: ModelId[]) => {
    setModels(m);
    if (!m.includes(inspectModel)) setInspectModel(m[0]);
  };

  return (
    <MotionConfig reducedMotion="user">
      <SidebarProvider
        className="h-svh min-h-0"
        style={{ "--sidebar-width": `min(${sidebarWidth}px, 28vw)` } as React.CSSProperties}
      >
        <AppSidebar
          history={history}
          activeId={activeId}
          onSelect={selectHistory}
          onNew={newRun}
          onDelete={deleteHistory}
          onExport={exportHistory}
          width={sidebarWidth}
          widthRange={SIDEBAR}
          onWidth={setSidebarWidth}
        />

        <SidebarInset className="min-w-0 overflow-y-auto lg:flex-row lg:overflow-hidden">
          <InputPanel
            width={inputWidth}
            title={title}
            mode={mode}
            onMode={changeMode}
            presetId={presetId}
            onPreset={loadPreset}
            state={state}
            onState={setState}
            facts={facts}
            questions={questions}
            onQuestions={setQuestions}
            models={models}
            onModels={changeModels}
            average={average}
            onAverage={setAverage}
            running={running}
            invalid={invalid}
            onRun={run}
          />
          <ResizeHandle
            label="Breite der Eingabe"
            value={inputWidth}
            min={INPUT.min}
            max={INPUT.max}
            onChange={setInputWidth}
            onReset={() => setInputWidth(INPUT.initial)}
            measure={(h) => h.previousElementSibling?.getBoundingClientRect().width}
            className="relative -mx-1 hidden shrink-0 lg:block"
          />
          <OutputPanel
            questions={questions}
            models={models}
            states={states}
            rule={activeRule}
            onInspect={(m) => {
              setInspectModel(m);
              setInspectorOpen(true);
            }}
            toolbar={
              <Toolbar
                onToggleInspector={() => {
                  setInspectModel((m) => (models.includes(m) ? m : models[0]));
                  setInspectorOpen((o) => !o);
                }}
                inspectorOpen={inspectorOpen}
              />
            }
          />
        </SidebarInset>

        <Inspector
          open={inspectorOpen}
          onOpenChange={setInspectorOpen}
          models={models}
          states={states}
          modelId={models.includes(inspectModel) ? inspectModel : models[0]}
          onModel={setInspectModel}
        />
      </SidebarProvider>
    </MotionConfig>
  );
}
