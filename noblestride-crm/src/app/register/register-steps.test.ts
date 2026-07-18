import { describe, it, expect } from "vitest";
import { validateStep, EMPTY_WIZARD_VALUES, STEP_FIELDS, STEP_COUNT, type WizardValues } from "./register-steps";

const filled: WizardValues = {
  fundName: "Savannah Growth Partners",
  contactPerson: "Ada Obi",
  email: "ada@savannah.com",
  phone: "+254700111222",
  investorType: "PrivateEquity",
  sectorPreference: ["Technology"],
  geographicFocus: ["EastAfrica"],
  dealTypes: ["Equity"],
  ticketMin: "500000",
  ticketMax: "5000000",
  currency: "USD",
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

  it("step 3 (sectors + geographies) requires at least one of each", () => {
    expect(validateStep(3, { ...filled, sectorPreference: [] }).ok).toBe(false);
    expect(validateStep(3, { ...filled, geographicFocus: [] }).ok).toBe(false);
    expect(validateStep(3, filled).ok).toBe(true);
  });

  it("step 4 (deal prefs) requires deal types, tickets and currency together", () => {
    expect(validateStep(4, { ...filled, dealTypes: [] }).ok).toBe(false);
    expect(validateStep(4, { ...filled, ticketMin: "" }).ok).toBe(false);
    expect(validateStep(4, { ...filled, currency: "" }).ok).toBe(false);
    expect(validateStep(4, filled).ok).toBe(true);
  });

  it("step 4 rejects manual ticket entry where max < min", () => {
    const res = validateStep(4, { ...filled, ticketMin: "5000000", ticketMax: "1000000" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.ticketMax).toMatch(/at least the minimum/i);
  });

  it("step 4 rejects non-positive ticket amounts", () => {
    expect(validateStep(4, { ...filled, ticketMin: "0" }).ok).toBe(false);
    expect(validateStep(4, { ...filled, ticketMax: "-5" }).ok).toBe(false);
  });

  it("review step (index 5) has nothing to validate", () => {
    expect(validateStep(5, EMPTY_WIZARD_VALUES).ok).toBe(true);
  });
});
