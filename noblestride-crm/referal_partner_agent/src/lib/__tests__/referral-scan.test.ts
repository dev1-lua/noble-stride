import { describe, it, expect } from "vitest";
import { flattenReferredDeals } from "../referral-scan";

const PARTNER = {
  id: "p1",
  name: "Acme Advisory",
  referredMandates: [
    { id: "m1", name: "Busoga Mandate", stage: "Signed", dealStatus: "Open", updatedAt: "2026-07-01T00:00:00Z" },
    { id: "m2", name: "Naivasha Mandate", stage: "Lost", dealStatus: "Dropped", updatedAt: "2026-07-02T00:00:00Z" },
  ],
  referredTransactions: [
    // Child of m1 (same partner referred the mandate) — must be skipped.
    { id: "t1", name: "Busoga Raise", stage: "DueDiligence", dealStatus: "Open", mandateId: "m1", updatedAt: "2026-07-03T00:00:00Z" },
    // Direct referral on someone else's mandate — must be kept.
    { id: "t2", name: "Kigali Raise", stage: "ClosedWon", dealStatus: "Closed", mandateId: "other", updatedAt: "2026-07-04T00:00:00Z" },
    // Direct referral with no mandate — kept.
    { id: "t3", name: "Lagos Raise", stage: "ClosedLost", dealStatus: "Closed", mandateId: null, updatedAt: "2026-07-05T00:00:00Z" },
  ],
};

describe("flattenReferredDeals", () => {
  it("flattens mandates + direct transactions, skipping same-partner mandate children", () => {
    const deals = flattenReferredDeals([PARTNER]);
    expect(deals.map((d) => d.dealKey)).toEqual(["mandate:m1", "mandate:m2", "transaction:t2", "transaction:t3"]);
  });

  it("marks conversion and loss per pipeline rules", () => {
    const deals = flattenReferredDeals([PARTNER]);
    const byKey = Object.fromEntries(deals.map((d) => [d.dealKey, d]));
    expect(byKey["mandate:m1"]).toMatchObject({ converted: true, lost: false }); // Signed
    expect(byKey["mandate:m2"]).toMatchObject({ converted: false, lost: true }); // Lost
    expect(byKey["transaction:t2"]).toMatchObject({ converted: true, lost: false }); // ClosedWon
    expect(byKey["transaction:t3"]).toMatchObject({ converted: false, lost: true }); // ClosedLost
  });

  it("carries partner attribution and relative links", () => {
    const deals = flattenReferredDeals([PARTNER]);
    expect(deals[0]).toMatchObject({ partnerId: "p1", partnerName: "Acme Advisory", link: "/mandates/m1" });
    expect(deals[2].link).toBe("/transactions/t2");
  });

  it("returns empty for partners with no referrals", () => {
    expect(flattenReferredDeals([{ id: "p2", name: "Quiet", referredMandates: [], referredTransactions: [] }])).toEqual([]);
  });
});
