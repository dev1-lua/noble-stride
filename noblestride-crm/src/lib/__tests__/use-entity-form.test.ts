// Reviewer finding: Task 8's optional enum/boolean fields (Mandate.priority,
// Mandate.referralQualified, Transaction.priority, Transaction.partnerFeeStatus)
// could not be cleared back to unset — buildMutationInput dropped "" instead of
// sending an explicit null. This pins the fix: an opt-in `clearableFields` list
// turns "" into null for named fields only, leaving the default "blank means
// leave unchanged" convention byte-identical for every other field.
import { describe, it, expect } from "vitest";
import { buildMutationInput } from "@/components/ui/use-entity-form";

describe("buildMutationInput — default behavior (no clearableFields)", () => {
  it("drops blank, null and undefined values", () => {
    const out = buildMutationInput({ name: "Acme", dealStatus: "", notes: null, leadId: undefined });
    expect(out).toEqual({ name: "Acme" });
  });

  it("strips id regardless of value", () => {
    const out = buildMutationInput({ id: "abc123", name: "Acme" });
    expect(out).toEqual({ name: "Acme" });
  });

  it("keeps false and 0 (falsy but meaningful) values", () => {
    const out = buildMutationInput({ referralQualified: false, probability: 0 });
    expect(out).toEqual({ referralQualified: false, probability: 0 });
  });

  it("is unaffected by an empty clearableFields array (default path stays identical)", () => {
    const out = buildMutationInput({ name: "Acme", priority: "" }, []);
    expect(out).toEqual({ name: "Acme" });
  });
});

describe("buildMutationInput — clearableFields opt-in", () => {
  it("maps blank to explicit null for a listed field", () => {
    const out = buildMutationInput({ name: "Acme", priority: "" }, ["priority"]);
    expect(out).toEqual({ name: "Acme", priority: null });
  });

  it("still drops blank for fields not in the clearable list", () => {
    const out = buildMutationInput(
      { name: "Acme", priority: "", dealStatus: "" },
      ["priority"],
    );
    expect(out).toEqual({ name: "Acme", priority: null });
  });

  it("handles multiple clearable fields independently", () => {
    const out = buildMutationInput(
      { priority: "", partnerFeeStatus: "", targetProfile: "" },
      ["priority", "partnerFeeStatus"],
    );
    expect(out).toEqual({ priority: null, partnerFeeStatus: null });
  });

  it("still drops real null/undefined for a clearable field (only \"\" triggers a clear)", () => {
    const out = buildMutationInput({ priority: null, referralQualified: undefined }, [
      "priority",
      "referralQualified",
    ]);
    expect(out).toEqual({});
  });

  it("still preserves false for a clearable boolean field", () => {
    const out = buildMutationInput({ referralQualified: false }, ["referralQualified"]);
    expect(out).toEqual({ referralQualified: false });
  });
});
