import "server-only";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import {
  TYPESAFE_MODELS,
  ollamaId,
  fromOllama,
  fromVllm,
  mergeKnown,
  pickDefault,
  unreachable,
  type LocalBackend,
  type OllamaShow,
  type OllamaTag,
} from "./models";
import type { KnownModel, LoadedModel, ModelInfo, ModelsResponse } from "./types";

/** Kurzer Cache im Speicher, damit nicht jeder Seitenaufruf und jeder Lauf alle Backends abfragt. */
const TTL = 30_000;
let cache: { at: number; value: Promise<ModelsResponse> } | undefined;

const getJson = async (url: string, init?: RequestInit) => {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(3000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

type Listed = { models: ModelInfo[]; installed?: string[] };

/** `installed`: alle Tags samt `parent_model`, unabhängig von der Capability, damit Kopien ihr Original verdecken. */
async function ollama(base: string): Promise<Listed> {
  const { models }: { models: OllamaTag[] } = await getJson(`${base}/api/tags`);
  const shows: OllamaShow[] = await Promise.all(
    models.map((t) => getJson(`${base}/api/show`, { method: "POST", body: JSON.stringify({ model: t.name }) })),
  );
  return {
    models: models.flatMap((t, i) => fromOllama(t, shows[i]) ?? []),
    installed: models.flatMap((t) => [t.name, t.details?.parent_model ?? ""]).filter(Boolean),
  };
}

async function vllm(base: string): Promise<Listed> {
  const { data }: { data: { id: string; max_model_len?: number }[] } = await getJson(`${base}/v1/models`);
  return { models: data.map(fromVllm) };
}

/** Env erst beim Aufruf lesen; ohne Env läuft Ollama lokal, ein leerer Wert schaltet es ab. */
export const ollamaBase = () => process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";

/** Pullen nur mit `ALLOW_PULL=1` und aktivem Ollama; es belegt Plattenplatz auf dem Host. */
export const pullAllowed = () => process.env.ALLOW_PULL === "1" && Boolean(ollamaBase());

export const reject = (status: number, message: string) =>
  Response.json({ error: { kind: "api", message } }, { status });

/** Nur dieselbe Herkunft und nur JSON: Eine fremde Seite darf nichts auf dem Host anstoßen. Ohne Origin (curl) ist es kein Browser. */
export function rejectForeign(req: Request): Response | null {
  const origin = req.headers.get("origin");
  if (origin !== null && (!URL.canParse(origin) || new URL(origin).host !== req.headers.get("host")))
    return reject(403, "Nur von derselben Herkunft.");
  // Nur JSON: erzwingt bei fremden Origins zusätzlich einen CORS-Preflight, den die Routen nicht beantworten.
  if (!req.headers.get("content-type")?.startsWith("application/json"))
    return reject(415, "Erwartet Content-Type application/json.");
  return null;
}

/** Von Ollama geladene Modelle (`/api/ps`) mit belegtem Grafikspeicher. */
export async function ollamaLoaded(): Promise<LoadedModel[]> {
  const base = ollamaBase();
  if (!base) return [];
  const { models }: { models: { name: string; size_vram: number }[] } = await getJson(`${base}/api/ps`);
  return models.map((m) => ({ id: ollamaId(m.name), vramBytes: m.size_vram }));
}

/** Entlädt sofort; `/api/generate` nimmt `keep_alive: 0` auch für reine Decision-Modelle an, Laden dagegen nicht. */
export const unloadOllama = (name: string) =>
  getJson(`${ollamaBase()}/api/generate`, { method: "POST", body: JSON.stringify({ model: name, keep_alive: 0 }) });

const KNOWN_FILE = "config/models.json";
const KnownFile = z.array(
  z.object({
    name: z.string().min(1),
    label: z.string().min(1),
    sizeGb: z.number().positive(),
    description: z.string(),
  }),
);

/** Bekannte Modelle; ist die Datei unbrauchbar, gibt es keine. Logs nur mit Metadaten. */
export async function readKnown(): Promise<KnownModel[]> {
  try {
    // turbopackIgnore: sonst verfolgt der Build das ganze Projekt in den Standalone-Output.
    const raw = await readFile(resolve(/* turbopackIgnore: true */ process.cwd(), KNOWN_FILE), "utf8");
    return KnownFile.parse(JSON.parse(raw));
  } catch (e) {
    const why =
      e instanceof z.ZodError ? `${e.issues.length} Fehler` : ((e as NodeJS.ErrnoException).code ?? (e as Error).name);
    console.warn(`models ${KNOWN_FILE} unbrauchbar (${why})`);
    return [];
  }
}

async function load(): Promise<ModelsResponse> {
  const oBase = ollamaBase();
  const vBase = process.env.VLLM_BASE_URL;
  const sources: [LocalBackend, () => Promise<Listed>][] = [];
  if (oBase) sources.push(["ollama", () => ollama(oBase)]);
  if (vBase) sources.push(["vllm", () => vllm(vBase)]);

  const [results, knownFile] = await Promise.all([
    Promise.all(
      sources.map(async ([backend, list]): Promise<Listed & { error?: ModelsResponse["errors"][number] }> => {
        try {
          return await list();
        } catch (e) {
          // Nur Metadaten loggen; ein ausgefallenes Backend lässt die Route nicht scheitern.
          console.warn(`models ${backend} ${e instanceof Error ? e.name : "Fehler"}`);
          return { models: [], error: { backend, message: unreachable(backend) } };
        }
      }),
    ),
    oBase ? readKnown() : [],
  ]);
  // TypeSafe nur mit Key und nur statisch, nie ein Request.
  const models = [...results.flatMap((r) => r.models), ...(process.env.TYPESAFE_API_KEY ? TYPESAFE_MODELS : [])];
  const errors = results.flatMap((r) => r.error ?? []);
  // Ist Ollama nicht erreichbar, ist unklar, was installiert ist; dann keine bekannten Modelle anbieten.
  const known = errors.some((e) => e.backend === "ollama")
    ? []
    : mergeKnown(
        knownFile,
        results.flatMap((r) => r.installed ?? []),
      );
  return { models, defaultModel: pickDefault(models, process.env.DEFAULT_MODEL), errors, known, pull: pullAllowed() };
}

/** Reihenfolge: Ollama, vLLM, TypeSafe. `refresh` umgeht den Cache und schreibt ihn neu. */
export function listModels(refresh = false): Promise<ModelsResponse> {
  if (refresh || !cache || Date.now() - cache.at > TTL) {
    cache = { at: Date.now(), value: load() };
  }
  return cache.value;
}

export const findModel = async (id: string) => (await listModels()).models.find((m) => m.id === id);
