/** Kalibrierungs-Kennzahlen für die Evaluation. Rein und ohne Abhängigkeiten, damit `node --test` es direkt lädt. */
export type Pred = { probs: number[]; label: number };

/** Mulberry32: deterministischer Zufall für Generator und Bootstrap. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
const argmax = (p: number[]) => p.indexOf(Math.max(...p));
const correct = ({ probs, label }: Pred) => (argmax(probs) === label ? 1 : 0);

export const accuracy = (preds: Pred[]) => mean(preds.map(correct));

/** Multi-Class-Brier: Σ_k (p_k − y_k)², Bereich 0–2. */
export const brier = (preds: Pred[]) =>
  mean(preds.map(({ probs, label }) => probs.reduce((s, p, k) => s + (p - (k === label ? 1 : 0)) ** 2, 0)));

export const nll = (preds: Pred[]) => mean(preds.map(({ probs, label }) => -Math.log(Math.max(probs[label], 1e-12))));

/** Top-Label-ECE mit gleich breiten Bins: Σ_b |acc_b − conf_b| · n_b / N. */
export function ece(preds: Pred[], bins = 15): number {
  const gap = Array.from({ length: bins }, () => 0);
  for (const p of preds) {
    const conf = Math.max(...p.probs);
    gap[Math.min(bins - 1, Math.floor(conf * bins))] += correct(p) - conf;
  }
  return gap.reduce((s, g) => s + Math.abs(g), 0) / preds.length;
}

/** Nach Konfidenz absteigend sortiert: Fehlerrate der sichersten k Items, AURC = Mittel über alle k. */
export function riskCoverage(preds: Pred[]): { coverage: number[]; risk: number[]; aurc: number } {
  const sorted = preds.toSorted((a, b) => Math.max(...b.probs) - Math.max(...a.probs));
  const coverage: number[] = [];
  const risk: number[] = [];
  let errors = 0;
  sorted.forEach((p, i) => {
    errors += 1 - correct(p);
    coverage.push((i + 1) / sorted.length);
    risk.push(errors / (i + 1));
  });
  return { coverage, risk, aurc: mean(risk) };
}

/** Temperature Scaling: p_i^(1/T), normiert, im Log-Raum gerechnet. */
export function scale(probs: number[], T: number): number[] {
  const logits = probs.map((p) => Math.log(Math.max(p, 1e-12)) / T);
  const max = Math.max(...logits);
  const exps = logits.map((l) => Math.exp(l - max));
  const sum = exps.reduce((s, e) => s + e, 0);
  return exps.map((e) => e / sum);
}

/** T mit minimaler NLL, Goldener Schnitt über log T in [ln 0,05, ln 20]. */
export function fitTemperature(preds: Pred[]): number {
  const f = (x: number) => nll(preds.map((p) => ({ ...p, probs: scale(p.probs, Math.exp(x)) })));
  const g = (Math.sqrt(5) - 1) / 2;
  let a = Math.log(0.05);
  let b = Math.log(20);
  let c = b - g * (b - a);
  let d = a + g * (b - a);
  let fc = f(c);
  let fd = f(d);
  for (let i = 0; i < 60; i++) {
    if (fc < fd) {
      [b, d, fd] = [d, c, fc];
      c = b - g * (b - a);
      fc = f(c);
    } else {
      [a, c, fc] = [c, d, fd];
      d = a + g * (b - a);
      fd = f(d);
    }
  }
  return Math.exp((a + b) / 2);
}

/**
 * Perzentil-Bootstrap: 95-%-KI einer Kennzahl über Resampling mit Zurücklegen. Mit `cluster` werden ganze Gruppen
 * gezogen (z. B. alle Fragen eines States), sonst einzelne Items.
 */
export function bootstrap<P extends Pred>(
  preds: P[],
  stat: (p: P[]) => number,
  n = 1000,
  seed = 1,
  cluster?: (p: P) => string,
): [number, number] {
  const groups = cluster ? [...Map.groupBy(preds, cluster).values()] : preds.map((p) => [p]);
  const r = rng(seed);
  const stats = Array.from({ length: n }, () =>
    stat(Array.from(groups, () => groups[Math.floor(r() * groups.length)]).flat()),
  ).toSorted((x, y) => x - y);
  return [stats[Math.round(0.025 * (n - 1))], stats[Math.round(0.975 * (n - 1))]];
}
