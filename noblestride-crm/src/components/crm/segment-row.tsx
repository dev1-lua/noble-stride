// segment-row.tsx — Six investor segment counter tiles.
// Presentational; server-compatible (no "use client").

import { formatCompact } from "@/lib/format";
import type { InvestorSegments } from "@/server/domain/types";

interface SegmentRowProps {
  segments: InvestorSegments;
}

interface TileProps {
  label: string;
  value: number;
}

function Tile({ label, value }: TileProps) {
  return (
    <div className="flex-1 min-w-0 rounded-lg bg-white border border-zinc-200 shadow-sm px-5 py-4">
      <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide truncate">{label}</p>
      <p className="mt-2 text-2xl font-bold text-zinc-900 leading-none">{formatCompact(value)}</p>
    </div>
  );
}

/**
 * SegmentRow — 6 stat tiles showing investor segment counts.
 * Expects an InvestorSegments object (all counts pre-fetched server-side).
 */
export function SegmentRow({ segments }: SegmentRowProps) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      <Tile label="Total Investors" value={segments.total} />
      <Tile label="Active This Quarter" value={segments.activeThisQuarter} />
      <Tile label="Private Equity" value={segments.privateEquity} />
      <Tile label="Venture Capital" value={segments.ventureCapital} />
      <Tile label="DFIs" value={segments.dfi} />
      <Tile label="Debt Providers" value={segments.debtProvider} />
    </div>
  );
}
