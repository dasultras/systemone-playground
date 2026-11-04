import { z } from "zod";
import { findKnown } from "@/lib/models";
import { ollamaBase, readKnown, reject, rejectForeign } from "@/lib/registry";

// Leitet `POST /api/pull` von Ollama samt NDJSON-Fortschritt durch. Nur mit ALLOW_PULL=1, da es Plattenplatz belegt,
// und nur für Modelle aus config/models.json, damit Ollama keine beliebigen Registries kontaktiert.
const Body = z.object({ name: z.string() });

export async function POST(req: Request) {
  const foreign = rejectForeign(req);
  if (foreign) return foreign;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  const name = findKnown(await readKnown(), parsed.success ? parsed.data.name.trim() : "")?.name;
  if (process.env.ALLOW_PULL !== "1")
    return reject(
      403,
      `Pullen ist deaktiviert (aktivieren mit ALLOW_PULL=1). Alternativ auf dem Host: ollama pull ${name ?? "<name>"}`,
    );
  const base = ollamaBase();
  if (!base) return reject(400, "Ollama-Backend ist nicht aktiv (OLLAMA_BASE_URL).");
  if (!name) return reject(400, "Nur Modelle aus config/models.json lassen sich pullen.");

  const up = await fetch(`${base}/api/pull`, {
    method: "POST",
    body: JSON.stringify({ model: name, stream: true }),
    signal: req.signal,
  }).catch(() => null);
  // Nur Metadaten loggen.
  console.info(`pull ${name} ${up?.status ?? "netzwerk"}`);
  if (!up?.ok || !up.body) {
    const detail = ((await up?.json().catch(() => null)) as { error?: string } | null)?.error;
    return reject(502, `Ollama antwortet mit ${up?.status ?? "keiner Verbindung"}${detail ? `: ${detail}` : ""}.`);
  }
  return new Response(up.body, { headers: { "content-type": "application/x-ndjson" } });
}
