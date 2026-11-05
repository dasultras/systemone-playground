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
import { unreachable } from "./models";
import { ollamaBase, ollamaLoaded } from "./registry";
import { labelsFor } from "./questions";
import { errorRun, type RunRequest } from "./run";
import type { Backend, ModelInfo, ModelRun, Question, RunError } from "./types";

/** Ollama und vLLM sprechen nativ das Jev-Schema; alle Backends nutzen denselben SDK-Client. */
const local = (baseURL: string | undefined, apiKey: string): TypeSafeClientConfig => ({
  baseURL,
  apiKey,
  compression: false,
  timeout: 120_000,
  retry: { maxRetries: 0 },
});
const CONFIG: Record<Backend, () => TypeSafeClientConfig> = {
  typesafe: () => ({ timeout: 30_000 }),
  ollama: () => local(ollamaBase(), "ollama"),
  vllm: () => local(process.env.VLLM_BASE_URL, "vllm"),
};
const clients: Partial<Record<Backend, TypeSafeClient>> = {};
// Lazy, damit ein fehlender TYPESAFE_API_KEY nur TypeSafe-Läufe scheitern lässt.
const client = (b: Backend) => (clients[b] ??= new TypeSafeClient(CONFIG[b]()));

const queues: Partial<Record<Backend, Promise<unknown>>> = {};
/** Lokale Backends rechnen ein Modell nach dem anderen; ohne Warteschlange enthielte die Latenz die Wartezeit auf andere. */
function serial<T>(b: Backend, fn: () => Promise<T>): Promise<T> {
  if (b === "typesafe") return fn();
  const next = (queues[b] ?? Promise.resolve()).catch(() => undefined).then(fn);
  queues[b] = next;
  return next;
}

/** Lädt ein Ollama-Modell mit einer Mini-Frage, denn `/api/generate` lehnt reine Decision-Modelle ab. Dauer in ms. */
async function warmUp(name: string, signal?: AbortSignal): Promise<number> {
  const started = performance.now();
  await client("ollama").systemOne({ model: name, state: ".", questions: { q: noul("?") } }, { signal });
  return Math.round(performance.now() - started);
}

export const loadOllama = (name: string, signal?: AbortSignal) => serial("ollama", () => warmUp(name, signal));

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

function toError(e: unknown, backend: Backend): RunError {
  if (e instanceof APITimeoutError) return { kind: "timeout", message: `Timeout nach ${e.timeoutMs / 1000} s.` };
  if (e instanceof APIError) {
    const overflow = e.status === 413 || (e.status === 400 && /context|exceed/i.test(e.message));
    return { kind: overflow ? "overflow" : "api", message: e.message, status: e.status };
  }
  if (e instanceof APIConnectionError && backend !== "typesafe") {
    const hint = backend === "ollama" ? " Läuft „ollama serve“?" : "";
    return { kind: "network", message: unreachable(backend) + hint };
  }
  const message = e instanceof Error ? e.message : String(e);
  return { kind: e instanceof APIConnectionError ? "network" : "api", message };
}

/** `model` ist ein verfügbares Modell aus `/api/models` (ID `backend:name`); der Request trägt den Namen ohne Präfix. */
export async function runModel(
  { modelId, state, facts, questions, average }: RunRequest,
  { id, backend }: ModelInfo,
  signal: AbortSignal,
): Promise<ModelRun> {
  const request = {
    model: id.slice(backend.length + 1),
    state: facts.length ? { text: state, facts: Object.fromEntries(facts.map((f) => [f.key, f.value])) } : state,
    questions: toQuestions(questions, average),
  };
  return serial(backend, async () => {
    let started = performance.now();
    const latency = () => Math.round(performance.now() - started);
    let loadMs: number | undefined;
    try {
      // Laden getrennt messen, damit die Latenz nur die Rechenzeit zeigt.
      if (backend === "ollama" && !(await ollamaLoaded().catch(() => [])).some((m) => m.id === id)) {
        loadMs = await warmUp(request.model, signal);
        started = performance.now();
      }
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
        loadMs,
        tokensIn: input_tokens ?? 0,
        tokensOut: output_tokens ?? 0,
        averaged: average,
        request,
        response,
      };
    } catch (e) {
      const response = e instanceof APIError ? e.body : null;
      const rest = { latencyMs: latency(), loadMs, averaged: average, request, response };
      return errorRun(modelId, toError(e, backend), rest);
    }
  });
}
