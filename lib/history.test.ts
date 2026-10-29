import assert from "node:assert/strict";
import { test } from "node:test";
import { groupOf, parseHistory, timeLabel, toCsv } from "./history.ts";
import type { HistoryEntry } from "./types";

const at = (d: number, h: number, m: number) => new Date(2026, 2, d, h, m).getTime();

test("Gruppen nach lokalen Kalendertagen", () => {
  const now = at(30, 0, 1); // Tag nach der Zeitumstellung
  assert.equal(groupOf(at(30, 0, 0), now), "Heute");
  assert.equal(groupOf(at(29, 23, 59), now), "Gestern");
  assert.equal(groupOf(at(24, 12, 0), now), "Diese Woche");
  assert.equal(groupOf(at(23, 23, 59), now), "Älter");
});

test("Zeitangabe: Uhrzeit heute, Datum für Älteres", () => {
  const now = at(30, 12, 0);
  assert.equal(timeLabel(at(30, 9, 5), now), "09:05");
  assert.equal(timeLabel(at(12, 9, 5), now), "12.03.");
  assert.equal(timeLabel(new Date(2025, 2, 12).getTime(), now), "12.03.25");
});

test("parseHistory übersteht Unlesbares", () => {
  assert.deepEqual(parseHistory(null), []);
  assert.deepEqual(parseHistory("{"), []);
  assert.deepEqual(parseHistory("{}"), []);
  const base = { title: "t", at: 1, mode: "single", presetId: null, state: "", average: 1, facts: [], questions: [] };
  const ok = { ...base, id: "h1", models: ["clef-flash"], runs: [{ modelId: "clef-flash", answers: [] }] };
  const gone = { ...ok, id: "h4", models: ["gibts-nicht"], runs: [{ modelId: "gibts-nicht", answers: [] }] };
  const partial = { ...ok, id: "h5", runs: [{ modelId: "clef-flash" }] };
  const noAverage = { ...ok, id: "h6", average: undefined };
  const raw = [ok, { ...ok, id: "h2", at: "gestern" }, { id: "h3", at: 1, runs: [{}] }, gone, partial, noAverage, null];
  assert.deepEqual(parseHistory(JSON.stringify(raw)), [ok]);
  // Vorlagen kommen aus einer Datei; entfernte Vorlagen dürfen alte Einträge nicht verwerfen.
  const oldPreset = { ...ok, id: "h7", presetId: "alte-vorlage" };
  assert.deepEqual(parseHistory(JSON.stringify([oldPreset])), [oldPreset]);
});

const q = (id: string, text: string) => ({
  id,
  text,
  type: "noul" as const,
  options: [],
  levels: 5,
  scoreLow: "",
  scoreHigh: "",
});
const run = (modelId: "clef-flash" | "elephant-1:9b-q4-ctx8k") => ({
  modelId,
  answers: [],
  latencyMs: 1,
  tokensIn: 0,
  tokensOut: 0,
  averaged: 1,
  request: null,
  response: null,
});

test("CSV maskiert Anführungszeichen, Kommas und Zeilenumbrüche", () => {
  const entry = {
    id: "h1",
    title: "t",
    at: Date.UTC(2026, 9, 28, 10, 0),
    mode: "multi",
    presetId: null,
    state: "",
    facts: [],
    questions: [q("q1", 'Sagt er "ja", oder\nnein?'), q("q2", "zwei")],
    models: ["clef-flash", "elephant-1:9b-q4-ctx8k"],
    average: 1,
    runs: [run("clef-flash"), run("elephant-1:9b-q4-ctx8k")],
  } satisfies HistoryEntry;
  const csv = toCsv([entry]);
  assert.ok(csv.startsWith('"run","zeitpunkt","modell"'));
  assert.ok(csv.includes('"Sagt er ""ja"", oder\nnein?"'));
  assert.ok(csv.includes('"2026-10-28T10:00:00.000Z"'));
  // Kopf + Läufe × Fragen; eine Zeile enthält einen Umbruch im Feld.
  assert.equal(csv.split("\n").length, 1 + 2 * 2 + 2);
});
