import { describe, it, expect, vi } from "vitest";
import { OutreachStatusTool } from "../OutreachStatusTool";
import type { CrmClient } from "../../../lib/crm-client";

const DRAFTS = [
  {
    id: "d1",
    subject: "Intro: Busoga Raise x Vantage",
    status: "Sent",
    matchRationale: "Sector fit",
    error: null,
    sentAt: "2026-07-10T00:00:00Z",
    reviewedAt: "2026-07-09T00:00:00Z",
    createdAt: "2026-07-08T00:00:00Z",
    investor: { id: "i1", name: "Vantage Capital" },
    transaction: { id: "t1", name: "Busoga Raise" },
    person: { firstName: "Amina", lastName: "Okello", email: "amina@vantage.example" },
  },
  {
    id: "d2",
    subject: "Intro: Busoga Raise x Kuramo",
    status: "Draft",
    matchRationale: "Ticket size fit",
    error: null,
    sentAt: null,
    reviewedAt: null,
    createdAt: "2026-07-11T00:00:00Z",
    investor: { id: "i2", name: "Kuramo" },
    transaction: { id: "t1", name: "Busoga Raise" },
    person: null,
  },
  {
    id: "d3",
    subject: "Intro: Kampala x Helios",
    status: "Failed",
    matchRationale: "Geo fit",
    error: "SMTP bounce",
    sentAt: null,
    reviewedAt: "2026-07-05T00:00:00Z",
    createdAt: "2026-07-04T00:00:00Z",
    investor: { id: "i4", name: "Helios" },
    transaction: { id: "t2", name: "Kampala Logistics" },
    person: null,
  },
];

function stub(drafts = DRAFTS): { crm: CrmClient; query: ReturnType<typeof vi.fn> } {
  const query = vi.fn(async (document: string, variables?: Record<string, unknown>) => {
    if (document.includes("globalSearch")) {
      return { globalSearch: [{ id: "t1", type: "Transaction", title: "Busoga Raise", subtitle: null, href: "/x" }] };
    }
    if (document.includes("TrackerOutreachDrafts")) {
      const txnId = variables?.transactionId;
      return { outreachDrafts: txnId ? drafts.filter((d) => d.transaction.id === txnId) : drafts };
    }
    throw new Error(`unexpected document: ${document.slice(0, 60)}`);
  });
  return { crm: { baseUrl: "https://crm.example", query: query as CrmClient["query"] }, query };
}

describe("OutreachStatusTool", () => {
  it("org-wide call groups all drafts by status", async () => {
    const { crm } = stub();
    const out = await new OutreachStatusTool({ crm }).execute({});
    if (out.status !== "ok") throw new Error("expected ok");
    expect(out.draftCount).toBe(3);
    expect(out.byStatus).toEqual({ Sent: 1, Draft: 1, Failed: 1 });
    expect(out.drafts[0]).toMatchObject({
      subject: "Intro: Busoga Raise x Vantage",
      investor: "Vantage Capital",
      deal: "Busoga Raise",
      contact: "Amina Okello",
    });
    expect(out.drafts[2]).toMatchObject({ status: "Failed", error: "SMTP bounce", contact: null });
    expect(out.link).toBe("https://crm.example/outreach");
  });

  it("deal-scoped call resolves the name and passes the transaction id", async () => {
    const { crm, query } = stub();
    const out = await new OutreachStatusTool({ crm }).execute({ deal: "Busoga Raise" });
    if (out.status !== "ok") throw new Error("expected ok");
    expect(out.draftCount).toBe(2);
    const draftsCall = query.mock.calls.find(([doc]) => (doc as string).includes("TrackerOutreachDrafts"));
    expect(draftsCall?.[1]).toMatchObject({ transactionId: "t1" });
  });

  it("surfaces ambiguous deal candidates instead of guessing", async () => {
    const crm: CrmClient = {
      baseUrl: "https://crm.example",
      query: vi.fn(async (document: string) => {
        if (document.includes("globalSearch")) {
          return {
            globalSearch: [
              { id: "t1", type: "Transaction", title: "Busoga Raise", subtitle: null, href: "/x" },
              { id: "t9", type: "Transaction", title: "Busoga Raise II", subtitle: null, href: "/y" },
            ],
          };
        }
        throw new Error(`unexpected document: ${document.slice(0, 60)}`);
      }) as CrmClient["query"],
    };
    const out = await new OutreachStatusTool({ crm }).execute({ deal: "Busoga" });
    expect(out.status).toBe("ambiguous_deal");
    if (out.status !== "ambiguous_deal") throw new Error("expected ambiguous_deal");
    expect(out.candidates).toHaveLength(2);
  });
});
