import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { DEFAULT_PRESETS_FILE, loadPresets, parsePresets } from "./presets.ts";

const read = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const one = (q: object, rest: object = {}) =>
  JSON.stringify([{ id: "a", title: "A", mode: "single", state: "s", questions: [{ id: "q1", ...q }], ...rest }]);

test("Standarddatei enthält genau eine Vorlage", () => {
  assert.equal(parsePresets(read(DEFAULT_PRESETS_FILE)).length, 1);
});

test("Beispieldatei zeigt alle Fragetypen und ein Bündel mit Regel", () => {
  const ps = parsePresets(read("examples/presets.example.json"));
  const types = new Set(ps.flatMap((p) => p.questions.map((q) => q.type)));
  assert.deepEqual([...types].toSorted(), ["choice", "noul", "score"]);
  assert.ok(ps.some((p) => p.mode === "multi" && p.rule && p.questions.length > 1));
});

test("Defaults werden ergänzt", () => {
  const [p] = parsePresets(one({ text: "Frage?", type: "noul" }));
  assert.deepEqual(p.facts, []);
  assert.equal(p.rule, undefined);
  assert.deepEqual(p.questions[0], {
    id: "q1",
    text: "Frage?",
    type: "noul",
    options: [],
    levels: 5,
    scoreLow: "niedrig",
    scoreHigh: "hoch",
  });
});

test("Ungültiges wirft", () => {
  assert.throws(() => parsePresets("{"));
  assert.throws(() => parsePresets("[]"));
  assert.throws(() => parsePresets(one({ text: "Welche?", type: "choice", options: ["nur eine"] })));
  const ok = JSON.parse(one({ text: "Frage?", type: "noul" }));
  assert.throws(() => parsePresets(JSON.stringify([...ok, ...ok])), /eindeutig/);
  const two = { ...ok[0], questions: [ok[0].questions[0], { ...ok[0].questions[0], id: "q2" }] };
  assert.throws(() => parsePresets(JSON.stringify([two])));
  assert.throws(() => parsePresets(JSON.stringify([{ ...ok[0], title: "  " }])));
  assert.equal(parsePresets(JSON.stringify([{ ...two, mode: "multi" }]))[0].questions.length, 2);
});

test("Fehlende Datei fällt auf den Standard zurück", async (t) => {
  const warn = t.mock.method(console, "warn", () => {});
  const ps = await loadPresets("gibts/nicht.json");
  assert.deepEqual(
    ps.map((p) => p.id),
    ["himmel"],
  );
  assert.match(String(warn.mock.calls[0].arguments[0]), /gibts\/nicht\.json unbrauchbar \(ENOENT\)/);
});
