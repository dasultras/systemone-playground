"use client";

import { Check, Copy, RotateCw, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtInt, overLimit } from "@/lib/limits";
import { fmtNum, fmtPct } from "@/lib/metrics";
import { BACKEND_LABEL, modelMeta } from "@/lib/models";
import { PULL_START, pullModel, statusText, type PullProgress } from "@/lib/pull";
import type { KnownModel, ModelId, ModelsResponse } from "@/lib/types";
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
  const known = catalog?.known ?? [];

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
      {known.length > 0 && <SubHeading>Installiert</SubHeading>}
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
              {m.backend === "vllm" && (
                <span className="block truncate text-xs text-muted-foreground">
                  Modell wird beim Start von vLLM festgelegt
                </span>
              )}
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
      {known.length > 0 && <SubHeading>Bekannt, nicht installiert</SubHeading>}
      {known.map((k) => (
        <KnownRow key={k.name} k={k} pull={catalog?.pull === true} onRefresh={onRefresh} />
      ))}
      {catalog?.errors.map((e) => (
        <p key={e.backend} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-warn">
          <TriangleAlert aria-hidden className="size-3.5 shrink-0" />
          {e.message}
        </p>
      ))}
    </Group>
  );
}

const SubHeading = ({ children }: { children: string }) => (
  <h3 className="px-3 pt-2 pb-1 text-[11px] font-semibold text-muted-foreground">{children}</h3>
);

type PullState = PullProgress | { error: string };

/** Bekanntes Modell: mit ALLOW_PULL direkt pullen, sonst den Befehl für den Host zum Kopieren. */
function KnownRow({ k, pull, onRefresh }: { k: KnownModel; pull: boolean; onRefresh: () => Promise<void> }) {
  const [state, setState] = useState<PullState | null>(null);
  const [copied, setCopied] = useState(false);
  const progress = state && "status" in state ? state : null;
  const pulling = progress !== null && !progress.done;
  const pct = progress?.total ? progress.completed / progress.total : 0;
  const command = `ollama pull ${k.name}`;
  const size = `≈ ${fmtNum(k.sizeGb, 1)} GB`;

  const start = async () => {
    setState(PULL_START);
    try {
      await pullModel(k.name, setState);
      toast(`${k.label} installiert`);
      await onRefresh();
    } catch (e) {
      setState({ error: e instanceof Error ? e.message : String(e) });
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // Zwischenablage gesperrt: Ein Klick auf den Befehl markiert ihn ganz.
      toast("Kopieren nicht möglich, bitte den Befehl markieren");
    }
  };

  return (
    <div className="space-y-1.5 px-3 py-2">
      <span className="block leading-tight">
        <span className="block truncate text-[13px] font-medium" title={k.name}>
          {k.label}
        </span>
        {/* Mit Pull steht die Größe schon auf dem Button. */}
        <span className="block text-xs text-muted-foreground">
          {k.description}
          {!pull && ` · ${size}`} · nicht installiert
        </span>
      </span>
      {pull && (
        <Button variant="outline" size="sm" disabled={pulling} onClick={start}>
          Pullen ({size})
        </Button>
      )}
      {/* Auch nach einem Fehler, etwa 403 ohne ALLOW_PULL, bleibt der Befehl für den Host. */}
      {(!pull || (state && "error" in state)) && (
        <div className="flex items-center gap-1.5">
          <code
            title={command}
            className="min-w-0 flex-1 rounded bg-muted px-1.5 py-0.5 font-mono text-xs break-all select-all"
          >
            {command}
          </code>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={copy}
            aria-label={copied ? "Kopiert" : "Befehl kopieren"}
            className="text-muted-foreground"
          >
            {copied ? <Check aria-hidden className="text-ok" /> : <Copy aria-hidden />}
          </Button>
        </div>
      )}
      {pulling && (
        <>
          <div
            role="progressbar"
            aria-label={`Fortschritt ${k.label}`}
            aria-valuenow={Math.round(pct * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-1 overflow-hidden rounded-full bg-muted"
          >
            <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${pct * 100}%` }} />
          </div>
          <p className="flex justify-between gap-2 text-xs text-muted-foreground">
            <span className="truncate">{statusText(progress.status)}</span>
            <span className="tabular-nums">{fmtPct(pct, 0)}</span>
          </p>
        </>
      )}
      {state && "error" in state && <p className="text-xs text-destructive">Pull fehlgeschlagen: {state.error}</p>}
    </div>
  );
}
