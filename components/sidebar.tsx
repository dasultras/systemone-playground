"use client";

import { Download, Search, SquarePen, X } from "lucide-react";
import { useState } from "react";
import { modelById } from "@/lib/mock-data";
import type { HistoryEntry } from "@/lib/types";
import { Dot } from "./viz";

type Props = {
  history: HistoryEntry[];
  activeId: string | null;
  onSelect: (e: HistoryEntry) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onExport: (kind: "json" | "csv") => void;
  onClose: () => void;
  undo: { title: string } | null;
  onUndo: () => void;
};

const GROUPS: HistoryEntry["group"][] = ["Heute", "Gestern", "Diese Woche"];

export function Sidebar({ history, activeId, onSelect, onNew, onDelete, onExport, onClose, undo, onUndo }: Props) {
  const [query, setQuery] = useState("");
  const filtered = history.filter((h) =>
    `${h.title} ${h.questions.map((q) => q.text).join(" ")}`.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <aside aria-label="Verlauf" className="relative flex h-full w-[232px] shrink-0 flex-col border-r border-line bg-rail">
      <div className="flex h-11 items-center justify-between px-3">
        <div className="flex items-center gap-2">
          <span aria-hidden className="grid size-5 place-items-center rounded-[5px] bg-ink text-[11px] font-bold leading-none text-canvas">d</span>
          <span className="font-semibold">Decision Playground</span>
        </div>
        <button onClick={onClose} className="icon-btn !size-7 lg:hidden" aria-label="Verlauf schließen">
          <X aria-hidden className="size-4" />
        </button>
      </div>

      <div className="space-y-1 px-2 pb-2">
        <button onClick={onNew} className="flex h-8 w-full items-center gap-2 rounded-md px-2 font-medium hover:bg-sunken-2/70">
          <SquarePen aria-hidden className="size-4 text-muted" /> Neuer Lauf
        </button>
        <div className="relative">
          <Search aria-hidden className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-faint" />
          <label htmlFor="verlauf-suche" className="sr-only">Verlauf durchsuchen</label>
          <input
            id="verlauf-suche"
            type="search"
            name="verlauf-suche"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Verlauf durchsuchen …"
            className="h-8 w-full rounded-md bg-sunken-2/60 pl-7 pr-2 placeholder:text-faint hover:bg-sunken-2"
          />
        </div>
      </div>

      <nav aria-label="Vergangene Läufe" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-3">
        {GROUPS.map((g) => {
          const items = filtered.filter((h) => h.group === g);
          if (!items.length) return null;
          return (
            <section key={g} aria-label={g} className="mt-3">
              <h2 className="px-2 pb-1 text-xs font-medium text-faint">{g}</h2>
              <ul>
                {items.map((h) => (
                  <li key={h.id} className="group relative">
                    <button
                      onClick={() => onSelect(h)}
                      aria-current={activeId === h.id ? "true" : undefined}
                      className={`w-full rounded-md px-2 py-1.5 text-left transition-colors ${activeId === h.id ? "bg-sunken-2" : "hover:bg-sunken-2/60"}`}
                    >
                      <span className="block truncate font-medium">{h.title}</span>
                      <span className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                        <span className="tabular-nums">{h.time}</span>
                        <span className="flex gap-1">
                          {h.models.map((m) => (
                            <span key={m} className="inline-flex" title={modelById(m).label}>
                              <Dot color={modelById(m).color} className="!size-1.5" />
                              <span className="sr-only">{modelById(m).label}</span>
                            </span>
                          ))}
                        </span>
                        {h.mode === "multi" && <span>{h.questions.length} Fragen</span>}
                      </span>
                    </button>
                    <button
                      onClick={() => onDelete(h.id)}
                      className="absolute right-1 top-1.5 grid size-6 place-items-center rounded text-faint opacity-0 hover:bg-sunken hover:text-bad focus-visible:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100"
                      aria-label={`Lauf „${h.title}“ löschen`}
                    >
                      <X aria-hidden className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
        {filtered.length === 0 && <p className="px-2 pt-6 text-muted">Keine Läufe gefunden.</p>}
      </nav>

      {undo && (
        <div role="status" className="absolute inset-x-2 bottom-[88px] flex items-center justify-between gap-2 rounded-md bg-ink px-3 py-2 text-canvas shadow-lg">
          <span className="truncate">Lauf gelöscht</span>
          <button onClick={onUndo} className="font-semibold underline underline-offset-2">Rückgängig</button>
        </div>
      )}

      <div className="border-t border-line p-2">
        <p className="px-2 pb-1 text-xs font-medium text-faint">Verlauf exportieren</p>
        <div className="flex gap-1">
          <button onClick={() => onExport("json")} className="btn-outline flex-1"><Download aria-hidden className="size-3.5" /> JSON</button>
          <button onClick={() => onExport("csv")} className="btn-outline flex-1"><Download aria-hidden className="size-3.5" /> CSV</button>
        </div>
        <p className="px-2 pt-1.5 text-xs text-faint">Gespeichert nur in diesem Browser.</p>
      </div>
    </aside>
  );
}
