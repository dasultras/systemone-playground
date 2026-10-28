"use client";

import { MotionConfig } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { download, seedHistory, toCsv, toJson } from "@/lib/history";
import { DEFAULT_MODEL, PRESETS, newQuestion, presetById, uid } from "@/lib/mock-data";
import { mockRun, type SimulatedError } from "@/lib/mock-run";
import type { Fact, HistoryEntry, Mode, ModelId, ModelState, Question } from "@/lib/types";
import { InputPanel, validate, type Invalid } from "./input-panel";
import { Inspector } from "./inspector";
import { OutputPanel } from "./output-panel";
import { Sidebar } from "./sidebar";
import { Toolbar } from "./toolbar";

const FIRST = PRESETS[0];

function subscribeTheme(cb: () => void) {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => mo.disconnect();
}
const isDark = () => document.documentElement.classList.contains("dark");

export function Playground() {
  const dark = useSyncExternalStore(subscribeTheme, isDark, () => false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebar, setMobileSidebar] = useState(false);
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
  const [undo, setUndo] = useState<{ entry: HistoryEntry; index: number } | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      if (undoTimer.current) clearTimeout(undoTimer.current);
    },
    [],
  );

  const toggleTheme = () => {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {}
  };

  const running = models.some((m) => states[m]?.status === "running");

  const loadPreset = (id: string) => {
    const p = presetById(id);
    if (!p) return;
    clearTimers();
    setPresetId(id);
    setMode(p.mode);
    setState(p.state);
    setFacts(p.facts);
    setQuestions(p.questions);
    setStates({});
    setActiveId(null);
    setInvalid(null);
  };

  const changeMode = (m: Mode) => {
    if (m === mode) return;
    const first = PRESETS.find((p) => p.mode === m);
    if (first) loadPreset(first.id);
  };

  const newRun = () => {
    clearTimers();
    setPresetId(null);
    setMode("single");
    setState("");
    setFacts([]);
    setQuestions([newQuestion("choice")]);
    setStates({});
    setActiveId(null);
    setInvalid(null);
    setMobileSidebar(false);
  };

  const run = useCallback(() => {
    const bad = validate(state, questions);
    setInvalid(bad);
    if (bad) {
      document.getElementById(bad.id)?.focus();
      return;
    }
    clearTimers();
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
    clearTimers();
    setPresetId(h.presetId);
    setMode(h.mode);
    setState(h.state);
    setFacts(h.facts);
    setQuestions(h.questions);
    setModels(h.models);
    setAverage(h.average);
    setStates(Object.fromEntries(h.runs.map((r) => [r.modelId, { status: "done", run: r } as ModelState])));
    setActiveId(h.id);
    setInvalid(null);
    setMobileSidebar(false);
  };

  const deleteHistory = (id: string) => {
    const index = history.findIndex((h) => h.id === id);
    if (index < 0) return;
    setUndo({ entry: history[index], index });
    setHistory((h) => h.filter((x) => x.id !== id));
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), 6000);
  };

  const undoDelete = () => {
    if (!undo) return;
    setHistory((h) => [...h.slice(0, undo.index), undo.entry, ...h.slice(undo.index)]);
    setUndo(null);
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

  const closeInspector = useCallback(() => setInspectorOpen(false), []);

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex h-dvh overflow-hidden">
        {mobileSidebar && (
          <button className="fixed inset-0 z-20 bg-black/40 lg:hidden" onClick={() => setMobileSidebar(false)} aria-label="Verlauf schließen" />
        )}
        <div
          className={`fixed inset-y-0 left-0 z-30 transition-transform lg:static lg:z-auto lg:translate-x-0 ${
            mobileSidebar ? "translate-x-0" : "-translate-x-full"
          } ${sidebarOpen ? "" : "lg:hidden"}`}
        >
          <Sidebar
            history={history}
            activeId={activeId}
            onSelect={selectHistory}
            onNew={newRun}
            onDelete={deleteHistory}
            onExport={exportHistory}
            onClose={() => setMobileSidebar(false)}
            undo={undo ? { title: undo.entry.title } : null}
            onUndo={undoDelete}
          />
        </div>

        <main className="flex min-w-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
          <InputPanel
            title={title}
            onToggleSidebar={() => {
              if (window.matchMedia("(min-width: 1024px)").matches) setSidebarOpen((o) => !o);
              else setMobileSidebar((o) => !o);
            }}
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
                dark={dark}
                onToggleTheme={toggleTheme}
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
        </main>

        {inspectorOpen && (
          <Inspector
            models={models}
            states={states}
            modelId={models.includes(inspectModel) ? inspectModel : models[0]}
            onModel={setInspectModel}
            onClose={closeInspector}
          />
        )}
      </div>
    </MotionConfig>
  );
}
