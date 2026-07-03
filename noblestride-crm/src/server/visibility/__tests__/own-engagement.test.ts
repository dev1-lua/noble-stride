// projectOwnEngagement — the investor's OWN journey projection.
// Allowlist: dealId, stage, lastContact, termSheetIssued, termSheetDate,
// milestoneKeys. Everything else on the engagement (feedback, probability,
// notes, amounts, owner, other investors) must never appear.
import { describe, it, expect } from "vitest";
import type { EngagementStage, MilestoneKey, PrismaClient } from "@prisma/client";
import { projectOwnEngagement, type OwnEngagementInput } from "@/server/visibility/project";
import { loadInvestorPipeline } from "@/server/visibility/load";
import { STAGE_MILESTONES, MILESTONE_ORDER } from "@/lib/milestones";
import {
  FORBIDDEN_STRINGS,
  INTERNAL_NOTE,
  INVESTOR_FEEDBACK,
  OTHER_INVESTOR_NAME,
  TEAM_MEMBER_NAME,
  OWN_INVESTOR_ID,
  makeDealFixture,
} from "./fixtures";

// Distinctive sentinels for engagement-internal values that must never leak.
const SECRET_PROBABILITY = 87654321;
const SECRET_TOTAL = 55_111_222;
const SECRET_DISBURSED = 44_333_555;
const SECRET_PENDING = 10_777_667;
const SECRET_OWNER_ID = "user-secret-owner-id";

function makeOwnEngagement(overrides: Partial<OwnEngagementInput> = {}): OwnEngagementInput {
  return {
    transactionId: "txn-1",
    engagementStage: "DueDiligence",
    lastContact: new Date("2026-06-01T00:00:00Z"),
    termSheetIssued: true,
    termSheetDate: new Date("2026-06-15T00:00:00Z"),
    // Internal-only fields, present on the loaded row:
    notes: INTERNAL_NOTE,
    feedback: INVESTOR_FEEDBACK,
    probability: SECRET_PROBABILITY,
    totalAmount: SECRET_TOTAL,
    amountDisbursed: SECRET_DISBURSED,
    amountPending: SECRET_PENDING,
    disbursementStatus: "Ongoing",
    ownerId: SECRET_OWNER_ID,
    owner: { id: SECRET_OWNER_ID, name: TEAM_MEMBER_NAME, email: "alice@noblestride.com" },
    ...overrides,
  };
}

describe("projectOwnEngagement — allowlisted own-journey fields", () => {
  it("returns exactly the allowlisted shape", () => {
    const p = projectOwnEngagement(makeOwnEngagement(), [{ key: "PreliminaryDD" }]);
    expect(Object.keys(p).sort()).toEqual([
      "dealId",
      "lastContact",
      "milestoneKeys",
      "stage",
      "termSheetDate",
      "termSheetIssued",
    ]);
    expect(p.dealId).toBe("txn-1");
    expect(p.stage).toBe("DueDiligence");
    expect(p.lastContact).toEqual(new Date("2026-06-01T00:00:00Z"));
    expect(p.termSheetIssued).toBe(true);
    expect(p.termSheetDate).toEqual(new Date("2026-06-15T00:00:00Z"));
  });

  it("defaults optional own fields to null/false", () => {
    const p = projectOwnEngagement(
      { transactionId: "txn-9", engagementStage: "Shared" },
      [],
    );
    expect(p.lastContact).toBeNull();
    expect(p.termSheetIssued).toBe(false);
    expect(p.termSheetDate).toBeNull();
    expect(p.milestoneKeys).toEqual([]);
  });

  // Table-driven: stage-implied milestones surface for every stage.
  const stageCases: [EngagementStage, number][] = [
    ["Shared", 0],
    ["TeaserSent", 1],
    ["NDASigned", 2],
    ["Meeting", 3],
    ["InfoRequest", 3],
    ["IMShared", 3],
    ["VDRAccess", 4],
    ["DueDiligence", 5],
    ["TermSheet", 8],
    ["Offer", 12],
    ["Invested", 14],
    ["Declined", 0],
  ];
  for (const [stage, expectedCount] of stageCases) {
    it(`stage ${stage} → ${expectedCount} stage-implied milestones`, () => {
      const p = projectOwnEngagement(makeOwnEngagement({ engagementStage: stage }), []);
      expect(p.milestoneKeys).toEqual(STAGE_MILESTONES[stage]);
      expect(p.milestoneKeys).toHaveLength(expectedCount);
    });
  }

  it("merges recorded milestones with stage-implied ones, in MILESTONE_ORDER", () => {
    const recorded: { key: MilestoneKey }[] = [
      { key: "DataRoomAccess" }, // out of order vs stage NDASigned
      { key: "NdaExecuted" }, // duplicate of stage-implied
    ];
    const p = projectOwnEngagement(makeOwnEngagement({ engagementStage: "NDASigned" }), recorded);
    expect(p.milestoneKeys).toEqual(["TeaserReview", "NdaExecuted", "DataRoomAccess"]);
    // Ordering always follows the canonical cycle.
    const indices = p.milestoneKeys.map((k) => MILESTONE_ORDER.indexOf(k));
    expect([...indices].sort((a, b) => a - b)).toEqual(indices);
  });

  it("Declined keeps individually recorded milestones (stage implies nothing)", () => {
    const p = projectOwnEngagement(makeOwnEngagement({ engagementStage: "Declined" }), [
      { key: "TeaserReview" },
      { key: "NdaExecuted" },
    ]);
    expect(p.milestoneKeys).toEqual(["TeaserReview", "NdaExecuted"]);
  });
});

describe("projectOwnEngagement — HARD RULES (JSON scan)", () => {
  const allStages: EngagementStage[] = stagesUnderTest();
  function stagesUnderTest(): EngagementStage[] {
    return [
      "Shared", "TeaserSent", "NDASigned", "IMShared", "Meeting", "InfoRequest",
      "VDRAccess", "DueDiligence", "TermSheet", "Offer", "Invested", "Declined",
    ];
  }

  for (const stage of allStages) {
    it(`never leaks feedback/probability/notes/amounts/owner @ ${stage}`, () => {
      const json = JSON.stringify(
        projectOwnEngagement(makeOwnEngagement({ engagementStage: stage }), [
          { key: "TeaserReview" },
        ]),
      );
      for (const forbidden of FORBIDDEN_STRINGS) expect(json).not.toContain(forbidden);
      expect(json).not.toContain(String(SECRET_PROBABILITY));
      expect(json).not.toContain(String(SECRET_TOTAL));
      expect(json).not.toContain(String(SECRET_DISBURSED));
      expect(json).not.toContain(String(SECRET_PENDING));
      expect(json).not.toContain(SECRET_OWNER_ID);
      expect(json).not.toContain(OTHER_INVESTOR_NAME);
      // Property names themselves must not survive either.
      expect(json).not.toContain('"notes"');
      expect(json).not.toContain('"feedback"');
      expect(json).not.toContain('"probability"');
      expect(json).not.toContain('"totalAmount"');
      expect(json).not.toContain('"amountDisbursed"');
      expect(json).not.toContain('"amountPending"');
      expect(json).not.toContain('"disbursementStatus"');
      expect(json).not.toContain('"owner"');
      expect(json).not.toContain('"ownerId"');
    });
  }
});

describe("loadInvestorPipeline", () => {
  function stubPrisma(overrides: { investor?: unknown; engagements?: unknown[] }): PrismaClient {
    return {
      investor: { findUniqueOrThrow: async () => overrides.investor },
      engagement: { findMany: async () => overrides.engagements ?? [] },
    } as unknown as PrismaClient;
  }

  const investorFixture = {
    id: OWN_INVESTOR_ID,
    name: "Own Fund LP",
    engagementClassification: "Active",
  };

  function makeEngagementRow(overrides: Record<string, unknown> = {}) {
    return {
      id: "eng-own",
      transactionId: "txn-1",
      investorId: OWN_INVESTOR_ID,
      engagementStage: "NDASigned",
      lastContact: new Date("2026-06-01T00:00:00Z"),
      termSheetIssued: false,
      termSheetDate: null,
      notes: INTERNAL_NOTE,
      feedback: INVESTOR_FEEDBACK,
      probability: SECRET_PROBABILITY,
      totalAmount: SECRET_TOTAL,
      amountDisbursed: SECRET_DISBURSED,
      amountPending: SECRET_PENDING,
      ownerId: SECRET_OWNER_ID,
      owner: { name: TEAM_MEMBER_NAME },
      milestones: [
        { key: "TeaserReview", completedAt: new Date("2026-05-01T00:00:00Z"), notes: INTERNAL_NOTE },
      ],
      transaction: makeDealFixture(),
      ...overrides,
    };
  }

  it("joins own engagement to the tier-projected deal", async () => {
    const prisma = stubPrisma({ investor: investorFixture, engagements: [makeEngagementRow()] });
    const items = await loadInvestorPipeline(prisma, OWN_INVESTOR_ID);
    expect(items).toHaveLength(1);
    expect(items[0]?.deal.tier).toBe("AFTER_NDA");
    expect(items[0]?.own.stage).toBe("NDASigned");
    expect(items[0]?.own.milestoneKeys).toEqual(["TeaserReview", "NdaExecuted"]);
    expect(items[0]?.milestoneDates.TeaserReview).toEqual(new Date("2026-05-01T00:00:00Z"));
  });

  it("blocked classification yields an empty pipeline", async () => {
    const prisma = stubPrisma({
      investor: { ...investorFixture, engagementClassification: "Greylisted" },
      engagements: [makeEngagementRow()],
    });
    expect(await loadInvestorPipeline(prisma, OWN_INVESTOR_ID)).toEqual([]);
  });

  it("Declined rows survive at teaser level and sort last", async () => {
    const prisma = stubPrisma({
      investor: investorFixture,
      engagements: [
        makeEngagementRow({ id: "eng-d", transactionId: "txn-d", engagementStage: "Declined", transaction: { ...makeDealFixture(), id: "txn-d" } }),
        makeEngagementRow(),
      ],
    });
    const items = await loadInvestorPipeline(prisma, OWN_INVESTOR_ID);
    expect(items.map((i) => i.own.stage)).toEqual(["NDASigned", "Declined"]);
    // Declined deal projected at teaser level: banded financials, no raw numbers.
    expect(items[1]?.deal.tier).toBe("PRE_INTEREST");
    expect(items[1]?.deal.financialsSummary.disclosure).toBe("limited");
  });

  it("pipeline output never contains forbidden data (JSON scan)", async () => {
    const prisma = stubPrisma({ investor: investorFixture, engagements: [makeEngagementRow()] });
    const json = JSON.stringify(await loadInvestorPipeline(prisma, OWN_INVESTOR_ID));
    for (const forbidden of FORBIDDEN_STRINGS) expect(json).not.toContain(forbidden);
    expect(json).not.toContain(String(SECRET_PROBABILITY));
    expect(json).not.toContain(String(SECRET_TOTAL));
    expect(json).not.toContain(String(SECRET_DISBURSED));
    expect(json).not.toContain(String(SECRET_PENDING));
    expect(json).not.toContain(SECRET_OWNER_ID);
  });
});
