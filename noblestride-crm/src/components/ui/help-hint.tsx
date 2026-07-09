"use client";

// help-hint.tsx — Wave 1 teaching layer: a small "?" affordance that pops a
// plain-language definition. Outside-click-to-close follows the
// columns-popover pattern in deals-view-controls.tsx (a fixed full-screen
// overlay behind the popover that closes it on click, rather than a
// document-level event listener).

import { useState } from "react";
import { cn } from "@/lib/cn";
import { define } from "@/lib/glossary";

type HelpHintProps =
  | { term: string; text?: never; className?: string }
  | { text: string; term?: never; className?: string };

export function HelpHint(props: HelpHintProps) {
  const [open, setOpen] = useState(false);
  const definition = "term" in props && props.term ? define(props.term) : props.text;
  const label = "term" in props && props.term ? props.term : undefined;

  if (!definition) return null;

  return (
    <span className={cn("relative inline-flex", props.className)}>
      <button
        type="button"
        aria-label="What is this?"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] text-[10px] font-semibold leading-none text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-secondary)] hover:text-[var(--text-secondary)]"
      >
        ?
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-2 w-64 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3 shadow-lg">
            {label && (
              <p className="mb-1 text-xs font-semibold text-[var(--text-primary)]">{label}</p>
            )}
            <p className="text-xs leading-relaxed text-[var(--text-secondary)]">{definition}</p>
          </div>
        </>
      )}
    </span>
  );
}
