"use client";

import { Braces, FlaskConical, Moon, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { SimulatedError } from "@/lib/mock-run";

type Props = {
  dark: boolean;
  onToggleTheme: () => void;
  onToggleInspector: () => void;
  inspectorOpen: boolean;
  simulate: SimulatedError;
  onSimulate: (s: SimulatedError) => void;
};

export function Toolbar(p: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", down);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  return (
    <>
      <span className="mr-2 hidden text-xs text-muted md:inline">Mock, keine echten Modellaufrufe</span>

      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-haspopup="true"
          className={`icon-btn ${p.simulate !== "none" ? "!text-warn" : ""}`}
          aria-label="Fehler simulieren"
        >
          <FlaskConical aria-hidden className="size-4" />
        </button>
        {open && (
          <fieldset className="absolute right-0 top-full z-20 mt-1 w-64 rounded-md border border-line-strong bg-canvas p-3 shadow-xl">
            <legend className="sr-only">Fehler simulieren</legend>
            <p className="section-title mb-1" aria-hidden>Fehler simulieren</p>
            <p className="mb-2 text-xs text-muted">Betrifft das zuletzt gewählte Modell. Fehler erscheinen nie als Antwort.</p>
            {(
              [
                ["none", "Kein Fehler"],
                ["timeout", "Timeout"],
                ["overflow", "Overflow (HTTP 400)"],
              ] as const
            ).map(([v, label]) => (
              <label key={v} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-sunken">
                <input type="radio" name="sim" checked={p.simulate === v} onChange={() => p.onSimulate(v)} className="accent-[var(--ink)]" />
                {label}
              </label>
            ))}
          </fieldset>
        )}
      </div>

      <button
        onClick={p.onToggleInspector}
        aria-pressed={p.inspectorOpen}
        className={`icon-btn ${p.inspectorOpen ? "!bg-sunken-2 !text-ink" : ""}`}
        aria-label="Request-Inspektor"
      >
        <Braces aria-hidden className="size-4" />
      </button>
      <button onClick={p.onToggleTheme} className="icon-btn" aria-label={p.dark ? "Hellen Modus aktivieren" : "Dunklen Modus aktivieren"}>
        {p.dark ? <Sun aria-hidden className="size-4" /> : <Moon aria-hidden className="size-4" />}
      </button>
    </>
  );
}
