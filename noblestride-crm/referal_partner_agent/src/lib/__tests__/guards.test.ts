import { describe, it, expect } from "vitest";
import { hasRecordedAgreement, checkFeeGuard, type PartnerAgreementFields } from "../guards";

function partner(overrides: Partial<PartnerAgreementFields> = {}): PartnerAgreementFields {
  return {
    name: "Acme Advisory",
    feeSharingAgreement: true,
    feeSharingTerms: "2% of closed value",
    partnerAgreementStatus: "Signed",
    ...overrides,
  };
}

describe("hasRecordedAgreement", () => {
  it("requires BOTH the flag and a Signed status", () => {
    expect(hasRecordedAgreement(partner())).toBe(true);
    expect(hasRecordedAgreement(partner({ feeSharingAgreement: false }))).toBe(false);
    expect(hasRecordedAgreement(partner({ partnerAgreementStatus: "Sent" }))).toBe(false);
    expect(hasRecordedAgreement(partner({ partnerAgreementStatus: "None" }))).toBe(false);
  });
});

describe("checkFeeGuard", () => {
  it("allows fee writes when the agreement is recorded", () => {
    const verdict = checkFeeGuard(partner(), { partnerFeeStatus: "Due", partnerFeeAmount: 10_000 });
    expect(verdict.allowed).toBe(true);
    if (verdict.allowed) expect(verdict.warning).toBeUndefined();
  });

  it("refuses marking a fee owed without a recorded agreement", () => {
    for (const p of [
      partner({ feeSharingAgreement: false }),
      partner({ partnerAgreementStatus: "Sent" }),
      partner({ partnerAgreementStatus: "None" }),
    ]) {
      const verdict = checkFeeGuard(p, { partnerFeeStatus: "Due" });
      expect(verdict.allowed).toBe(false);
      if (!verdict.allowed) expect(verdict.message).toContain("update_partner");
    }
  });

  it("refuses an amount write too — an amount implies a fee is owed", () => {
    expect(checkFeeGuard(partner({ feeSharingAgreement: false }), { partnerFeeAmount: 5000 }).allowed).toBe(false);
  });

  it("allows resetting to NotDue with no amount regardless of agreement", () => {
    expect(checkFeeGuard(partner({ feeSharingAgreement: false }), { partnerFeeStatus: "NotDue" }).allowed).toBe(true);
    expect(checkFeeGuard(null, { partnerFeeStatus: "NotDue" }).allowed).toBe(true);
  });

  it("refuses when the deal has no referring partner at all", () => {
    const verdict = checkFeeGuard(null, { partnerFeeStatus: "Due" });
    expect(verdict.allowed).toBe(false);
    if (!verdict.allowed) expect(verdict.message).toContain("link_partner_to_deal");
  });

  it("warns (does not block) when the signed agreement has no terms", () => {
    const verdict = checkFeeGuard(partner({ feeSharingTerms: null }), { partnerFeeStatus: "Invoiced" });
    expect(verdict.allowed).toBe(true);
    if (verdict.allowed) expect(verdict.warning).toContain("no terms");
    const blank = checkFeeGuard(partner({ feeSharingTerms: "  " }), { partnerFeeAmount: 1 });
    expect(blank.allowed).toBe(true);
    if (blank.allowed) expect(blank.warning).toBeDefined();
  });
});
