"use client";

import { Braces, Check, FlaskConical, Moon, PanelLeft, Plus, Sun, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { MODELS, modelById } from "@/lib/mock-data";
import type { SimulatedError } from "@/lib/mock-run";
import type { ModelId } from "@/lib/types";

type Props = {
  models: ModelId[];
  onModels: (m: ModelId[]) => void;
  dark: boolean;
  onToggleTheme: () => void;
  onToggleSidebar: () => void;
  onToggleInspector: () => void;
  inspectorOpen: boolean;
  simulate: SimulatedError;
  onSimulate: (s: SimulatedError) => void;
};

const MAX_MODELS = 3;

function useOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open, close]);
  return ref;
}

export function TopBar(p: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [optsOpen, setOptsOpen] = useState(false);
  const pickerRef = useOutside(pickerOpen, () => setPickerOpen(false));
  const optsRef = useOutside(optsOpen, () => setOptsOpen(false));
  const hosted = p.models.some((m) => modelById(m).hosted);

  const toggle = (id: ModelId) => {
    if (p.models.includes(id)) {
      if (p.models.length > 1) p.onModels(p.models.filter((m) => m !== id));
    } else if (p.models.length < MAX_MODELS) p.onModels([...p.models, id]);
  };

  return (
    <>
      <header className="relative z-20 flex h-14 shrink-0 items-center gap-2 border-b border-line bg-canvas/80 px-3 backdrop-blur">
        <button onClick={p.onToggleSidebar} className="btn-ghost !p-2" aria-label="Seitenleiste umschalten">
          <PanelLeft className="size-[18px]" />
        </button>

        <div className="relative flex min-w-0 items-center gap-1.5" ref={pickerRef}>
          {p.models.map((id) => {
            const m = modelById(id);
            return (
              <span key={id} className="group inline-flex items-center gap-2 rounded-lg border border-line bg-panel py-1 pl-2.5 pr-1.5 text-sm font-medium shadow-sm">
                <span className="size-2 rounded-full" style={{ background: m.color }} />
                <span className="truncate">{m.label}</span>
                <span className="hidden font-mono text-[10px] font-normal text-faint sm:inline">{m.size}</span>
                {p.models.length > 1 && (
                  <button onClick={() => toggle(id)} className="rounded p-0.5 text-faint hover:bg-sunken hover:text-ink" aria-label={`${m.label} entfernen`}>
                    <X className="size-3" />
                  </button>
                )}
              </span>
            );
          })}
          {p.models.length < MAX_MODELS && (
            <button onClick={() => setPickerOpen((o) => !o)} className="btn-ghost !p-1.5" title="Modell zum Vergleich hinzufügen" aria-label="Modell hinzufügen">
              <Plus className="size-4" />
            </button>
          )}

          {pickerOpen && (
            <div className="absolute left-0 top-full z-20 mt-2 w-80 overflow-hidden rounded-xl border border-line bg-panel p-1.5 shadow-2xl">
              <div className="px-2.5 pb-1 pt-1.5 text-[11px] font-medium text-faint">Modelle (bis zu {MAX_MODELS} zum Vergleich)</div>
              {MODELS.map((m) => {
                const on = p.models.includes(m.id);
                return (
                  <button
                    key={m.id}
                    onClick={() => toggle(m.id)}
                    className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-sunken"
                  >
                    <span className="size-2.5 rounded-full" style={{ background: m.color }} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{m.label}</span>
                      <span className="block truncate font-mono text-[11px] text-muted">{m.id}</span>
                    </span>
                    <span className="rounded bg-sunken px-1.5 py-0.5 text-[10px] text-muted">{m.hosted ? "TypeSafe" : "Ollama"}</span>
                    {on && <Check className="size-4 text-accent" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="ml-auto flex items-center gap-1">
          <span className="mr-1 hidden rounded-full border border-line px-2.5 py-1 text-[11px] text-muted md:inline">UI-Mock · keine echten Modellaufrufe</span>

          <div className="relative" ref={optsRef}>
            <button onClick={() => setOptsOpen((o) => !o)} className="btn-ghost !p-2" title="Mock-Optionen" aria-label="Mock-Optionen">
              <FlaskConical className="size-[18px]" />
            </button>
            {optsOpen && (
              <div className="absolute right-0 top-full z-20 mt-2 w-64 rounded-xl border border-line bg-panel p-3 shadow-2xl">
                <div className="mb-2 text-sm font-medium">Fehler simulieren</div>
                <p className="mb-2 text-xs text-muted">Betrifft das zuletzt gewählte Modell. Fehler werden nie als Antwort gezeigt.</p>
                {(
                  [
                    ["none", "Keiner"],
                    ["timeout", "Timeout"],
                    ["overflow", "Overflow-400"],
                  ] as const
                ).map(([v, label]) => (
                  <label key={v} className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-sunken">
                    <input type="radio" name="sim" checked={p.simulate === v} onChange={() => p.onSimulate(v)} className="accent-[var(--accent)]" />
                    {label}
                  </label>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={p.onToggleInspector}
            className={`btn-ghost !p-2 ${p.inspectorOpen ? "!bg-sunken !text-ink" : ""}`}
            title="Request-Inspektor"
            aria-label="Request-Inspektor"
          >
            <Braces className="size-[18px]" />
          </button>
          <button onClick={p.onToggleTheme} className="btn-ghost !p-2" aria-label="Dark Mode umschalten">
            {p.dark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
          </button>
        </div>
      </header>

      {hosted && (
        <div className="flex items-center gap-2 border-b border-warn/20 bg-warn-soft px-4 py-2 text-xs text-warn">
          <span className="font-semibold">TypeSafe-Hosting (USA):</span> nur synthetische Daten verwenden – keine echten Inventurdaten.
        </div>
      )}
    </>
  );
}
