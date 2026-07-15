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
