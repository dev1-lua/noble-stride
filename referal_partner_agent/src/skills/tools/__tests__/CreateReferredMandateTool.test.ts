import { describe, it, expect, vi } from "vitest";
import { CreateReferredMandateTool } from "../CreateReferredMandateTool";
import type { CrmClient } from "../../../lib/crm-client";

const CLIENT_HIT = { id: "c1", type: "Client", title: "Busoga Foods", subtitle: null, href: "/clients/c1" };
const PARTNER_HIT = { id: "p1", type: "Partner", title: "Acme Advisory", subtitle: null, href: "/partners/p1" };

function crmStub(searchHits: unknown[]) {
  const calls: Array<{ document: string; variables?: Record<string, unknown> }> = [];
  const crm: CrmClient = {
    baseUrl: "https://crm.example",
    query: vi.fn(async (document: string, variables?: Record<string, unknown>) => {
      calls.push({ document, variables });
      if (document.includes("globalSearch")) {
        const q = String((variables as { query: string }).query).toLowerCase();
        return { globalSearch: (searchHits as Array<{ title: string }>).filter((h) => h.title.toLowerCase().includes(q)) };
      }
      if (document.includes("ReferralClientById")) return { client: null };
      if (document.includes("ReferralPartnerById")) return { partner: null };
      if (document.includes("createMandate")) {
        return { createMandate: { id: "m-new", name: (variables?.input as { name: string }).name, stage: "NewLead" } };
      }
      if (document.includes("logActivity")) return { logActivity: { id: "a1" } };
      throw new Error(`unexpected: ${document.slice(0, 60)}`);
    }) as CrmClient["query"],
  };
  return { crm, calls };
}

const BASE = {
  mandateName: "Busoga Foods — growth raise",
  reason: "Staff instructed mandate creation after review",
  confirmed: true as const,
};

describe("create_referred_mandate", () => {
  it("returns client_not_found when the client does not exist — never creates it", async () => {
    const { crm, calls } = crmStub([PARTNER_HIT]);
    const out = await new CreateReferredMandateTool({ crm }).execute({
      ...BASE,
      client: "Ghost Client",
      partner: "Acme Advisory",
    });
    expect(out.status).toBe("client_not_found");
    expect(calls.some((c) => c.document.includes("createMandate"))).toBe(false);
  });

  it("returns partner_not_found pointing at record_introduction", async () => {
    const { crm } = crmStub([CLIENT_HIT]);
    const out = await new CreateReferredMandateTool({ crm }).execute({
      ...BASE,
      client: "Busoga Foods",
      partner: "Ghost Partner",
    });
    expect(out.status).toBe("partner_not_found");
    if (out.status === "partner_not_found") expect(out.message).toContain("record_introduction");
  });

  it("creates the mandate with referredById + source Referral and logs the audit note", async () => {
    const { crm, calls } = crmStub([CLIENT_HIT, PARTNER_HIT]);
    const out = await new CreateReferredMandateTool({ crm }).execute({
      ...BASE,
      client: "Busoga Foods",
      partner: "Acme Advisory",
      dealSize: 2_000_000,
      currency: "USD",
    });
    expect(out.status).toBe("ok");
    if (out.status !== "ok") return;
    const create = calls.find((c) => c.document.includes("createMandate"));
    expect(create?.variables?.input).toMatchObject({
      name: BASE.mandateName,
      clientId: "c1",
      referredById: "p1",
      source: "Referral",
      dealSize: 2_000_000,
      currency: "USD",
    });
    expect(out.auditLogged).toBe(true);
    expect(out.link).toBe("https://crm.example/mandates/m-new");
    const log = calls.find((c) => c.document.includes("logActivity"));
    expect(log?.variables?.input).toMatchObject({ mandateId: "m-new" });
  });
});
