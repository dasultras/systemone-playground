"use client";

import { motion } from "motion/react";
import { NOUL_BAND, bimodalPeaks, expectedScore, fmtNum, fmtPct, noulVerdict } from "@/lib/metrics";
import type { Light, Metrics } from "@/lib/types";

const LIGHT = {
  green: { label: "Belastbar", dot: "bg-ok", chip: "bg-ok-soft text-ok" },
  yellow: { label: "Prüfen", dot: "bg-warn", chip: "bg-warn-soft text-warn" },
  red: { label: "Unsicher", dot: "bg-bad", chip: "bg-bad-soft text-bad" },
} satisfies Record<Light, { label: string; dot: string; chip: string }>;

export function Ampel({ light, compact }: { light: Light; compact?: boolean }) {
  const l = LIGHT[light];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${l.chip}`}>
      <span className={`size-1.5 rounded-full ${l.dot}`} />
      {compact ? null : l.label}
    </span>
  );
}

export function MetricRow({ m }: { m: Metrics }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted">
      <Ampel light={m.light} />
      <span>
        confidence <b className="font-mono font-medium text-ink">{fmtNum(m.confidence)}</b>
      </span>
      <span>
        Margin <b className="font-mono font-medium text-ink">{fmtNum(m.margin)}</b>
      </span>
    </div>
  );
}

const TRACK = "relative h-2 flex-1 rounded-full bg-sunken";

function Bar({ p, top, color }: { p: number; top: boolean; color?: string }) {
  return (
    <motion.div
      className="h-full rounded-full"
      style={{ background: top ? (color ?? "var(--accent)") : "var(--faint)", opacity: top ? 1 : 0.45 }}
      initial={{ width: 0 }}
      animate={{ width: `${p * 100}%` }}
      transition={{ type: "spring", stiffness: 140, damping: 22 }}
    />
  );
}

/** Balken je Option mit Referenzlinie bei 1/K. */
export function ChoiceBars({ labels, probs, color }: { labels: string[]; probs: number[]; color?: string }) {
  const k = probs.length;
  const top = probs.indexOf(Math.max(...probs));
  return (
    <div className="space-y-2">
      {labels.map((l, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className={`w-36 shrink-0 truncate text-sm ${i === top ? "font-medium text-ink" : "text-muted"}`} title={l}>
            {l}
          </span>
          <div className={TRACK}>
            <Bar p={probs[i]} top={i === top} color={color} />
            <span className="absolute -top-1 bottom-[-4px] w-px border-l border-dashed border-ink/40" style={{ left: `${(100 / k)}%` }} />
          </div>
          <span className={`w-14 shrink-0 text-right font-mono text-xs ${i === top ? "text-ink" : "text-muted"}`}>
            {fmtPct(probs[i])}
          </span>
        </div>
      ))}
      <p className="pl-[9.75rem] text-[11px] text-faint">┆ Zufallsniveau 1/K = {fmtPct(1 / k)}</p>
    </div>
  );
}

/** Vergleich: Zeilen = Optionen, Spalten = Modelle. */
export function ChoiceCompare({
  labels,
  cols,
}: {
  labels: string[];
  cols: { key: string; name: string; color: string; probs: number[] | null }[];
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <span className="w-36 shrink-0" />
        <div className="grid flex-1 gap-3" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0,1fr))` }}>
          {cols.map((c) => (
            <span key={c.key} className="flex items-center gap-1.5 truncate text-[11px] font-medium text-muted">
              <span className="size-2 rounded-full" style={{ background: c.color }} />
              {c.name}
            </span>
          ))}
        </div>
      </div>
      {labels.map((l, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="w-36 shrink-0 truncate text-sm text-muted" title={l}>
            {l}
          </span>
          <div className="grid flex-1 gap-3" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0,1fr))` }}>
            {cols.map((c) => {
              if (!c.probs) return <span key={c.key} className="text-xs text-faint">—</span>;
              const top = c.probs.indexOf(Math.max(...c.probs)) === i;
              return (
                <div key={c.key} className="flex items-center gap-2">
                  <div className={TRACK}>
                    <Bar p={c.probs[i]} top={top} color={c.color} />
                    <span className="absolute -top-0.5 bottom-[-2px] w-px border-l border-dashed border-ink/30" style={{ left: `${100 / c.probs.length}%` }} />
                  </div>
                  <span className={`w-12 shrink-0 text-right font-mono text-[11px] ${top ? "text-ink" : "text-muted"}`}>
                    {fmtPct(c.probs[i], 0)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/** P(wahr) auf einer Skala; Band 0,3–0,7 gilt als "unklar". */
export function NoulGauge({ pTrue, color }: { pTrue: number; color?: string }) {
  const verdict = noulVerdict(pTrue);
  const v = {
    yes: { label: "Ja", cls: "text-ok" },
    no: { label: "Nein", cls: "text-ink" },
    unclear: { label: "Unklar", cls: "text-warn" },
  }[verdict];
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className={`text-lg font-semibold tracking-tight ${v.cls}`}>{v.label}</span>
        <span className="font-mono text-xs text-muted">
          P(wahr) <b className="font-medium text-ink">{fmtPct(pTrue)}</b>
        </span>
      </div>
      <div className="relative h-8">
        <div className="absolute inset-x-0 top-3 h-2 rounded-full bg-sunken" />
        <div
          className="absolute top-3 h-2 bg-warn/25"
          style={{ left: `${NOUL_BAND[0] * 100}%`, width: `${(NOUL_BAND[1] - NOUL_BAND[0]) * 100}%` }}
        />
        <motion.div
          className="absolute top-1.5 size-5 -translate-x-1/2 rounded-full border-[3px] border-panel shadow-md"
          style={{ background: color ?? "var(--accent)" }}
          initial={{ left: "50%" }}
          animate={{ left: `${pTrue * 100}%` }}
          transition={{ type: "spring", stiffness: 140, damping: 20 }}
        />
      </div>
      <div className="relative mt-0.5 h-4 font-mono text-[10px] text-faint">
        <span className="absolute left-0">0 Nein</span>
        <span className="absolute -translate-x-1/2" style={{ left: "50%" }}>
          unklar 0,3–0,7
        </span>
        <span className="absolute right-0">Ja 1</span>
      </div>
    </div>
  );
}

/** Volle Verteilung über die Level, Erwartungswert als Marke, Hinweis bei zwei Gipfeln. */
export function ScoreHistogram({
  probs,
  low,
  high,
  color,
  compact,
}: {
  probs: number[];
  low: string;
  high: string;
  color?: string;
  compact?: boolean;
}) {
  const n = probs.length;
  const max = Math.max(...probs);
  const mode = probs.indexOf(max);
  const e = expectedScore(probs);
  const peaks = bimodalPeaks(probs);
  const h = compact ? 64 : 104;
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-lg font-semibold tracking-tight">
          Modus {mode + 1}
          <span className="ml-2 text-sm font-normal text-muted">
            Erwartung <b className="font-mono font-medium text-ink">{fmtNum(e)}</b>
          </span>
        </span>
      </div>
      <div className="flex items-end gap-1.5" style={{ height: h }}>
        {probs.map((p, i) => (
          <div key={i} className="flex h-full flex-1 flex-col items-center justify-end">
            <span className="mb-1 font-mono text-[10px] text-muted">{fmtPct(p, 0)}</span>
            <motion.div
              className="w-full rounded-t-md"
              style={{ background: i === mode ? (color ?? "var(--accent)") : "var(--faint)", opacity: i === mode ? 1 : 0.4 }}
              initial={{ height: 0 }}
              animate={{ height: Math.max(3, (p / (max || 1)) * (h - 18)) }}
              transition={{ type: "spring", stiffness: 140, damping: 22 }}
            />
          </div>
        ))}
      </div>
      <div className="relative mt-1 h-3 border-t border-line">
        <span
          className="absolute -top-[3px] size-1.5 -translate-x-1/2 rotate-45 bg-ink"
          style={{ left: `${((e - 1 + 0.5) / n) * 100}%` }}
          title={`Erwartungswert ${fmtNum(e)}`}
        />
      </div>
      <div className="flex gap-1.5">
        {probs.map((_, i) => (
          <span key={i} className="flex-1 text-center font-mono text-[11px] text-muted">
            {i + 1}
          </span>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-faint">
        <span>1 = {low}</span>
        <span>{n} = {high}</span>
      </div>
      {peaks && (
        <p className="mt-2 rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn">
          Zwei Gipfel (Level {peaks[0]} und {peaks[1]}): Das Modell ist uneins, der Erwartungswert ist hier irreführend.
        </p>
      )}
    </div>
  );
}
