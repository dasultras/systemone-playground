import { legacyModelId } from "./models.ts";
import { labelsFor } from "./questions.ts";
import type { HistoryEntry, HistoryGroup } from "./types";

export const HISTORY_KEY = "playground.history";
export const MAX_HISTORY = 50;

const midnight = (t: number) => {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

/** Gruppe nach Kalendertagen in lokaler Zeit; Rundung fängt Sommer-/Winterzeit ab. */
export function groupOf(at: number, now = Date.now()): HistoryGroup {
  const days = Math.round((midnight(now) - midnight(at)) / 86_400_000);
  return days <= 0 ? "Heute" : days === 1 ? "Gestern" : days < 7 ? "Diese Woche" : "Älter";
}

export function timeLabel(at: number, now = Date.now()): string {
  const d = new Date(at);
  const g = groupOf(at, now);
  if (g === "Diese Woche") return d.toLocaleDateString("de-DE", { weekday: "short" });
  if (g === "Älter") {
    // Jahr nur, wenn es vom aktuellen abweicht.
    const year = d.getFullYear() === new Date(now).getFullYear() ? undefined : "2-digit";
    return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year });
  }
  return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

/** Liest gespeicherte Einträge; Unlesbares fällt still weg. */
export function parseHistory(raw: string | null): HistoryEntry[] {
  let data: unknown;
  try {
    data = JSON.parse(raw ?? "[]");
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  // Jedes Feld, das Anzeige oder Export lesen, muss passen; sonst stürzt die Auswahl ab.
  // Nicht mehr verfügbare Modelle bleiben erhalten, die Anzeige leitet Name und Farbe aus der ID ab.
  return data
    .filter(
      (e): e is HistoryEntry =>
        typeof e === "object" &&
        e !== null &&
        typeof e.at === "number" &&
        typeof e.id === "string" &&
        typeof e.title === "string" &&
        typeof e.state === "string" &&
        typeof e.average === "number" &&
        (e.mode === "single" || e.mode === "multi") &&
        (e.presetId === null || typeof e.presetId === "string") &&
        ["facts", "questions", "models", "runs"].every((k) => Array.isArray(e[k])) &&
        e.runs.every((r: { answers?: unknown } | null) => Array.isArray(r?.answers)) &&
        [...e.models, ...e.runs.map((r: { modelId: unknown }) => r.modelId)].every((id) => typeof id === "string"),
    )
    .map((e) => ({
      ...e,
      // IDs ohne Präfix stammen aus der Zeit vor der freien Modellwahl.
      models: e.models.map(legacyModelId),
      runs: e.runs.map((r) => ({ ...r, modelId: legacyModelId(r.modelId) })),
    }));
}

// Verlauf liegt im Speicher und zusätzlich in localStorage, wie die Spaltenbreiten in resize-handle.tsx.
let cache: HistoryEntry[] | undefined;
const listeners = new Set<() => void>();

/** Stabiler Server-Snapshot: Auf dem Server gibt es keinen Verlauf. */
export const NO_HISTORY: HistoryEntry[] = [];

export function subscribeHistory(cb: () => void) {
  // Änderungen aus anderen Tabs neu einlesen; key null heißt localStorage.clear().
  const onStorage = (e: StorageEvent) => {
    if (e.key !== HISTORY_KEY && e.key !== null) return;
    cache = undefined;
    cb();
  };
  listeners.add(cb);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function readHistory(): HistoryEntry[] {
  if (!cache) {
    try {
      cache = parseHistory(localStorage.getItem(HISTORY_KEY));
    } catch {
      cache = [];
    }
  }
  return cache;
}

export function writeHistory(next: HistoryEntry[]) {
  cache = next.slice(0, MAX_HISTORY);
  for (let keep = cache; ; keep = keep.slice(0, Math.ceil(keep.length / 2))) {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(keep));
      cache = keep; // Anzeige zeigt nur, was einen Reload übersteht.
      break;
    } catch {
      // Speicher voll oder nicht verfügbar: neuere Hälfte versuchen, zuletzt nur im Speicher halten.
      if (keep.length <= 1) break;
    }
  }
  listeners.forEach((l) => l());
}

export function toJson(entries: HistoryEntry[]): string {
  return JSON.stringify(entries, null, 2);
}

const csvCell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;

export function toCsv(entries: HistoryEntry[]): string {
  const head = [
    "run",
    "zeitpunkt",
    "modell",
    "frage",
    "typ",
    "antwort",
    "p_max",
    "confidence",
    "margin",
    "entropie",
    "latenz_ms",
    "laden_ms",
    "fehler",
  ];
  const rows: (string | number)[][] = [];
  for (const e of entries) {
    for (const r of e.runs) {
      for (const q of e.questions) {
        const a = r.answers.find((x) => x.questionId === q.id);
        rows.push([
          e.id,
          new Date(e.at).toISOString(),
          r.modelId,
          q.text,
          q.type,
          a ? labelsFor(q)[a.metrics.topIndex] : "",
          a ? a.metrics.pMax.toFixed(4) : "",
          a ? a.metrics.confidence.toFixed(4) : "",
          a ? a.metrics.margin.toFixed(4) : "",
          a ? a.metrics.entropy.toFixed(4) : "",
          r.latencyMs,
          r.loadMs ?? "",
          r.error?.kind ?? "",
        ]);
      }
    }
  }
  return [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
}

export function download(name: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
