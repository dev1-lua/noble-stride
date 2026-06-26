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
    const r = investorCreateSchema.safeParse({
      name: "Test Fund",
      investorType: "PrivateEquity",
      engagementClassification: "Greylisted",
      minRevenue: 5,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.engagementClassification).toBe("Greylisted");
      expect(r.data.minRevenue).toBe(5);
    }
  });

  it("mandate: requires name and clientId", () => {
    expect(mandateCreateSchema.safeParse({ name: "M" }).success).toBe(false);
    expect(mandateCreateSchema.safeParse({ name: "M", clientId: "c1" }).success).toBe(true);
  });

  it("partner: accepts name only", () => {
    expect(partnerCreateSchema.safeParse({ name: "Bowmans" }).success).toBe(true);
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
