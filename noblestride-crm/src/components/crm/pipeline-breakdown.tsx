// pipeline-breakdown.tsx — simple count bar-lists for the dashboard's Pipeline
// Breakdown cards (spec §13): active transactions by deal lead / sector /
// financing type / ticket-size band. Presentational, server-safe (no
// "use client", no charting library) — plain CSS width bars, same family as
// the Pipeline Overview stacked bars in pipeline-chart.tsx but static.

export interface BreakdownRow {
  key: string;
  label: string;
  count: number;
  /** Drilldown target (e.g. a pre-filtered /deals URL); row renders as a link when set. */
  href?: string;
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
    return <p className="text-xs text-[var(--text-tertiary)]">{emptyText}</p>;
  }

  const max = Math.max(...rows.map((r) => r.count), 1);

  return (
    <ul className="space-y-2">
      {rows.map((r) => {
        const row = (
          <>
            <span className="w-28 shrink-0 truncate text-xs text-[var(--text-secondary)]" title={r.label}>
              {r.label}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
              <div
                className="h-full rounded-full bg-[var(--accent)]"
                style={{ width: `${Math.max((r.count / max) * 100, 4)}%` }}
              />
            </div>
            <span className="w-6 shrink-0 text-right text-xs font-semibold tabular-nums text-[var(--text-primary)]">
              {r.count}
            </span>
          </>
        );
        return (
          <li key={r.key}>
            {r.href ? (
              <a href={r.href} className="flex items-center gap-2.5 -mx-1 rounded px-1 py-0.5 transition-colors hover:bg-[var(--bg-tertiary)]">
                {row}
              </a>
            ) : (
              <span className="flex items-center gap-2.5 px-0 py-0.5">{row}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
