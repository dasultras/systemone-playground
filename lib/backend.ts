import "server-only";
import {
  APIConnectionError,
  APIError,
  APITimeoutError,
  TypeSafeClient,
  choice,
  noul,
  score,
  type ChoiceResponse,
  type Questions,
  type Question as SdkQuestion,
  type SystemOneResult,
  type TypeSafeClientConfig,
} from "@typesafe-ai/sdk";
import { computeMetrics } from "./metrics";
import { modelById } from "./models";
import { labelsFor } from "./questions";
import { errorRun, type RunRequest } from "./run";
import type { ModelInfo, ModelRun, Question, RunError } from "./types";

/** Ollama spricht nativ das Jev-Schema; beide Backends nutzen denselben SDK-Client. */
const CONFIG: Record<ModelInfo["backend"], TypeSafeClientConfig> = {
  typesafe: { timeout: 30_000 },
  ollama: {
    baseURL: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
    apiKey: "ollama",
    compression: false,
    timeout: 120_000,
    retry: { maxRetries: 0 },
  },
};
const clients: Partial<Record<ModelInfo["backend"], TypeSafeClient>> = {};
// Lazy, damit ein fehlender TYPESAFE_API_KEY nur TypeSafe-Läufe scheitern lässt.
const client = (b: ModelInfo["backend"]) => (clients[b] ??= new TypeSafeClient(CONFIG[b]));

/** Choice mit `average` > 1: zyklisch verschobene Kopien unter `id~s`, gegen Positions-Bias. */
const shifts = (q: Question, average: number) => (q.type === "choice" ? Math.min(average, q.options.length) : 1);
const key = (q: Question, s: number) => (s ? `${q.id}~${s}` : q.id);

function toQuestions(questions: Question[], average: number): Questions {
  return Object.fromEntries(
    questions.flatMap((q): [string, SdkQuestion][] => {
      if (q.type === "noul") return [[q.id, noul(q.text)]];
      if (q.type === "score") {
        const levels = Array.from({ length: q.levels }, (_, i) =>
          i === 0 ? q.scoreLow : i === q.levels - 1 ? q.scoreHigh : null,
        );
        return [[q.id, score(q.text, levels)]];
      }
      const labels = labelsFor(q);
      return Array.from({ length: shifts(q, average) }, (_, s) => [
        key(q, s),
        choice(q.text, Object.fromEntries([...labels.slice(s), ...labels.slice(0, s)].map((l) => [l, null]))),
      ]);
    }),
  );
}

/** Wahrscheinlichkeiten in der Reihenfolge von `labelsFor(q)`. */
function probsOf(q: Question, answers: SystemOneResult<Questions>["answers"], average: number): number[] {
  const a = answers[q.id];
  if (a.type === "noul") return [a.noul, 1 - a.noul];
  if (a.type === "score") return Array.from({ length: q.levels }, (_, i) => a.probabilities[i]);
  const n = shifts(q, average);
  const runs = Array.from({ length: n }, (_, s) => answers[key(q, s)] as ChoiceResponse);
  return labelsFor(q).map((l) => runs.reduce((sum, r) => sum + r.probabilities[l], 0) / n);
}

function toError(e: unknown, backend: ModelInfo["backend"]): RunError {
  if (e instanceof APITimeoutError) return { kind: "timeout", message: `Timeout nach ${e.timeoutMs / 1000} s.` };
  if (e instanceof APIError) {
    const overflow = e.status === 413 || (e.status === 400 && /context|exceed/i.test(e.message));
    return { kind: overflow ? "overflow" : "api", message: e.message, status: e.status };
  }
  if (e instanceof APIConnectionError && backend === "ollama")
    return { kind: "network", message: "Ollama nicht erreichbar (OLLAMA_BASE_URL). Läuft „ollama serve“?" };
  const message = e instanceof Error ? e.message : String(e);
  return { kind: e instanceof APIConnectionError ? "network" : "api", message };
}

export async function runModel(
  { modelId, state, facts, questions, average }: RunRequest,
  signal: AbortSignal,
): Promise<ModelRun> {
  const request = {
    model: modelId,
    state: facts.length ? { text: state, facts: Object.fromEntries(facts.map((f) => [f.key, f.value])) } : state,
    questions: toQuestions(questions, average),
  };
  const { backend } = modelById(modelId);
  const started = performance.now();
  const latency = () => Math.round(performance.now() - started);
  try {
    const response = await client(backend).systemOne(request, { signal });
    const answers = questions.map((q) => {
      const probs = probsOf(q, response.answers, average);
      return { questionId: q.id, probs, metrics: computeMetrics(probs) };
    });
    const { input_tokens, output_tokens } = response.usage;
    return {
      modelId,
      answers,
      latencyMs: latency(),
      tokensIn: input_tokens ?? 0,
      tokensOut: output_tokens ?? 0,
      averaged: average,
      request,
      response,
    };
  } catch (e) {
    const response = e instanceof APIError ? e.body : null;
    return errorRun(modelId, toError(e, backend), { latencyMs: latency(), averaged: average, request, response });
  }
}
