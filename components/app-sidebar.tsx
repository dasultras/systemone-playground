"use client";

import { Download, SquarePen, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { NO_HISTORY, groupOf, timeLabel } from "@/lib/history";
import { modelById } from "@/lib/models";
import type { HistoryEntry, HistoryGroup } from "@/lib/types";
import { ResizeHandle } from "./resize-handle";
import { Dot } from "./viz";

type Props = {
  history: HistoryEntry[];
  activeId: string | null;
  onSelect: (e: HistoryEntry) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onExport: (kind: "json" | "csv") => void;
  width: number;
  widthRange: { initial: number; min: number; max: number };
  onWidth: (w: number) => void;
};

const GROUPS: HistoryGroup[] = ["Heute", "Gestern", "Diese Woche", "Älter"];

// Einfügen und Löschen kurz ein- und ausblenden; overflow nur während der Animation, sonst wäre der Fokusring abgeschnitten.
// Gruppen genauso, damit der erste Eintrag einer neuen Gruppe und das Löschen des letzten sichtbar animieren.
const MotionGroup = motion.create(SidebarGroup);
const MotionItem = motion.create(SidebarMenuItem);
const ITEM = {
  initial: { opacity: 0, height: 0, overflow: "hidden" },
  animate: { opacity: 1, height: "auto", transitionEnd: { overflow: "visible" } },
  exit: { opacity: 0, height: 0, overflow: "hidden" },
  transition: { duration: 0.18, ease: "easeOut" },
} as const;

export function AppSidebar({
  history,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onExport,
  width,
  widthRange,
  onWidth,
}: Props) {
  const [query, setQuery] = useState("");
  const { isMobile, setOpenMobile, setOpen } = useSidebar();
  const filtered = history.filter((h) =>
    `${h.title} ${h.questions.map((q) => q.text).join(" ")}`.toLowerCase().includes(query.toLowerCase()),
  );
  const closeOnMobile = () => isMobile && setOpenMobile(false);

  return (
    <Sidebar aria-label="Verlauf">
      <SidebarHeader className="gap-2">
        <div className="flex h-7 items-center gap-2 px-2">
          <span
            aria-hidden
            className="grid size-5 place-items-center rounded-[5px] bg-primary text-[11px] leading-none font-bold text-primary-foreground"
          >
            s
          </span>
          <span className="text-[13px] font-semibold">System One Playground</span>
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => {
                onNew();
                closeOnMobile();
              }}
              className="text-[13px] font-medium"
            >
              <SquarePen aria-hidden className="text-muted-foreground" />
              <span>Neuer Lauf</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <label htmlFor="verlauf-suche" className="sr-only">
          Verlauf durchsuchen
        </label>
        <SidebarInput
          id="verlauf-suche"
          type="search"
          name="verlauf-suche"
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Verlauf durchsuchen …"
        />
      </SidebarHeader>

      <SidebarContent>
        {/* Neuer key nach der Hydration: Der geladene Verlauf erscheint ohne Animation. */}
        <AnimatePresence initial={false} key={history === NO_HISTORY ? "server" : "client"}>
          {GROUPS.map((g) => {
            const items = filtered.filter((h) => groupOf(h.at) === g);
            if (!items.length) return null;
            return (
              <MotionGroup key={g} className="py-1" {...ITEM}>
                <SidebarGroupLabel>{g}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <AnimatePresence initial={false}>
                      {items.map((h) => (
                        <MotionItem key={h.id} {...ITEM}>
                          <SidebarMenuButton
                            size="lg"
                            isActive={activeId === h.id}
                            aria-current={activeId === h.id ? "true" : undefined}
                            onClick={() => {
                              onSelect(h);
                              closeOnMobile();
                            }}
                            className="h-auto py-1.5"
                          >
                            <span className="flex min-w-0 flex-col gap-0.5">
                              <span className="truncate text-[13px] font-medium">{h.title}</span>
                              <span className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
                                <span className="tabular-nums">{timeLabel(h.at)}</span>
                                <span className="flex gap-1">
                                  {h.models.map((m) => (
                                    <span key={m} className="inline-flex" title={modelById(m).label}>
                                      <Dot color={modelById(m).color} className="size-1.5!" />
                                      <span className="sr-only">{modelById(m).label}</span>
                                    </span>
                                  ))}
                                </span>
                                {h.mode === "multi" && <span>{h.questions.length} Fragen</span>}
                              </span>
                            </span>
                          </SidebarMenuButton>
                          <SidebarMenuAction
                            showOnHover
                            onClick={() => onDelete(h.id)}
                            aria-label={`Lauf „${h.title}“ (${timeLabel(h.at)}) löschen`}
                          >
                            <X aria-hidden />
                          </SidebarMenuAction>
                        </MotionItem>
                      ))}
                    </AnimatePresence>
                  </SidebarMenu>
                </SidebarGroupContent>
              </MotionGroup>
            );
          })}
        </AnimatePresence>
        {filtered.length === 0 && (
          <p className="px-4 pt-6 text-muted-foreground">
            {history.length ? "Keine Läufe gefunden." : "Noch keine Läufe. Ergebnisse landen hier automatisch."}
          </p>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <p className="px-1 text-xs font-medium text-faint">Verlauf exportieren</p>
        <div className="flex gap-1">
          <Button variant="outline" className="flex-1" disabled={!history.length} onClick={() => onExport("json")}>
            <Download aria-hidden /> JSON
          </Button>
          <Button variant="outline" className="flex-1" disabled={!history.length} onClick={() => onExport("csv")}>
            <Download aria-hidden /> CSV
          </Button>
        </div>
        <p className="px-1 text-xs text-faint">Gespeichert nur in diesem Browser.</p>
      </SidebarFooter>
      <ResizeHandle
        label="Breite des Verlaufs"
        value={width}
        min={widthRange.min}
        max={widthRange.max}
        onChange={onWidth}
        onReset={() => onWidth(widthRange.initial)}
        onCollapse={() => setOpen(false)}
        measure={(h) => h.parentElement?.getBoundingClientRect().width}
        className="absolute inset-y-0 -right-1 hidden md:block"
      />
    </Sidebar>
  );
}
