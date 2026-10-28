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
  /** Nur Mock: Index der "richtigen" Antwort (Choice/Score) bzw. 0 = wahr, 1 = unwahr (Noul). */
  mockTruth?: number;
  /** Nur Mock: zweiter Gipfel, den schwächere Modelle mit ausgeben. */
  mockSecond?: number;
};

export type ModelId = "jev-latest" | "elephant-1:9b-q4-ctx8k" | "clef-flash" | "pplx-decider";

export type ModelInfo = {
  id: ModelId;
  label: string;
  backend: "typesafe" | "ollama";
  hosted: boolean;
  contextTokens: number;
  size: string;
  color: string;
  /** Mock-Profil */
  sharpness: number;
  noise: number;
  baseLatencyMs: number;
};

export type Fact = { key: string; value: string };

export type Preset = {
  id: string;
  title: string;
  mode: Mode;
  badge: string;
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
};

export type ModelRun = {
  modelId: ModelId;
  error?: RunError;
  answers: Answer[];
  latencyMs: number;
  tokensIn: number;
  tokensOut: number;
  averaged: number;
  request: unknown;
  response: unknown;
};

export type ModelState =
  { status: "idle" } | { status: "running"; startedAt: number } | { status: "done"; run: ModelRun };

export type HistoryEntry = {
  id: string;
  title: string;
  time: string;
  group: "Heute" | "Gestern" | "Diese Woche";
  mode: Mode;
  presetId: string | null;
  state: string;
  facts: Fact[];
  questions: Question[];
  models: ModelId[];
  average: number;
  runs: ModelRun[];
};
