// segment-row.tsx — Six investor segment counter tiles.
// Presentational; server-compatible (no "use client").

import { Users, TrendingUp, Briefcase, Rocket, Landmark, Coins } from "lucide-react";
import { formatCompact } from "@/lib/format";
import type { InvestorSegments } from "@/server/domain/types";

interface SegmentRowProps {
  segments: InvestorSegments;
}

interface TileProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  /** Brand-accent the leading tile so the row has a single anchor. */
  accent?: boolean;
}

function Tile({ label, value, icon, accent }: TileProps) {
  return (
    <div className="flex-1 min-w-[140px] rounded-xl border border-zinc-200/80 bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-shadow hover:shadow-[0_2px_8px_rgba(16,24,40,0.06)]">
      <div className="flex items-start justify-between gap-2">
        <p className="min-h-[26px] text-[11px] font-semibold uppercase leading-tight tracking-wider text-zinc-400">
          {label}
        </p>
        <span
          className={
            accent
              ? "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"
              : "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-zinc-50 text-zinc-400"
          }
        >
          {icon}
        </span>
      </div>
      <p className="mt-2 text-[26px] font-bold leading-none tracking-tight text-zinc-900 tabular-nums">
        {formatCompact(value)}
      </p>
    </div>
  );
}

/**
 * SegmentRow — 6 stat tiles showing investor segment counts.
 * Expects an InvestorSegments object (all counts pre-fetched server-side).
 */
export function SegmentRow({ segments }: SegmentRowProps) {
  const ICON = "h-4 w-4";
  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      <Tile label="Total Investors" value={segments.total} icon={<Users className={ICON} />} accent />
      <Tile label="Active This Quarter" value={segments.activeThisQuarter} icon={<TrendingUp className={ICON} />} />
      <Tile label="Private Equity" value={segments.privateEquity} icon={<Briefcase className={ICON} />} />
      <Tile label="Venture Capital" value={segments.ventureCapital} icon={<Rocket className={ICON} />} />
      <Tile label="DFIs" value={segments.dfi} icon={<Landmark className={ICON} />} />
      <Tile label="Debt Providers" value={segments.debtProvider} icon={<Coins className={ICON} />} />
    </div>
  );
}
