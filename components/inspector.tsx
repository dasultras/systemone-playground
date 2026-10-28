"use client";

import { Check, Copy, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { modelById } from "@/lib/mock-data";
import type { ModelId, ModelState } from "@/lib/types";
import { Segmented } from "./ui";
import { Dot } from "./viz";

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
  const closeRef = useRef<HTMLButtonElement>(null);
  const s = states[modelId];
  const run = s?.status === "done" ? s.run : null;
  const json = run ? JSON.stringify(tab === "request" ? run.request : run.response, null, 2) : "";
  const m = modelById(modelId);

  useEffect(() => {
    closeRef.current?.focus();
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [onClose]);

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
    <aside
      role="dialog"
      aria-label="Request-Inspektor"
      className="fixed inset-y-0 right-0 z-30 flex w-full max-w-[480px] flex-col overscroll-contain border-l border-line-strong bg-canvas shadow-2xl"
    >
      <header className="flex h-11 items-center justify-between border-b border-line pl-5 pr-3">
        <div className="flex items-baseline gap-3">
          <h2 className="section-title">Request-Inspektor</h2>
          <span className="font-mono text-[11px] text-muted">{m.backend === "typesafe" ? "api.typesafe.ai" : "OLLAMA_BASE_URL/v1/systemone"}</span>
        </div>
        <button ref={closeRef} onClick={onClose} className="icon-btn" aria-label="Inspektor schließen">
          <X aria-hidden className="size-4" />
        </button>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Modell">
          {models.map((id) => {
            const mm = modelById(id);
            return (
              <button
                key={id}
                onClick={() => onModel(id)}
                aria-pressed={id === modelId}
                className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium ${id === modelId ? "bg-sunken-2 text-ink" : "text-muted hover:bg-sunken hover:text-ink"}`}
              >
                <Dot color={mm.color} className="!size-1.5" />
                {mm.label}
              </button>
            );
          })}
        </div>
        <Segmented
          label="Ansicht"
          value={tab}
          onChange={setTab}
          options={[
            { value: "request", label: "Request" },
            { value: "response", label: "Response" },
          ]}
        />
      </div>

      <div className="relative min-h-0 flex-1 px-5 pb-4">
        {run ? (
          <>
            <button onClick={copy} className="icon-btn absolute right-7 top-2 !size-7 bg-sunken" aria-label={copied ? "Kopiert" : "JSON kopieren"}>
              {copied ? <Check aria-hidden className="size-3.5 text-ok" /> : <Copy aria-hidden className="size-3.5" />}
            </button>
            <pre className="h-full overflow-auto rounded-md bg-sunken p-4 font-mono text-xs leading-relaxed">{json}</pre>
          </>
        ) : (
          <p className="grid h-full place-items-center rounded-md border border-dashed border-line-strong text-muted">
            Für dieses Modell liegt noch kein Lauf vor.
          </p>
        )}
      </div>
      <p className="border-t border-line px-5 py-3 text-xs text-muted">
        Das Schema im Mock ist illustrativ. Im echten Betrieb enthalten Logs nur Metadaten, nie den State.
      </p>
    </aside>
  );
}
