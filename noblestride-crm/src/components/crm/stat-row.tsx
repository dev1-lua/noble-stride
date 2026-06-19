// stat-row.tsx — A row of 4 stat tiles (presentational, server-safe).
// Wraps StatCard in a responsive 4-column grid.

import { StatCard } from "@/components/ui";

export interface StatTile {
  label: string;
  value: string;
  sub?: string;
}

interface StatRowProps {
  tiles: [StatTile, StatTile, StatTile, StatTile];
}

/**
 * StatRow — renders 4 StatCard tiles side-by-side.
 * Presentational only: caller pre-formats all values on the server.
 * No interaction, no client boundary needed.
 */
export function StatRow({ tiles }: StatRowProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {tiles.map((tile) => (
        <StatCard key={tile.label} label={tile.label} value={tile.value} sub={tile.sub} />
      ))}
    </div>
  );
}
