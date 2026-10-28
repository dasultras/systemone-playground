import type { Light, Metrics } from "./types";

/** Einheitliche Kennzahlen für alle Modelle (TypeSafe-Definition von confidence). */
export function computeMetrics(probs: number[]): Metrics {
  const k = probs.length;
  const ranked = probs.map((p, i) => ({ p, i })).toSorted((a, b) => b.p - a.p);
  const pMax = ranked[0]?.p ?? 0;
  const p2 = ranked[1]?.p ?? 0;
  const confidence = k > 1 ? (pMax - 1 / k) / (1 - 1 / k) : 1;
  const margin = pMax - p2;
  const entropy = k > 1 ? -probs.reduce((s, p) => s + (p > 0 ? p * Math.log(p) : 0), 0) / Math.log(k) : 0;
  return {
    k,
    topIndex: ranked[0]?.i ?? 0,
    pMax,
    p2,
    confidence,
    margin,
    entropy,
    light: trafficLight(confidence, margin),
  };
}

export function trafficLight(confidence: number, margin: number): Light {
  if (confidence >= 0.6 && margin >= 0.3) return "green";
  if (confidence < 0.25 || margin < 0.1) return "red";
  return "yellow";
}

export const NOUL_BAND: [number, number] = [0.3, 0.7];

export function noulVerdict(pTrue: number): "yes" | "no" | "unclear" {
  if (pTrue > NOUL_BAND[1]) return "yes";
  if (pTrue < NOUL_BAND[0]) return "no";
  return "unclear";
}

export function expectedScore(probs: number[]): number {
  return probs.reduce((s, p, i) => s + (i + 1) * p, 0);
}

/** Zwei deutlich getrennte Gipfel mit Tal dazwischen. Gibt die Level (1-basiert) zurück. */
export function bimodalPeaks(probs: number[]): [number, number] | null {
  const peaks: number[] = [];
  for (let i = 0; i < probs.length; i++) {
    const l = probs[i - 1] ?? 0;
    const r = probs[i + 1] ?? 0;
    if (probs[i] >= 0.2 && probs[i] > l && probs[i] >= r) peaks.push(i);
  }
  if (peaks.length < 2) return null;
  const [a, b] = peaks
    .toSorted((x, y) => probs[y] - probs[x])
    .slice(0, 2)
    .toSorted((x, y) => x - y);
  const valley = Math.min(...probs.slice(a, b + 1));
  return valley < 0.6 * Math.min(probs[a], probs[b]) ? [a + 1, b + 1] : null;
}

export const fmtPct = (p: number, digits = 1) => `${(p * 100).toFixed(digits).replace(".", ",")} %`;

export const fmtNum = (n: number, digits = 2) => n.toFixed(digits).replace(".", ",");
