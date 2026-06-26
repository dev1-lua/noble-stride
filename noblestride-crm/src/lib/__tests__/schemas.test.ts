import { describe, it, expect } from "vitest";
import { investorCreateSchema } from "@/lib/schemas/investor";
import { mandateCreateSchema } from "@/lib/schemas/mandate";
import { partnerCreateSchema } from "@/lib/schemas/partner";
import { serviceProviderCreateSchema } from "@/lib/schemas/service-provider";

describe("entity create schemas", () => {
  it("investor: accepts a minimal valid payload", () => {
    const r = investorCreateSchema.safeParse({ name: "Acme Capital", investorType: "VentureCapital" });
    expect(r.success).toBe(true);
  });

  it("investor: rejects missing name", () => {
    const r = investorCreateSchema.safeParse({ investorType: "VentureCapital" });
    expect(r.success).toBe(false);
  });

  it("investor: rejects a bad enum", () => {
    const r = investorCreateSchema.safeParse({ name: "X", investorType: "NotAType" });
    expect(r.success).toBe(false);
  });

  it("investor: Task-5 fields survive Zod parse (not stripped)", () => {
    const nextAction = new Date("2026-09-01T00:00:00.000Z");
    const r = investorCreateSchema.safeParse({
      name: "Test Fund",
      investorType: "PrivateEquity",
      engagementClassification: "Greylisted",
      ndaStatus: "ClosedNDA",
      minRevenue: 5,
      minEbitda: 2,
      minLoanBook: 100,
      shareholdingPreference: "Minority",
      pricingPreference: "Discount to NAV",
      remainingInvestmentPeriod: "3 years",
      ddRequirements: "Big 4 audit",
      icApprovalProcess: "Two-stage IC",
      trackRecord: "10 exits",
      investmentMandate: "SSA growth equity",
      feedback: "Strong interest",
      nextActionDate: nextAction,
      ssaRegionContactId: "person_123",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.engagementClassification).toBe("Greylisted");
      expect(r.data.ndaStatus).toBe("ClosedNDA");
      expect(r.data.minRevenue).toBe(5);
      expect(r.data.minEbitda).toBe(2);
      expect(r.data.minLoanBook).toBe(100);
      expect(r.data.shareholdingPreference).toBe("Minority");
      expect(r.data.pricingPreference).toBe("Discount to NAV");
      expect(r.data.remainingInvestmentPeriod).toBe("3 years");
      expect(r.data.ddRequirements).toBe("Big 4 audit");
      expect(r.data.icApprovalProcess).toBe("Two-stage IC");
      expect(r.data.trackRecord).toBe("10 exits");
      expect(r.data.investmentMandate).toBe("SSA growth equity");
      expect(r.data.feedback).toBe("Strong interest");
      expect(r.data.nextActionDate).toEqual(nextAction);
      expect(r.data.ssaRegionContactId).toBe("person_123");
    }
  });

  it("mandate: requires name and clientId", () => {
    expect(mandateCreateSchema.safeParse({ name: "M" }).success).toBe(false);
    expect(mandateCreateSchema.safeParse({ name: "M", clientId: "c1" }).success).toBe(true);
  });

  it("partner: accepts name only", () => {
    expect(partnerCreateSchema.safeParse({ name: "Bowmans" }).success).toBe(true);
  });

  it("partner: Task-6 fields survive Zod parse (not stripped)", () => {
    const r = partnerCreateSchema.safeParse({
      name: "Apex Advisory",
      advisorType: "TransactionAdvisor",
      organization: "Apex Group",
      email: "contact@apex.com",
      phone: "+27 11 000 0000",
      feeSharingAgreement: true,
      feeSharingTerms: "2% of deal value",
      partnerAgreementStatus: "Signed",
      internalOnly: false,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.advisorType).toBe("TransactionAdvisor");
      expect(r.data.organization).toBe("Apex Group");
      expect(r.data.email).toBe("contact@apex.com");
      expect(r.data.phone).toBe("+27 11 000 0000");
      expect(r.data.feeSharingAgreement).toBe(true);
      expect(r.data.feeSharingTerms).toBe("2% of deal value");
      expect(r.data.partnerAgreementStatus).toBe("Signed");
      expect(r.data.internalOnly).toBe(false);
    }
  });

  it("serviceProvider: accepts name + type", () => {
    expect(serviceProviderCreateSchema.safeParse({ name: "Bowmans", type: "LawFirm" }).success).toBe(true);
  });

  it("serviceProvider: rejects blank name", () => {
    expect(serviceProviderCreateSchema.safeParse({ name: "  ", type: "LawFirm" }).success).toBe(false);
  });

  it("serviceProvider: rejects a bad enum", () => {
    expect(serviceProviderCreateSchema.safeParse({ name: "X", type: "NotAType" }).success).toBe(false);
  });

  it("serviceProvider: rejects a negative fee", () => {
    expect(serviceProviderCreateSchema.safeParse({ name: "X", type: "LawFirm", fee: -1 }).success).toBe(false);
  });
});
