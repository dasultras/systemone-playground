import { estimateTokens } from "./limits";
import { labelsFor, modelById } from "./mock-data";
import { computeMetrics } from "./metrics";
import type { Answer, Fact, ModelId, ModelRun, Question, RunError } from "./types";

/* Deterministischer Pseudo-Zufall: gleiche Eingabe → gleiche Mock-Antwort. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const gauss = (r: () => number) => Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r());

function softmax(logits: number[]): number[] {
  const m = Math.max(...logits);
  const e = logits.map((l) => Math.exp(l - m));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((x) => x / s);
}

function singlePass(q: Question, state: string, modelId: ModelId, shift: number): number[] {
  const model = modelById(modelId);
  const k = q.type === "noul" ? 2 : q.type === "score" ? q.levels : q.options.length;
  const seedKey = `${modelId}|${state}|${q.text}|${shift}`;
  const r = rng(hash(seedKey));
  const truthSeed = rng(hash(`${state}|${q.text}`))();
  const truth = q.mockTruth !== undefined && q.mockTruth < k ? q.mockTruth : Math.min(k - 1, Math.floor(truthSeed * k));

  const logits = Array.from({ length: k }, (_, i) => {
    let l = gauss(r) * model.noise;
    if (q.type === "score") l -= Math.abs(i - truth) * model.sharpness * 0.85;
    else if (i === truth) l += model.sharpness;
    return l;
  });
  if (q.mockSecond !== undefined && q.mockSecond < k && q.mockSecond !== truth) {
    // Unsicherere Modelle (mehr noise) halten die zweite Lesart fast so hoch wie die erste.
    const gap = Math.max(0.3, 2.2 - 2.4 * model.noise);
    logits[q.mockSecond] = Math.max(logits[q.mockSecond], logits[truth] - gap);
  }
  if (q.type === "choice") logits[0] += model.noise * 0.9; // Positions-Bias: erste Option
  return softmax(logits);
}

/** Antwortverteilung. Bei Choice mit `shifts` > 1 werden die Optionen zyklisch verschoben und gemittelt. */
export function mockProbs(q: Question, state: string, modelId: ModelId, shifts: number): number[] {
  if (q.type !== "choice" || shifts <= 1) return singlePass(q, state, modelId, 0);
  const k = q.options.length;
  const acc = Array.from({ length: k }, () => 0);
  for (let s = 0; s < shifts; s++) {
    // Bias hängt an der Position, nicht an der Option → beim Zurückdrehen verteilt er sich.
    const rotated = q.options.map((_, i) => q.options[(i + s) % k]);
    const p = singlePass(
      {
        ...q,
        options: rotated,
        mockTruth: ((q.mockTruth ?? 0) - s + k) % k,
        mockSecond: q.mockSecond === undefined ? undefined : (q.mockSecond - s + k) % k,
      },
      state,
      modelId,
      s,
    );
    p.forEach((v, i) => (acc[(i + s) % k] += v / shifts));
  }
  return acc;
}

export function factsBlock(facts: Fact[]): string {
  return facts.map((f) => `${f.key}: ${f.value}`).join("\n");
}

export function fullStateText(state: string, facts: Fact[]): string {
  return facts.length ? `${state}\n\n${factsBlock(facts)}` : state;
}

export type SimulatedError = "none" | "timeout" | "overflow";

export function mockRun(args: {
  modelId: ModelId;
  state: string;
  facts: Fact[];
  questions: Question[];
  average: number;
  simulate?: SimulatedError;
}): ModelRun {
  const { modelId, state, facts, questions, average, simulate = "none" } = args;
  const model = modelById(modelId);
  const text = fullStateText(state, facts);
  const tokensIn =
    estimateTokens(text) + questions.reduce((s, q) => s + estimateTokens(q.text + labelsFor(q).join(" ")) + 24, 0);
  const jitter = rng(hash(modelId + text))();
  const perQuestion = model.hosted ? 60 : 180;

  const request = {
    model: modelId,
    state: text,
    questions: questions.map((q) => ({
      type: q.type,
      question: q.text,
      ...(q.type === "choice" ? { options: q.options } : {}),
      ...(q.type === "score" ? { levels: q.levels } : {}),
    })),
    ...(average > 1 ? { average_order: average } : {}),
  };

  let error: RunError | undefined;
  if (simulate === "timeout") {
    error = {
      kind: "timeout",
      message: `Timeout nach ${model.hosted ? 30 : 120} s – keine Antwort erhalten.`,
    };
  } else if (simulate === "overflow" || tokensIn > model.contextTokens) {
    error = {
      kind: "overflow",
      message: `400 Context overflow: ≈ ${tokensIn.toLocaleString("de-DE")} Tokens > Limit ${model.contextTokens.toLocaleString("de-DE")}.`,
    };
  }

  const latencyMs = error
    ? error.kind === "timeout"
      ? model.hosted
        ? 30_000
        : 120_000
      : 180
    : Math.round((model.baseLatencyMs + questions.length * perQuestion * average) * (0.85 + jitter * 0.3));

  if (error) {
    return {
      modelId,
      error,
      answers: [],
      latencyMs,
      tokensIn,
      tokensOut: 0,
      averaged: average,
      request,
      response: { error: { type: error.kind, message: error.message } },
    };
  }

  const answers: Answer[] = questions.map((qq) => {
    const probs = mockProbs(qq, text, modelId, average);
    return { questionId: qq.id, probs, metrics: computeMetrics(probs) };
  });
  const tokensOut = questions.length * 12;
  const response = {
    model: modelId,
    answers: answers.map((a, i) => ({
      type: questions[i].type,
      probabilities: Object.fromEntries(labelsFor(questions[i]).map((l, j) => [l, Number(a.probs[j].toFixed(4))])),
    })),
    usage: { prompt_tokens: tokensIn, completion_tokens: tokensOut },
    latency_ms: latencyMs,
  };
  return { modelId, answers, latencyMs, tokensIn, tokensOut, averaged: average, request, response };
}
