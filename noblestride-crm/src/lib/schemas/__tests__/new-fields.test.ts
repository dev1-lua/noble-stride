// Aug-2026 feedback: the fields added to the deal schemas (F4.2.1 advisory
// classification + fee paid, F4.3.1 retainer paid, F4.1.x workflow template).

import { describe, it, expect } from "vitest";
import { advisoryCreateSchema, advisoryUpdateSchema } from "@/lib/schemas/advisory";
import { mandateCreateSchema, mandateUpdateSchema } from "@/lib/schemas/mandate";
import { transactionUpdateSchema } from "@/lib/schemas/transaction";

const advisory = (over: Record<string, unknown> = {}) => ({ name: "A", clientId: "c1", ...over });
const mandate = (over: Record<string, unknown> = {}) => ({ name: "M", clientId: "c1", ...over });

describe("advisory classification (F4.2.1)", () => {
  it("accepts every AdvisoryClassification value", () => {
    for (const c of ["Valuation", "DueDiligence", "BusinessPlanPitchDeck", "FinancialModel", "AdvisorySupport", "Other"]) {
      expect(advisoryCreateSchema.parse(advisory({ classification: c })).classification).toBe(c);
    }
  });
  it("is clearable to null and omittable", () => {
    expect(advisoryCreateSchema.parse(advisory({ classification: null })).classification).toBeNull();
    expect(advisoryCreateSchema.parse(advisory()).classification).toBeUndefined();
  });
  it("rejects an unknown classification", () => {
    expect(advisoryCreateSchema.safeParse(advisory({ classification: "PitchDeck" })).success).toBe(false);
    expect(advisoryUpdateSchema.safeParse({ classification: "nope" }).success).toBe(false);
  });
});

describe("fee paid / retainer paid amounts (F4.2.1 / F4.3.1)", () => {
  it("accepts a non-negative amount", () => {
    expect(advisoryCreateSchema.parse(advisory({ feeAmount: 10_000, feePaidAmount: 2_500 })).feePaidAmount).toBe(2_500);
    expect(mandateCreateSchema.parse(mandate({ retainerAmount: 50_000, retainerPaidAmount: 20_000 })).retainerPaidAmount).toBe(20_000);
    expect(mandateCreateSchema.parse(mandate({ retainerPaidAmount: 0 })).retainerPaidAmount).toBe(0);
  });
  it("rejects a negative amount", () => {
    expect(advisoryCreateSchema.safeParse(advisory({ feePaidAmount: -1 })).success).toBe(false);
    expect(mandateCreateSchema.safeParse(mandate({ retainerPaidAmount: -0.01 })).success).toBe(false);
    expect(mandateUpdateSchema.safeParse({ retainerPaidAmount: -100 }).success).toBe(false);
  });
});

describe("per-deal workflow template (F4.1.x)", () => {
  it("accepts an id, a null (clear) and omission on all three deal kinds", () => {
    expect(mandateUpdateSchema.parse({ workflowTemplateId: "t1" }).workflowTemplateId).toBe("t1");
    expect(mandateUpdateSchema.parse({ workflowTemplateId: null }).workflowTemplateId).toBeNull();
    expect(transactionUpdateSchema.parse({ workflowTemplateId: "t1" }).workflowTemplateId).toBe("t1");
    expect(advisoryUpdateSchema.parse({ workflowTemplateId: null }).workflowTemplateId).toBeNull();
    expect(advisoryUpdateSchema.parse({}).workflowTemplateId).toBeUndefined();
  });
});
