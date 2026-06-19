import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/cn";

interface StatCardProps {
  /** Short label above the value, e.g. "Active Investors" */
  label: string;
  /** Pre-formatted big value string, e.g. "$4.2B" or "127" */
  value: string;
  /** Pre-formatted positive delta string, e.g. "+12%" — rendered as green chip with up-arrow */
  delta?: string;
  /** Optional leading icon (lucide React element or any ReactNode) */
  icon?: React.ReactNode;
  /** Optional sub-line below the value, e.g. "vs last quarter" */
  sub?: string;
  className?: string;
}

/**
 * StatCard — metric tile for the dashboard.
 * Presentational: caller formats value, delta, sub via lib helpers.
 * Renders label (muted), big value, optional green delta chip (+arrow), optional icon, optional sub.
 */
export function StatCard({ label, value, delta, icon, sub, className }: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg bg-white border border-zinc-200 shadow-sm p-5 flex flex-col gap-3",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide">{label}</span>
        {icon && (
          <span className="flex items-center justify-center h-8 w-8 rounded-md bg-emerald-50 text-emerald-600">
            {icon}
          </span>
        )}
      </div>

      <div className="flex items-end gap-3">
        <span className="text-2xl font-bold text-zinc-900 leading-none">{value}</span>
        {delta && (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 mb-0.5">
            <ArrowUpRight className="h-3 w-3" />
            {delta}
          </span>
        )}
      </div>

      {sub && <p className="text-xs text-zinc-400">{sub}</p>}
    </div>
  );
}
