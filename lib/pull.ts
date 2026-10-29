import type { RunError } from "./types";

// Rein und ohne server-only: Route, Model-Picker und Tests nutzen dieselben Helfer.

/**
 * Ollama-Referenz wie `clef-flash:latest` oder `hf.co/org/modell:tag`: höchstens drei Segmente,
 * jedes beginnt mit Buchstabe oder Ziffer, keine Leerzeichen, kein `..`, keine URL.
 */
export function isModelRef(name: string): boolean {
  if (name.length < 1 || name.length > 200 || name.includes("..")) return false;
  return /^[a-z0-9][A-Za-z0-9._-]*(\/[a-z0-9][A-Za-z0-9._-]*){0,2}(:[A-Za-z0-9._-]+)?$/.test(name);
}

export type PullProgress = { status: string; completed: number; total: number; done: boolean; error?: string };

export const PULL_START: PullProgress = { status: "starte", completed: 0, total: 0, done: false };

const STATUS_DE: [RegExp, string][] = [
  [/^pulling manifest/, "Manifest laden"],
  [/^pulling /, "Daten laden"],
  [/^verifying/, "Prüfsumme prüfen"],
  [/^writing manifest/, "Manifest schreiben"],
  [/^success$/, "Fertig"],
];

/** Ollamas englische Statuszeilen für die UI übersetzen; Unbekanntes bleibt, wie es ist. */
export const statusText = (status: string) => STATUS_DE.find(([re]) => re.test(status))?.[1] ?? status;

/** NDJSON in ganze Zeilen zerlegen; der unvollständige Rest wartet auf den nächsten Chunk, Kaputtes fällt weg. */
export function splitLines(buffer: string): { lines: unknown[]; rest: string } {
  const parts = buffer.split("\n");
  const rest = parts.pop() ?? "";
  const lines = parts.flatMap((l) => {
    if (!l.trim()) return [];
    try {
      return [JSON.parse(l) as unknown];
    } catch {
      return [];
    }
  });
  return { lines, rest };
}

type PullEvent = { status?: string; digest?: string; total?: number; completed?: number; error?: string };

/** Fortschritt über alle Layer (`digest`) summieren; `layers` sammelt den letzten Stand je Layer. */
export function reduceProgress(
  prev: PullProgress,
  event: unknown,
  layers: Map<string, { total: number; completed: number }>,
): PullProgress {
  const e = (event ?? {}) as PullEvent;
  if (e.digest && e.total) layers.set(e.digest, { total: e.total, completed: e.completed ?? 0 });
  let total = 0;
  let completed = 0;
  for (const l of layers.values()) {
    total += l.total;
    completed += l.completed;
  }
  const status = e.error ? "Fehler" : (e.status ?? prev.status);
  return { status, completed, total, done: status === "success", ...(e.error ? { error: e.error } : {}) };
}

/** Startet `POST /api/models/pull` und meldet jeden Schritt; ohne abschließendes `success` gilt der Pull als gescheitert. */
export async function pullModel(name: string, onProgress: (p: PullProgress) => void): Promise<PullProgress> {
  const res = await fetch("/api/models/pull", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok || !res.body) {
    const json = (await res.json().catch(() => null)) as { error?: RunError } | null;
    throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const layers = new Map<string, { total: number; completed: number }>();
  let progress = PULL_START;
  let buffer = "";
  for (;;) {
    // oxlint-disable-next-line no-await-in-loop -- Stream liest Chunk für Chunk
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const { lines, rest } = splitLines(done ? `${buffer}\n` : buffer);
    buffer = rest;
    for (const line of lines) {
      progress = reduceProgress(progress, line, layers);
      onProgress(progress);
      if (progress.error) throw new Error(progress.error);
    }
    if (done) break;
  }
  if (!progress.done) throw new Error("Pull ohne Abschluss beendet.");
  return progress;
}
