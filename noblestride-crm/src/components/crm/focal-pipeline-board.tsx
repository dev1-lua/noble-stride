"use client";

// focal-pipeline-board.tsx — grouped engagement board used by both the
// By-Deal and By-Investor views. Each group is a native <details> row: the
// summary shows the focal name, a count, a stacked stage-distribution bar and
// stage pills; expanding reveals the individual engagements.
//
// Marked "use client": the inner name Link stops propagation on click so it
// doesn't also toggle the parent <details> disclosure, and a Server Component
// cannot attach an event handler to an element it renders directly.
// The per-row EngagementRestageSelect is the second client-island reason.
import Link from "next/link";
import { Chip } from "@/components/ui";
import type { SelectOption } from "@/components/ui";
import { stageBarColor } from "@/lib/engagement-stage-colors";
import { EngagementRestageSelect } from "./engagement-restage-select";

export interface FocalGroupItemDTO {
  id: string;
  transactionId: string;
  investorId: string;
  counterpartName: string;
  counterpartHref: string;
  stage: string;
  interestLevel: string | null;
  /** §7.2 lens: computed server-side via canUpdateRecord (own-scope aware). */
  canRestage: boolean;
}
export interface FocalGroupDTO {
  id: string;
  name: string;
  href: string;
  countLabel: string;
  stageCounts: { stage: string; label: string; count: number }[];
  items: FocalGroupItemDTO[];
}

function StageBar({ stageCounts, total }: { stageCounts: FocalGroupDTO["stageCounts"]; total: number }) {
  if (total === 0) return null;
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-zinc-100">
      {stageCounts.map((s) => (
        <div
          key={s.stage}
          className={stageBarColor(s.stage)}
          style={{ width: `${(s.count / total) * 100}%` }}
          title={`${s.label}: ${s.count}`}
        />
      ))}
    </div>
  );
}

export function FocalPipelineBoard({ groups, stageOptions }: { groups: FocalGroupDTO[]; stageOptions: SelectOption[] }) {
  if (groups.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200/80 bg-white px-5 py-12 text-center text-zinc-500 shadow-sm">
        No engagements recorded yet.
      </div>
    );
  }
  return (
    <div className="space-y-2.5">
      {groups.map((g) => {
        const total = g.items.length;
        return (
          <details key={g.id} className="group rounded-xl border border-zinc-200/80 bg-white shadow-sm">
            <summary className="flex cursor-pointer list-none items-center gap-4 px-4 py-3 [&::-webkit-details-marker]:hidden">
              <span className="w-4 shrink-0 text-zinc-400 transition-transform group-open:rotate-90">▸</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <Link
                    href={g.href}
                    className="min-w-0 truncate text-sm font-semibold text-zinc-900 hover:text-accent"
                    title={g.name}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {g.name}
                  </Link>
                  <span className="shrink-0 text-xs font-medium text-zinc-500">{g.countLabel}</span>
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <StageBar stageCounts={g.stageCounts} total={total} />
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {g.stageCounts.map((s) => (
                    <span key={s.stage} className="inline-flex items-center gap-1.5 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-600">
                      <span className={`h-2 w-2 rounded-full ${stageBarColor(s.stage)}`} />
                      {s.label}·{s.count}
                    </span>
                  ))}
                </div>
              </div>
            </summary>

            <ul className="divide-y divide-zinc-100 border-t border-zinc-100">
              {g.items.map((it) => (
                <li key={it.id} className="flex items-center justify-between gap-3 px-4 py-2.5 pl-12">
                  <Link href={it.counterpartHref} className="min-w-0 truncate text-sm text-zinc-800 hover:text-accent" title={it.counterpartName}>
                    {it.counterpartName}
                  </Link>
                  <div className="flex shrink-0 items-center gap-2">
                    {it.interestLevel && <Chip value={it.interestLevel} group="InterestLevel" />}
                    {it.canRestage ? (
                      <div className="w-40">
                        <EngagementRestageSelect
                          id={it.id}
                          transactionId={it.transactionId}
                          investorId={it.investorId}
                          currentStage={it.stage}
                          stageOptions={stageOptions}
                        />
                      </div>
                    ) : (
                      <Chip value={it.stage} group="EngagementStage" />
                    )}
                    <Link href={`/engagement/${it.id}`} className="text-xs font-medium text-accent hover:underline">
                      Open →
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </details>
        );
      })}
    </div>
  );
}
