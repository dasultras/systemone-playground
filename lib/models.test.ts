import assert from "node:assert/strict";
import { test } from "node:test";
import { fromOllama, fromVllm, legacyModelId, modelColor, modelMeta, parseModelId, pickDefault } from "./models.ts";

test("parseModelId: nur bekannte Präfixe, Namen mit Doppelpunkten", () => {
  assert.deepEqual(parseModelId("ollama:elephant-1:9b-q4-ctx8k"), {
    backend: "ollama",
    name: "elephant-1:9b-q4-ctx8k",
  });
  assert.deepEqual(parseModelId("vllm:org/modell:v2"), { backend: "vllm", name: "org/modell:v2" });
  assert.equal(parseModelId("elephant-1:9b-q4-ctx8k"), null);
  assert.equal(parseModelId("ollama:"), null);
});

test("legacyModelId: Präfix für alte IDs", () => {
  assert.equal(legacyModelId("jev-latest"), "typesafe:jev-latest");
  assert.equal(legacyModelId("elephant-1:9b-q4-ctx8k"), "ollama:elephant-1:9b-q4-ctx8k");
  assert.equal(legacyModelId("vllm:x"), "vllm:x");
  assert.equal(legacyModelId("typesafe:jev-latest"), "typesafe:jev-latest");
});

test("modelColor: deterministisch, sechs Tokens", () => {
  const ids = ["ollama:a", "ollama:b", "vllm:c", "typesafe:jev-latest", "ollama:clef-flash", "x"];
  for (const id of ids) {
    assert.equal(modelColor(id), modelColor(id));
    assert.match(modelColor(id), /^var\(--model-[1-6]\)$/);
  }
});

test("modelMeta: unbekannte ID stürzt nicht ab", () => {
  const m = modelMeta("ollama:gibts-nicht:latest");
  assert.equal(m.label, "gibts-nicht");
  assert.equal(m.backend, "ollama");
  assert.equal(m.hosted, false);
  assert.equal(m.contextTokens, 0);
  assert.equal(m.size, "nicht verfügbar");
  assert.equal(modelMeta("typesafe:jev-latest").hosted, true);
  assert.equal(modelMeta("ohne-praefix").backend, "ollama");
  assert.equal(modelMeta("jev-latest").backend, "typesafe");
});

test("fromOllama: Capability, Kontextlimit und Größe", () => {
  const tag = {
    name: "elephant-1:9b-q4-ctx8k",
    capabilities: ["decision", "vision"],
    details: { parameter_size: "8.95B", quantization_level: "Q4_K_M" },
  };
  const show = {
    parameters: "num_batch 8192\nnum_ctx                        8192",
    model_info: { "qwen35.context_length": 262144 },
  };
  const m = fromOllama(tag, show)!;
  assert.equal(m.id, "ollama:elephant-1:9b-q4-ctx8k");
  assert.equal(m.contextTokens, 8192); // num_ctx gewinnt gegen model_info
  assert.equal(m.size, "8.95B · Q4_K_M · 8k");
  // Ohne num_ctx: *.context_length; `:latest` fällt weg, damit alte IDs passen.
  const clef = fromOllama(
    { name: "clef-flash:latest" },
    { capabilities: ["decision"], model_info: { "clef.context_length": 16384 } },
  )!;
  assert.equal(clef.id, "ollama:clef-flash");
  assert.equal(clef.contextTokens, 16384);
  assert.equal(clef.size, "16k");
  assert.equal(fromOllama({ name: "chat", capabilities: ["completion"] }, { capabilities: ["decision"] }), null);
  assert.equal(fromOllama({ name: "chat" }, {}), null);
  assert.equal(fromOllama({ name: "x", capabilities: ["decision"] }, {})!.contextTokens, 0);
});

test("fromVllm", () => {
  const m = fromVllm({ id: "org/modell", max_model_len: 32768 });
  assert.deepEqual(
    [m.id, m.backend, m.hosted, m.contextTokens, m.size],
    ["vllm:org/modell", "vllm", false, 32768, "32k"],
  );
});

test("pickDefault: Env, sonst erstes Ollama-Modell", () => {
  const models = [modelMeta("vllm:v"), modelMeta("ollama:a"), modelMeta("ollama:b")];
  assert.equal(pickDefault(models, "ollama:b"), "ollama:b");
  assert.equal(pickDefault(models, "b"), "ollama:b");
  assert.equal(pickDefault(models, "ollama:weg"), "ollama:a");
  assert.equal(pickDefault(models), "ollama:a");
  assert.equal(pickDefault([modelMeta("vllm:v")]), "vllm:v");
  assert.equal(pickDefault([]), null);
});
