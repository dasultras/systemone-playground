import { z } from "zod";
import { isModelRef } from "@/lib/pull";
import { ollamaBase } from "@/lib/registry";

// Leitet `POST /api/pull` von Ollama samt NDJSON-Fortschritt durch. Nur mit ALLOW_PULL=1, da es Plattenplatz belegt.
const Body = z.object({ name: z.string() });

const reject = (status: number, message: string) => Response.json({ error: { kind: "api", message } }, { status });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  const raw = parsed.success ? parsed.data.name.trim() : "";
  const name = isModelRef(raw) ? raw : "";
  if (process.env.ALLOW_PULL !== "1")
    return reject(
      403,
      `Pullen ist deaktiviert (ALLOW_PULL=1). Alternativ auf dem Host: ollama pull ${name || "<name>"}`,
    );
  const base = ollamaBase();
  if (!base) return reject(400, "Ollama-Backend ist nicht aktiv (OLLAMA_BASE_URL).");
  // Nur JSON: erzwingt bei fremden Origins einen CORS-Preflight, den die Route nicht beantwortet.
  if (!req.headers.get("content-type")?.startsWith("application/json"))
    return reject(415, "Erwartet Content-Type application/json.");
  if (!name) return reject(400, "Ungültiger Modellname.");

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
