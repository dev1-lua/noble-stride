import { describe, it, expect, vi } from "vitest";
import { resolveByNameOrId, looksLikeRecordId } from "../record-lookup";
import type { CrmClient } from "../crm-client";

const CUID = "cmquku4py009f42u3yr27faui";
const DEAL_HIT = { id: "t1", type: "Transaction", title: "Busoga Raise", subtitle: null, href: "/transactions/t1" };

function crmStub(opts: { searchHits?: unknown[]; byId?: { id: string; name: string } | null }): CrmClient {
  return {
    baseUrl: "https://crm.example",
    query: vi.fn(async (document: string) => {
      if (document.includes("globalSearch")) return { globalSearch: opts.searchHits ?? [] };
      if (document.includes("TrackerTransactionById")) return { transaction: opts.byId ?? null };
      if (document.includes("TrackerInvestorById")) return { investor: opts.byId ?? null };
      throw new Error(`unexpected: ${document.slice(0, 50)}`);
    }) as CrmClient["query"],
  };
}

describe("looksLikeRecordId", () => {
  it("accepts cuids and rejects names", () => {
    expect(looksLikeRecordId(CUID)).toBe(true);
    expect(looksLikeRecordId("Busoga Raise")).toBe(false);
    expect(looksLikeRecordId("c1")).toBe(false);
  });
});

describe("resolveByNameOrId", () => {
  it("prefers the name search when it hits", async () => {
    const out = await resolveByNameOrId(crmStub({ searchHits: [DEAL_HIT] }), "transaction", "busoga");
    expect(out.kind).toBe("match");
  });

  it("falls back to a direct by-id fetch when the search misses and the query is an id", async () => {
    const out = await resolveByNameOrId(
      crmStub({ byId: { id: CUID, name: "Busoga Raise" } }),
      "transaction",
      CUID,
    );
    expect(out).toEqual({
      kind: "match",
      result: { id: CUID, type: "Transaction", title: "Busoga Raise", subtitle: null, href: `/transactions/${CUID}` },
    });
  });

  it("stays none for an unknown id and for non-id misses", async () => {
    expect((await resolveByNameOrId(crmStub({ byId: null }), "transaction", CUID)).kind).toBe("none");
    expect((await resolveByNameOrId(crmStub({}), "transaction", "nothing here")).kind).toBe("none");
  });

  it("works for investors too", async () => {
    const out = await resolveByNameOrId(crmStub({ byId: { id: CUID, name: "Vantage" } }), "investor", CUID);
    expect(out.kind).toBe("match");
  });
});
