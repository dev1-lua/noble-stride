import { env } from "lua-cli";

/** CRM EngagementStage enum values (prisma schema). */
export type EngagementStage =
  | "Shared"
  | "TeaserSent"
  | "NDASigned"
  | "IMShared"
  | "VDRAccess"
  | "Meeting"
  | "InfoRequest"
  | "DueDiligence"
  | "TermSheet"
  | "Offer"
  | "Invested"
  | "Declined";

/** Reasons are enum-like strings — they key the followup-check dedupe records. */
export type FlagReason = "stalled" | "disbursement_outstanding" | "term_sheet_undated";

/**
 * Days an engagement may sit idle at each stage before it's flagged. Momentum
 * stages (Offer, InfoRequest) chase fast; review-heavy stages get longer rope.
 * Invested is special-cased in evaluate(): only flagged while disbursement is
 * outstanding. Declined is terminal and never flagged.
 */
export const DEFAULT_STALE_DAYS: Record<Exclude<EngagementStage, "Declined">, number> = {
  Shared: 14,
  TeaserSent: 10,
  NDASigned: 14,
  IMShared: 14,
  VDRAccess: 21,
  Meeting: 10,
  InfoRequest: 7,
  DueDiligence: 21,
  TermSheet: 14,
  Offer: 7,
  Invested: 30,
};

export type StaleThresholds = typeof DEFAULT_STALE_DAYS;

/** Merge a TRACKER_STALE_DAYS-style JSON override over the defaults. Bad JSON → defaults. */
export function resolveThresholds(envValue?: string): StaleThresholds {
  if (!envValue) return DEFAULT_STALE_DAYS;
  try {
    const parsed = JSON.parse(envValue) as Record<string, unknown>;
    const merged = { ...DEFAULT_STALE_DAYS };
    for (const [stage, days] of Object.entries(parsed)) {
      if (stage in merged && typeof days === "number" && days > 0) {
        merged[stage as keyof StaleThresholds] = days;
      }
    }
    return merged;
  } catch {
    console.warn("TRACKER_STALE_DAYS is not valid JSON — using default thresholds.");
    return DEFAULT_STALE_DAYS;
  }
}

export function thresholdsFromEnv(): StaleThresholds {
  return resolveThresholds(env("TRACKER_STALE_DAYS"));
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days since the most recent touch (lastContact or updatedAt). */
export function idleDays(
  now: Date,
  engagement: { lastContact?: string | null; updatedAt?: string | null },
): number {
  const touches = [engagement.lastContact, engagement.updatedAt]
    .filter((t): t is string => Boolean(t))
    .map((t) => new Date(t).getTime())
    .filter((t) => Number.isFinite(t));
  if (touches.length === 0) return Number.POSITIVE_INFINITY;
  return Math.floor((now.getTime() - Math.max(...touches)) / DAY_MS);
}
