"use client";

// popover.tsx — click-to-open panel anchored to a trigger button. Extracted
// from the Columns chooser in deals-view-controls.tsx (Aug-2026 feedback
// F4.1.4: the deals filter bar collapses its secondary filters behind
// "More filters", and the view controls tuck saved views away the same way).
//
// Deliberately minimal: a full-screen click-catcher closes it (same trick the
// Columns chooser used), Escape closes it, and the panel opens leftward or
// rightward depending on `align` — a right-aligned panel next to the sidebar
// would extend under it and swallow clicks.

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

export interface PopoverProps {
  /** Trigger button label. */
  label: React.ReactNode;
  children: React.ReactNode;
  /** Which edge the panel is pinned to. Default "left" (opens rightward). */
  align?: "left" | "right";
  /** Extra classes for the panel (width, max-height, padding). */
  panelClassName?: string;
  /** Rendered on the trigger, e.g. an active-filter count. */
  badge?: number;
  "data-testid"?: string;
}

const TRIGGER =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-[var(--border-subtle)] " +
  "bg-[var(--bg-primary)] px-3 text-xs font-medium text-[var(--text-primary)] transition-colors " +
  "hover:bg-[var(--bg-secondary)] active:bg-[var(--bg-tertiary)]";

export function Popover({ label, children, align = "left", panelClassName, badge, ...rest }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className={TRIGGER}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
        data-testid={rest["data-testid"]}
      >
        {label}
        {badge ? (
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold leading-none text-white">
            {badge}
          </span>
        ) : null}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            role="dialog"
            className={cn(
              "absolute top-full z-50 mt-2 max-h-[32rem] overflow-y-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3 shadow-lg",
              align === "right" ? "right-0" : "left-0",
              panelClassName ?? "w-72",
            )}
          >
            {children}
          </div>
        </>
      )}
    </div>
  );
}
