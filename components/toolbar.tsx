"use client";

import { Braces, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type Props = {
  onToggleInspector: () => void;
  inspectorOpen: boolean;
};

const noop = () => () => {};

/** Ein Klick schaltet weiter: System → Hell → Dunkel → System. */
const THEMES = {
  system: { label: "System", icon: Monitor, next: "light" },
  light: { label: "Hell", icon: Sun, next: "dark" },
  dark: { label: "Dunkel", icon: Moon, next: "system" },
} as const;

export function Toolbar(p: Props) {
  const { theme, setTheme } = useTheme();
  // Das Theme steht erst im Browser fest; bis zur Hydration gilt "System", damit Server und Client übereinstimmen.
  const mounted = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const current = (mounted && THEMES[theme as keyof typeof THEMES]) || THEMES.system;
  const Icon = current.icon;

  return (
    <div className="flex items-center gap-0.5">
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-label="Request-Inspektor"
              aria-pressed={p.inspectorOpen}
              onClick={p.onToggleInspector}
              className="text-muted-foreground aria-pressed:bg-accent aria-pressed:text-foreground"
            />
          }
        >
          <Braces aria-hidden />
        </TooltipTrigger>
        <TooltipContent>Request-Inspektor</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Design: ${current.label}`}
              onClick={() => setTheme(current.next)}
              className="text-muted-foreground"
            />
          }
        >
          <Icon aria-hidden />
        </TooltipTrigger>
        <TooltipContent>Design: {current.label}</TooltipContent>
      </Tooltip>
    </div>
  );
}
