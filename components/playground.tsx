"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { download, seedHistory, toCsv, toJson } from "@/lib/history";
import { DEFAULT_MODEL, PRESETS, newQuestion, presetById, uid } from "@/lib/mock-data";
import { mockRun, type SimulatedError } from "@/lib/mock-run";
import type { Fact, HistoryEntry, Mode, ModelId, ModelState, Question } from "@/lib/types";
import { InputPanel, validate } from "./input-panel";
import { Inspector } from "./inspector";
import { OutputPanel } from "./output-panel";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";

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

  const [states, setStates] = useState<Record<string, ModelState | undefined>>({});
  const [history, setHistory] = useState<HistoryEntry[]>(seedHistory);
  const [activeId, setActiveId] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

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
  };

  const run = useCallback(() => {
    if (validate(state, questions)) return;
    clearTimers();
    const started = Date.now();
    const snapshot = { state, facts, questions, average };
    const lastLocal = models[models.length - 1];
    const results = models.map((id) => ({
      id,
      run: mockRun({ modelId: id, ...snapshot, simulate: id === lastLocal ? simulate : "none" }),
    }));
    setStates(Object.fromEntries(models.map((id) => [id, { status: "running", startedAt: started } as ModelState])));
    setActiveId(null);

    let pending = results.length;
    for (const r of results) {
      // Mock-Latenz gerafft (ca. 1/4), damit Unterschiede zwischen Modellen spürbar bleiben.
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
                questions: snapshot.questions,
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
    setMobileSidebar(false);
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

  const changeModels = (m: ModelId[]) => {
    setModels(m);
    if (!m.includes(inspectModel)) setInspectModel(m[0]);
  };

  return (
    <div className="flex h-dvh overflow-hidden">
      {mobileSidebar && (
        <button className="fixed inset-0 z-20 bg-black/30 lg:hidden" onClick={() => setMobileSidebar(false)} aria-label="Seitenleiste schließen" />
      )}
      <div
        className={`fixed inset-y-0 left-0 z-30 transition-transform lg:static lg:z-auto lg:translate-x-0 ${mobileSidebar ? "translate-x-0" : "-translate-x-full"} ${sidebarOpen ? "" : "lg:hidden"}`}
      >
            <Sidebar
              history={history}
              activeId={activeId}
              onSelect={selectHistory}
              onNew={newRun}
              onDelete={(id) => setHistory((h) => h.filter((x) => x.id !== id))}
              onExport={exportHistory}
              onClose={() => setMobileSidebar(false)}
            />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          models={models}
          onModels={changeModels}
          dark={dark}
          onToggleTheme={toggleTheme}
          onToggleSidebar={() => {
            if (window.matchMedia("(min-width: 1024px)").matches) setSidebarOpen((o) => !o);
            else setMobileSidebar((o) => !o);
          }}
          onToggleInspector={() => {
            setInspectModel((m) => (models.includes(m) ? m : models[0]));
            setInspectorOpen((o) => !o);
          }}
          inspectorOpen={inspectorOpen}
          simulate={simulate}
          onSimulate={setSimulate}
        />

        <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 lg:flex-row lg:overflow-hidden">
          <InputPanel
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
            average={average}
            onAverage={setAverage}
            running={running}
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
          />
        </main>
      </div>

      {inspectorOpen && (
        <Inspector
          models={models}
          states={states}
          modelId={models.includes(inspectModel) ? inspectModel : models[0]}
          onModel={setInspectModel}
          onClose={() => setInspectorOpen(false)}
        />
      )}
    </div>
  );
}
