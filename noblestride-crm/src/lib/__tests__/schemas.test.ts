import { describe, it, expect } from "vitest";
import { investorCreateSchema } from "@/lib/schemas/investor";
import { mandateCreateSchema } from "@/lib/schemas/mandate";
import { partnerCreateSchema } from "@/lib/schemas/partner";
import { serviceProviderCreateSchema } from "@/lib/schemas/service-provider";
import { clientCreateSchema } from "@/lib/schemas/client";
import { transactionCreateSchema } from "@/lib/schemas/transaction";
import { taskCreateSchema } from "@/lib/schemas/task";

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

  it("investor schema accepts onboarding fields", () => {
    const parsed = investorCreateSchema.parse({
      name: "Fund X",
      investorType: "PrivateEquity",
      onboardingStatus: "PendingReview",
      registeredAt: new Date("2026-07-05"),
    });
    expect(parsed.onboardingStatus).toBe("PendingReview");
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

  it("client: spec-gap fields survive Zod parse (not stripped)", () => {
    const r = clientCreateSchema.safeParse({
      name: "Acme Foods",
      codename: "Project Falcon",
      registrationNo: "CR12/2024/000123",
      hqCountry: "Kenya",
      businessModel: "B2B distribution",
      foundersNationality: "Kenyan",
      ownershipStructure: "Founder-owned",
      directorsManagement: "2 EDs, 1 NED",
      targetClients: "Mid-market retailers",
      staffCount: 120,
      branchCount: 8,
      ebitda: 500000,
      netProfit: 250000,
      existingDebt: 100000,
      loanBook: 750000,
      totalAssets: 2000000,
      impactFlags: ["WomenLed", "YouthLed"],
      status: "Active",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.codename).toBe("Project Falcon");
      expect(r.data.registrationNo).toBe("CR12/2024/000123");
      expect(r.data.hqCountry).toBe("Kenya");
      expect(r.data.staffCount).toBe(120);
      expect(r.data.branchCount).toBe(8);
      expect(r.data.ebitda).toBe(500000);
      expect(r.data.netProfit).toBe(250000);
      expect(r.data.existingDebt).toBe(100000);
      expect(r.data.loanBook).toBe(750000);
      expect(r.data.totalAssets).toBe(2000000);
      expect(r.data.impactFlags).toEqual(["WomenLed", "YouthLed"]);
      expect(r.data.status).toBe("Active");
    }
  });

  it("client: strips unknown keys", () => {
    const r = clientCreateSchema.safeParse({ name: "Acme Foods", notAField: "nope" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect((r.data as Record<string, unknown>).notAField).toBeUndefined();
    }
  });

  it("client: rejects a bad ClientStatus enum", () => {
    expect(clientCreateSchema.safeParse({ name: "X", status: "Deleted" }).success).toBe(false);
  });

  it("client: rejects a bad ImpactFlag enum", () => {
    expect(clientCreateSchema.safeParse({ name: "X", impactFlags: ["FounderLed"] }).success).toBe(false);
  });

  it("mandate: accepts dealStatus", () => {
    const r = mandateCreateSchema.safeParse({ name: "M", clientId: "c1", dealStatus: "ClosedReopened" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.dealStatus).toBe("ClosedReopened");
  });

  it("mandate: rejects a bad DealStatus enum", () => {
    expect(mandateCreateSchema.safeParse({ name: "M", clientId: "c1", dealStatus: "Vanished" }).success).toBe(false);
  });

  it("transaction: spec-gap fields survive Zod parse (not stripped)", () => {
    const r = transactionCreateSchema.safeParse({
      name: "T1",
      clientId: "c1",
      assistantId: "u2",
      dealStatus: "OnHold",
      dealMilestone: "SpaSha",
      financingType: "EquityAndDebt",
      maxSellingStake: "NA",
      targetProfile: "Strategic investor",
      useOfFunds: "Working capital",
      vdrLink: "https://vdr.example.com/deal-1",
      probability: 60,
      notes: "Strong pipeline",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.assistantId).toBe("u2");
      expect(r.data.dealStatus).toBe("OnHold");
      expect(r.data.dealMilestone).toBe("SpaSha");
      expect(r.data.financingType).toBe("EquityAndDebt");
      expect(r.data.maxSellingStake).toBe("NA");
      expect(r.data.targetProfile).toBe("Strategic investor");
      expect(r.data.useOfFunds).toBe("Working capital");
      expect(r.data.vdrLink).toBe("https://vdr.example.com/deal-1");
      expect(r.data.probability).toBe(60);
      expect(r.data.notes).toBe("Strong pipeline");
    }
  });

  it("transaction: strips unknown keys", () => {
    const r = transactionCreateSchema.safeParse({ name: "T1", clientId: "c1", bogus: "nope" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect((r.data as Record<string, unknown>).bogus).toBeUndefined();
    }
  });

  it("transaction: rejects a bad DealMilestone enum", () => {
    expect(transactionCreateSchema.safeParse({ name: "T1", clientId: "c1", dealMilestone: "Handshake" }).success).toBe(false);
  });

  it("task: requires title", () => {
    expect(taskCreateSchema.safeParse({}).success).toBe(false);
    expect(taskCreateSchema.safeParse({ title: "Follow up" }).success).toBe(true);
  });

  it("task: accepts all optional link ids + source + escalated", () => {
    const due = new Date("2026-08-01T00:00:00.000Z");
    const r = taskCreateSchema.safeParse({
      title: "Send teaser",
      status: "Ongoing",
      source: "WhatsApp",
      dueAt: due,
      body: "Follow up with investor",
      assigneeId: "u1",
      assistantId: "u2",
      escalated: true,
      mandateId: "m1",
      transactionId: "t1",
      investorId: "i1",
      clientId: "c1",
      activityId: "a1",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.status).toBe("Ongoing");
      expect(r.data.source).toBe("WhatsApp");
      expect(r.data.dueAt).toEqual(due);
      expect(r.data.assistantId).toBe("u2");
      expect(r.data.escalated).toBe(true);
      expect(r.data.mandateId).toBe("m1");
      expect(r.data.transactionId).toBe("t1");
      expect(r.data.investorId).toBe("i1");
      expect(r.data.clientId).toBe("c1");
      expect(r.data.activityId).toBe("a1");
    }
  });

  it("task: strips unknown keys", () => {
    const r = taskCreateSchema.safeParse({ title: "X", notAField: "nope" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect((r.data as Record<string, unknown>).notAField).toBeUndefined();
    }
  });

  it("task: rejects a bad TaskSource enum", () => {
    expect(taskCreateSchema.safeParse({ title: "X", source: "Fax" }).success).toBe(false);
  });
});
