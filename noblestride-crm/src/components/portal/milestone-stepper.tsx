// Horizontal mini-stepper over the investor milestone cycle. Filled =
// complete, the next upcoming step is highlighted. Pure server-renderable
// component (no interactivity).
//
// The key list is a prop (defaulting to the 14 investor-visible milestones, so
// "Success fee paid" is never a segment — F6b.3 / image29) rather than a
// hard-coded import, which is what lets the caller decide what a fund sees.
import type { MilestoneKey } from "@prisma/client";
import { INVESTOR_VISIBLE_MILESTONES, MILESTONE_LABELS } from "@/lib/milestones";

export function MilestoneStepper({
  completedKeys,
  muted = false,
  keys = INVESTOR_VISIBLE_MILESTONES,
}: {
  completedKeys: MilestoneKey[];
  muted?: boolean;
  keys?: MilestoneKey[];
}) {
  const done = new Set(completedKeys);
  const currentIndex = keys.findIndex((k) => !done.has(k));
  return (
    <div className="flex items-center gap-0.5" aria-label="Milestone progress">
      {keys.map((key, i) => {
        const complete = done.has(key);
        const isCurrent = !muted && i === currentIndex;
        const cls = complete
          ? muted
            ? "bg-[var(--border-strong)]"
            : "bg-[var(--accent)]"
          : isCurrent
            ? "bg-[var(--t-tag-bg-emerald)] ring-1 ring-inset ring-[var(--accent)]"
            : "bg-[var(--bg-tertiary)]";
        return (
          <span
            key={key}
            title={MILESTONE_LABELS[key]}
            className={`h-1.5 min-w-0 flex-1 rounded-full ${cls}`}
          />
        );
      })}
    </div>
  );
}
