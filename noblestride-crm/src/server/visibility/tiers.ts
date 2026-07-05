// Visibility engine — tier resolution (design spec §5.1, build-spec §11).
// Pure module: type-only Prisma imports, no runtime dependencies.

import type { EngagementStage, InvestorEngagementClassification, OnboardingStatus } from "@prisma/client";

/** External-investor visibility tier, from least to most access. */
export type Tier = "NONE" | "PRE_INTEREST" | "AFTER_NDA" | "DD";

/**
 * Classifications that block ALL external access (§5.1 row 1).
 * Record keyed by the enum so adding a classification forces a decision here.
 */
const CLASSIFICATION_BLOCKED: Record<InvestorEngagementClassification, boolean> = {
  Active: false,
  Inactive: true,
  OnHold: true,
  Excluded: true,
  Greylisted: true,
};

/** Classifications whose investors see nothing (empty portal). */
export const BLOCKED_CLASSIFICATIONS: readonly InvestorEngagementClassification[] = (
  Object.keys(CLASSIFICATION_BLOCKED) as InvestorEngagementClassification[]
).filter((c) => CLASSIFICATION_BLOCKED[c]);

export function isBlockedClassification(classification: InvestorEngagementClassification): boolean {
  return CLASSIFICATION_BLOCKED[classification];
}

/** Onboarding gate (design spec §5): only Approved investors see anything. */
export function isOnboardingBlocked(status: OnboardingStatus): boolean {
  return status !== "Approved";
}

/** Stage → tier (§5.1 rows 2–5). Record keyed by the enum for exhaustiveness. */
const STAGE_TIER: Record<EngagementStage, Tier> = {
  Shared: "PRE_INTEREST",
  TeaserSent: "PRE_INTEREST",
  NDASigned: "AFTER_NDA",
  IMShared: "AFTER_NDA",
  Meeting: "AFTER_NDA",
  InfoRequest: "AFTER_NDA",
  TermSheet: "AFTER_NDA",
  Offer: "AFTER_NDA",
  VDRAccess: "DD",
  DueDiligence: "DD",
  Invested: "DD",
  Declined: "NONE",
};

/**
 * Resolve an investor's visibility tier for one deal (§5.1).
 *
 * - Not-yet-approved onboarding (PendingReview/Rejected) → NONE, always.
 * - Blocked classification (Excluded/Greylisted/Inactive/OnHold) → NONE, always.
 * - Declined engagement → NONE.
 * - No engagement, or Shared/TeaserSent → PRE_INTEREST.
 * - NDASigned/IMShared/Meeting/InfoRequest/TermSheet/Offer → AFTER_NDA.
 * - VDRAccess/DueDiligence/Invested → DD.
 */
export function investorTier(
  investor: {
    engagementClassification: InvestorEngagementClassification;
    onboardingStatus: OnboardingStatus;
  },
  engagement?: { engagementStage: EngagementStage } | null,
): Tier {
  if (isOnboardingBlocked(investor.onboardingStatus)) return "NONE";
  if (CLASSIFICATION_BLOCKED[investor.engagementClassification]) return "NONE";
  if (!engagement) return "PRE_INTEREST";
  return STAGE_TIER[engagement.engagementStage];
}
