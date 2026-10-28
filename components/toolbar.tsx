"use client";

import { Braces, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type Props = {
  onToggleInspector: () => void;
  inspectorOpen: boolean;
};

const noop = () => () => {};

export function Toolbar(p: Props) {
  const { resolvedTheme, setTheme } = useTheme();
  // Das Theme steht erst im Browser fest; bis zur Hydration gilt "hell", damit Server und Client übereinstimmen.
  const mounted = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const dark = mounted && resolvedTheme === "dark";

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
              aria-label={dark ? "Hellen Modus aktivieren" : "Dunklen Modus aktivieren"}
              onClick={() => setTheme(dark ? "light" : "dark")}
              className="text-muted-foreground"
            />
          }
        >
          <Sun aria-hidden className="hidden dark:block" />
          <Moon aria-hidden className="dark:hidden" />
        </TooltipTrigger>
        <TooltipContent>{dark ? "Heller Modus" : "Dunkler Modus"}</TooltipContent>
      </Tooltip>
    </div>
  );
}
