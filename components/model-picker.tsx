"use client";

import { RotateCw, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtInt, overLimit } from "@/lib/limits";
import { BACKEND_LABEL, modelMeta } from "@/lib/models";
import type { ModelId, ModelsResponse } from "@/lib/types";
import { Group } from "./group";
import { Dot } from "./viz";

export const MAX_MODELS = 3;

type Props = {
  /** `null`, solange `/api/models` noch lädt. */
  catalog: ModelsResponse | null;
  selected: ModelId[];
  onSelected: (m: ModelId[]) => void;
  tokens: number;
  onRefresh: () => Promise<void>;
};

export function ModelPicker({ catalog, selected, onSelected, tokens, onRefresh }: Props) {
  const [refreshing, setRefreshing] = useState(false);
  const available = catalog?.models ?? [];
  // Ausgewählte, aber nicht mehr verfügbare Modelle (z. B. aus dem Verlauf) bleiben sichtbar, damit man sie abwählen kann.
  const missing = selected.filter((id) => !available.some((m) => m.id === id)).map(modelMeta);
  const rows = [...available.map((m) => ({ m, gone: false })), ...missing.map((m) => ({ m, gone: true }))];

  const setModel = (id: ModelId, on: boolean, gone: boolean) => {
    if (!on && (selected.length > 1 || gone)) onSelected(selected.filter((m) => m !== id));
    if (on && selected.length < MAX_MODELS && !selected.includes(id)) onSelected([...selected, id]);
  };

  return (
    <Group
      title="Modelle"
      aside={
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          bis zu {MAX_MODELS} zum Vergleich
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Modelle neu laden"
            disabled={refreshing}
            onClick={() => {
              setRefreshing(true);
              onRefresh().finally(() => setRefreshing(false));
            }}
            className="-my-1 text-muted-foreground"
          >
            <RotateCw aria-hidden className={refreshing ? "animate-spin" : ""} />
          </Button>
        </span>
      }
    >
      {catalog === null &&
        [0, 1].map((i) => (
          <div key={i} className="flex min-h-11 items-center gap-2.5 px-3 py-1.5">
            <Skeleton className="size-4" />
            <Skeleton className="h-3 flex-1" />
          </div>
        ))}
      {catalog && rows.length === 0 && (
        <p className="px-3 py-2.5 text-xs text-muted-foreground">Kein Modell gefunden. Läuft „ollama serve“?</p>
      )}
      {rows.map(({ m, gone }) => {
        const on = selected.includes(m.id);
        const locked = (!on && (gone || selected.length >= MAX_MODELS)) || (on && !gone && selected.length === 1);
        const over = overLimit(tokens, m);
        const id = `model-${m.id}`;
        return (
          <Label
            key={m.id}
            htmlFor={id}
            className={`flex min-h-11 items-center gap-2.5 px-3 py-1.5 font-normal ${locked ? (on ? "" : "opacity-60") : "cursor-pointer hover:bg-muted/60"}`}
          >
            <Checkbox
              id={id}
              aria-label={m.label}
              checked={on}
              disabled={locked}
              onCheckedChange={(v) => setModel(m.id, v === true, gone)}
            />
            <Dot color={m.color} />
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[13px] font-medium">{m.label}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {BACKEND_LABEL[m.backend]}, {m.size}
              </span>
            </span>
            {m.contextTokens > 0 && (
              <span
                className={`text-xs tabular-nums ${over ? "font-medium text-destructive" : "text-muted-foreground"}`}
              >
                {fmtInt(tokens)} / {fmtInt(m.contextTokens)}
                {over && <span className="sr-only"> überschreitet das Limit</span>}
              </span>
            )}
          </Label>
        );
      })}
      {catalog?.errors.map((e) => (
        <p key={e.backend} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-warn">
          <TriangleAlert aria-hidden className="size-3.5 shrink-0" />
          {e.message}
        </p>
      ))}
    </Group>
  );
}
