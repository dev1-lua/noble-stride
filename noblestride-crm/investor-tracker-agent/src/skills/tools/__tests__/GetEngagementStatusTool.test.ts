import { describe, it, expect, vi } from "vitest";
import { GetEngagementStatusTool } from "../GetEngagementStatusTool";
import { DEFAULT_STALE_DAYS } from "../../../lib/staleness";
import type { CrmClient } from "../../../lib/crm-client";

const NOW = new Date("2026-07-14T08:00:00Z");

const DETAIL = {
  id: "e1",
  name: "Vantage × Busoga",
  status: "InConversation",
  engagementStage: "TeaserSent",
  interestLevel: "High",
  ndaType: null,
  ndaSignedAt: null,
  termSheetIssued: false,
  termSheetDate: null,
  totalAmount: 2000000,
  amountDisbursed: 0,
  amountPending: null,
  disbursementStatus: null,
  dateReceived: null,
  probability: 40,
  feedback: null,
  notes: null,
  lastContact: "2026-07-01T08:00:00Z", // 13d idle > TeaserSent 10
  updatedAt: "2026-06-20T08:00:00Z",
  transactionId: "t1",
  investorId: "i1",
  transaction: {
    id: "t1",
    name: "Busoga Raise",
    stage: "InvestorOutreach",
    dealStatus: "Open",
    client: { id: "c1", name: "Busoga Ltd" },
    ddTracks: [{ track: "Financial", status: "InProgress", notes: null, startedAt: null, completedAt: null }],
  },
  investor: { id: "i1", name: "Vantage Capital", investorType: "PrivateEquity", engagementClassification: "Active", ndaStatus: "None" },
  milestones: [{ key: "TeaserReview", completedAt: "2026-06-01T00:00:00Z", notes: null }],
  activities: Array.from({ length: 12 }, (_, i) => ({
    type: "Email",
    subject: `mail ${i}`,
    body: null,
    occurredAt: "2026-07-01T08:00:00Z",
    channel: "Email",
    direction: "Outbound",
  })),
};

function crmStub(engagement: unknown = DETAIL): CrmClient {
  return {
    baseUrl: "https://crm.example",
    query: vi.fn(async (document: string) => {
      if (document.includes("TrackerEngagement(")) return { engagement };
      throw new Error(`unexpected document: ${document.slice(0, 60)}`);
    }) as CrmClient["query"],
  };
}

describe("GetEngagementStatusTool", () => {
  const deps = { crm: crmStub(), thresholds: DEFAULT_STALE_DAYS, now: () => NOW };

  it("returns the full tracking picture with staleness verdict and deep link", async () => {
    const out = await new GetEngagementStatusTool(deps).execute({ engagementId: "e1" });
    expect(out.status).toBe("ok");
    if (out.status !== "ok") return;
    expect(out.engagement).toMatchObject({
      stage: "TeaserSent",
      investor: { name: "Vantage Capital", classification: "Active" },
      deal: { name: "Busoga Raise", client: "Busoga Ltd" },
      staleness: { idleDays: 13, thresholdDays: 10, isStale: true },
    });
    expect(out.engagement.recentActivities).toHaveLength(10); // capped
    expect(out.link).toBe("https://crm.example/engagement/e1");
  });

  it("rejects a call with neither engagementId nor both names", async () => {
    const out = await new GetEngagementStatusTool(deps).execute({ investor: "vantage" });
    expect(out.status).toBe("rejected");
  });

  it("returns not_found when the engagement cannot be loaded", async () => {
    const out = await new GetEngagementStatusTool({ ...deps, crm: crmStub(null) }).execute({ engagementId: "gone" });
    expect(out.status).toBe("not_found");
  });
});
