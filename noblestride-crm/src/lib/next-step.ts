// Stage-aware "request next step" labels (spec 2026-07-19 §8). Investors
// SIGNAL the next step; staff move the stage — stages drive visibility tiers
// and NDA gating, so they are never mutated from the portal.

import type { EngagementStage } from "@prisma/client";

export function nextStepLabel(stage: EngagementStage): string | null {
  switch (stage) {
    case "Shared":
    case "TeaserSent":
      return "Request NDA";
    case "NDASigned":
      return "Request IM";
    case "IMShared":
      return "Request VDR access";
    case "VDRAccess":
      return "Request a meeting";
    case "Meeting":
    case "InfoRequest":
    case "DueDiligence":
    case "TermSheet":
    case "Offer":
      return "Request an update";
    case "Invested":
    case "Declined":
      return null;
  }
}
