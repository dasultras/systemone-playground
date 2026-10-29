// Nur Server-Code (app/page.tsx) importiert diese Datei; sie liest Vorlagen vom Dateisystem.
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import type { Preset as PresetType } from "./types";

const Text = z.string().trim().min(1);

const Question = z
  .object({
    id: z.string().min(1),
    text: Text,
    type: z.enum(["choice", "noul", "score"]),
    options: z.array(Text).max(10).default([]),
    levels: z.int().min(2).max(10).default(5),
    scoreLow: z.string().default("niedrig"),
    scoreHigh: z.string().default("hoch"),
  })
  .refine((q) => q.type !== "choice" || q.options.length >= 2, "Choice braucht mindestens 2 Optionen.");

const Preset = z
  .object({
    id: z.string().min(1),
    title: Text,
    mode: z.enum(["single", "multi"]),
    state: Text,
    facts: z.array(z.object({ key: z.string().min(1), value: z.string() })).default([]),
    // wie MAX_QUESTIONS
    questions: z.array(Question).min(1).max(5),
    rule: z.object({ label: Text, yes: Text, no: Text }).optional(),
  })
  .refine((p) => p.mode !== "single" || p.questions.length === 1, "Einzelfrage hat genau eine Frage.");

/** Datei mit Vorlagen: mindestens eine, IDs eindeutig. */
export const PresetFile = z
  .array(Preset)
  .min(1)
  .refine((ps) => new Set(ps.map((p) => p.id)).size === ps.length, "Vorlagen-IDs müssen eindeutig sein.");

export const DEFAULT_PRESETS_FILE = "config/presets.default.json";

/** Wirft bei kaputtem JSON oder Schemafehler. */
export function parsePresets(raw: string): PresetType[] {
  return PresetFile.parse(JSON.parse(raw));
}

// turbopackIgnore: sonst verfolgt der Build das ganze Projekt in den Standalone-Output.
const read = (file: string) => readFile(resolve(/* turbopackIgnore: true */ process.cwd(), file), "utf8");

/** Liest die Vorlagen-Datei; ist sie unbrauchbar, gilt die Standarddatei. Logs nur mit Metadaten, nie mit Inhalten. */
export async function loadPresets(file = process.env.PRESETS_FILE || DEFAULT_PRESETS_FILE): Promise<PresetType[]> {
  try {
    return parsePresets(await read(file));
  } catch (e) {
    const why =
      e instanceof z.ZodError
        ? `${e.issues.length} Fehler: ${e.issues.map((i) => i.path.join(".") || "(Wurzel)").join(", ")}`
        : ((e as NodeJS.ErrnoException).code ?? (e as Error).name);
    console.warn(`presets ${file} unbrauchbar (${why}), nutze ${DEFAULT_PRESETS_FILE}`);
    return parsePresets(await read(DEFAULT_PRESETS_FILE));
  }
}
