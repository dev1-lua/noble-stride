import { describe, it, expect, vi } from "vitest";
import { LinkPartnerToDealTool } from "../LinkPartnerToDealTool";
import type { CrmClient } from "../../../lib/crm-client";

/** Hermetic staff stub — without it the in-tool guard calls the live Lua API. */
const STAFF = async () => true;

const PARTNER_HIT = { id: "p1", type: "Partner", title: "Acme Advisory", subtitle: null, href: "/partners/p1" };
const MANDATE_HIT = { id: "m1", type: "Mandate", title: "Busoga Mandate", subtitle: null, href: "/mandates/m1" };

function crmStub(opts: { referredBy?: { id: string; name: string } | null } = {}) {
  const calls: Array<{ document: string; variables?: Record<string, unknown> }> = [];
  const crm: CrmClient = {
    baseUrl: "https://crm.example",
    query: vi.fn(async (document: string, variables?: Record<string, unknown>) => {
      calls.push({ document, variables });
      if (document.includes("globalSearch")) {
        const q = String((variables as { query: string }).query).toLowerCase();
        return {
          globalSearch: [PARTNER_HIT, MANDATE_HIT].filter((h) => h.title.toLowerCase().includes(q)),
        };
      }
      if (document.includes("ReferralMandateStatus")) {
        return {
          mandate: { id: "m1", name: "Busoga Mandate", clientId: "c1", referredBy: opts.referredBy ?? null },
        };
      }
      if (document.includes("updateMandate")) return { updateMandate: { id: "m1" } };
      if (document.includes("logActivity")) return { logActivity: { id: "a1" } };
      throw new Error(`unexpected: ${document.slice(0, 60)}`);
    }) as CrmClient["query"],
  };
  return { crm, calls };
}

const BASE = {
  partner: "Acme Advisory",
  deal: "Busoga Mandate",
  dealType: "mandate" as const,
  reason: "Attribution correction",
  confirmed: true as const,
};

describe("link_partner_to_deal", () => {
  it("links an unattributed deal, echoing name/clientId in the update", async () => {
    const { crm, calls } = crmStub();
    const out = await new LinkPartnerToDealTool({ isStaff: STAFF, crm }).execute(BASE);
    expect(out.status).toBe("ok");
    const update = calls.find((c) => c.document.includes("updateMandate"));
    expect(update?.variables?.input).toEqual({ name: "Busoga Mandate", clientId: "c1", referredById: "p1" });
  });

  it("conflicts (naming the current originator) when a DIFFERENT partner is linked", async () => {
    const { crm, calls } = crmStub({ referredBy: { id: "p2", name: "Rival Partners" } });
    const out = await new LinkPartnerToDealTool({ isStaff: STAFF, crm }).execute(BASE);
    expect(out.status).toBe("conflict");
    if (out.status === "conflict") expect(out.currentOriginator.name).toBe("Rival Partners");
    expect(calls.some((c) => c.document.includes("updateMandate"))).toBe(false);
  });

  it("overrides the originator only with overrideExisting: true", async () => {
    const { crm } = crmStub({ referredBy: { id: "p2", name: "Rival Partners" } });
    const out = await new LinkPartnerToDealTool({ isStaff: STAFF, crm }).execute({ ...BASE, overrideExisting: true });
    expect(out.status).toBe("ok");
    if (out.status === "ok") expect(out.replaced).toEqual({ name: "Rival Partners" });
  });

  it("no-ops with already_linked when the same partner is already the originator", async () => {
    const { crm, calls } = crmStub({ referredBy: { id: "p1", name: "Acme Advisory" } });
    const out = await new LinkPartnerToDealTool({ isStaff: STAFF, crm }).execute(BASE);
    expect(out.status).toBe("already_linked");
    expect(calls.some((c) => c.document.includes("updateMandate"))).toBe(false);
  });
});
