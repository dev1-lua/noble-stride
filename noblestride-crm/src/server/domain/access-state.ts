// F6b.2 (image28: "restrict the details until the investor has expressed
// interest and been granted access") — pure state derivation for the
// deal-access flow, staff side and portal side.
//
// The rule the client asked about and the rule SOW §06 imposes meet here:
// interest alone does NOT unlock anything. What unlocks a deal is a stage that
// presupposes an NDA, and `assertStageAllowed` is the only thing that lets an
// engagement reach one. So `accessState` reads the STAGE, never a grant
// timestamp: `Engagement.accessGrantedAt` is audit metadata (who granted it,
// when), and if it were the state source a stage rollback would leave the UI
// claiming access the guard no longer allows.

import type { EngagementStage, EngagementStatus } from "@prisma/client";
import { stageRequiresNda } from "./nda-guard";

export type AccessState = "none" | "interest_received" | "granted";

export function accessState(e: {
  engagementStage: EngagementStage;
  status: EngagementStatus;
}): AccessState {
  if (e.engagementStage === "Declined") return "none";
  if (stageRequiresNda(e.engagementStage)) return "granted";
  return e.status === "Interested" || e.status === "InConversation" ? "interest_received" : "none";
}

/**
 * What the investor's own pipeline row says about a deal. Aika's vocabulary
 * (§2c): the fund should be able to read its position without being told
 * anything internal.
 */
export type PortalDealStatusLabel =
  | "Shared with you"
  | "Awaiting access"
  | "Access granted"
  | "Information shared"
  | "In discussion"
  | "Closed"
  | "Declined";

// Keyed by the enum on purpose: adding an EngagementStage forces a decision
// here rather than silently falling through to a default.
//
// The labels must only ever move FORWARD as the stage advances. `IMShared` used
// to read "NDA signed", which sent a fund's chip backwards from "Access granted"
// to "NDA signed" the moment staff shared the information memorandum — it read
// as losing access. Each label now says something new and later than the last.
const STAGE_LABEL: Record<EngagementStage, PortalDealStatusLabel> = {
  Shared: "Shared with you",
  TeaserSent: "Shared with you",
  NDASigned: "Access granted",
  IMShared: "Information shared",
  VDRAccess: "In discussion",
  Meeting: "In discussion",
  InfoRequest: "In discussion",
  DueDiligence: "In discussion",
  TermSheet: "In discussion",
  Offer: "In discussion",
  Invested: "Closed",
  Declined: "Declined",
};

export function portalStatusLabel(own: {
  stage: EngagementStage;
  status: EngagementStatus;
}): PortalDealStatusLabel {
  const base = STAGE_LABEL[own.stage];
  // Interest registered but not yet acted on is the one case the stage alone
  // cannot express — Shared/TeaserSent covers both "we sent it" and "we sent it
  // and they asked for more".
  if (
    base === "Shared with you" &&
    accessState({ engagementStage: own.stage, status: own.status }) === "interest_received"
  ) {
    return "Awaiting access";
  }
  return base;
}
