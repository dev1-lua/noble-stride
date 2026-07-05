// nda-guard.ts — pure NDA gating rules (design spec §4, SOW §06 guardrail:
// "No VDR access without internal approval AND the correct signed NDA").
//
// Open NDA (investor ↔ NobleStride): satisfies the NDA requirement on EVERY
// deal. Closed NDA (investor ↔ NobleStride ↔ one client): satisfies it only
// for the engagement that carries it. An engagement-level ndaType of "Open"
// also counts (it records that the investor's open NDA covers this deal).

import type { EngagementStage, InvestorNdaStatus, NdaType } from "@prisma/client";

/** Stages that presuppose a signed NDA (everything at AFTER_NDA/DD tier). */
const NDA_REQUIRED: Record<EngagementStage, boolean> = {
  Shared: false,
  TeaserSent: false,
  Declined: false,
  NDASigned: true,
  IMShared: true,
  Meeting: true,
  InfoRequest: true,
  TermSheet: true,
  Offer: true,
  VDRAccess: true,
  DueDiligence: true,
  Invested: true,
};

export function stageRequiresNda(stage: EngagementStage): boolean {
  return NDA_REQUIRED[stage];
}

export function ndaSatisfied(
  investor: { ndaStatus: InvestorNdaStatus },
  engagement?: { ndaType: NdaType | null } | null,
): boolean {
  if (investor.ndaStatus === "OpenNDA") return true;
  return (engagement?.ndaType ?? null) !== null;
}

export class NdaGuardError extends Error {}

/** Throw when moving to `stage` is not allowed without the correct NDA. */
export function assertStageAllowed(
  stage: EngagementStage,
  investor: { ndaStatus: InvestorNdaStatus },
  engagement?: { ndaType: NdaType | null } | null,
): void {
  if (stageRequiresNda(stage) && !ndaSatisfied(investor, engagement)) {
    throw new NdaGuardError(
      `Stage "${stage}" requires a signed NDA. Record an Open NDA on the investor, or a Closed NDA on this engagement, first.`,
    );
  }
}
