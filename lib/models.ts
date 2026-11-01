import type { Backend, KnownModel, ModelId, ModelInfo, ModelsResponse } from "./types";

// Rein und ohne server-only: Client, Server, Tests und Eval nutzen dieselben Helfer.

export const BACKEND_NAME: Record<Backend, string> = { ollama: "Ollama", vllm: "vLLM", typesafe: "TypeSafe" };
export const BACKEND_LABEL: Record<Backend, string> = {
  ollama: `${BACKEND_NAME.ollama}, lokal`,
  vllm: `${BACKEND_NAME.vllm}, lokal`,
  typesafe: `${BACKEND_NAME.typesafe}, gehostet`,
};

/** Backends mit eigener Basis-URL; TypeSafe wird nie abgefragt, nur statisch gelistet. */
export type LocalBackend = Exclude<Backend, "typesafe">;
/** Gemeinsame Meldung für Modellliste und Lauf. */
export const unreachable = (b: LocalBackend) => `${BACKEND_NAME[b]} nicht erreichbar (${b.toUpperCase()}_BASE_URL).`;

/** Nur diese drei Präfixe zählen; Namen selbst enthalten Doppelpunkte (`elephant-1:9b-q4-ctx8k`). */
export function parseModelId(id: string): { backend: Backend; name: string } | null {
  const m = /^(ollama|vllm|typesafe):(.+)$/.exec(id);
  return m ? { backend: m[1] as Backend, name: m[2] } : null;
}

/** Gespeicherte IDs ohne Präfix (vor der freien Modellwahl) gehörten zu Ollama, außer Jev. */
export function legacyModelId(id: string): ModelId {
  if (parseModelId(id)) return id;
  return id === "jev-latest" ? "typesafe:jev-latest" : `ollama:${id}`;
}

const SLOTS = 6;
const token = (i: number) => `var(--model-${i + 1})`;
/** Deterministisch per djb2 auf einen von sechs Farb-Slots. */
function slot(id: ModelId): number {
  let h = 5381;
  for (const c of id) h = ((h << 5) + h + c.charCodeAt(0)) >>> 0;
  return h % SLOTS;
}

export const modelColor = (id: ModelId) => token(slot(id));

/** Farben für eine Auswahl: Hash-Farbe, bei Kollision die nächste freie, damit verglichene Modelle nie gleich aussehen. */
export function colorsFor(ids: ModelId[]): Record<ModelId, string> {
  const used = new Set<number>();
  return Object.fromEntries(
    ids.map((id) => {
      let i = slot(id);
      while (used.has(i) && used.size < SLOTS) i = (i + 1) % SLOTS;
      used.add(i);
      return [id, token(i)];
    }),
  );
}

const info = (backend: Backend, name: string, contextTokens: number, size: string): ModelInfo => {
  const id = `${backend}:${name}`;
  return {
    id,
    label: name.replace(/:latest$/, ""),
    backend,
    hosted: backend === "typesafe",
    contextTokens,
    size,
    color: modelColor(id),
  };
};

const ctxLabel = (ctx: number) => (ctx ? `${Math.round(ctx / 1024)}k` : "");

/** Nur aus der ID abgeleitet, stürzt nie ab, z. B. für Verlaufseinträge mit entfernten Modellen. `among`: Farbe innerhalb dieser Auswahl. */
export function modelMeta(id: ModelId, among?: ModelId[]): ModelInfo {
  const p = parseModelId(legacyModelId(id)) ?? { backend: "ollama" as const, name: id };
  const m = info(p.backend, p.name, 0, "nicht verfügbar");
  return among ? { ...m, color: colorsFor(among)[id] ?? m.color } : m;
}

type OllamaDetails = { parameter_size?: string; quantization_level?: string; parent_model?: string };
export type OllamaTag = { name: string; capabilities?: string[]; details?: OllamaDetails };
export type OllamaShow = {
  capabilities?: string[];
  parameters?: string;
  model_info?: Record<string, unknown>;
  details?: OllamaDetails;
};

/** Nur Modelle mit Capability `decision`; Limit aus `num_ctx`, sonst aus `*.context_length`. */
export function fromOllama(tag: OllamaTag, show: OllamaShow): ModelInfo | null {
  if (!(tag.capabilities ?? show.capabilities)?.includes("decision")) return null;
  const numCtx = /^num_ctx +([0-9]+)/m.exec(show.parameters ?? "");
  const key = Object.keys(show.model_info ?? {}).find((k) => k.endsWith(".context_length"));
  const ctx = numCtx ? Number(numCtx[1]) : Number(key && show.model_info?.[key]) || 0;
  const d = { ...show.details, ...tag.details };
  const size = [d.parameter_size, d.quantization_level, ctxLabel(ctx)].filter(Boolean).join(" · ");
  // Ollama löst Namen ohne Tag zu `:latest` auf; so passen auch alte IDs wie `clef-flash`.
  return info("ollama", tag.name.replace(/:latest$/, ""), ctx, size);
}

export function fromVllm(m: { id: string; max_model_len?: number }): ModelInfo {
  const ctx = m.max_model_len ?? 0;
  return info("vllm", m.id, ctx, ctxLabel(ctx));
}

/** Statisch: Die Liste ruft die TypeSafe-API nie auf. */
export const TYPESAFE_MODELS: ModelInfo[] = [info("typesafe", "jev-latest", 64_000, "64k")];

/** `DEFAULT_MODEL`, falls verfügbar, sonst das erste Ollama-Modell, sonst das erste überhaupt. */
export function pickDefault(models: ModelInfo[], env?: string): ModelId | null {
  const wanted = env ? legacyModelId(env) : null;
  if (wanted && models.some((m) => m.id === wanted)) return wanted;
  return (models.find((m) => m.backend === "ollama") ?? models[0])?.id ?? null;
}

/** Referenz vergleichbar machen: Ollama ignoriert Groß-/Kleinschreibung und ergänzt fehlende Tags zu `:latest`. */
export function normRef(ref: string): string {
  const r = ref.toLowerCase();
  return r.slice(r.lastIndexOf("/") + 1).includes(":") ? r : `${r}:latest`;
}

/** Bekannte Modelle ohne die installierten; `installed` enthält Namen und `parent_model` der Tags. */
export function mergeKnown(known: KnownModel[], installed: string[]): KnownModel[] {
  const have = new Set(installed.map(normRef));
  return known.filter((k) => !have.has(normRef(k.name)));
}

/** Pullbar ist nur, was in `config/models.json` steht; liefert dessen Referenz oder null. */
export const findKnown = (known: KnownModel[], ref: string) =>
  known.find((k) => normRef(k.name) === normRef(ref)) ?? null;

export async function fetchModels(refresh = false): Promise<ModelsResponse> {
  const res = await fetch(`/api/models${refresh ? "?refresh=1" : ""}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
