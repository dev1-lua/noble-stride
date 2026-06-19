import { describe, it, expect } from "vitest";
import { investorCreateSchema } from "@/lib/schemas/investor";
import { mandateCreateSchema } from "@/lib/schemas/mandate";
import { partnerCreateSchema } from "@/lib/schemas/partner";

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

  it("mandate: requires name and clientId", () => {
    expect(mandateCreateSchema.safeParse({ name: "M" }).success).toBe(false);
    expect(mandateCreateSchema.safeParse({ name: "M", clientId: "c1" }).success).toBe(true);
  });

  it("partner: accepts name only", () => {
    expect(partnerCreateSchema.safeParse({ name: "Bowmans" }).success).toBe(true);
  });
});
