import { describe, it, expect } from "vitest";
import { workflowStepSchema, workflowTemplateSaveSchema, slugKey } from "@/lib/schemas/workflow";

const step = (over: Record<string, unknown> = {}) => ({
  key: "ndaSigned",
  title: "NDA Signed",
  phase: "Qualify",
  description: null,
  appliesTo: [],
  ...over,
});

describe("slugKey", () => {
  it("camelCases a title", () => {
    expect(slugKey("Deliverables handover")).toBe("deliverablesHandover");
    expect(slugKey("NDA Signed")).toBe("ndaSigned");
    expect(slugKey("Term Sheet / Transaction Progression")).toBe("termSheetTransactionProgression");
    expect(slugKey("  Internal   Review  ")).toBe("internalReview");
  });
  it("de-duplicates numerically against existing keys", () => {
    expect(slugKey("Internal Review", ["internalReview"])).toBe("internalReview2");
    expect(slugKey("Internal Review", ["internalReview", "internalReview2"])).toBe("internalReview3");
    expect(slugKey("Internal Review", ["somethingElse"])).toBe("internalReview");
  });
  it("always yields a schema-valid key, even from junk", () => {
    for (const title of ["", "   ", "123", "!!!", "4A Short-term"]) {
      const k = slugKey(title);
      expect(workflowStepSchema.safeParse(step({ key: k })).success).toBe(true);
    }
  });
});

describe("workflowStepSchema", () => {
  it("accepts a well-formed step", () => {
    expect(workflowStepSchema.parse(step())).toMatchObject({ key: "ndaSigned", phase: "Qualify", appliesTo: [] });
  });
  it("defaults appliesTo to []", () => {
    const parsed = workflowStepSchema.parse({ key: "x1", title: "X", phase: "Execute" });
    expect(parsed.appliesTo).toEqual([]);
    expect(parsed.description ?? null).toBeNull();
  });
  it("rejects bad keys", () => {
    for (const key of ["", "A", "1abc", "Nda Signed", "nda-signed", "nda_signed", "a", "a".repeat(50) + "x"]) {
      expect(workflowStepSchema.safeParse(step({ key })).success).toBe(false);
    }
  });
  it("rejects a blank or over-long title and an over-long description", () => {
    expect(workflowStepSchema.safeParse(step({ title: "" })).success).toBe(false);
    expect(workflowStepSchema.safeParse(step({ title: "t".repeat(81) })).success).toBe(false);
    expect(workflowStepSchema.safeParse(step({ description: "d".repeat(401) })).success).toBe(false);
    expect(workflowStepSchema.safeParse(step({ description: "d".repeat(400) })).success).toBe(true);
  });
  it("rejects an unknown phase or deal kind", () => {
    expect(workflowStepSchema.safeParse(step({ phase: "Closing" })).success).toBe(false);
    expect(workflowStepSchema.safeParse(step({ appliesTo: ["Mandate", "Nope"] })).success).toBe(false);
    expect(workflowStepSchema.safeParse(step({ appliesTo: ["Advisory"] })).success).toBe(true);
  });
});

describe("workflowTemplateSaveSchema", () => {
  it("accepts a named template with steps", () => {
    const parsed = workflowTemplateSaveSchema.parse({ name: "Advisory assignment", steps: [step(), step({ key: "a2", title: "Second" })] });
    expect(parsed.steps).toHaveLength(2);
  });
  it("requires a name and at least one step, capping at 40", () => {
    expect(workflowTemplateSaveSchema.safeParse({ name: "", steps: [step()] }).success).toBe(false);
    expect(workflowTemplateSaveSchema.safeParse({ name: "n".repeat(81), steps: [step()] }).success).toBe(false);
    expect(workflowTemplateSaveSchema.safeParse({ name: "ok", steps: [] }).success).toBe(false);
    const many = Array.from({ length: 41 }, (_, i) => step({ key: `k${i}a`, title: `S${i}` }));
    expect(workflowTemplateSaveSchema.safeParse({ name: "ok", steps: many }).success).toBe(false);
  });
  it("rejects duplicate step keys with a clear message", () => {
    const r = workflowTemplateSaveSchema.safeParse({ name: "ok", steps: [step(), step()] });
    expect(r.success).toBe(false);
    if (!r.success) expect(JSON.stringify(r.error.issues)).toMatch(/unique/i);
  });
});
