import { z } from "zod";
import { MODELS } from "./mock-data";
import type { ModelId, ModelRun, RunError } from "./types";

const Text = z.string().trim().min(1);

/** Body von `POST /api/run`: ein Modell pro Request, damit jedes Ergebnis einzeln eintrifft. */
export const RunRequest = z.object({
  modelId: z.custom<ModelId>((v) => MODELS.some((m) => m.id === v)),
  state: Text,
  facts: z.array(z.object({ key: Text, value: z.string() })),
  questions: z
    .array(
      z.object({
        id: Text,
        text: Text,
        type: z.enum(["choice", "noul", "score"]),
        options: z
          .array(Text)
          .max(10)
          .refine((o) => new Set(o).size === o.length, "Optionen müssen eindeutig sein."),
        levels: z.int().min(2).max(10),
        scoreLow: z.string(),
        scoreHigh: z.string(),
      }),
    )
    .min(1)
    .refine((qs) => qs.every((q) => q.type !== "choice" || q.options.length >= 2), "Choice braucht 2 Optionen."),
  average: z.int().min(1).max(4),
});
export type RunRequest = z.infer<typeof RunRequest>;

export const errorRun = (modelId: ModelId, error: RunError, rest: Partial<ModelRun> = {}): ModelRun => ({
  modelId,
  error,
  answers: [],
  latencyMs: 0,
  tokensIn: 0,
  tokensOut: 0,
  averaged: 1,
  request: null,
  response: null,
  ...rest,
});

/** Fehler der Route oder des Netzes kommen als fehlgeschlagener Lauf zurück, nie als Antwort. */
export async function postRun(body: RunRequest, signal: AbortSignal): Promise<ModelRun> {
  try {
    const res = await fetch("/api/run", { method: "POST", body: JSON.stringify(body), signal });
    // Kein JSON (z. B. HTML-Fehlerseite eines Proxys): als API-Fehler mit Status melden.
    const json = await res.json().catch(() => null);
    if (res.ok && json) return json;
    const error = json?.error ?? { kind: "api", message: `Unlesbare Antwort vom Server (HTTP ${res.status}).` };
    return errorRun(body.modelId, { ...error, status: res.status }, { request: body });
  } catch {
    // Die Browsermeldung („Failed to fetch“) ist englisch und sagt nicht mehr als das hier.
    return errorRun(body.modelId, { kind: "network", message: "Server nicht erreichbar oder Verbindung abgebrochen." });
  }
}
