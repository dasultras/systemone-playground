import assert from "node:assert/strict";
import { test } from "node:test";
import { bimodalPeaks, computeMetrics, expectedScore, noulVerdict, trafficLight } from "./metrics.ts";

const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≠ ${b}`);

test("confidence ist 0 bei Gleichverteilung und 1 bei Gewissheit", () => {
  close(computeMetrics([0.25, 0.25, 0.25, 0.25]).confidence, 0);
  close(computeMetrics([0, 1, 0]).confidence, 1);
  close(computeMetrics([0.25, 0.25, 0.25, 0.25]).entropy, 1);
});

test("Kennzahlen einer Choice-Verteilung", () => {
  const m = computeMetrics([0.1, 0.7, 0.2]);
  assert.equal(m.topIndex, 1);
  close(m.confidence, (0.7 - 1 / 3) / (1 - 1 / 3));
  close(m.margin, 0.5);
  assert.equal(m.light, "yellow"); // confidence 0,55 < 0,6
});

test("Ampel an den Grenzen", () => {
  assert.equal(trafficLight(0.6, 0.3), "green");
  assert.equal(trafficLight(0.59, 0.3), "yellow");
  assert.equal(trafficLight(0.24, 0.5), "red");
  assert.equal(trafficLight(0.9, 0.09), "red");
});

test("Noul-Band 0,3–0,7", () => {
  assert.equal(noulVerdict(0.71), "yes");
  assert.equal(noulVerdict(0.7), "unclear");
  assert.equal(noulVerdict(0.3), "unclear");
  assert.equal(noulVerdict(0.29), "no");
});

test("Score: Erwartungswert und zwei Gipfel", () => {
  close(expectedScore([0, 0, 1, 0, 0]), 3);
  assert.deepEqual(bimodalPeaks([0.4, 0.05, 0.05, 0.1, 0.4]), [1, 5]);
  assert.equal(bimodalPeaks([0.05, 0.2, 0.5, 0.2, 0.05]), null);
});
