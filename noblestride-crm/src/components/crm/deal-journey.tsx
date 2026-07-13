// deal-journey.tsx — numbered-grid rendering of the 17-step deal journey
// derived by src/server/domain/journey.ts (Task 15). Purely presentational
// server component: no hooks, no "use client" — takes the already-computed
// JourneyStep[] (see journeyForMandate in src/server/services/journey.ts)
// and renders it as a progress summary + legend + numbered step grid (no
// connector lines, so nothing dangles when the grid wraps).

import { cn } from "@/lib/cn";
import type { JourneyStep } from "@/server/domain/journey";
import { JOURNEY_STEP_HELP } from "@/lib/glossary";

interface DealJourneyProps {
  steps: JourneyStep[] | null | undefined;
}

const CELL_BASE =
  "flex h-full items-start gap-2 rounded-lg border px-2.5 py-2 transition-colors";

function cellClasses(state: JourneyStep["state"]): string {
  switch (state) {
    case "done":
      return cn(CELL_BASE, "border-emerald-500/40 bg-emerald-500/[0.06]");
    case "current":
      return cn(CELL_BASE, "border-accent bg-[var(--bg-primary)] ring-1 ring-accent");
    case "manual":
      return cn(CELL_BASE, "border-dashed border-[var(--border-subtle)] bg-transparent");
    case "pending":
    default:
      return cn(CELL_BASE, "border-[var(--border-subtle)] bg-[var(--bg-secondary)]");
  }
}

const BADGE_BASE =
  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums";

function badgeClasses(state: JourneyStep["state"]): string {
  switch (state) {
    case "done":
      return cn(BADGE_BASE, "bg-emerald-500 text-white");
    case "current":
      return cn(BADGE_BASE, "bg-accent text-white");
    case "manual":
      return cn(
        BADGE_BASE,
        "border border-dashed border-[var(--border-subtle)] bg-transparent text-[var(--text-tertiary)]"
      );
    case "pending":
    default:
      return cn(
        BADGE_BASE,
        "border border-[var(--border-subtle)] bg-transparent text-[var(--text-tertiary)]"
      );
  }
}

function titleClasses(state: JourneyStep["state"]): string {
  return cn(
    "text-[11px] leading-tight",
    state === "current"
      ? "font-semibold text-[var(--text-primary)]"
      : state === "done"
        ? "text-[var(--text-secondary)]"
        : "text-[var(--text-tertiary)]"
  );
}

function srStateLabel(state: JourneyStep["state"]): string {
  switch (state) {
    case "done":
      return " (done)";
    case "current":
      return " (current step)";
    case "manual":
      return " (manual)";
    case "pending":
    default:
      return " (upcoming)";
  }
}

/**
 * DealJourney — numbered step grid for the 17-stage deal lifecycle.
 * A progress bar + legend orient a first-time viewer; each step cell is
 * colored by state (done / current / pending / manual) and numbered so
 * order is conveyed without connector lines (which would dangle when the
 * grid wraps). Step 1's `evidence` (source of the mandate) is rendered as a
 * link + sub-line on that cell; every cell's `title=` tooltip pulls from
 * JOURNEY_STEP_HELP.
 */
export function DealJourney({ steps }: DealJourneyProps) {
  if (!steps || steps.length === 0) return null;

  const completable = steps.filter((s) => s.state !== "manual").length;
  const done = steps.filter((s) => s.state === "done").length;
  const current = steps.find((s) => s.state === "current");
  const pct = completable > 0 ? Math.round((done / completable) * 100) : 0;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs leading-relaxed text-[var(--text-tertiary)]">
        The 17 stages a deal moves through, from first contact to post-close. Each
        stage is marked complete from real records, so a later stage can finish
        before an earlier one.
      </p>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-[var(--text-primary)]">
            {done} of {completable} stages complete
          </span>
          <span className="truncate text-[var(--text-tertiary)]">
            {current ? `Currently: ${current.title}` : "All stages complete"}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
          <div
            className="h-full rounded-full bg-emerald-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[var(--text-tertiary)]">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
          Done
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full border border-accent bg-accent" aria-hidden="true" />
          Current
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full border border-[var(--border-subtle)]"
            aria-hidden="true"
          />
          Upcoming
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full border border-dashed border-[var(--border-subtle)]"
            aria-hidden="true"
          />
          Manual
        </span>
      </div>

      <ol
        aria-label="Deal journey steps"
        className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4"
      >
        {steps.map((step) => {
          const help = JOURNEY_STEP_HELP[step.index - 1]?.description;
          const isCurrent = step.state === "current";

          const header = (
            <div className="flex min-w-0 flex-1 items-center gap-1">
              <span className={titleClasses(step.state)}>
                {step.title}
                <span className="sr-only">{srStateLabel(step.state)}</span>
              </span>
              {isCurrent && (
                <span className="ml-auto rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                  Now
                </span>
              )}
            </div>
          );

          const body = (
            <div className="flex min-w-0 flex-col">
              {header}
              {step.index === 1 && step.evidence && (
                <span className="mt-0.5 truncate text-[10px] text-accent">
                  {step.evidence.label}
                </span>
              )}
            </div>
          );

          const content =
            step.index === 1 && step.evidence ? (
              <a
                href={step.evidence.href}
                title={help}
                className={cn(cellClasses(step.state), "hover:opacity-80 transition-opacity")}
              >
                <span className={badgeClasses(step.state)} aria-hidden="true">
                  {step.index}
                </span>
                {body}
              </a>
            ) : (
              <div className={cellClasses(step.state)} title={help}>
                <span className={badgeClasses(step.state)} aria-hidden="true">
                  {step.index}
                </span>
                {body}
              </div>
            );

          return (
            <li key={step.index} aria-current={isCurrent ? "step" : undefined}>
              {content}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
