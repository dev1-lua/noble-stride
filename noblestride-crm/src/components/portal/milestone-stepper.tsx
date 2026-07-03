// Horizontal mini-stepper: 15 segments over the fixed investor milestone
// cycle. Filled = complete, the next upcoming step is highlighted. Pure
// server-renderable component (no interactivity).
import type { MilestoneKey } from "@prisma/client";
import { MILESTONE_ORDER, MILESTONE_LABELS } from "@/lib/milestones";

export function MilestoneStepper({
  completedKeys,
  muted = false,
}: {
  completedKeys: MilestoneKey[];
  muted?: boolean;
}) {
  const done = new Set(completedKeys);
  const currentIndex = MILESTONE_ORDER.findIndex((k) => !done.has(k));
  return (
    <div className="flex items-center gap-0.5" aria-label="Milestone progress">
      {MILESTONE_ORDER.map((key, i) => {
        const complete = done.has(key);
        const isCurrent = !muted && i === currentIndex;
        const cls = complete
          ? muted
            ? "bg-zinc-300"
            : "bg-emerald-500"
          : isCurrent
            ? "bg-emerald-100 ring-1 ring-inset ring-emerald-500"
            : "bg-zinc-100";
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
