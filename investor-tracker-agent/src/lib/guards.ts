/**
 * Excluded-investor guard (spec §8.3 "Never": share a deal with an excluded
 * investor). Excluded/Greylisted engagements may only be wound DOWN — recording
 * a decline or a fell-off/dropped disbursement — never advanced or enriched.
 */

export type EngagementClassification = "Active" | "Inactive" | "OnHold" | "Excluded" | "Greylisted";

export const BLOCKED_CLASSIFICATIONS: ReadonlySet<EngagementClassification> = new Set([
  "Excluded",
  "Greylisted",
]);

export interface GuardedChange {
  engagementStage?: string;
  disbursementStatus?: string;
  [key: string]: unknown;
}

const WIND_DOWN_STAGES = new Set(["Declined"]);
const WIND_DOWN_DISBURSEMENTS = new Set(["FellOff", "Dropped"]);

export type GuardVerdict = { allowed: true } | { allowed: false; message: string };

export function checkExcludedGuard(
  investor: { name: string; engagementClassification?: string | null },
  change?: GuardedChange,
): GuardVerdict {
  const classification = investor.engagementClassification as EngagementClassification | null | undefined;
  if (!classification || !BLOCKED_CLASSIFICATIONS.has(classification)) return { allowed: true };

  // Winding down is allowed: a pure Declined / FellOff / Dropped change.
  if (change) {
    const keys = Object.keys(change).filter((k) => change[k] !== undefined);
    const isWindDown =
      keys.length > 0 &&
      keys.every(
        (k) =>
          (k === "engagementStage" && WIND_DOWN_STAGES.has(String(change.engagementStage))) ||
          (k === "disbursementStatus" && WIND_DOWN_DISBURSEMENTS.has(String(change.disbursementStatus))),
      );
    if (isWindDown) return { allowed: true };
  }

  return {
    allowed: false,
    message:
      `${investor.name} is classified ${classification} — this engagement cannot be advanced or updated. ` +
      `Only recording a decline or a fell-off/dropped disbursement is permitted. ` +
      `Ask an admin to review the investor's classification if this seems wrong.`,
  };
}
