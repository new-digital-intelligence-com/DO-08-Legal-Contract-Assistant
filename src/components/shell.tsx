"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon, type IconName } from "./icons";

/**
 * The frame every console screen sits in.
 *
 * A persistent left rail rather than a tab bar, for one reason that outweighs
 * the rest: the count of positions still awaiting legal sign-off stays visible
 * while you work somewhere else. This is a tool whose whole job is to put
 * things in front of a person, and a tab strip hides that number the moment you
 * leave the tab it lives on.
 */

export type Section = {
  id: string;
  label: string;
  icon: IconName;
  blurb: string;
  /** Key into the `counts` map the shell is given. */
  countKey?: string;
  /** A count here means something needs attention, not just volume. */
  alerting?: boolean;
};

export const SECTIONS: Section[] = [
  { id: "overview", label: "Overview", icon: "overview", blurb: "The last contract through, and where things stand" },
  {
    id: "contracts",
    label: "Contracts",
    icon: "documents",
    blurb: "Everything uploaded, and what came back",
    countKey: "contracts",
  },
  {
    id: "signoff",
    label: "Sign-off",
    icon: "flag",
    blurb: "Positions waiting for a lawyer",
    countKey: "awaitingSignOff",
    alerting: true,
  },
  { id: "standards", label: "Playbook", icon: "categories", blurb: "The positions we already take" },
  { id: "draft", label: "Draft", icon: "forms", blurb: "Draft an agreement to the playbook" },
  { id: "ask", label: "Ask", icon: "ask", blurb: "Policy and compliance questions" },
  { id: "audit", label: "Audit", icon: "audit", blurb: "Append-only trail" },
];

/* ────────────────────────────────────────────────────────────────────────────
 * Command palette
 * ────────────────────────────────────────────────────────────────────────── */

type Command = { id: string; label: string; hint: string; run: () => void };

/**
 * Cmd-K navigation.
 *
 * A convenience and never the only route to anything: every command here is
 * also a visible control somewhere. A palette that hides a capability is a
 * capability most people will never find.
 */
export function CommandPalette({
  onNavigate,
  extra = [],
}: {
  onNavigate: (id: string) => void;
  extra?: Command[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Clearing the query when the palette opens is a state adjustment, not a
  // synchronisation with anything outside React, so it happens during render
  // rather than in an effect — React's documented pattern for state derived
  // from a prop change. Doing it in an effect renders the stale query for a
  // frame and costs a second render pass.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setQuery("");
      setCursor(0);
    }
  }

  // Focus IS an external system, so it stays in an effect. The frame delay
  // lets the dialog mount before focus moves, which otherwise lands on nothing
  // and leaves the palette needing a click.
  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  const commands = useMemo<Command[]>(
    () => [
      ...SECTIONS.map((section) => ({
        id: section.id,
        label: section.label,
        hint: section.blurb,
        run: () => onNavigate(section.id),
      })),
      ...extra,
    ],
    [onNavigate, extra],
  );

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return commands;
    return commands.filter((command) =>
      `${command.label} ${command.hint}`.toLowerCase().includes(needle),
    );
  }, [commands, query]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/20 p-4 pt-[12vh]"
      onMouseDown={() => setOpen(false)}
    >
      <div
        className="rise w-full max-w-lg overflow-hidden rounded-xl border border-border bg-elevated shadow-pop"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Icon name="search" className="size-4 text-ink-3" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setCursor(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setCursor((value) => Math.min(value + 1, matches.length - 1));
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setCursor((value) => Math.max(value - 1, 0));
              }
              if (event.key === "Enter" && matches[cursor]) {
                matches[cursor].run();
                setOpen(false);
              }
            }}
            placeholder="Go to…"
            className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-ink-3"
          />
        </div>
        <ul className="max-h-72 overflow-y-auto py-1">
          {matches.length === 0 && (
            <li className="px-3 py-6 text-center text-xs text-ink-3">Nothing matches.</li>
          )}
          {matches.map((command, index) => (
            <li key={command.id}>
              <button
                type="button"
                onMouseEnter={() => setCursor(index)}
                onClick={() => {
                  command.run();
                  setOpen(false);
                }}
                className={`flex w-full items-baseline gap-2 px-3 py-2 text-left text-[13px] ${
                  index === cursor ? "bg-sunken" : ""
                }`}
              >
                <span className="font-medium">{command.label}</span>
                <span className="truncate text-xs text-ink-3">{command.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * The shell
 * ────────────────────────────────────────────────────────────────────────── */

export function Shell({
  active,
  onNavigate,
  counts = {},
  status,
  children,
}: {
  active: string;
  onNavigate: (id: string) => void;
  counts?: Record<string, number | undefined>;
  status?: React.ReactNode;
  children: React.ReactNode;
}) {
  const navigate = useCallback((id: string) => onNavigate(id), [onNavigate]);
  const current = SECTIONS.find((section) => section.id === active);

  return (
    <div className="flex min-h-screen">
      <CommandPalette onNavigate={navigate} />

      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-surface md:flex">
        <div className="flex items-center gap-2.5 px-4 py-4">
          <Image src="/logo.png" alt="" width={26} height={26} className="logo" priority />
          <div className="leading-tight">
            <div className="text-[13px] font-semibold">Contract Assistant</div>
            <div className="text-[11px] text-ink-3">DO-08</div>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 px-2">
          {SECTIONS.map((section) => {
            const count = section.countKey ? counts[section.countKey] : undefined;
            const isActive = section.id === active;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => navigate(section.id)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors ${
                  isActive ? "bg-sunken font-medium text-ink" : "text-ink-2 hover:bg-sunken"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon
                  name={section.icon}
                  className={`size-4 shrink-0 ${isActive ? "text-brand" : "text-ink-3"}`}
                />
                <span className="flex-1 truncate">{section.label}</span>
                {count !== undefined && count > 0 && (
                  <span
                    className={`tnum rounded px-1.5 py-0.5 text-[11px] font-medium ${
                      section.alerting
                        ? "bg-crit-bg text-crit-ink ring-1 ring-inset ring-crit-line"
                        : "bg-neutral-bg text-neutral-ink"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="space-y-2 px-4 py-3 text-[11px] text-ink-3">
          {status}
          <div className="flex items-center gap-1">
            <Icon name="command" className="size-3" />
            <span>K to jump</span>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* The mobile rail collapses to a scrolling strip rather than a menu:
            the sign-off count has to stay on screen, and a hamburger hides it. */}
        <nav className="flex gap-1 overflow-x-auto border-b border-border bg-surface px-2 py-2 md:hidden">
          {SECTIONS.map((section) => {
            const count = section.countKey ? counts[section.countKey] : undefined;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => navigate(section.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] ${
                  section.id === active ? "bg-sunken font-medium" : "text-ink-2"
                }`}
              >
                {section.label}
                {count !== undefined && count > 0 && (
                  <span
                    className={`tnum rounded px-1 text-[10.5px] ${
                      section.alerting ? "bg-crit-bg text-crit-ink" : "bg-neutral-bg text-neutral-ink"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <header className="border-b border-border bg-surface px-5 py-4 md:px-8">
          <h1 className="text-[19px] font-semibold">{current?.label ?? "Overview"}</h1>
          <p className="mt-0.5 text-[12.5px] text-ink-3">{current?.blurb}</p>
        </header>

        <main className="px-5 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
