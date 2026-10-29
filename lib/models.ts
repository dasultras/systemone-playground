import type { ModelId, ModelInfo } from "./types";

export const MODELS: ModelInfo[] = [
  {
    id: "elephant-1:9b-q4-ctx8k",
    label: "elephant-1",
    backend: "ollama",
    hosted: false,
    contextTokens: 8_000,
    size: "9B · q4 · 8k",
    color: "var(--model-elephant)",
  },
  {
    id: "clef-flash",
    label: "clef-flash",
    backend: "ollama",
    hosted: false,
    contextTokens: 8_000,
    size: "8k",
    color: "var(--model-clef)",
  },
  {
    id: "pplx-decider",
    label: "pplx-decider",
    backend: "ollama",
    hosted: false,
    contextTokens: 16_000,
    size: "27B · 16k",
    color: "var(--model-pplx)",
  },
  {
    id: "jev-latest",
    label: "Jev",
    backend: "typesafe",
    hosted: true,
    contextTokens: 64_000,
    size: "64k",
    color: "var(--model-jev)",
  },
];

export const DEFAULT_MODEL: ModelId = "elephant-1:9b-q4-ctx8k";

export const modelById = (id: ModelId) => MODELS.find((m) => m.id === id)!;
