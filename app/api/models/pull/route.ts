import { z } from "zod";
import { findKnown } from "@/lib/models";
import { ollamaBase, readKnown } from "@/lib/registry";

// Leitet `POST /api/pull` von Ollama samt NDJSON-Fortschritt durch. Nur mit ALLOW_PULL=1, da es Plattenplatz belegt,
// und nur für Modelle aus config/models.json, damit Ollama keine beliebigen Registries kontaktiert.
const Body = z.object({ name: z.string() });

const reject = (status: number, message: string) => Response.json({ error: { kind: "api", message } }, { status });

export async function POST(req: Request) {
  // Nur dieselbe Herkunft: Eine fremde Seite darf keinen Pull auf dem Host anstoßen. Ohne Origin (curl) ist es kein Browser.
  const origin = req.headers.get("origin");
  if (origin !== null && (!URL.canParse(origin) || new URL(origin).host !== req.headers.get("host")))
    return reject(403, "Pull nur von derselben Herkunft.");
  // Nur JSON: erzwingt bei fremden Origins zusätzlich einen CORS-Preflight, den die Route nicht beantwortet.
  if (!req.headers.get("content-type")?.startsWith("application/json"))
    return reject(415, "Erwartet Content-Type application/json.");

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
