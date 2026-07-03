// engagement-stage-board.tsx — 12-stage engagement pipeline board.
// Presentational; server-compatible (no "use client") — the only client island
// is the EngagementRestageSelect on each card. Columns scroll horizontally
// (overflow-x-auto), mirroring kanban-board.tsx styling without DnD: with 12
// stages a per-card restage select beats dragging across a wide board.

import Link from "next/link";
import { Chip, Badge } from "@/components/ui";
import type { SelectOption } from "@/components/ui";
import { label } from "@/lib/vocab";
import { EngagementRestageSelect } from "./engagement-restage-select";

// ─── DTOs (plain values only — no Prisma types cross the RSC boundary) ───────

export interface EngagementCardDTO {
  id: string;
  transactionId: string;
  investorId: string;
  investorName: string;
  transactionName: string;
  interestLevel: string | null;
  ndaType: string | null;
  termSheetIssued: boolean;
  probability: number | null;
  /** §7.2 lens: computed server-side via canUpdateRecord (own-scope aware). */
  canRestage: boolean;
}

export interface EngagementStageColumnDTO {
  stage: string;
  label: string;
  items: EngagementCardDTO[];
}

// ─── Column header accents (same palette rhythm as kanban-board.tsx) ─────────

const COLUMN_HEADER_COLORS = [
  "border-l-slate-400",
  "border-l-sky-400",
  "border-l-sky-500",
  "border-l-violet-400",
  "border-l-violet-500",
  "border-l-amber-400",
  "border-l-amber-500",
  "border-l-orange-500",
  "border-l-emerald-400",
  "border-l-emerald-500",
  "border-l-emerald-600",
  "border-l-rose-500",
];

// ─── Card ─────────────────────────────────────────────────────────────────────

function EngagementStageCard({
  card,
  stage,
  stageOptions,
}: {
  card: EngagementCardDTO;
  stage: string;
  stageOptions: SelectOption[];
}) {
  return (
    <div className="bg-white rounded-lg border border-zinc-200 shadow-sm p-3 space-y-2">
      {/* Investor × transaction */}
      <div className="min-w-0">
        <Link
          href={`/investors/${card.investorId}`}
          className="block text-sm font-semibold text-zinc-900 hover:text-accent transition-colors leading-snug truncate"
          title={card.investorName}
        >
          {card.investorName}
        </Link>
        <Link
          href={`/transactions/${card.transactionId}`}
          className="block text-xs text-zinc-500 hover:text-accent transition-colors mt-0.5 truncate"
          title={card.transactionName}
        >
          {card.transactionName}
        </Link>
      </div>

      {/* Interest / NDA / term-sheet / probability */}
      <div className="flex flex-wrap items-center gap-1.5">
        {card.interestLevel && (
          <Chip value={card.interestLevel} group="InterestLevel" />
        )}
        {card.ndaType && (
          <Badge tone="info">NDA {label("NdaType", card.ndaType)}</Badge>
        )}
        {card.termSheetIssued && <Badge tone="success">Term Sheet</Badge>}
        {card.probability != null && (
          <span className="ml-auto text-xs font-semibold text-zinc-600">
            {card.probability}%
          </span>
        )}
      </div>

      {/* Restage control — hidden when the active org-role lens can't update this row */}
      {card.canRestage ? (
        <EngagementRestageSelect
          id={card.id}
          transactionId={card.transactionId}
          investorId={card.investorId}
          currentStage={stage}
          stageOptions={stageOptions}
        />
      ) : (
        <p className="text-[11px] text-zinc-400">Read-only in current view</p>
      )}
    </div>
  );
}

// ─── Board ────────────────────────────────────────────────────────────────────

export function EngagementStageBoard({
  columns,
  stageOptions,
}: {
  columns: EngagementStageColumnDTO[];
  stageOptions: SelectOption[];
}) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {columns.map((col, colIdx) => (
        <div key={col.stage} className="flex-shrink-0 w-60 flex flex-col">
          {/* Column header */}
          <div
            className={`mb-3 px-3 py-2 rounded-md bg-white border border-zinc-200 border-l-4 shadow-sm ${
              COLUMN_HEADER_COLORS[colIdx % COLUMN_HEADER_COLORS.length]
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-700 uppercase tracking-wide whitespace-nowrap">
                {col.label}
              </span>
              <span className="text-xs font-bold text-zinc-500 bg-zinc-100 rounded-full px-2 py-0.5">
                {col.items.length}
              </span>
            </div>
          </div>

          {/* Cards */}
          <div className="flex-1 flex flex-col gap-2.5 rounded-lg p-2 min-h-[120px] bg-zinc-100/60">
            {col.items.map((card) => (
              <EngagementStageCard
                key={card.id}
                card={card}
                stage={col.stage}
                stageOptions={stageOptions}
              />
            ))}
            {col.items.length === 0 && (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-xs text-zinc-400 text-center py-4">No engagements</p>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
