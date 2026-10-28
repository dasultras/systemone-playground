"use client";

import { motion } from "motion/react";
import { NOUL_BAND, bimodalPeaks, expectedScore, fmtNum, fmtPct } from "@/lib/metrics";
import type { Light } from "@/lib/types";

const LIGHT = {
  green: { label: "Belastbar", dot: "bg-ok", text: "text-ok" },
  yellow: { label: "Prüfen", dot: "bg-warn", text: "text-warn" },
  red: { label: "Unsicher", dot: "bg-bad", text: "text-bad" },
} satisfies Record<Light, { label: string; dot: string; text: string }>;

export function Dot({ color, className = "" }: { color: string; className?: string }) {
  return <span aria-hidden className={`inline-block size-2 shrink-0 rounded-full ${className}`} style={{ background: color }} />;
}

export function Verdict({ light }: { light: Light }) {
  const l = LIGHT[light];
  return (
    <span className={`inline-flex items-center gap-1.5 font-medium ${l.text}`}>
      <span aria-hidden className={`size-1.5 rounded-full ${l.dot}`} />
      {l.label}
    </span>
  );
}

export const gridTemplate = (n: number) => `minmax(6.5rem, 10rem) repeat(${n}, minmax(0, 1fr))`;

const spring = { type: "spring", stiffness: 160, damping: 24 } as const;
const tint = (color: string, pct: number) => `color-mix(in srgb, ${color} ${pct}%, transparent)`;

export type Col = {
  key: string;
  name: string;
  color: string;
  probs: number[] | null;
};

/**
 * Optionen × Modelle. Jede Zelle ist ein Balken mit der Zahl darin,
 * die gestrichelte Linie markiert das Zufallsniveau 1/K.
 */
export function ChoiceMatrix({ labels, cols }: { labels: string[]; cols: Col[] }) {
  const k = labels.length;
  const template = gridTemplate(cols.length);
  return (
    <div role="table" aria-label="Wahrscheinlichkeit je Option und Modell">
      {cols.length > 1 && (
        <div role="row" className="grid items-end gap-x-3 pb-2" style={{ gridTemplateColumns: template }}>
          <span role="columnheader"><span className="sr-only">Option</span></span>
          {cols.map((c) => (
            <span key={c.key} role="columnheader" className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-muted">
              <Dot color={c.color} />
              <span className="truncate">{c.name}</span>
            </span>
          ))}
        </div>
      )}
      {labels.map((l, i) => (
        <div key={i} role="row" className="grid items-center gap-x-3 border-t border-line py-[3px]" style={{ gridTemplateColumns: template }}>
          <span role="rowheader" className="truncate pr-2 text-[13px] text-muted" title={l}>
            {l}
          </span>
          {cols.map((c) => {
            if (!c.probs) return <span key={c.key} role="cell" className="px-2 text-faint">–</span>;
            const top = c.probs.indexOf(Math.max(...c.probs)) === i;
            return (
              <div key={c.key} role="cell" className="relative h-6 overflow-hidden rounded-[3px]">
                <motion.div
                  className="absolute inset-y-0 left-0"
                  style={{ background: tint(c.color, top ? 34 : 14) }}
                  initial={{ width: 0 }}
                  animate={{ width: `${c.probs[i] * 100}%` }}
                  transition={spring}
                />
                {top && <span aria-hidden className="absolute inset-y-0 left-0 w-[2px]" style={{ background: c.color }} />}
                <span aria-hidden className="absolute inset-y-0 w-px border-l border-dashed border-ink/25" style={{ left: `${100 / k}%` }} />
                <span className={`relative flex h-full items-center px-2 tabular-nums ${top ? "font-semibold text-ink" : "text-muted"}`}>
                  {fmtPct(c.probs[i])}
                </span>
              </div>
            );
          })}
        </div>
      ))}
      <p className="mt-2 flex items-center gap-2 text-xs text-faint">
        <span aria-hidden className="inline-block h-3 border-l border-dashed border-ink/40" />
        Zufallsniveau 1/K = <span className="tabular-nums">{fmtPct(1 / k)}</span>
      </p>
    </div>
  );
}

/** P(wahr) auf einer Skala, die Zone 0,3–0,7 gilt als „unklar“. */
export function NoulScale({ pTrue, color }: { pTrue: number; color: string }) {
  const [lo, hi] = NOUL_BAND;
  const ticks: [number, string][] = [[0, "0"], [lo, "0,3"], [hi, "0,7"], [1, "1"]];
  return (
    <div role="img" aria-label={`P(wahr) ${fmtPct(pTrue)}, Zone unklar zwischen 0,3 und 0,7`}>
      <div className="relative h-5">
        <div className="absolute inset-x-0 top-2 h-1.5 overflow-hidden rounded-full bg-sunken-2">
          <div className="hatch absolute inset-y-0 bg-warn-soft" style={{ left: `${lo * 100}%`, width: `${(hi - lo) * 100}%` }} />
        </div>
        <motion.div
          className="absolute top-0 h-5 w-[3px] -translate-x-1/2 rounded-full"
          style={{ background: color }}
          initial={{ left: "50%" }}
          animate={{ left: `${pTrue * 100}%` }}
          transition={spring}
        />
      </div>
      <div className="relative h-4 text-[11px] tabular-nums text-faint">
        {ticks.map(([v, t]) => (
          <span
            key={t}
            className={`absolute ${v === 0 ? "" : v === 1 ? "-translate-x-full" : "-translate-x-1/2"}`}
            style={{ left: `${v * 100}%` }}
          >
            {t}
          </span>
        ))}
      </div>
      <div className="relative h-4 text-[11px] text-faint">
        <span className="absolute left-0">Nein</span>
        <span className="absolute -translate-x-1/2 text-warn" style={{ left: `${((lo + hi) / 2) * 100}%` }}>unklar</span>
        <span className="absolute right-0">Ja</span>
      </div>
    </div>
  );
}

/** Verteilung über die Level, Erwartungswert als gestrichelte Linie. */
export function ScoreChart({ probs, color, low, high }: { probs: number[]; color: string; low: string; high: string }) {
  const n = probs.length;
  const max = Math.max(...probs) || 1;
  const mode = probs.indexOf(Math.max(...probs));
  const e = expectedScore(probs);
  const peaks = bimodalPeaks(probs);
  const H = 72;
  return (
    <div>
      <div role="img" aria-label={`Verteilung über ${n} Level, Modus ${mode + 1}, Erwartungswert ${fmtNum(e)}`} className="relative">
        <div className="flex items-end gap-1" style={{ height: H + 16 }}>
          {probs.map((p, i) => (
            <div key={i} className="flex h-full flex-1 flex-col items-center justify-end">
              <span className={`mb-0.5 text-[11px] tabular-nums ${i === mode ? "font-semibold text-ink" : "text-faint"}`}>{fmtPct(p, 0)}</span>
              <motion.div
                className="w-full rounded-t-[3px]"
                style={{ background: i === mode ? color : tint(color, 28) }}
                initial={{ height: 0 }}
                animate={{ height: Math.max(2, (p / max) * H) }}
                transition={spring}
              />
            </div>
          ))}
        </div>
        <div aria-hidden className="pointer-events-none absolute inset-y-0 border-l border-dashed border-ink/50" style={{ left: `${((e - 0.5) / n) * 100}%` }} />
      </div>
      <div className="flex gap-1 border-t border-line pt-1 text-[11px] tabular-nums text-muted">
        {probs.map((_, i) => (
          <span key={i} className="flex-1 text-center">{i + 1}</span>
        ))}
      </div>
      <div className="mt-0.5 flex justify-between text-[11px] text-faint">
        <span>1 = {low}</span>
        <span>{n} = {high}</span>
      </div>
      {peaks && (
        <p className="mt-2 rounded-md bg-warn-soft px-2.5 py-1.5 text-xs text-warn">
          Zwei Gipfel bei Level {peaks[0]} und {peaks[1]}. Der Erwartungswert ist hier irreführend.
        </p>
      )}
    </div>
  );
}
