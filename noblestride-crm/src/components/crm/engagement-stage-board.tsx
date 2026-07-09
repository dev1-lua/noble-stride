// engagement-stage-board.tsx — 12-stage engagement pipeline board.
// Presentational; server-compatible (no "use client") — the only client island
// is the EngagementRestageSelect on each card. Columns scroll horizontally
// (overflow-x-auto), mirroring kanban-board.tsx styling without DnD: with 12
// stages a per-card restage select beats dragging across a wide board.

import Link from "next/link";
import { Chip, Badge } from "@/components/ui";
import type { SelectOption } from "@/components/ui";
import { label, STAGE_HELP } from "@/lib/vocab";
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
    <div className="bg-[var(--bg-primary)] rounded-md border border-[var(--border-subtle)] p-3 space-y-2">
      {/* Investor × transaction */}
      <div className="min-w-0">
        <Link
          href={`/investors/${card.investorId}`}
          className="block text-sm font-semibold text-[var(--text-primary)] hover:text-accent transition-colors leading-snug truncate"
          title={card.investorName}
        >
          {card.investorName}
        </Link>
        <Link
          href={`/transactions/${card.transactionId}`}
          className="block text-xs text-[var(--text-tertiary)] hover:text-accent transition-colors mt-0.5 truncate"
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
          <span className="ml-auto text-xs font-semibold text-[var(--text-secondary)]">
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
        <p className="text-[11px] text-[var(--text-tertiary)]">Read-only in current view</p>
      )}

      {/* Detail page: NDA recording, milestones, timeline */}
      <Link
        href={`/engagement/${card.id}`}
        className="block text-xs font-medium text-accent hover:underline"
      >
        Open engagement →
      </Link>
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
            title={STAGE_HELP.EngagementStage[col.stage]}
            className={`mb-2 px-2.5 py-1.5 rounded-md bg-[var(--bg-primary)] border border-[var(--border-subtle)] border-l-4 ${
              COLUMN_HEADER_COLORS[colIdx % COLUMN_HEADER_COLORS.length]
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide whitespace-nowrap">
                {col.label}
              </span>
              <span className="text-xs font-bold text-[var(--t-tag-text-gray)] bg-[var(--t-tag-bg-gray)] rounded-full px-2 py-0.5">
                {col.items.length}
              </span>
            </div>
          </div>

          {/* Cards */}
          <div className="flex-1 flex flex-col gap-2 rounded-md p-1.5 min-h-[120px] border border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
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
                <p className="text-xs text-[var(--text-tertiary)] text-center py-4">No engagements yet</p>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
