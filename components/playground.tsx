"use client";

import { MotionConfig } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { download, seedHistory, toCsv, toJson } from "@/lib/history";
import { DEFAULT_MODEL, PRESETS, newQuestion, presetById, uid } from "@/lib/mock-data";
import { mockRun, type SimulatedError } from "@/lib/mock-run";
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

type Timers = { current: ReturnType<typeof setTimeout>[] };

function clearTimers(timers: Timers) {
  timers.current.forEach(clearTimeout);
  timers.current = [];
}

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
  const [simulate, setSimulate] = useState<SimulatedError>("none");
  const [invalid, setInvalid] = useState<Invalid | null>(null);

  const [states, setStates] = useState<Record<string, ModelState | undefined>>({});
  const [history, setHistory] = useState<HistoryEntry[]>(seedHistory);
  const [activeId, setActiveId] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const running = models.some((m) => states[m]?.status === "running");

  const reset = () => {
    clearTimers(timers);
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

  const run = useCallback(() => {
    const bad = validate(state, questions);
    setInvalid(bad);
    if (bad) {
      document.getElementById(bad.id)?.focus();
      return;
    }
    clearTimers(timers);
    const started = Date.now();
    const snapshot = { state, facts, questions, average };
    const lastModel = models[models.length - 1];
    const results = models.map((id) => ({
      id,
      run: mockRun({ modelId: id, ...snapshot, simulate: id === lastModel ? simulate : "none" }),
    }));
    setStates(Object.fromEntries(models.map((id) => [id, { status: "running", startedAt: started } as ModelState])));
    setActiveId(null);

    let pending = results.length;
    for (const r of results) {
      // Mock-Latenz gerafft (ca. ein Viertel), die Unterschiede zwischen den Modellen bleiben sichtbar.
      const delay = Math.min(2800, Math.max(500, r.run.latencyMs / 4));
      timers.current.push(
        setTimeout(() => {
          setStates((s) => ({ ...s, [r.id]: { status: "done", run: r.run } }));
          if (--pending === 0) {
            const first = questions[0].text;
            const id = uid("h");
            setHistory((h) => [
              {
                id,
                title: presetById(presetId ?? "")?.title ?? (first.length > 36 ? `${first.slice(0, 36)}…` : first),
                time: new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }),
                group: "Heute",
                mode,
                presetId,
                ...snapshot,
                models,
                runs: results.map((x) => x.run),
              },
              ...h,
            ]);
            setActiveId(id);
          }
        }, delay),
      );
    }
  }, [state, facts, questions, average, models, simulate, presetId, mode]);

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
    const index = history.findIndex((h) => h.id === id);
    if (index < 0) return;
    const entry = history[index];
    setHistory((h) => h.filter((x) => x.id !== id));
    toast(`„${entry.title}“ gelöscht`, {
      action: {
        label: "Rückgängig",
        onClick: () => setHistory((h) => [...h.slice(0, index), entry, ...h.slice(index)]),
      },
    });
  };

  const exportHistory = (kind: "json" | "csv") =>
    kind === "json"
      ? download("playground-historie.json", toJson(history), "application/json")
      : download("playground-historie.csv", toCsv(history), "text/csv");

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
                simulate={simulate}
                onSimulate={setSimulate}
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
