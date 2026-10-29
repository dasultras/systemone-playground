import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PULL_START,
  isModelRef,
  pullModel,
  reduceProgress,
  splitLines,
  statusText,
  type PullProgress,
} from "./pull.ts";

test("splitLines: Zeile über Chunks, kaputte Zeile fällt weg", () => {
  const a = splitLines('{"status":"pulling manifest"}\n{"status":"pul');
  assert.deepEqual(a.lines, [{ status: "pulling manifest" }]);
  assert.equal(a.rest, '{"status":"pul');
  const b = splitLines(`${a.rest}ling"}\nkein json\n\n{"status":"success"}\n`);
  assert.deepEqual(b.lines, [{ status: "pulling" }, { status: "success" }]);
  assert.equal(b.rest, "");
});

test("reduceProgress: summiert Layer, success und Fehler", () => {
  const layers = new Map<string, { total: number; completed: number }>();
  let p = reduceProgress(PULL_START, { status: "pulling a", digest: "a", total: 100, completed: 50 }, layers);
  p = reduceProgress(p, { status: "pulling b", digest: "b", total: 300, completed: 0 }, layers);
  p = reduceProgress(p, { status: "pulling a", digest: "a", total: 100, completed: 100 }, layers);
  assert.deepEqual(p, { status: "pulling a", completed: 100, total: 400, done: false });
  p = reduceProgress(p, { status: "verifying sha256 digest" }, layers);
  assert.equal(p.total, 400);
  assert.equal(reduceProgress(p, { status: "success" }, layers).done, true);
  const err = reduceProgress(p, { error: "pull model manifest: file does not exist" }, layers);
  assert.equal(err.error, "pull model manifest: file does not exist");
  assert.equal(err.done, false);
});

test("isModelRef: Referenzen ja, Leerzeichen, Pfade und URLs nein", () => {
  for (const ok of ["hf.co/waseigo/elephant-1-decision-GGUF:latest", "clef-flash", "clef-flash:latest", "org/m:v2"])
    assert.equal(isModelRef(ok), true, ok);
  for (const bad of ["a b", "../x", "http://x", "/x", "", "a/b/c/d", "x:", "A", "a".repeat(201)])
    assert.equal(isModelRef(bad), false, bad);
});

const ndjson = (chunks: string[], status = 200) =>
  new Response(
    new ReadableStream({
      start(c) {
        for (const ch of chunks) c.enqueue(new TextEncoder().encode(ch));
        c.close();
      },
    }),
    { status },
  );

test("pullModel: liest den Stream mit gestubbtem fetch, nie ein echter Request", async (t) => {
  const calls: [string, RequestInit | undefined][] = [];
  const reply = { current: () => ndjson([]) };
  t.mock.method(globalThis, "fetch", async (url: string, init?: RequestInit) => {
    calls.push([url, init]);
    return reply.current();
  });

  reply.current = () =>
    ndjson(['{"status":"pulling a","digest":"a","total":10,', '"completed":5}\n{"status":"success"}', "\n"]);
  const seen: PullProgress[] = [];
  const done = await pullModel("clef-flash:latest", (p) => seen.push(p));
  assert.equal(calls[0][0], "/api/models/pull");
  assert.equal(calls[0][1]?.body, JSON.stringify({ name: "clef-flash:latest" }));
  assert.deepEqual(
    seen.map((p) => p.status),
    ["pulling a", "success"],
  );
  assert.deepEqual(done, { status: "success", completed: 5, total: 10, done: true });

  reply.current = () => ndjson(['{"status":"pulling manifest"}\n']);
  await assert.rejects(
    pullModel("x", () => {}),
    /ohne Abschluss/,
  );

  reply.current = () => ndjson(['{"error":"kaputt"}\n']);
  await assert.rejects(
    pullModel("x", () => {}),
    /kaputt/,
  );

  reply.current = () => Response.json({ error: { kind: "api", message: "Pullen ist deaktiviert" } }, { status: 403 });
  await assert.rejects(
    pullModel("x", () => {}),
    /Pullen ist deaktiviert/,
  );
});

test("statusText: übersetzt Ollamas Status, Unbekanntes bleibt", () => {
  assert.equal(statusText("pulling manifest"), "Manifest laden");
  assert.equal(statusText("pulling 1a2b3c"), "Daten laden");
  assert.equal(statusText("verifying sha256 digest"), "Prüfsumme prüfen");
  assert.equal(statusText("success"), "Fertig");
  assert.equal(statusText("starte"), "starte");
});
