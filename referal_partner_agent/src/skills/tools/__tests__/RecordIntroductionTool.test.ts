import { describe, it, expect, vi } from "vitest";
import { RecordIntroductionTool } from "../RecordIntroductionTool";
import type { CrmClient } from "../../../lib/crm-client";

const NOW = () => new Date("2026-07-15T08:00:00Z"); // Wednesday

interface StubOpts {
  searchHits?: unknown[];
  byId?: { id: string; name: string } | null;
}

function crmStub(opts: StubOpts = {}) {
  const calls: Array<{ document: string; variables?: Record<string, unknown> }> = [];
  const crm: CrmClient = {
    baseUrl: "https://crm.example",
    query: vi.fn(async (document: string, variables?: Record<string, unknown>) => {
      calls.push({ document, variables });
      if (document.includes("globalSearch")) return { globalSearch: opts.searchHits ?? [] };
      if (document.includes("ReferralPartnerById")) return { partner: opts.byId ?? null };
      if (document.includes("createPartner")) return { createPartner: { id: "p-new", name: (variables?.input as { name: string }).name } };
      if (document.includes("updatePartner")) return { updatePartner: { id: "p1", name: "Acme Advisory" } };
      if (document.includes("createTask")) return { createTask: { id: "task1", title: (variables?.input as { title: string }).title, dueAt: "2026-07-20T08:00:00.000Z" } };
      if (document.includes("logActivity")) return { logActivity: { id: "a1" } };
      throw new Error(`unexpected: ${document.slice(0, 60)}`);
    }) as CrmClient["query"],
  };
  return { crm, calls };
}

const BASE = {
  introduced: "Busoga Foods",
  reason: "Partner introduced them at the Nairobi forum",
  confirmed: true as const,
};

describe("record_introduction", () => {
  it("create_new: creates the partner and files the review task — NEVER a mandate", async () => {
    const { crm, calls } = crmStub();
    const out = await new RecordIntroductionTool({ crm, now: NOW }).execute({
      ...BASE,
      partner: "Acme Advisory",
      partnerAction: "create_new",
    });
    expect(out.status).toBe("ok");
    if (out.status !== "ok") return;
    expect(out.partner).toMatchObject({ created: true });
    expect(out.reviewTask.title).toBe("Review referral introduction: Busoga Foods (introduced by Acme Advisory)");
    // The structural guarantee: no mandate/transaction creation, ever.
    for (const call of calls) {
      expect(call.document).not.toContain("createMandate");
      expect(call.document).not.toContain("createTransaction");
    }
    // Without a linked deal, the audit note has nowhere to attach.
    expect(out.auditLogged).toBe(false);
  });

  it("create_new with similar existing partners returns possible_duplicate until createAnyway", async () => {
    const hits = [{ id: "p1", type: "Partner", title: "Acme Advisory Kenya", subtitle: null, href: "/partners/p1" }];
    const { crm } = crmStub({ searchHits: hits });
    const out = await new RecordIntroductionTool({ crm, now: NOW }).execute({
      ...BASE,
      partner: "Acme Advisory",
      partnerAction: "create_new",
    });
    expect(out.status).toBe("possible_duplicate");

    const retry = await new RecordIntroductionTool({ crm: crmStub({ searchHits: hits }).crm, now: NOW }).execute({
      ...BASE,
      partner: "Acme Advisory",
      partnerAction: "create_new",
      createAnyway: true,
    });
    expect(retry.status).toBe("ok");
  });

  it("use_existing: updates the matched partner (echoing name) and files the task", async () => {
    const { crm, calls } = crmStub({
      searchHits: [{ id: "p1", type: "Partner", title: "Acme Advisory", subtitle: null, href: "/partners/p1" }],
    });
    const out = await new RecordIntroductionTool({ crm, now: NOW }).execute({
      ...BASE,
      partner: "Acme Advisory",
      partnerAction: "use_existing",
      partnerFields: { email: "intro@acme.example" },
    });
    expect(out.status).toBe("ok");
    if (out.status !== "ok") return;
    expect(out.partner).toMatchObject({ id: "p1", created: false });
    const update = calls.find((c) => c.document.includes("updatePartner"));
    expect(update?.variables?.input).toMatchObject({ name: "Acme Advisory", email: "intro@acme.example" });
  });

  it("use_existing with no match returns partner_not_found (no create fallthrough)", async () => {
    const { crm, calls } = crmStub();
    const out = await new RecordIntroductionTool({ crm, now: NOW }).execute({
      ...BASE,
      partner: "Ghost Partner",
      partnerAction: "use_existing",
    });
    expect(out.status).toBe("partner_not_found");
    expect(calls.some((c) => c.document.includes("createPartner"))).toBe(false);
  });

  it("attaches deal FKs to the task and audit note only when existingDealId is given", async () => {
    const { crm, calls } = crmStub({
      searchHits: [{ id: "p1", type: "Partner", title: "Acme Advisory", subtitle: null, href: "/partners/p1" }],
    });
    const out = await new RecordIntroductionTool({ crm, now: NOW }).execute({
      ...BASE,
      partner: "Acme Advisory",
      partnerAction: "use_existing",
      existingDealId: "m9",
      existingDealType: "mandate",
    });
    expect(out.status).toBe("ok");
    if (out.status !== "ok") return;
    expect(out.auditLogged).toBe(true);
    const task = calls.find((c) => c.document.includes("createTask"));
    expect(task?.variables?.input).toMatchObject({ mandateId: "m9" });
    const log = calls.find((c) => c.document.includes("logActivity"));
    expect(log?.variables?.input).toMatchObject({ mandateId: "m9" });
  });

  it("always links the review task to the partner — with and without a deal FK (spec §3.8)", async () => {
    // Fresh intro, no deal: partnerId is the task's only link — this is what
    // used to make createTask fail perpetually ("partial success" QA HIGH).
    const fresh = crmStub();
    await new RecordIntroductionTool({ crm: fresh.crm, now: NOW }).execute({
      ...BASE,
      partner: "Acme Advisory",
      partnerAction: "create_new",
    });
    const freshTask = fresh.calls.find((c) => c.document.includes("createTask"));
    expect(freshTask?.variables?.input).toMatchObject({ partnerId: "p-new" });

    // Intro concerning an existing deal: both links present.
    const withDeal = crmStub({
      searchHits: [{ id: "p1", type: "Partner", title: "Acme Advisory", subtitle: null, href: "/partners/p1" }],
    });
    await new RecordIntroductionTool({ crm: withDeal.crm, now: NOW }).execute({
      ...BASE,
      partner: "Acme Advisory",
      partnerAction: "use_existing",
      existingDealId: "m9",
      existingDealType: "mandate",
    });
    const dealTask = withDeal.calls.find((c) => c.document.includes("createTask"));
    expect(dealTask?.variables?.input).toMatchObject({ partnerId: "p1", mandateId: "m9" });
  });

  it("rejects existingDealId without existingDealType", async () => {
    const { crm } = crmStub();
    const out = await new RecordIntroductionTool({ crm, now: NOW }).execute({
      ...BASE,
      partner: "Acme Advisory",
      partnerAction: "create_new",
      existingDealId: "m9",
    });
    expect(out.status).toBe("rejected");
  });

  it("review task lands 3 business days out", async () => {
    const { crm, calls } = crmStub();
    await new RecordIntroductionTool({ crm, now: NOW }).execute({
      ...BASE,
      partner: "Acme Advisory",
      partnerAction: "create_new",
    });
    const task = calls.find((c) => c.document.includes("createTask"));
    // Wed 2026-07-15 + 3 business days = Mon 2026-07-20.
    expect((task?.variables?.input as { dueAt: string }).dueAt).toBe("2026-07-20T08:00:00.000Z");
  });
});
