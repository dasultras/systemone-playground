"use client";

import { Download, SquarePen, X } from "lucide-react";
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
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { modelById } from "@/lib/mock-data";
import type { HistoryEntry } from "@/lib/types";
import { Dot } from "./viz";

type Props = {
  history: HistoryEntry[];
  activeId: string | null;
  onSelect: (e: HistoryEntry) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onExport: (kind: "json" | "csv") => void;
};

const GROUPS: HistoryEntry["group"][] = ["Heute", "Gestern", "Diese Woche"];

export function AppSidebar({ history, activeId, onSelect, onNew, onDelete, onExport }: Props) {
  const [query, setQuery] = useState("");
  const { isMobile, setOpenMobile } = useSidebar();
  const filtered = history.filter((h) =>
    `${h.title} ${h.questions.map((q) => q.text).join(" ")}`.toLowerCase().includes(query.toLowerCase()),
  );
  const closeOnMobile = () => isMobile && setOpenMobile(false);

  return (
    <Sidebar aria-label="Verlauf">
      <SidebarHeader className="gap-2">
        <div className="flex h-7 items-center gap-2 px-2">
          <span aria-hidden className="grid size-5 place-items-center rounded-[5px] bg-primary text-[11px] font-bold leading-none text-primary-foreground">
            d
          </span>
          <span className="text-[13px] font-semibold">Decision Playground</span>
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
        {GROUPS.map((g) => {
          const items = filtered.filter((h) => h.group === g);
          if (!items.length) return null;
          return (
            <SidebarGroup key={g} className="py-1">
              <SidebarGroupLabel>{g}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((h) => (
                    <SidebarMenuItem key={h.id}>
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
                            <span className="tabular-nums">{h.time}</span>
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
                      <SidebarMenuAction showOnHover onClick={() => onDelete(h.id)} aria-label={`Lauf „${h.title}“ löschen`}>
                        <X aria-hidden />
                      </SidebarMenuAction>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
        {filtered.length === 0 && <p className="px-4 pt-6 text-muted-foreground">Keine Läufe gefunden.</p>}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <p className="px-1 text-xs font-medium text-faint">Verlauf exportieren</p>
        <div className="flex gap-1">
          <Button variant="outline" className="flex-1" onClick={() => onExport("json")}>
            <Download aria-hidden /> JSON
          </Button>
          <Button variant="outline" className="flex-1" onClick={() => onExport("csv")}>
            <Download aria-hidden /> CSV
          </Button>
        </div>
        <p className="px-1 text-xs text-faint">Gespeichert nur in diesem Browser.</p>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
