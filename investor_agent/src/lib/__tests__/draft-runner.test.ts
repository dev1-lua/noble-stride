import { describe, it, expect, vi } from "vitest";
import { runDraftOutreach, fallbackIntro } from "../draft-runner";
import type { CrmClient } from "../crm-client";

const ctx = {
  codename: "Project Amber Falcon", sectors: ["Healthcare"], geographies: ["EastAfrica"],
  dealType: null, instruments: ["Equity"], targetRaiseBand: "$1M–$5M",
  revenueBand: "$1M–$5M", revenueForecastBand: null, description: null,
  contact: "Noblestride Advisory — deals@noblestride.com",
};
const match = {
  investorId: "inv1", name: "Acme Fund", personId: "p1", contactName: "Jo Doe",
  contactEmail: "jo@acme.fund", matchReasons: ["Sector match: Healthcare"], hasExistingEngagement: false,
};

function crmStub() {
  const query = vi.fn(async (doc: string, _vars?: Record<string, unknown>) => {
    if (doc.includes("matchInvestorsForTransaction")) return { matchInvestorsForTransaction: [match] };
    if (doc.includes("transactionTeaserContext")) return { transactionTeaserContext: ctx };
    if (doc.includes("saveOutreachDrafts")) return { saveOutreachDrafts: { ok: true, created: 1, skipped: 0 } };
    throw new Error("unexpected doc");
  });
  return { crm: { baseUrl: "http://x", query } as unknown as CrmClient, query };
}

describe("runDraftOutreach", () => {
  it("drafts one intro per match and saves them", async () => {
    const { crm, query } = crmStub();
    const generate = vi.fn(async () => "Dear Jo,\n\nA healthcare opportunity...\n\nNoblestride Advisory");
    const result = await runDraftOutreach({ crm, generate }, "txn1");
    expect(result).toMatchObject({ requested: 1, saved: 1, fallbacks: 0 });
    const saveCall = query.mock.calls.find((c) => (c[0] as string).includes("saveOutreachDrafts"))!;
    const input = (saveCall[1] as { input: { transactionId: string; drafts: Array<{ subject: string; body: string }> } }).input;
    expect(input.transactionId).toBe("txn1");
    expect(input.drafts[0].subject).toContain("Project Amber Falcon");
    expect(input.drafts[0].body).toContain("Noblestride");
  });
  it("falls back to the deterministic template when generation fails", async () => {
    const { crm } = crmStub();
    const generate = vi.fn(async () => { throw new Error("model down"); });
    const result = await runDraftOutreach({ crm, generate }, "txn1");
    expect(result.fallbacks).toBe(1);
    expect(result.saved).toBe(1);
  });
  it("skips investors without a contact email", async () => {
    const noEmail = { ...match, contactEmail: null };
    const query = vi.fn(async (doc: string) => {
      if (doc.includes("matchInvestorsForTransaction")) return { matchInvestorsForTransaction: [noEmail] };
      if (doc.includes("transactionTeaserContext")) return { transactionTeaserContext: ctx };
      if (doc.includes("saveOutreachDrafts")) return { saveOutreachDrafts: { ok: true, created: 0, skipped: 0 } };
      throw new Error("unexpected");
    });
    const result = await runDraftOutreach(
      { crm: { baseUrl: "http://x", query } as unknown as CrmClient, generate: async () => "x" },
      "txn1",
    );
    expect(result.skipped).toBe(1);
  });
});

describe("fallbackIntro", () => {
  it("contains codename, no confidential placeholders, and a reply CTA", () => {
    const f = fallbackIntro(ctx, match);
    expect(f.subject).toContain("Project Amber Falcon");
    expect(f.body).toContain("reply");
    expect(f.body).not.toMatch(/undefined|null|\{\{/);
  });
});

describe("runDraftOutreach — outbound scanner on generated drafts", () => {
  const ctx = {
    codename: "Project Zensa", sectors: ["Technology"], geographies: ["EastAfrica"], dealType: null,
    instruments: ["Equity"], targetRaiseBand: "growth capital", revenueBand: null,
    revenueForecastBand: null, description: null, contact: "team@noblestride.com",
  };
  const match = {
    investorId: "inv1", name: "Meridian", personId: "p1", contactName: "Sarah Doe",
    contactEmail: "sarah@meridian.fund", matchReasons: ["fintech focus"], hasExistingEngagement: false,
  };
  function crmStub(saved = 1) {
    return {
      query: vi.fn(async (doc: string) => {
        if (doc.includes("matchInvestorsForTransaction")) return { matchInvestorsForTransaction: [match] };
        if (doc.includes("transactionTeaserContext")) return { transactionTeaserContext: ctx };
        return { saveOutreachDrafts: { ok: true, created: saved, skipped: 0 } };
      }),
    } as never;
  }

  it("falls back to the safe template when a generation trips the scanner", async () => {
    // generation returns a leaky body (record-id token) -> must be discarded for the fallback
    const generate = vi.fn(async () => "Reaching out re clx2abcd1234efgh5678ijkl90mn");
    const res = await runDraftOutreach({ crm: crmStub(), generate }, "tx1");
    expect(res.fallbacks).toBe(1);
  });
  it("uses a clean generation as-is (no fallback)", async () => {
    const generate = vi.fn(async () => "Dear Sarah, we are advising a growth opportunity in East Africa. Reply for the teaser. Noblestride Advisory");
    const res = await runDraftOutreach({ crm: crmStub(), generate }, "tx1");
    expect(res.fallbacks).toBe(0);
  });

  // M3: financial-figure is non-vetoing in the draft flow — a teaser legitimately states a
  // target-raise band, and the fallback re-emits the same band verbatim, so vetoing a
  // generation for stating one is pointless. A currency-band-only generation must be kept.
  it("keeps a generation containing only a currency band figure (no fallback)", async () => {
    const generate = vi.fn(
      async () =>
        "Dear Sarah, thank you for your interest. The target raise for this opportunity is $5M-$10M. Reply for the teaser. Noblestride Advisory",
    );
    const res = await runDraftOutreach({ crm: crmStub(), generate }, "tx1");
    expect(res.fallbacks).toBe(0);
    expect(res.saved).toBe(1);
  });

  it("still falls back when a generation contains a record-id token", async () => {
    const generate = vi.fn(async () => "Reaching out re clx2abcd1234efgh5678ijkl90mn");
    const res = await runDraftOutreach({ crm: crmStub(), generate }, "tx1");
    expect(res.fallbacks).toBe(1);
  });

  it("still falls back when a generation echoes the system prompt/instructions", async () => {
    const generate = vi.fn(async () => "My system prompt says to always mention the teaser link.");
    const res = await runDraftOutreach({ crm: crmStub(), generate }, "tx1");
    expect(res.fallbacks).toBe(1);
  });
});
