"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { modelById } from "@/lib/mock-data";
import type { ModelId, ModelState } from "@/lib/types";
import { Segmented } from "./segmented";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  models: ModelId[];
  states: Record<string, ModelState | undefined>;
  modelId: ModelId;
  onModel: (m: ModelId) => void;
};

export function Inspector({ open, onOpenChange, models, states, modelId, onModel }: Props) {
  const [copied, setCopied] = useState<string | null>(null);
  const s = states[modelId];
  const run = s?.status === "done" ? s.run : null;
  const m = modelById(modelId);

  const copy = async (key: string, json: string) => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(key);
      setTimeout(() => setCopied(null), 1200);
    } catch {
      /* Zwischenablage nicht verfügbar */
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 data-[side=right]:sm:max-w-[520px]">
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle className="text-[13px] font-semibold">Request-Inspektor</SheetTitle>
          <SheetDescription className="font-mono text-[11px]">
            {m.backend === "typesafe" ? "api.typesafe.ai" : "OLLAMA_BASE_URL/v1/systemone"}
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="request" className="min-h-0 flex-1 gap-3 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Segmented
              label="Modell"
              value={modelId}
              onChange={onModel}
              options={models.map((id) => ({ value: id, label: modelById(id).label }))}
            />
            <TabsList>
              <TabsTrigger value="request">Request</TabsTrigger>
              <TabsTrigger value="response">Response</TabsTrigger>
            </TabsList>
          </div>

          {(["request", "response"] as const).map((tab) => {
            const json = run ? JSON.stringify(tab === "request" ? run.request : run.response, null, 2) : "";
            return (
              <TabsContent key={tab} value={tab} className="relative min-h-0">
                {run ? (
                  <>
                    <Button
                      variant="secondary"
                      size="icon-sm"
                      className="absolute right-2 top-2"
                      onClick={() => copy(tab, json)}
                      aria-label={copied === tab ? "Kopiert" : "JSON kopieren"}
                    >
                      {copied === tab ? <Check aria-hidden className="text-ok" /> : <Copy aria-hidden />}
                    </Button>
                    <pre className="h-full overflow-auto rounded-md bg-muted p-4 font-mono text-xs leading-relaxed">{json}</pre>
                  </>
                ) : (
                  <p className="grid h-full place-items-center rounded-md border border-dashed border-input text-muted-foreground">
                    Für dieses Modell liegt noch kein Lauf vor.
                  </p>
                )}
              </TabsContent>
            );
          })}
        </Tabs>

        <SheetFooter className="border-t px-5 py-3 text-xs text-muted-foreground">
          Das Schema im Mock ist illustrativ. Im echten Betrieb enthalten Logs nur Metadaten, nie den State.
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
