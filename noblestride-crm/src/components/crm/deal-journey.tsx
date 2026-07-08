// deal-journey.tsx — compact horizontal step spine rendering the 17-step
// deal journey derived by src/server/domain/journey.ts (Task 15). Purely
// presentational server component: no hooks, no "use client" — takes the
// already-computed JourneyStep[] (see journeyForMandate in
// src/server/services/journey.ts) and renders it.

import { cn } from "@/lib/cn";
import type { JourneyStep } from "@/server/domain/journey";

interface DealJourneyProps {
  steps: JourneyStep[] | null | undefined;
}

const DOT_BASE =
  "flex h-3 w-3 shrink-0 rounded-full border-2 transition-colors";

function dotClasses(state: JourneyStep["state"]): string {
  switch (state) {
    case "done":
      return cn(DOT_BASE, "border-emerald-500 bg-emerald-500");
    case "current":
      return cn(
        DOT_BASE,
        "border-accent bg-[var(--bg-primary)] ring-2 ring-accent ring-offset-2 ring-offset-[var(--bg-primary)]"
      );
    case "manual":
      return cn(DOT_BASE, "border-dashed border-[var(--border-subtle)] bg-transparent");
    case "pending":
    default:
      return cn(DOT_BASE, "border-[var(--border-subtle)] bg-[var(--bg-secondary)]");
  }
}

function labelClasses(state: JourneyStep["state"]): string {
  return cn(
    "mt-1.5 max-w-[6.5rem] text-center text-[11px] leading-tight",
    state === "current"
      ? "font-semibold text-[var(--text-primary)]"
      : state === "done"
        ? "text-[var(--text-secondary)]"
        : "text-[var(--text-tertiary)]"
  );
}

/**
 * DealJourney — compact horizontal spine, wraps on small screens.
 * done = emerald dot + connecting line; current = accent ring; pending =
 * neutral dot; manual (step 17) = dashed border. Step title sits under each
 * dot. Step 1's `evidence` (source of the mandate) is rendered as a
 * `title=` tooltip on a link to `evidence.href`.
 */
export function DealJourney({ steps }: DealJourneyProps) {
  if (!steps || steps.length === 0) return null;

  return (
    <ol className="flex flex-wrap items-start gap-y-4" aria-label="Deal journey">
      {steps.map((step, i) => {
        const prevDone = i > 0 && steps[i - 1].state === "done";
        const dot = <span className={dotClasses(step.state)} aria-hidden="true" />;
        const label = <span className={labelClasses(step.state)}>{step.title}</span>;

        const stepBody =
          step.index === 1 && step.evidence ? (
            <a
              href={step.evidence.href}
              title={step.evidence.label}
              className="flex flex-col items-center hover:opacity-80 transition-opacity"
            >
              {dot}
              {label}
            </a>
          ) : (
            <div className="flex flex-col items-center">
              {dot}
              {label}
            </div>
          );

        return (
          <li key={step.index} className="flex items-center">
            {i > 0 && (
              <div
                className={cn(
                  "h-0.5 w-6 shrink-0 sm:w-9",
                  prevDone ? "bg-emerald-500" : "bg-[var(--border-subtle)]"
                )}
                aria-hidden="true"
              />
            )}
            <div className="flex flex-col items-center px-1">{stepBody}</div>
          </li>
        );
      })}
    </ol>
  );
}
