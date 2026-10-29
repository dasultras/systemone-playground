import "server-only";
import {
  TYPESAFE_MODELS,
  fromOllama,
  fromVllm,
  pickDefault,
  unreachable,
  type LocalBackend,
  type OllamaShow,
  type OllamaTag,
} from "./models";
import type { ModelInfo, ModelsResponse } from "./types";

/** Kurzer Cache im Speicher, damit nicht jeder Seitenaufruf und jeder Lauf alle Backends abfragt. */
const TTL = 30_000;
let cache: { at: number; value: Promise<ModelsResponse> } | undefined;

const getJson = async (url: string, init?: RequestInit) => {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(3000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

async function ollama(base: string): Promise<ModelInfo[]> {
  const { models }: { models: OllamaTag[] } = await getJson(`${base}/api/tags`);
  const shows: OllamaShow[] = await Promise.all(
    models.map((t) => getJson(`${base}/api/show`, { method: "POST", body: JSON.stringify({ model: t.name }) })),
  );
  return models.flatMap((t, i) => fromOllama(t, shows[i]) ?? []);
}

async function vllm(base: string): Promise<ModelInfo[]> {
  const { data }: { data: { id: string; max_model_len?: number }[] } = await getJson(`${base}/v1/models`);
  return data.map(fromVllm);
}

/** Env erst beim Aufruf lesen; ohne Env läuft Ollama lokal, ein leerer Wert schaltet es ab. */
export const ollamaBase = () => process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";

async function load(): Promise<ModelsResponse> {
  const oBase = ollamaBase();
  const vBase = process.env.VLLM_BASE_URL;
  const sources: [LocalBackend, () => Promise<ModelInfo[]>][] = [];
  if (oBase) sources.push(["ollama", () => ollama(oBase)]);
  if (vBase) sources.push(["vllm", () => vllm(vBase)]);

  const results = await Promise.all(
    sources.map(async ([backend, list]) => {
      try {
        return { models: await list() };
      } catch (e) {
        // Nur Metadaten loggen; ein ausgefallenes Backend lässt die Route nicht scheitern.
        console.warn(`models ${backend} ${e instanceof Error ? e.name : "Fehler"}`);
        return { models: [], error: { backend, message: unreachable(backend) } };
      }
    }),
  );
  // TypeSafe nur mit Key und nur statisch, nie ein Request.
  const models = [...results.flatMap((r) => r.models), ...(process.env.TYPESAFE_API_KEY ? TYPESAFE_MODELS : [])];
  const errors = results.flatMap((r) => r.error ?? []);
  return { models, defaultModel: pickDefault(models, process.env.DEFAULT_MODEL), errors };
}

/** Reihenfolge: Ollama, vLLM, TypeSafe. `refresh` umgeht den Cache und schreibt ihn neu. */
export function listModels(refresh = false): Promise<ModelsResponse> {
  if (refresh || !cache || Date.now() - cache.at > TTL) {
    cache = { at: Date.now(), value: load() };
  }
  return cache.value;
}

export const findModel = async (id: string) => (await listModels()).models.find((m) => m.id === id);
