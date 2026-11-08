export type QuestionType = "choice" | "noul" | "score";
export type Mode = "single" | "multi";

export type Question = {
  id: string;
  text: string;
  type: QuestionType;
  /** Choice: 2–10 Optionen */
  options: string[];
  /** Score: 2–10 Level */
  levels: number;
  scoreLow: string;
  scoreHigh: string;
};

/** Immer mit Backend-Präfix, z. B. `ollama:elephant-1:9b-q4-ctx8k`. */
export type ModelId = string;

export type Backend = "ollama" | "vllm" | "typesafe";

export type ModelInfo = {
  id: ModelId;
  label: string;
  backend: Backend;
  hosted: boolean;
  /** Kontextlimit in Tokens; 0 = unbekannt. */
  contextTokens: number;
  size: string;
  color: string;
};

/** Bekanntes System-One-Modell aus `config/models.json`; `name` ist die Pull-Referenz für Ollama. */
export type KnownModel = {
  name: string;
  label: string;
  /** Ungefähre Downloadgröße in GB. */
  sizeGb: number;
  description: string;
};

/** Antwort von `GET /api/models`: verfügbare Modelle, nicht erreichbare Backends und bekannte, nicht installierte Modelle. */
export type ModelsResponse = {
  models: ModelInfo[];
  defaultModel: ModelId | null;
  errors: { backend: Backend; message: string }[];
  /** Nur Ollama-Modelle, die noch nicht installiert sind; fehlt im Fallback, wenn die Liste nicht lädt. */
  known?: KnownModel[];
  /** Pullen aus der UI erlaubt (`ALLOW_PULL=1` und Ollama aktiv). */
  pull?: boolean;
  /** Gerade von Ollama geladene Modelle, bei jedem Abruf frisch aus `/api/ps`. */
  loaded?: LoadedModel[];
};

export type LoadedModel = { id: ModelId; vramBytes: number };

export type Fact = { key: string; value: string };

export type Preset = {
  id: string;
  title: string;
  mode: Mode;
  state: string;
  facts: Fact[];
  questions: Question[];
  /** Wahrheitstabelle im Code (nur Bündel): alle Noul-Fragen müssen "Nein" sein. */
  rule?: { label: string; yes: string; no: string };
};

export type Light = "green" | "yellow" | "red";

export type Metrics = {
  k: number;
  topIndex: number;
  pMax: number;
  p2: number;
  confidence: number;
  margin: number;
  entropy: number;
  light: Light;
};

export type Answer = {
  questionId: string;
  probs: number[];
  metrics: Metrics;
};

export type RunError = {
  kind: "timeout" | "overflow" | "network" | "api";
  message: string;
  /** HTTP-Status, falls es einen gibt (z. B. 429 bei Rate-Limit oder Tagesbudget). */
  status?: number;
};

export type ModelRun = {
  modelId: ModelId;
  error?: RunError;
  answers: Answer[];
  /** Reine Rechenzeit des Modells, ohne Warten auf andere Modelle und ohne Laden. */
  latencyMs: number;
  /** Laden des Modells vor dem Lauf; fehlt, wenn es schon geladen war. */
  loadMs?: number;
  tokensIn: number;
  tokensOut: number;
  averaged: number;
  request: unknown;
  response: unknown;
};

export type ModelState =
  { status: "idle" } | { status: "running"; startedAt: number } | { status: "done"; run: ModelRun };

export type HistoryGroup = "Heute" | "Gestern" | "Diese Woche" | "Älter";

export type HistoryEntry = {
  id: string;
  title: string;
  /** Ende des Laufs in ms seit Epoch; Gruppe und Uhrzeit leiten sich daraus ab. */
  at: number;
  mode: Mode;
  presetId: string | null;
  state: string;
  facts: Fact[];
  questions: Question[];
  models: ModelId[];
  average: number;
  runs: ModelRun[];
};
