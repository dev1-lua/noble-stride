import { describe, it, expect, vi } from "vitest";
import { UpdateFeeStatusTool } from "../UpdateFeeStatusTool";
import type { CrmClient } from "../../../lib/crm-client";

/** Hermetic staff stub — without it the in-tool guard calls the live Lua API. */
const STAFF = async () => true;

const TXN_HIT = { id: "t1", type: "Transaction", title: "Busoga Raise", subtitle: null, href: "/transactions/t1" };

interface Originator {
  id: string;
  name: string;
  feeSharingAgreement: boolean;
  feeSharingTerms?: string | null;
  partnerAgreementStatus: string;
}

function crmStub(opts: { referredBy?: Originator | null; mandateReferredBy?: Originator | null } = {}) {
  const calls: Array<{ document: string; variables?: Record<string, unknown> }> = [];
  const crm: CrmClient = {
    baseUrl: "https://crm.example",
    query: vi.fn(async (document: string, variables?: Record<string, unknown>) => {
      calls.push({ document, variables });
      if (document.includes("globalSearch")) return { globalSearch: [TXN_HIT] };
      if (document.includes("ReferralTransactionStatus")) {
        return {
          transaction: {
            id: "t1",
            name: "Busoga Raise",
            clientId: "c1",
            partnerFeeStatus: "NotDue",
            partnerFeeAmount: null,
            referredBy: opts.referredBy ?? null,
            mandate: opts.mandateReferredBy !== undefined ? { referredBy: opts.mandateReferredBy } : null,
          },
        };
      }
      if (document.includes("updateTransaction")) return { updateTransaction: { id: "t1", partnerFeeStatus: "Due" } };
      if (document.includes("logActivity")) return { logActivity: { id: "a1" } };
      throw new Error(`unexpected: ${document.slice(0, 60)}`);
    }) as CrmClient["query"],
  };
  return { crm, calls };
}

const SIGNED: Originator = {
  id: "p1",
  name: "Acme Advisory",
  feeSharingAgreement: true,
  feeSharingTerms: "2% of closed value",
  partnerAgreementStatus: "Signed",
};

const UNSIGNED: Originator = { ...SIGNED, partnerAgreementStatus: "Sent" };

const BASE = {
  transaction: "Busoga Raise",
  set: { partnerFeeStatus: "Due" as const },
  reason: "Deal closed, fee now due",
  confirmed: true as const,
};

describe("update_fee_status", () => {
  it("refuses without a recorded agreement — and tells staff how to record one", async () => {
    const { crm, calls } = crmStub({ referredBy: UNSIGNED });
    const out = await new UpdateFeeStatusTool({ isStaff: STAFF, crm }).execute(BASE);
    expect(out.status).toBe("refused");
    if (out.status === "refused") expect(out.message).toContain("update_partner");
    expect(calls.some((c) => c.document.includes("updateTransaction"))).toBe(false);
  });

  it("refuses when the deal has no originator at all", async () => {
    const { crm } = crmStub({ referredBy: null, mandateReferredBy: null });
    const out = await new UpdateFeeStatusTool({ isStaff: STAFF, crm }).execute(BASE);
    expect(out.status).toBe("refused");
    if (out.status === "refused") expect(out.message).toContain("link_partner_to_deal");
  });

  it("writes the fee with a signed agreement, echoing name/clientId", async () => {
    const { crm, calls } = crmStub({ referredBy: SIGNED });
    const out = await new UpdateFeeStatusTool({ isStaff: STAFF, crm }).execute({
      ...BASE,
      set: { partnerFeeStatus: "Due", partnerFeeAmount: 40_000 },
    });
    expect(out.status).toBe("ok");
    if (out.status !== "ok") return;
    expect(out.partner).toEqual({ id: "p1", name: "Acme Advisory" });
    expect(out.previous).toEqual({ partnerFeeStatus: "NotDue", partnerFeeAmount: null });
    const update = calls.find((c) => c.document.includes("updateTransaction"));
    expect(update?.variables?.input).toEqual({
      name: "Busoga Raise",
      clientId: "c1",
      partnerFeeStatus: "Due",
      partnerFeeAmount: 40_000,
    });
    expect(out.auditLogged).toBe(true);
  });

  it("falls back to the parent mandate's referrer when the transaction has none", async () => {
    const { crm } = crmStub({ referredBy: null, mandateReferredBy: SIGNED });
    const out = await new UpdateFeeStatusTool({ isStaff: STAFF, crm }).execute(BASE);
    expect(out.status).toBe("ok");
    if (out.status === "ok") expect(out.partner?.name).toBe("Acme Advisory");
  });

  it("surfaces the no-terms warning on an otherwise allowed write", async () => {
    const { crm } = crmStub({ referredBy: { ...SIGNED, feeSharingTerms: null } });
    const out = await new UpdateFeeStatusTool({ isStaff: STAFF, crm }).execute(BASE);
    expect(out.status).toBe("ok");
    if (out.status === "ok") expect(out.warning).toContain("no terms");
  });
});
