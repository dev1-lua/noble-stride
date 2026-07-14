import { describe, it, expect, vi } from "vitest";
import { scanEngagements, evaluateEngagement, type ScanEngagement, type ScanTransaction } from "../tracker-runner";
import { DEFAULT_STALE_DAYS } from "../staleness";
import type { CrmClient } from "../crm-client";

const NOW = new Date("2026-07-14T08:00:00Z");
const CTX = { thresholds: DEFAULT_STALE_DAYS, now: NOW, baseUrl: "https://crm.example" };

const txn = (over: Partial<ScanTransaction> = {}): ScanTransaction => ({
  id: "t1",
  name: "Busoga Raise",
  stage: "InvestorOutreach",
  dealStatus: "Open",
  client: { id: "c1", name: "Busoga Ltd" },
  ...over,
});

const eng = (over: Partial<ScanEngagement> = {}): ScanEngagement => ({
  id: "e1",
  name: "Vantage × Busoga",
  engagementStage: "TeaserSent",
  lastContact: null,
  updatedAt: "2026-07-13T08:00:00Z", // 1 day idle
  termSheetIssued: false,
  termSheetDate: null,
  totalAmount: null,
  amountDisbursed: null,
  amountPending: null,
  disbursementStatus: null,
  investor: { id: "i1", name: "Vantage Capital", engagementClassification: "Active" },
  ...over,
});

describe("evaluateEngagement", () => {
  it("does not flag a fresh engagement", () => {
    expect(evaluateEngagement(eng(), txn(), CTX)).toEqual([]);
  });

  it("flags an engagement idle beyond its stage threshold", () => {
    const flags = evaluateEngagement(eng({ updatedAt: "2026-07-01T08:00:00Z" }), txn(), CTX); // 13d > TeaserSent 10
    expect(flags).toHaveLength(1);
    expect(flags[0]).toMatchObject({
      reason: "stalled",
      stage: "TeaserSent",
      idleDays: 13,
      thresholdDays: 10,
      link: "https://crm.example/engagement/e1",
    });
  });

  it("treats a never-touched engagement as maximally idle", () => {
    const flags = evaluateEngagement(eng({ updatedAt: null }), txn(), CTX);
    expect(flags).toHaveLength(1);
    expect(flags[0].idleDays).toBe(Number.POSITIVE_INFINITY);
  });

  it("skips non-live deals and Declined engagements", () => {
    const idle = { updatedAt: "2026-01-01T08:00:00Z" };
    expect(evaluateEngagement(eng(idle), txn({ dealStatus: "OnHold" }), CTX)).toEqual([]);
    expect(evaluateEngagement(eng(idle), txn({ dealStatus: "Closed" }), CTX)).toEqual([]);
    expect(evaluateEngagement(eng({ ...idle, engagementStage: "Declined" }), txn(), CTX)).toEqual([]);
  });

  it("flags Invested only while a disbursement is outstanding", () => {
    const idle = { updatedAt: "2026-06-01T08:00:00Z", engagementStage: "Invested" as const };
    expect(evaluateEngagement(eng(idle), txn(), CTX)).toEqual([]); // no pending amount
    const outstanding = evaluateEngagement(
      eng({ ...idle, disbursementStatus: "Ongoing", amountPending: 500000 }),
      txn(),
      CTX,
    );
    expect(outstanding).toHaveLength(1);
    expect(outstanding[0].reason).toBe("disbursement_outstanding");
    // Fully disbursed → quiet.
    expect(
      evaluateEngagement(eng({ ...idle, disbursementStatus: "Disbursed", amountPending: 0 }), txn(), CTX),
    ).toEqual([]);
  });

  it("flags an issued term sheet with no date, independent of idleness", () => {
    const flags = evaluateEngagement(eng({ termSheetIssued: true }), txn(), CTX);
    expect(flags).toHaveLength(1);
    expect(flags[0].reason).toBe("term_sheet_undated");
  });
});

describe("scanEngagements", () => {
  const payload = {
    engagementsByDeal: [
      {
        transaction: txn(),
        engagements: [
          eng({ id: "e1", updatedAt: "2026-07-01T08:00:00Z" }), // 13d stalled
          eng({ id: "e2", investor: { id: "i2", name: "Other Fund", engagementClassification: "Active" } }),
        ],
      },
      {
        transaction: txn({ id: "t2", name: "Nairobi Deal", dealStatus: "Dropped" }),
        engagements: [eng({ id: "e3", updatedAt: "2026-01-01T08:00:00Z" })],
      },
    ],
  };
  const crm: CrmClient = { baseUrl: "https://crm.example", query: vi.fn(async () => payload) as CrmClient["query"] };

  it("scans live deals, sorts most-idle first, ignores dropped deals", async () => {
    const flags = await scanEngagements({ crm, thresholds: DEFAULT_STALE_DAYS, now: () => NOW });
    expect(flags.map((f) => f.engagementId)).toEqual(["e1"]);
  });

  it("applies transaction and investor filters", async () => {
    expect(await scanEngagements({ crm, thresholds: DEFAULT_STALE_DAYS, now: () => NOW }, { transactionId: "t2" })).toEqual([]);
    expect(
      await scanEngagements({ crm, thresholds: DEFAULT_STALE_DAYS, now: () => NOW }, { investorId: "i2" }),
    ).toEqual([]);
  });
});
