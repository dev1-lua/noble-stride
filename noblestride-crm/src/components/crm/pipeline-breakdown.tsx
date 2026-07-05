// pipeline-breakdown.tsx — simple count bar-lists for the dashboard's Pipeline
// Breakdown cards (spec §13): active transactions by deal lead / sector /
// financing type / ticket-size band. Presentational, server-safe (no
// "use client", no charting library) — plain CSS width bars, same family as
// the Pipeline Overview stacked bars in pipeline-chart.tsx but static.

export interface BreakdownRow {
  key: string;
  label: string;
  count: number;
}

/**
 * BreakdownBarList — label · proportional bar · count, one row per entry.
 * Caller pre-sorts/pre-limits rows; this component is purely presentational.
 */
export function BreakdownBarList({
  rows,
  emptyText = "No data yet.",
}: {
  rows: BreakdownRow[];
  emptyText?: string;
}) {
  if (rows.length === 0) {
    return <p className="text-xs text-zinc-400">{emptyText}</p>;
  }

  const max = Math.max(...rows.map((r) => r.count), 1);

  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.key} className="flex items-center gap-2.5">
          <span className="w-28 shrink-0 truncate text-xs text-zinc-600" title={r.label}>
            {r.label}
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100">
            <div
              className="h-full rounded-full bg-teal-500"
              style={{ width: `${Math.max((r.count / max) * 100, 4)}%` }}
            />
          </div>
          <span className="w-6 shrink-0 text-right text-xs font-semibold tabular-nums text-zinc-900">
            {r.count}
          </span>
        </li>
      ))}
    </ul>
  );
}
