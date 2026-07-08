import { cn } from "@/lib/cn";
import { label as vocabLabel, STATUS_DOT, STAGE_HELP } from "@/lib/vocab";

interface ChipProps {
  value: string;
  group: string;
  /** "category" — colored pill; "status" — dot + label. Defaults to "category". */
  tone?: "category" | "status";
  className?: string;
  /**
   * Tooltip override. When omitted and `group` is one of the stage enums
   * (MandateStage / TransactionStage / EngagementStage), a STAGE_HELP
   * one-liner is looked up automatically — call sites that render stage
   * chips don't need to thread anything through.
   */
  title?: string;
}

const STAGE_GROUPS = new Set(["MandateStage", "TransactionStage", "EngagementStage"]);

function resolveTitle(group: string, value: string, explicit?: string): string | undefined {
  if (explicit) return explicit;
  if (STAGE_GROUPS.has(group)) return STAGE_HELP[group as keyof typeof STAGE_HELP]?.[value];
  return undefined;
}

// Restrained category styling — no rainbow. The entity *type* (InvestorType /
// PartnerType) carries a quiet brand tint so it reads as the primary qualifier;
// everything else (sectors, geographies, instruments) is a calm neutral pill.
const CATEGORY_BRAND = "bg-[var(--t-tag-bg-emerald)] text-[var(--t-tag-text-emerald)]";
const CATEGORY_NEUTRAL = "bg-[var(--t-tag-bg-gray)] text-[var(--t-tag-text-gray)]";

function categoryClasses(group: string): string {
  return group === "InvestorType" || group === "PartnerType" ? CATEGORY_BRAND : CATEGORY_NEUTRAL;
}

/**
 * Chip — displays a human label for a vocabulary value with deterministic styling.
 *
 * - tone="category" (default): a restrained pill — brand-tinted for the entity
 *   type, neutral for sectors / geographies / instruments.
 * - tone="status": status dot + label — for InvestorStatus, EngagementStatus, etc.
 *
 * Chips never wrap mid-phrase ("Sub-Saharan Africa" stays on one line).
 */
export function Chip({ value, group, tone, className, title }: ChipProps) {
  const resolvedTone = tone ?? (group.endsWith("Status") || group.endsWith("Stage") ? "status" : "category");
  const humanLabel = vocabLabel(group, value) || value;
  const resolvedTitle = resolveTitle(group, value, title);

  if (resolvedTone === "status") {
    const dotClass = STATUS_DOT[value] ?? "bg-zinc-400";
    return (
      <span
        title={resolvedTitle}
        className={cn(
          "inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-[var(--text-secondary)]",
          className
        )}
      >
        <span className={cn("h-2 w-2 rounded-full flex-shrink-0", dotClass)} />
        {humanLabel}
      </span>
    );
  }

  return (
    <span
      title={resolvedTitle}
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium",
        categoryClasses(group),
        className
      )}
    >
      {humanLabel}
    </span>
  );
}
