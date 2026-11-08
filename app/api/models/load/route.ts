import { z } from "zod";
import { loadOllama } from "@/lib/backend";
import { findModel, ollamaLoaded, reject, rejectForeign, unloadOllama } from "@/lib/registry";

// Lädt ein installiertes Ollama-Modell in den Speicher oder entlädt es. Antwortet mit dem neuen Stand aus /api/ps.
const Body = z.object({ id: z.string(), unload: z.boolean().default(false) });

export async function POST(req: Request) {
  const foreign = rejectForeign(req);
  if (foreign) return foreign;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  const model = parsed.success ? await findModel(parsed.data.id) : undefined;
  if (!parsed.success || model?.backend !== "ollama")
    return reject(400, "Nur installierte Ollama-Modelle lassen sich laden.");
  const { unload } = parsed.data;
  const name = model.id.slice("ollama:".length);
  try {
    const loadMs = unload ? undefined : await loadOllama(name, req.signal);
    if (unload) await unloadOllama(name);
    // Nur Metadaten loggen.
    console.info(`${unload ? "unload" : "load"} ${name} ${loadMs ?? 0}ms`);
    return Response.json({ loadMs, loaded: await ollamaLoaded() });
  } catch (e) {
    return reject(502, `Ollama: ${e instanceof Error ? e.message : String(e)}`);
  }
}
