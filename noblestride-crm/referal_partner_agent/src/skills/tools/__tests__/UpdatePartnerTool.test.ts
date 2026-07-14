import { describe, it, expect, vi } from "vitest";
import { UpdatePartnerTool } from "../UpdatePartnerTool";
import type { CrmClient } from "../../../lib/crm-client";

interface PartnerState {
  feeSharingAgreement?: boolean;
  feeSharingTerms?: string | null;
  referredMandates?: Array<{ id: string }>;
  referredTransactions?: Array<{ id: string }>;
}

function crmStub(state: PartnerState = {}) {
  const calls: Array<{ document: string; variables?: Record<string, unknown> }> = [];
  const crm: CrmClient = {
    baseUrl: "https://crm.example",
    query: vi.fn(async (document: string, variables?: Record<string, unknown>) => {
      calls.push({ document, variables });
      if (document.includes("ReferralPartnerDetail")) {
        return {
          partner: {
            id: "p1",
            name: "Acme Advisory",
            feeSharingAgreement: state.feeSharingAgreement ?? false,
            feeSharingTerms: state.feeSharingTerms ?? null,
            partnerAgreementStatus: "None",
            referredMandates: state.referredMandates ?? [],
            referredTransactions: state.referredTransactions ?? [],
          },
        };
      }
      if (document.includes("updatePartner")) return { updatePartner: { id: "p1", ...(variables?.input as object) } };
      if (document.includes("logActivity")) return { logActivity: { id: "a1" } };
      throw new Error(`unexpected: ${document.slice(0, 60)}`);
    }) as CrmClient["query"],
  };
  return { crm, calls };
}

const BASE = { partnerId: "p1", reason: "test", confirmed: true as const };

describe("update_partner", () => {
  it("echoes the existing name into PartnerInput (required even on update)", async () => {
    const { crm, calls } = crmStub();
    const out = await new UpdatePartnerTool({ crm }).execute({ ...BASE, set: { status: "Preferred" } });
    expect(out.status).toBe("ok");
    const update = calls.find((c) => c.document.includes("updatePartner"));
    expect(update?.variables?.input).toEqual({ name: "Acme Advisory", status: "Preferred" });
  });

  it("recording the agreement itself is allowed (that's how staff satisfy the fee guard)", async () => {
    const { crm } = crmStub();
    const out = await new UpdatePartnerTool({ crm }).execute({
      ...BASE,
      set: { feeSharingAgreement: true, partnerAgreementStatus: "Signed", feeSharingTerms: "2% of closed value" },
    });
    expect(out.status).toBe("ok");
    if (out.status === "ok") expect(out.warning).toBeUndefined();
  });

  it("warns when agreement is set true without terms (merged state)", async () => {
    const { crm } = crmStub({ feeSharingTerms: null });
    const out = await new UpdatePartnerTool({ crm }).execute({ ...BASE, set: { feeSharingAgreement: true } });
    expect(out.status).toBe("ok");
    if (out.status === "ok") expect(out.warning).toContain("feeSharingTerms");
  });

  it("anchors the audit note to a referred deal when one exists", async () => {
    const { crm, calls } = crmStub({ referredMandates: [{ id: "m1" }] });
    const out = await new UpdatePartnerTool({ crm }).execute({ ...BASE, set: { status: "Inactive" } });
    expect(out.status).toBe("ok");
    if (out.status === "ok") expect(out.auditLogged).toBe(true);
    const log = calls.find((c) => c.document.includes("logActivity"));
    expect(log?.variables?.input).toMatchObject({ mandateId: "m1" });
  });

  it("reports auditLogged: false honestly when the partner has no referred deals", async () => {
    const { crm, calls } = crmStub();
    const out = await new UpdatePartnerTool({ crm }).execute({ ...BASE, set: { status: "Inactive" } });
    expect(out.status).toBe("ok");
    if (out.status === "ok") expect(out.auditLogged).toBe(false);
    expect(calls.some((c) => c.document.includes("logActivity"))).toBe(false);
  });
});
