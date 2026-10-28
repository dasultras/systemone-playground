/** Grobe Schätzung: Zeichen / 2,6 (deutsche Texte, JSON, Pfade). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 2.6);
}

export const fmtInt = (n: number) => n.toLocaleString("de-DE");
