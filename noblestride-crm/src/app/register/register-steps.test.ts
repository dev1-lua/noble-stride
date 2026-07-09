import { describe, it, expect } from "vitest";
import { validateStep, EMPTY_WIZARD_VALUES, STEP_FIELDS, STEP_COUNT } from "./register-steps";

const filled = {
  fundName: "Savannah Growth Partners",
  contactPerson: "Ada Obi",
  email: "ada@savannah.com",
  phone: "+254700111222",
  investorType: "PrivateEquity",
  sectorPreference: ["Technology"],
  dealType: "Equity",
  dealSizeBand: "1m-5m",
};

describe("wizard step config", () => {
  it("has 5 input steps + a review step", () => {
    expect(STEP_FIELDS.length).toBe(5);
    expect(STEP_COUNT).toBe(6);
  });
});

describe("validateStep", () => {
  it("step 0 (fund name) rejects empty, accepts filled", () => {
    expect(validateStep(0, EMPTY_WIZARD_VALUES).ok).toBe(false);
    expect(validateStep(0, { ...EMPTY_WIZARD_VALUES, fundName: "X" }).ok).toBe(true);
  });

  it("step 1 (contact) rejects a free-provider email with a field error", () => {
    const res = validateStep(1, { ...filled, email: "ada@gmail.com" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.email).toMatch(/corporate email/i);
  });

  it("step 1 accepts a corporate email", () => {
    expect(validateStep(1, filled).ok).toBe(true);
  });

  it("step 3 (sectors) requires at least one sector", () => {
    expect(validateStep(3, { ...filled, sectorPreference: [] }).ok).toBe(false);
    expect(validateStep(3, filled).ok).toBe(true);
  });

  it("step 4 (deal prefs) validates type + band together", () => {
    expect(validateStep(4, { ...filled, dealSizeBand: "" }).ok).toBe(false);
    expect(validateStep(4, filled).ok).toBe(true);
  });

  it("review step (index 5) has nothing to validate", () => {
    expect(validateStep(5, EMPTY_WIZARD_VALUES).ok).toBe(true);
  });
});
