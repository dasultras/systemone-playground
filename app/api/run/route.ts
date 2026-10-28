import { runModel } from "@/lib/backend";
import { modelById } from "@/lib/mock-data";
import { RunRequest } from "@/lib/run";

// Guard: Größenlimit (Ollama nimmt höchstens 64 KiB), Rate-Limit und Tagesbudget für TypeSafe, alles im Speicher.
const MAX_BYTES = 64 * 1024;
const RATE = { limit: 30, windowMs: 60_000 };
const DAILY_TYPESAFE = Number(process.env.TYPESAFE_DAILY_REQUESTS) || 200;

let recent: number[] = [];
const budget = { day: "", used: 0 };

const reject = (status: number, message: string) => Response.json({ error: { kind: "api", message } }, { status });

export async function POST(req: Request) {
  const text = await req.text();
  if (Buffer.byteLength(text) > MAX_BYTES) return reject(413, "Request größer als 64 KiB.");

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return reject(400, "Ungültiges JSON.");
  }
  const parsed = RunRequest.safeParse(json);
  if (!parsed.success) return reject(400, parsed.error.issues.map((i) => i.message).join("; "));
  const body = parsed.data;

  const now = Date.now();
  recent = recent.filter((t) => now - t < RATE.windowMs);
  if (recent.length >= RATE.limit) return reject(429, `Rate-Limit: höchstens ${RATE.limit} Läufe pro Minute.`);
  recent.push(now);

  if (modelById(body.modelId).backend === "typesafe") {
    const day = new Date(now).toISOString().slice(0, 10);
    if (budget.day !== day) Object.assign(budget, { day, used: 0 });
    if (budget.used >= DAILY_TYPESAFE)
      return reject(429, `Tagesbudget von ${DAILY_TYPESAFE} TypeSafe-Läufen erreicht.`);
    budget.used++;
  }

  const run = await runModel(body, req.signal);
  // Nur Metadaten loggen, nie den State.
  console.info(`run ${body.modelId} q=${body.questions.length} ${run.latencyMs}ms ${run.error?.kind ?? "ok"}`);
  return Response.json(run);
}
