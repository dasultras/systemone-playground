"use client";

import { Braces, FlaskConical, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { SimulatedError } from "@/lib/mock-run";

type Props = {
  onToggleInspector: () => void;
  inspectorOpen: boolean;
  simulate: SimulatedError;
  onSimulate: (s: SimulatedError) => void;
};

const noop = () => () => {};

const SIMULATIONS = [
  ["none", "Kein Fehler"],
  ["timeout", "Timeout"],
  ["overflow", "Overflow (HTTP 400)"],
] as const;

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
      <Badge variant="outline" className="mr-2 hidden md:inline-flex">
        Mock
      </Badge>

      <Popover>
        <Tooltip>
          <TooltipTrigger
            render={
              <PopoverTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Fehler simulieren"
                    className={p.simulate !== "none" ? "text-warn" : "text-muted-foreground"}
                  />
                }
              />
            }
          >
            <FlaskConical aria-hidden />
          </TooltipTrigger>
          <TooltipContent>Fehler simulieren</TooltipContent>
        </Tooltip>
        <PopoverContent align="end" className="w-64">
          <PopoverHeader>
            <PopoverTitle>Fehler simulieren</PopoverTitle>
            <PopoverDescription>
              Betrifft das zuletzt gewählte Modell. Fehler erscheinen nie als Antwort.
            </PopoverDescription>
          </PopoverHeader>
          <RadioGroup
            value={p.simulate}
            onValueChange={(v) => p.onSimulate(v as SimulatedError)}
            aria-label="Fehlerart"
          >
            {SIMULATIONS.map(([v, label]) => (
              <Label key={v} className="flex cursor-pointer items-center gap-2 font-normal">
                <RadioGroupItem value={v} />
                {label}
              </Label>
            ))}
          </RadioGroup>
        </PopoverContent>
      </Popover>

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
