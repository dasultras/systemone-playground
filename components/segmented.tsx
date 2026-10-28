"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

/** Einfachauswahl auf Basis der shadcn-ToggleGroup; leere Auswahl ist nicht erlaubt. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
}) {
  return (
    <ToggleGroup
      aria-label={label}
      variant="outline"
      size="sm"
      spacing={0}
      value={[value]}
      onValueChange={(v: unknown[]) => {
        const next = v[0];
        if (typeof next === "string") onChange(next as T);
      }}
    >
      {options.map((o) => (
        <ToggleGroupItem
          key={o.value}
          value={o.value}
          className="px-2.5 text-xs text-muted-foreground aria-pressed:bg-accent aria-pressed:text-foreground pointer-coarse:min-h-10 pointer-coarse:min-w-10"
        >
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
