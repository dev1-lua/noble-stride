import { describe, it, expect } from "vitest";
import { assessDealHealth, analyzePipeline, STALE_DAYS } from "../analysis";

const NOW = new Date("2026-07-21T00:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

describe("assessDealHealth — transaction", () => {
  it("flags a stalled stage, no recent activity, and no engagements", () => {
    const res = assessDealHealth("transaction", {
      name: "Busoga Raise", stage: "Outreach", stageEnteredAt: daysAgo(60),
      updatedAt: daysAgo(45), targetRaise: 5_000_000,
      engagements: [], activities: [],
      client: { name: "Busoga Sugar" },
    }, NOW);
    const areas = res.findings.map((f) => f.area);
    expect(areas).toContain("stage");         // stalled
    expect(areas).toContain("activity");      // no recent activity
    expect(areas).toContain("engagements");   // none
    expect(res.findings.some((f) => f.severity === "risk")).toBe(true);
  });

  it("offers depth dimensions only for relations that have data", () => {
    const res = assessDealHealth("transaction", {
      name: "Acme Raise", stage: "Closing", stageEnteredAt: daysAgo(3),
      updatedAt: daysAgo(2), targetRaise: 1_000_000,
      engagements: [{ name: "Acme × FundX" }], activities: [{ subject: "call" }],
      documents: [{ name: "IM.pdf" }],
    }, NOW);
    const dims = res.depth.map((d) => d.dimension).sort();
    expect(dims).toEqual(["activity", "documents", "engagements"]);
  });

  it("is clean for a healthy, active deal", () => {
    const res = assessDealHealth("transaction", {
      name: "Healthy", stage: "DueDiligence", stageEnteredAt: daysAgo(5),
      updatedAt: daysAgo(1), targetRaise: 2_000_000,
      engagements: [{ name: "e1" }], activities: [{ occurredAt: daysAgo(1) }],
    }, NOW);
    expect(res.findings.filter((f) => f.severity === "risk")).toHaveLength(0);
  });
});

describe("assessDealHealth — mandate & investor", () => {
  it("flags a mandate with no transactions and unsigned NDA past intake", () => {
    const res = assessDealHealth("mandate", {
      name: "Mandate A", stage: "Proposal", stageEnteredAt: daysAgo(10),
      updatedAt: daysAgo(5), ndaStatus: "Pending", transactions: [], activities: [{}],
    }, NOW);
    expect(res.findings.map((f) => f.area)).toEqual(expect.arrayContaining(["transactions", "nda"]));
  });

  it("flags an investor with unfilled criteria", () => {
    const res = assessDealHealth("investor", {
      name: "FundZ", investorType: "PE", sectorFocus: [], ticketMin: null, ticketMax: null,
      engagements: [], activities: [],
    }, NOW);
    expect(res.findings.map((f) => f.area)).toContain("criteria");
  });
});

describe("assessDealHealth — activity recency (unordered `activities` relation)", () => {
  it("does NOT flag stale activity when the newest activity is recent, even if it is NOT first in the array", () => {
    // The CRM `activities` relation has no orderBy, so the server may return oldest-first.
    // activities[0] here is 60 days old, but a 1-day-old activity is also present.
    const res = assessDealHealth("transaction", {
      name: "Busoga Raise", stage: "DueDiligence", stageEnteredAt: daysAgo(3), updatedAt: daysAgo(1),
      targetRaise: 1_000_000, engagements: [{ name: "e1" }],
      activities: [{ occurredAt: daysAgo(60) }, { occurredAt: daysAgo(1) }],
    }, NOW);
    expect(res.findings.map((f) => f.area)).not.toContain("activity");
  });

  it("DOES flag stale activity when every activity is older than STALE_DAYS, regardless of order", () => {
    const res = assessDealHealth("transaction", {
      name: "Busoga Raise", stage: "DueDiligence", stageEnteredAt: daysAgo(3), updatedAt: daysAgo(1),
      targetRaise: 1_000_000, engagements: [{ name: "e1" }],
      activities: [{ occurredAt: daysAgo(45) }, { occurredAt: daysAgo(60) }],
    }, NOW);
    expect(res.findings.map((f) => f.area)).toContain("activity");
  });
});

describe("assessDealHealth — stalled-stage gating by record type", () => {
  it("does NOT flag 'stage' for an investor even when long unmodified (no pipeline stage exists)", () => {
    const res = assessDealHealth("investor", {
      name: "FundZ", investorType: "PE", sectorFocus: ["Fintech"], ticketMin: 100_000, ticketMax: 1_000_000,
      updatedAt: daysAgo(90), engagements: [], activities: [{ occurredAt: daysAgo(1) }],
    }, NOW);
    expect(res.findings.map((f) => f.area)).not.toContain("stage");
  });

  it("does NOT flag 'stage' for a partner even when long unmodified (no pipeline stage exists)", () => {
    const res = assessDealHealth("partner", {
      name: "PartnerCo", updatedAt: daysAgo(90), activities: [{ occurredAt: daysAgo(1) }],
    }, NOW);
    expect(res.findings.map((f) => f.area)).not.toContain("stage");
  });

  it("still flags 'stage' for a transaction whose stage is genuinely stale", () => {
    const res = assessDealHealth("transaction", {
      name: "Busoga Raise", stage: "Outreach", stageEnteredAt: daysAgo(60), updatedAt: daysAgo(45),
      targetRaise: 1_000_000, engagements: [{ name: "e1" }], activities: [{ occurredAt: daysAgo(1) }],
    }, NOW);
    expect(res.findings.map((f) => f.area)).toContain("stage");
  });
});

describe("analyzePipeline", () => {
  const columns = [
    { stage: "Outreach", label: "Outreach", items: [
      { id: "1", name: "A", stageEnteredAt: daysAgo(60), createdAt: daysAgo(90), updatedAt: daysAgo(50), dealSize: 1_000_000, sector: ["Fintech"] },
      { id: "2", name: "B", stageEnteredAt: daysAgo(3), createdAt: daysAgo(5), updatedAt: daysAgo(2), dealSize: 500_000, sector: ["Agriculture"] },
    ] },
    { stage: "Closing", label: "Closing", items: [
      { id: "3", name: "C", stageEnteredAt: daysAgo(2), createdAt: daysAgo(40), updatedAt: daysAgo(1), dealSize: 2_000_000, sector: ["Fintech"] },
    ] },
  ];

  it("totals count and value by stage", () => {
    const res = analyzePipeline(columns, NOW);
    const outreach = res.metrics.find((m) => m.stage === "Outreach")!;
    expect(outreach.count).toBe(2);
    expect(outreach.totalValue).toBe(1_500_000);
  });

  it("lists only stalled items (idle > STALE_DAYS) in aging", () => {
    const res = analyzePipeline(columns, NOW);
    expect(res.aging.map((a) => a.name)).toEqual(["A"]);
    expect(res.aging[0].idleDays).toBeGreaterThan(STALE_DAYS);
  });

  it("computes sector concentration", () => {
    const res = analyzePipeline(columns, NOW);
    const fintech = res.concentration.find((c) => c.sector === "Fintech")!;
    expect(fintech.count).toBe(2);
  });
});
