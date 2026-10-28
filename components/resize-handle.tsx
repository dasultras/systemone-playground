"use client";

import { useCallback, useRef, useState, useSyncExternalStore } from "react";

const STEP = 16;

// Breiten liegen im Speicher und zusätzlich in localStorage; Ziehen schreibt nur in den Speicher-Teil synchron.
const sizes = new Map<string, number>();
const listeners = new Set<() => void>();

function readSize(key: string): number | undefined {
  if (!sizes.has(key)) {
    try {
      const v = Number(localStorage.getItem(key));
      if (v) sizes.set(key, v);
    } catch {
      /* Speicher nicht verfügbar */
    }
  }
  return sizes.get(key);
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Breite in px, im Browser gespeichert. Bis zur Hydration gilt der Startwert, damit Server und Client übereinstimmen. */
export function useStoredSize(key: string, initial: number, min: number, max: number) {
  const stored = useSyncExternalStore(
    subscribe,
    () => readSize(key),
    () => undefined,
  );
  const size = Math.min(max, Math.max(min, stored ?? initial));

  const setSize = useCallback(
    (v: number) => {
      sizes.set(key, v);
      listeners.forEach((l) => l());
      try {
        localStorage.setItem(key, String(Math.round(v)));
      } catch {
        /* Speicher nicht verfügbar */
      }
    },
    [key],
  );

  return [size, setSize] as const;
}

/**
 * Senkrechter Griff zwischen zwei Spalten. Ziehen ändert die Breite der linken Spalte,
 * Pfeiltasten in 16-px-Schritten, Doppelklick setzt zurück.
 * `measure` liefert die tatsächlich gerenderte Breite, falls CSS sie zusätzlich begrenzt.
 */
export function ResizeHandle({
  label,
  value,
  min,
  max,
  onChange,
  onReset,
  onCollapse,
  measure,
  className = "",
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  onReset: () => void;
  /** Wird aufgerufen, wenn deutlich unter `min` gezogen wird. */
  onCollapse?: () => void;
  measure?: (handle: HTMLElement) => number | undefined;
  className?: string;
}) {
  const [dragging, setDragging] = useState(false);
  const start = useRef({ x: 0, size: 0 });
  const clamp = (v: number) => Math.min(max, Math.max(min, v));

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, size: measure?.(e.currentTarget) ?? value };
    setDragging(true);
    document.documentElement.dataset.resizing = "";
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const next = start.current.size + e.clientX - start.current.x;
    if (onCollapse && next < min - 80) {
      end(e);
      // Beim Wiederöffnen gilt die Breite von vor dem Ziehen.
      onChange(clamp(start.current.size));
      onCollapse();
      return;
    }
    onChange(clamp(next));
  };

  const end = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    setDragging(false);
    delete document.documentElement.dataset.resizing;
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const keys: Record<string, number> = {
      ArrowLeft: value - STEP,
      ArrowRight: value + STEP,
      Home: min,
      End: max,
    };
    if (e.key in keys) {
      e.preventDefault();
      onChange(clamp(keys[e.key]));
    } else if (e.key === "Enter") {
      e.preventDefault();
      onReset();
    }
  };

  return (
    // Fokussierbarer Separator nach WAI-ARIA "Window Splitter".
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={Math.round(value)}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      title="Ziehen zum Anpassen, Doppelklick setzt zurück"
      data-dragging={dragging || undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      onDoubleClick={onReset}
      onKeyDown={onKeyDown}
      className={`group/handle z-20 w-2 cursor-col-resize touch-none outline-none ${className}`}
    >
      <span
        aria-hidden
        className="pointer-events-none mx-auto block h-full w-px bg-transparent transition-colors group-hover/handle:bg-ring/60 group-focus-visible/handle:w-0.5 group-focus-visible/handle:bg-ring group-data-dragging/handle:w-0.5 group-data-dragging/handle:bg-ring"
      />
    </div>
  );
}
