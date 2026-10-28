"use client";

import { Check, Copy, X } from "lucide-react";
import { useState } from "react";
import { modelById } from "@/lib/mock-data";
import type { ModelId, ModelState } from "@/lib/types";
import { Segmented } from "./input-panel";

type Props = {
  models: ModelId[];
  states: Record<string, ModelState | undefined>;
  modelId: ModelId;
  onModel: (m: ModelId) => void;
  onClose: () => void;
};

export function Inspector({ models, states, modelId, onModel, onClose }: Props) {
  const [tab, setTab] = useState<"request" | "response">("request");
  const [copied, setCopied] = useState(false);
  const s = states[modelId];
  const run = s?.status === "done" ? s.run : null;
  const json = run ? JSON.stringify(tab === "request" ? run.request : run.response, null, 2) : "";
  const m = modelById(modelId);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* Zwischenablage nicht verfügbar */
    }
  };

  return (
    <aside className="fixed inset-y-0 right-0 z-30 flex w-full max-w-[460px] flex-col border-l border-line bg-panel shadow-2xl">
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <div>
          <div className="text-sm font-semibold">Request-Inspektor</div>
          <div className="text-xs text-muted">
            {m.backend === "typesafe" ? "api.typesafe.ai" : "OLLAMA_BASE_URL /v1/systemone"}
          </div>
        </div>
        <button onClick={onClose} className="btn-ghost !p-1.5" aria-label="Schließen">
          <X className="size-4" />
        </button>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <div className="flex flex-wrap gap-1.5">
          {models.map((id) => {
            const mm = modelById(id);
            return (
              <button
                key={id}
                onClick={() => onModel(id)}
                className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[11px] ${
                  id === modelId ? "border-accent/40 bg-accent-soft text-accent-ink" : "border-line text-muted hover:text-ink"
                }`}
              >
                <span className="size-1.5 rounded-full" style={{ background: mm.color }} />
                {mm.label}
              </button>
            );
          })}
        </div>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "request", label: "Request" },
            { value: "response", label: "Response" },
          ]}
          size="sm"
        />
      </div>

      <div className="relative min-h-0 flex-1 px-4 pb-4">
        {run ? (
          <>
            <button onClick={copy} className="btn-ghost absolute right-6 top-2 !p-1.5 bg-sunken" aria-label="Kopieren">
              {copied ? <Check className="size-3.5 text-ok" /> : <Copy className="size-3.5" />}
            </button>
            <pre className="h-full overflow-auto rounded-xl bg-sunken p-4 font-mono text-[12px] leading-relaxed text-ink">{json}</pre>
          </>
        ) : (
          <div className="grid h-full place-items-center rounded-xl border border-dashed border-line text-sm text-muted">
            Für dieses Modell liegt noch kein Lauf vor.
          </div>
        )}
      </div>
      <p className="border-t border-line px-4 py-3 text-xs text-muted">
        Mock: Das Schema ist illustrativ und entspricht nicht exakt dem TypeSafe-Format. Logs enthalten später nur Metadaten, nie State-Inhalte.
      </p>
    </aside>
  );
}
