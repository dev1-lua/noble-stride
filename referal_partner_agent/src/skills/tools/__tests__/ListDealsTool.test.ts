import { describe, it, expect, vi } from "vitest";
import { ListDealsTool } from "../ListDealsTool";
import { STAFF_ONLY_REFUSAL } from "../../../lib/staff-mode";
import type { CrmClient } from "../../../lib/crm-client";

/** Hermetic staff stub — without it the in-tool guard calls the live Lua API. */
const STAFF = async () => true;

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

/** Narrow the union — every test below expects the ok shape. */
async function run(input: { pipeline: "mandates" | "transactions" | "both"; limit: number }, isStaff = STAFF) {
  const out = await new ListDealsTool({ isStaff, crm: crmStub() }).execute(input);
  if (out.status !== "ok") throw new Error(`expected ok, got ${out.status}`);
  return out;
}

describe("list_deals", () => {
  it("lists deals from both pipelines newest-first with originator or null", async () => {
    const out = await run({ pipeline: "both", limit: 10 });
    expect(out.status).toBe("ok");
    expect(out.totalDeals).toBe(3);
    expect(out.deals.map((d) => d.name)).toEqual(["Newest Mandate", "Middle Transaction", "Oldest Mandate"]);
    expect(out.deals[0].introducedBy).toEqual(ACME);
    expect(out.deals[1].introducedBy).toBeNull();
    expect(out.deals[0].link).toBe("https://crm.example/mandates/m-new");
    expect(out.deals[1].link).toBe("https://crm.example/transactions/t-mid");
  });

  it("falls back to createdAt when dateOpened is missing", async () => {
    const out = await run({ pipeline: "both", limit: 10 });
    expect(out.deals[2]).toMatchObject({ name: "Oldest Mandate", opened: "2026-01-01T00:00:00Z" });
  });

  it("applies the limit and reports the full total", async () => {
    const out = await run({ pipeline: "both", limit: 2 });
    expect(out.totalDeals).toBe(3);
    expect(out.showing).toBe(2);
    expect(out.deals.map((d) => d.name)).toEqual(["Newest Mandate", "Middle Transaction"]);
  });

  it("filters to a single pipeline", async () => {
    const mandates = await run({ pipeline: "mandates", limit: 10 });
    expect(mandates.deals.every((d) => d.type === "mandate")).toBe(true);
    expect(mandates.totalDeals).toBe(2);
    const transactions = await run({ pipeline: "transactions", limit: 10 });
    expect(transactions.deals.map((d) => d.name)).toEqual(["Middle Transaction"]);
  });

  it("maps amount from dealSize (mandate) / targetRaise (transaction)", async () => {
    const out = await run({ pipeline: "both", limit: 10 });
    expect(out.deals[0].amount).toBe(5_000_000);
    expect(out.deals[1].amount).toBe(2_000_000);
  });

  it("refuses non-staff callers before touching the CRM (in-tool guard)", async () => {
    const crm = crmStub();
    const out = await new ListDealsTool({ isStaff: async () => false, crm }).execute({ pipeline: "both", limit: 10 });
    expect(out).toEqual(STAFF_ONLY_REFUSAL);
    expect(crm.query).not.toHaveBeenCalled();
  });
});
