import type { Fact, ModelInfo, Question } from "./types";

/** Grobe Schätzung: Zeichen / 2,6 (deutsche Texte, JSON, Pfade). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 2.6);
}

export const fmtInt = (n: number) => n.toLocaleString("de-DE");

/** State mit angehängten Fakten, so wie er an das Modell geht. */
export function fullStateText(state: string, facts: Fact[]): string {
  return facts.length ? `${state}\n\n${facts.map((f) => `${f.key}: ${f.value}`).join("\n")}` : state;
}

/** Geschätzte Tokens des ganzen Requests: State mit Fakten plus je Frage Text, Optionen und Overhead. */
export function requestTokens(state: string, facts: Fact[], questions: Question[]): number {
  return (
    estimateTokens(fullStateText(state, facts)) +
    questions.reduce((s, q) => s + estimateTokens(q.text + q.options.join(" ")) + 24, 0)
  );
}

/** Nur bei bekanntem Limit (`contextTokens` > 0). */
export const overLimit = (tokens: number, m: ModelInfo) => m.contextTokens > 0 && tokens > m.contextTokens;
