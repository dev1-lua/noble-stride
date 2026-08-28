// F6b.3 / G3 (image29): "only show if a deal is open, closed or ongoing."

import { describe, it, expect } from "vitest";
import { portalDealStatus } from "@/server/domain/deal-status";
import { DealStatus, TransactionStage } from "@prisma/client";

describe("portalDealStatus", () => {
  it("Closed wins from the transaction stage or a closed deal status", () => {
    expect(portalDealStatus({ dealStatus: "Open", transactionStage: "ClosedWon", engagementStage: "Invested" })).toBe("Closed");
    expect(portalDealStatus({ dealStatus: "Open", transactionStage: "ClosedLost", engagementStage: "TermSheet" })).toBe("Closed");
    expect(portalDealStatus({ dealStatus: "Closed", transactionStage: "TermSheet", engagementStage: "TermSheet" })).toBe("Closed");
    expect(portalDealStatus({ dealStatus: "Dropped", transactionStage: "InvestorOutreach", engagementStage: null })).toBe("Closed");
    expect(portalDealStatus({ dealStatus: "ClosedOnHold", transactionStage: "TermSheet", engagementStage: null })).toBe("Closed");
  });

  it("In progress once the investor's engagement is past the NDA gate", () => {
    expect(portalDealStatus({ dealStatus: "Open", transactionStage: "InvestorOutreach", engagementStage: "NDASigned" })).toBe("In progress");
    expect(portalDealStatus({ dealStatus: "Open", transactionStage: "DueDiligence", engagementStage: "DueDiligence" })).toBe("In progress");
  });

  it("Open otherwise", () => {
    expect(portalDealStatus({ dealStatus: "Open", transactionStage: "DealPreparation", engagementStage: "Shared" })).toBe("Open");
    expect(portalDealStatus({ dealStatus: "Open", transactionStage: "InvestorOutreach", engagementStage: null })).toBe("Open");
    expect(portalDealStatus({ dealStatus: "OnHold", transactionStage: "InvestorOutreach", engagementStage: "TeaserSent" })).toBe("Open");
  });

  // Reviewer finding: despite the name, ClosedReopened is an ACTIVE status
  // everywhere else in the app (dashboard.ts::ACTIVE_DEAL_STATUSES, and the
  // dashboard tile links to ?status=Open,ClosedReopened). Calling it Closed told
  // the investor a deal the firm had just reopened was closed.
  it("a reopened deal is not closed", () => {
    expect(portalDealStatus({ dealStatus: "ClosedReopened", transactionStage: "TermSheet", engagementStage: null })).toBe("Open");
    expect(portalDealStatus({ dealStatus: "ClosedReopened", transactionStage: "DueDiligence", engagementStage: "DueDiligence" })).toBe("In progress");
  });

  // An internal pause is not the investor's business — see the module header.
  it("does not leak an internal hold", () => {
    expect(portalDealStatus({ dealStatus: "OnHold", transactionStage: "DealPreparation", engagementStage: null })).toBe("Open");
  });

  it("returns one of the three states for every enum combination", () => {
    const allowed = new Set(["Open", "In progress", "Closed"]);
    for (const dealStatus of Object.values(DealStatus)) {
      for (const transactionStage of Object.values(TransactionStage)) {
        expect(allowed.has(portalDealStatus({ dealStatus, transactionStage, engagementStage: null }))).toBe(true);
      }
    }
  });
});
