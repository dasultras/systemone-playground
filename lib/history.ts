import { labelsFor, presetById } from "./mock-data";
import { mockRun } from "./mock-run";
import type { HistoryEntry, ModelId } from "./types";

function seed(
  id: string,
  presetId: string,
  models: ModelId[],
  time: string,
  group: HistoryEntry["group"],
  average = 1,
): HistoryEntry {
  const p = presetById(presetId)!;
  return {
    id,
    title: p.title,
    time,
    group,
    mode: p.mode,
    presetId,
    state: p.state,
    facts: p.facts,
    questions: p.questions,
    models,
    average,
    runs: models.map((modelId) =>
      mockRun({ modelId, state: p.state, facts: p.facts, questions: p.questions, average }),
    ),
  };
}

export function seedHistory(): HistoryEntry[] {
  return [
    seed("h1", "server-role", ["elephant-1:9b-q4-ctx8k", "jev-latest", "clef-flash"], "11:42", "Heute", 3),
    seed("h2", "dll-bundle", ["elephant-1:9b-q4-ctx8k", "pplx-decider"], "10:15", "Heute"),
    seed("h3", "patch-urgency", ["clef-flash", "jev-latest"], "17:03", "Gestern"),
    seed("h4", "cpe-match", ["elephant-1:9b-q4-ctx8k"], "14:20", "Gestern"),
    seed("h5", "dll-owner", ["pplx-decider", "jev-latest"], "Mo", "Diese Woche"),
  ];
}

export function toJson(entries: HistoryEntry[]): string {
  return JSON.stringify(entries, null, 2);
}

export function toCsv(entries: HistoryEntry[]): string {
  const head = ["run", "zeit", "modell", "frage", "typ", "antwort", "p_max", "confidence", "margin", "entropie", "latenz_ms", "fehler"];
  const rows: (string | number)[][] = [];
  for (const e of entries) {
    for (const r of e.runs) {
      for (const q of e.questions) {
        const a = r.answers.find((x) => x.questionId === q.id);
        rows.push([
          e.id,
          `${e.group} ${e.time}`,
          r.modelId,
          q.text,
          q.type,
          a ? labelsFor(q)[a.metrics.topIndex] : "",
          a ? a.metrics.pMax.toFixed(4) : "",
          a ? a.metrics.confidence.toFixed(4) : "",
          a ? a.metrics.margin.toFixed(4) : "",
          a ? a.metrics.entropy.toFixed(4) : "",
          r.latencyMs,
          r.error?.kind ?? "",
        ]);
      }
    }
  }
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  return [head, ...rows].map((r) => r.map(esc).join(",")).join("\n");
}

export function download(name: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
