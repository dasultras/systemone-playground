"use client";

import { Download, Search, SquarePen, X } from "lucide-react";
import { useState } from "react";
import { modelById } from "@/lib/mock-data";
import type { HistoryEntry } from "@/lib/types";

type Props = {
  history: HistoryEntry[];
  activeId: string | null;
  onSelect: (e: HistoryEntry) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onExport: (kind: "json" | "csv") => void;
  onClose: () => void;
};

const GROUPS: HistoryEntry["group"][] = ["Heute", "Gestern", "Diese Woche"];

export function Sidebar({ history, activeId, onSelect, onNew, onDelete, onExport, onClose }: Props) {
  const [query, setQuery] = useState("");
  const filtered = history.filter((h) => `${h.title} ${h.questions.map((q) => q.text).join(" ")}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <aside className="flex h-full w-[272px] shrink-0 flex-col border-r border-line bg-sunken/70 backdrop-blur">
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <div className="flex items-center gap-2.5">
          <div className="grid size-7 place-items-center rounded-lg bg-ink font-mono text-sm font-bold text-canvas">d·</div>
          <span className="text-[15px] font-semibold tracking-tight">Decision Playground</span>
        </div>
        <button onClick={onClose} className="btn-ghost !p-1.5 lg:hidden" aria-label="Seitenleiste schließen">
          <X className="size-4" />
        </button>
      </div>

      <div className="space-y-2 px-3 pb-2 pt-2">
        <button onClick={onNew} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors hover:bg-sunken-2/70">
          <SquarePen className="size-4 text-muted" /> Neuer Lauf
        </button>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Verlauf durchsuchen"
            className="w-full rounded-lg bg-sunken-2/60 py-1.5 pl-8 pr-3 text-sm outline-none placeholder:text-faint focus:ring-2 focus:ring-accent/40"
          />
        </div>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {GROUPS.map((g) => {
          const items = filtered.filter((h) => h.group === g);
          if (!items.length) return null;
          return (
            <div key={g} className="mt-4">
              <div className="px-2.5 pb-1 text-[11px] font-medium text-faint">{g}</div>
              {items.map((h) => (
                <div key={h.id} className="group relative">
                  <button
                    onClick={() => onSelect(h)}
                    className={`w-full rounded-lg px-2.5 py-2 text-left transition-colors ${
                      activeId === h.id ? "bg-sunken-2" : "hover:bg-sunken-2/60"
                    }`}
                  >
                    <div className="truncate text-sm">{h.title}</div>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted">
                      <span>{h.time}</span>
                      <span className="flex gap-0.5">
                        {h.models.map((m) => (
                          <span key={m} className="size-1.5 rounded-full" style={{ background: modelById(m).color }} title={modelById(m).label} />
                        ))}
                      </span>
                      {h.mode === "multi" && <span>{h.questions.length} Fragen</span>}
                    </div>
                  </button>
                  <button
                    onClick={() => onDelete(h.id)}
                    className="absolute right-1.5 top-2 hidden rounded p-1 text-faint hover:bg-sunken hover:text-bad group-hover:block"
                    aria-label="Lauf löschen"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          );
        })}
        {filtered.length === 0 && <p className="px-2.5 pt-6 text-sm text-muted">Keine Läufe gefunden.</p>}
      </nav>

      <div className="border-t border-line p-3">
        <div className="mb-1.5 px-2.5 text-[11px] font-medium text-faint">Historie exportieren</div>
        <div className="flex gap-2">
          <button onClick={() => onExport("json")} className="btn-ghost flex-1 !justify-start border border-line">
            <Download className="size-3.5" /> JSON
          </button>
          <button onClick={() => onExport("csv")} className="btn-ghost flex-1 !justify-start border border-line">
            <Download className="size-3.5" /> CSV
          </button>
        </div>
        <p className="mt-2 px-2.5 text-[11px] text-faint">Nur im Browser gespeichert.</p>
      </div>
    </aside>
  );
}
