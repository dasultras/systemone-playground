import assert from "node:assert/strict";
import { test } from "node:test";
import {
  accuracy,
  bootstrap,
  brier,
  ece,
  fitTemperature,
  nll,
  riskCoverage,
  rng,
  scale,
  type Pred,
} from "./calibration.ts";

const close = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);

test("Brier und NLL", () => {
  close(brier([{ probs: [0, 1, 0], label: 1 }]), 0);
  close(brier([{ probs: [0.5, 0.5], label: 0 }]), 0.5);
  close(nll([{ probs: [0.25, 0.75], label: 1 }]), -Math.log(0.75));
  close(nll([{ probs: [0, 1], label: 0 }]), -Math.log(1e-12));
});

test("ECE: 0 bei perfekter Kalibrierung, sonst gewichtete Bin-Lücke", () => {
  // conf 0,8, davon 4 von 5 richtig
  const calibrated = [0, 0, 0, 0, 1].map((label) => ({ probs: [0.8, 0.2], label }));
  close(ece(calibrated), 0);
  // Bin 0,9: conf 0,9, acc 0,5 → 0,4 · 2/4; Bin 0,6: conf 0,6, acc 1 → 0,4 · 2/4
  const preds = [
    { probs: [0.9, 0.1], label: 0 },
    { probs: [0.9, 0.1], label: 1 },
    { probs: [0.4, 0.6], label: 1 },
    { probs: [0.4, 0.6], label: 1 },
  ];
  close(ece(preds), 0.4);
  close(accuracy(preds), 0.75);
});

test("Risk-Coverage und AURC", () => {
  const { coverage, risk, aurc } = riskCoverage([
    { probs: [0.6, 0.4], label: 1 }, // unsicherster, falsch
    { probs: [0.9, 0.1], label: 0 },
    { probs: [0.2, 0.8], label: 0 }, // falsch
  ]);
  assert.deepEqual(coverage, [1 / 3, 2 / 3, 1]);
  assert.deepEqual(risk, [0, 1 / 2, 2 / 3]);
  close(aurc, (0 + 1 / 2 + 2 / 3) / 3);
});

test("Temperature Scaling", () => {
  scale([0.2, 0.3, 0.5], 1).forEach((p, i) => close(p, [0.2, 0.3, 0.5][i]));
  scale([0.05, 0.15, 0.8], 1e6).forEach((p) => close(p, 1 / 3, 1e-5));
});

test("fitTemperature findet T ≈ 2 bei übersteilten Vorhersagen", () => {
  const r = rng(7);
  const preds: Pred[] = Array.from({ length: 20_000 }, () => {
    const truth = scale([r(), r(), r()], 0.25); // wahre Verteilung
    const u = r();
    const label = u < truth[0] ? 0 : u < truth[0] + truth[1] ? 1 : 2;
    return { probs: scale(truth, 0.5), label }; // Modell zu sicher: p²
  });
  close(fitTemperature(preds), 2, 0.1);
});

test("Bootstrap ist deterministisch und umschließt den Punktwert", () => {
  const r = rng(3);
  const preds = Array.from({ length: 200 }, () => ({ probs: scale([r(), r()], 0.3), label: r() < 0.5 ? 0 : 1 }));
  const ci = bootstrap(preds, brier, 500, 11);
  assert.deepEqual(bootstrap(preds, brier, 500, 11), ci);
  assert.ok(ci[0] <= brier(preds) && brier(preds) <= ci[1]);
});

test("Cluster-Bootstrap zieht ganze Gruppen", () => {
  const r = rng(5);
  const preds = Array.from({ length: 50 }, () => ({ probs: scale([r(), r()], 0.3), label: r() < 0.5 ? 0 : 1 }));
  // Jedes Item fünfmal in einer Gruppe: gleiche Ziehungen, gleiche Mittelwerte wie ohne Kopien.
  const copies = preds.flatMap((p, i) => Array.from({ length: 5 }, () => ({ ...p, group: String(i) })));
  const [lo, hi] = bootstrap(copies, brier, 200, 9, (p) => p.group);
  const [plo, phi] = bootstrap(preds, brier, 200, 9);
  close(lo, plo, 1e-12);
  close(hi, phi, 1e-12);
});
