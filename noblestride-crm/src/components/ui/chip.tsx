import { cn } from "@/lib/cn";
import { label as vocabLabel, chipClasses, STATUS_DOT } from "@/lib/vocab";

interface ChipProps {
  value: string;
  group: string;
  /** "category" — colored pill via chipClasses; "status" — dot + label. Defaults to "category". */
  tone?: "category" | "status";
  className?: string;
}

/**
 * Chip — displays a human label for a vocabulary value with deterministic styling.
 *
 * - tone="category" (default): full colored pill via chipClasses() — for Sector, InvestorType, Geography, etc.
 * - tone="status": status dot + label — for InvestorStatus, EngagementStatus, PartnerStatus.
 *
 * The caller decides the tone; it can also be inferred if group ends in "Status".
 */
export function Chip({ value, group, tone, className }: ChipProps) {
  const resolvedTone = tone ?? (group.endsWith("Status") || group.endsWith("Stage") ? "status" : "category");
  const humanLabel = vocabLabel(group, value) || value;

  if (resolvedTone === "status") {
    const dotClass = STATUS_DOT[value] ?? "bg-zinc-400";
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium text-zinc-700", className)}>
        <span className={cn("h-2 w-2 rounded-full flex-shrink-0", dotClass)} />
        {humanLabel}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        chipClasses(value),
        className
      )}
    >
      {humanLabel}
    </span>
  );
}
