import { describe, it, expect, vi } from "vitest";
import { resolveByNameOrId, looksLikeRecordId } from "../record-lookup";
import type { CrmClient } from "../crm-client";

const CUID = "cmquku4py009f42u3yr27faui";
const PARTNER_HIT = { id: "p1", type: "Partner", title: "Acme Advisory", subtitle: null, href: "/partners/p1" };

function crmStub(opts: { searchHits?: unknown[]; byId?: { id: string; name: string } | null }): CrmClient {
  return {
    baseUrl: "https://crm.example",
    query: vi.fn(async (document: string) => {
      if (document.includes("globalSearch")) return { globalSearch: opts.searchHits ?? [] };
      if (document.includes("ReferralPartnerById")) return { partner: opts.byId ?? null };
      if (document.includes("ReferralMandateById")) return { mandate: opts.byId ?? null };
      if (document.includes("ReferralClientById")) return { client: opts.byId ?? null };
      if (document.includes("ReferralTransactionById")) return { transaction: opts.byId ?? null };
      throw new Error(`unexpected: ${document.slice(0, 50)}`);
    }) as CrmClient["query"],
  };
}

describe("looksLikeRecordId", () => {
  it("accepts cuids and rejects names", () => {
    expect(looksLikeRecordId(CUID)).toBe(true);
    expect(looksLikeRecordId("Acme Advisory")).toBe(false);
    expect(looksLikeRecordId("c1")).toBe(false);
  });
});

describe("resolveByNameOrId", () => {
  it("prefers the name search when it hits", async () => {
    const out = await resolveByNameOrId(crmStub({ searchHits: [PARTNER_HIT] }), "partner", "acme");
    expect(out.kind).toBe("match");
  });

  it("falls back to a direct by-id fetch for partners when the search misses", async () => {
    const out = await resolveByNameOrId(
      crmStub({ byId: { id: CUID, name: "Acme Advisory" } }),
      "partner",
      CUID,
    );
    expect(out).toEqual({
      kind: "match",
      result: { id: CUID, type: "Partner", title: "Acme Advisory", subtitle: null, href: `/partners/${CUID}` },
    });
  });

  it("falls back by id for mandates and clients too", async () => {
    const mandate = await resolveByNameOrId(crmStub({ byId: { id: CUID, name: "M" } }), "mandate", CUID);
    expect(mandate.kind).toBe("match");
    if (mandate.kind === "match") expect(mandate.result.href).toBe(`/mandates/${CUID}`);

    const client = await resolveByNameOrId(crmStub({ byId: { id: CUID, name: "C" } }), "client", CUID);
    expect(client.kind).toBe("match");
    if (client.kind === "match") expect(client.result.href).toBe(`/clients/${CUID}`);
  });

  it("stays none for an unknown id and for non-id misses", async () => {
    expect((await resolveByNameOrId(crmStub({ byId: null }), "partner", CUID)).kind).toBe("none");
    expect((await resolveByNameOrId(crmStub({}), "partner", "nothing here")).kind).toBe("none");
  });
});
