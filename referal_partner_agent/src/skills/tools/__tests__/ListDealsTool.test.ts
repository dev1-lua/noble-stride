import { describe, it, expect, vi } from "vitest";
import { ListDealsTool } from "../ListDealsTool";
import { withStaffGuard, STAFF_ONLY_REFUSAL } from "../../../lib/staff-mode";
import type { CrmClient } from "../../../lib/crm-client";

const ACME = { id: "p1", name: "Acme Advisory" };

const SNAPSHOT = {
  mandatesByStage: [
    {
      stage: "Prospecting",
      label: "Prospecting",
      items: [
        {
          id: "m-new", name: "Newest Mandate", stage: "Prospecting", dealStatus: "Active",
          createdAt: "2026-07-20T00:00:00Z", updatedAt: "2026-07-20T00:00:00Z",
          dateOpened: "2026-07-20T00:00:00Z", currency: "USD", dealSize: 5_000_000,
          referredBy: ACME, client: { id: "c1", name: "Busoga Ltd" },
        },
      ],
    },
    {
      stage: "Signed",
      label: "Signed",
      items: [
        {
          id: "m-old", name: "Oldest Mandate", stage: "Signed", dealStatus: "Active",
          createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-06-01T00:00:00Z",
          dateOpened: null, currency: "USD", dealSize: 1_000_000,
          referredBy: null, client: null,
        },
      ],
    },
  ],
  transactionsByStage: [
    {
      stage: "DueDiligence",
      label: "Due Diligence",
      items: [
        {
          id: "t-mid", name: "Middle Transaction", stage: "DueDiligence", dealStatus: "Active",
          createdAt: "2026-03-01T00:00:00Z", updatedAt: "2026-07-01T00:00:00Z",
          dateOpened: "2026-04-15T00:00:00Z", currency: "TZS", targetRaise: 2_000_000,
          referredBy: null, client: { id: "c2", name: "Pass Leasing TZ" },
        },
      ],
    },
  ],
};

function crmStub() {
  const crm: CrmClient = {
    baseUrl: "https://crm.example",
    query: vi.fn(async (document: string) => {
      if (document.includes("ReferralDealsSnapshot")) return SNAPSHOT;
      throw new Error(`unexpected: ${document.slice(0, 60)}`);
    }) as CrmClient["query"],
  };
  return crm;
}

describe("list_deals", () => {
  it("lists deals from both pipelines newest-first with originator or null", async () => {
    const out = await new ListDealsTool({ crm: crmStub() }).execute({ pipeline: "both", limit: 10 });
    expect(out.status).toBe("ok");
    expect(out.totalDeals).toBe(3);
    expect(out.deals.map((d) => d.name)).toEqual(["Newest Mandate", "Middle Transaction", "Oldest Mandate"]);
    expect(out.deals[0].introducedBy).toEqual(ACME);
    expect(out.deals[1].introducedBy).toBeNull();
    expect(out.deals[0].link).toBe("https://crm.example/mandates/m-new");
    expect(out.deals[1].link).toBe("https://crm.example/transactions/t-mid");
  });

  it("falls back to createdAt when dateOpened is missing", async () => {
    const out = await new ListDealsTool({ crm: crmStub() }).execute({ pipeline: "both", limit: 10 });
    expect(out.deals[2]).toMatchObject({ name: "Oldest Mandate", opened: "2026-01-01T00:00:00Z" });
  });

  it("applies the limit and reports the full total", async () => {
    const out = await new ListDealsTool({ crm: crmStub() }).execute({ pipeline: "both", limit: 2 });
    expect(out.totalDeals).toBe(3);
    expect(out.showing).toBe(2);
    expect(out.deals.map((d) => d.name)).toEqual(["Newest Mandate", "Middle Transaction"]);
  });

  it("filters to a single pipeline", async () => {
    const mandates = await new ListDealsTool({ crm: crmStub() }).execute({ pipeline: "mandates", limit: 10 });
    expect(mandates.deals.every((d) => d.type === "mandate")).toBe(true);
    expect(mandates.totalDeals).toBe(2);
    const transactions = await new ListDealsTool({ crm: crmStub() }).execute({ pipeline: "transactions", limit: 10 });
    expect(transactions.deals.map((d) => d.name)).toEqual(["Middle Transaction"]);
  });

  it("maps amount from dealSize (mandate) / targetRaise (transaction)", async () => {
    const out = await new ListDealsTool({ crm: crmStub() }).execute({ pipeline: "both", limit: 10 });
    expect(out.deals[0].amount).toBe(5_000_000);
    expect(out.deals[1].amount).toBe(2_000_000);
  });

  it("refuses non-staff callers when wrapped with the staff guard", async () => {
    const guarded = withStaffGuard(new ListDealsTool({ crm: crmStub() }), async () => false);
    const out = await guarded.execute({ pipeline: "both", limit: 10 });
    expect(out).toEqual(STAFF_ONLY_REFUSAL);
  });
});
