"use client";

import { X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** Zeilenhöhe in px. Textfeld, Nummern, Trennlinien und ✕ liegen auf demselben Raster. */
const ROW = 32;
const GRID = `repeating-linear-gradient(to bottom, var(--border) 0 1px, transparent 1px ${ROW}px)`;

/** Aufzählungszeichen und Nummerierung („- “, „• “, „3. “, „3) “) beim Einfügen entfernen. */
const LIST_PREFIX = /^\s*(?:[-*•]|\d+[.)])\s+/;

const lineAt = (text: string, pos: number) => text.slice(0, pos).split("\n").length - 1;

/**
 * Choice-Optionen als ein Textfeld, eine Option pro Zeile: Alles lässt sich auf einmal
 * markieren, kopieren und als Liste einfügen. Nummern und ✕ sind nur Overlay.
 */
export function OptionsEditor({
  id,
  options,
  onChange,
  min,
  max,
}: {
  id: string;
  options: string[];
  onChange: (options: string[]) => void;
  min: number;
  max: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [caret, setCaret] = useState<number | null>(null);
  const value = options.join("\n");
  const n = options.length;

  const commit = (text: string, cursor?: number) => {
    let lines = text.split("\n");
    if (lines.length > max) {
      toast(`Höchstens ${max} Optionen, ${lines.length - max} Zeilen wurden ignoriert.`);
      lines = lines.slice(0, max);
    }
    onChange(lines);
    if (cursor !== undefined)
      requestAnimationFrame(() => {
        const el = ref.current;
        if (!el) return;
        const pos = Math.min(cursor, el.value.length);
        el.setSelectionRange(pos, pos);
        setCaret(lineAt(el.value, pos));
      });
  };

  const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = e.clipboardData.getData("text").replace(/\r\n?/g, "\n");
    if (!pasted.includes("\n")) return;
    e.preventDefault();
    const lines = pasted
      .replace(/\n+$/, "")
      .split("\n")
      .map((l) => l.replace(LIST_PREFIX, "").trim());
    const el = e.currentTarget;
    const before = value.slice(0, el.selectionStart);
    const inserted = lines.join("\n");
    commit(before + inserted + value.slice(el.selectionEnd), before.length + inserted.length);
  };

  const remove = (i: number) => {
    const next = options.filter((_, j) => j !== i);
    const row = Math.min(i, next.length - 1);
    const pos = next.slice(0, row).reduce((s, o) => s + o.length + 1, 0);
    onChange(next);
    requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.setSelectionRange(pos, pos);
      setCaret(row);
    });
  };

  const trackCaret = (el: HTMLTextAreaElement) => setCaret(lineAt(el.value, el.selectionStart));

  return (
    <div
      className="relative bg-strip"
      style={{ height: n * ROW }}
      onMouseMove={(e) => setHover(Math.floor((e.clientY - e.currentTarget.getBoundingClientRect().top) / ROW))}
      onMouseLeave={() => setHover(null)}
    >
      {/* Trennlinien ab der zweiten Zeile; die erste und letzte Linie zieht die Gruppe. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0"
        style={{ top: ROW, backgroundImage: GRID }}
      />

      <ol
        aria-hidden
        className="pointer-events-none absolute top-0 left-3 w-4 text-right text-xs text-faint tabular-nums"
      >
        {options.map((_, i) => (
          <li key={i} style={{ height: ROW, lineHeight: `${ROW}px` }}>
            {i + 1}
          </li>
        ))}
      </ol>

      {options.map(
        (o, i) =>
          !o && (
            <span
              key={i}
              aria-hidden
              className="pointer-events-none absolute left-9 text-[13px] text-muted-foreground"
              style={{ top: i * ROW, lineHeight: `${ROW}px` }}
            >
              Option {i + 1}
            </span>
          ),
      )}

      <textarea
        ref={ref}
        id={id}
        value={value}
        onChange={(e) => {
          commit(e.target.value);
          trackCaret(e.target);
        }}
        onPaste={onPaste}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing && n >= max) e.preventDefault();
        }}
        onSelect={(e) => trackCaret(e.currentTarget)}
        onFocus={(e) => trackCaret(e.currentTarget)}
        onBlur={() => setCaret(null)}
        aria-label={`Optionen, eine pro Zeile, ${n} von ${max}`}
        wrap="off"
        rows={n}
        spellCheck={false}
        autoComplete="off"
        className="absolute inset-0 resize-none overflow-hidden bg-transparent pr-9 pl-9 text-[13px] outline-none"
        style={{ lineHeight: `${ROW}px` }}
      />

      {n > min &&
        options.map((_, i) => (
          <Button
            key={i}
            variant="ghost"
            size="icon-xs"
            onClick={() => remove(i)}
            aria-label={`Option ${i + 1} entfernen`}
            className={`absolute right-1.5 text-muted-foreground hover:text-destructive focus-visible:opacity-100 pointer-coarse:opacity-100 ${hover === i || caret === i ? "opacity-100" : "opacity-0"}`}
            style={{ top: i * ROW + (ROW - 20) / 2 }}
          >
            <X aria-hidden />
          </Button>
        ))}
    </div>
  );
}
