import type { Fact } from "./types";

/** Grobe Schätzung: Zeichen / 2,6 (deutsche Texte, JSON, Pfade). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 2.6);
}

export const fmtInt = (n: number) => n.toLocaleString("de-DE");

/** State mit angehängten Fakten, so wie er an das Modell geht. */
export function fullStateText(state: string, facts: Fact[]): string {
  return facts.length ? `${state}\n\n${facts.map((f) => `${f.key}: ${f.value}`).join("\n")}` : state;
}
