// F6b.3 as amended by G3 (image29: the milestone checklist "might need to be
// removed from the investor and only show if a deal is open, closed or
// ongoing").
//
// So the investor's default view of a deal is one word, not a 15-step
// checklist. Three states only, and deliberately coarse: an internal pause
// (`dealStatus: "OnHold"`) reads as Open, because Noblestride pausing its own
// work is not the investor's business and "On hold" would invite a question
// nobody wants to answer.

import type { DealStatus, EngagementStage, TransactionStage } from "@prisma/client";
import { stageRequiresNda } from "./nda-guard";

export type PortalDealStatus = "Open" | "In progress" | "Closed";

const CLOSED_TRANSACTION_STAGES: TransactionStage[] = ["ClosedWon", "ClosedLost"];
const CLOSED_DEAL_STATUSES: DealStatus[] = ["Closed", "ClosedReopened", "ClosedOnHold", "Dropped"];

export function portalDealStatus(input: {
  dealStatus: DealStatus;
  transactionStage: TransactionStage;
  engagementStage: EngagementStage | null;
}): PortalDealStatus {
  if (
    CLOSED_TRANSACTION_STAGES.includes(input.transactionStage) ||
    CLOSED_DEAL_STATUSES.includes(input.dealStatus)
  ) {
    return "Closed";
  }
  // "Ongoing" in the client's words: this investor is past the NDA gate and
  // actually working the deal. Reuses stageRequiresNda so this and the access
  // gate cannot drift apart.
  if (input.engagementStage != null && stageRequiresNda(input.engagementStage)) return "In progress";
  return "Open";
}
