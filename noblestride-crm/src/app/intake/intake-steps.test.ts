import { describe, it, expect } from "vitest";
import { validateStep, EMPTY_INTAKE_VALUES, STEP_FIELDS, STEP_COUNT, needsLoanBook } from "./intake-steps";
import type { IntakeWizardValues } from "./intake-steps";

const filled: IntakeWizardValues = {
  legalName: "Savannah Foods Ltd",
  registrationNo: "CR10/12345",
  country: "EastAfrica",
  sectors: ["Agribusiness"],
  yearFounded: "2015",
  website: "https://savannahfoods.example.com",
  pitchDeckUrl: "",
  contactName: "Ada Obi",
  role: "CFO",
  email: "ada@savannahfoods.com",
  phone: "+254700111222",
  revenueUsd: "2500000",
  ebitdaUsd: "300000",
  netProfitUsd: "150000",
  totalAssetsUsd: "4000000",
  auditedYears: "3",
  loanBookUsd: "",
  raiseUsd: "1500000",
  instrument: "Equity",
  useOfFunds: "Working capital and plant expansion",
  proposedTimeline: "Close within 6 months",
  ownershipSummary: "100% held by founders",
  pepExposure: "no",
  governmentOwned: "no",
  existingDebtUsd: "",
};

describe("intake wizard step config", () => {
  it("has 5 input steps + a review step", () => {
    expect(STEP_FIELDS.length).toBe(5);
    expect(STEP_COUNT).toBe(6);
  });
});

describe("validateStep", () => {
  it("step 0 (company basics) rejects empty, accepts filled", () => {
    expect(validateStep(0, EMPTY_INTAKE_VALUES).ok).toBe(false);
    expect(validateStep(0, filled).ok).toBe(true);
  });

  it("step 1 (contact) rejects a free-provider email with a field error", () => {
    const res = validateStep(1, { ...filled, email: "ada@gmail.com" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.email).toMatch(/corporate email/i);
  });

  it("step 1 accepts a corporate email", () => {
    expect(validateStep(1, filled).ok).toBe(true);
  });

  it("step 2 (financial snapshot) requires the core figures", () => {
    expect(validateStep(2, { ...filled, revenueUsd: "" }).ok).toBe(false);
    expect(validateStep(2, filled).ok).toBe(true);
  });

  it("step 2 (financial snapshot) allows zero/negative EBITDA and net profit, but still requires them", () => {
    expect(
      validateStep(2, { ...filled, ebitdaUsd: "-50000", netProfitUsd: "0" }).ok,
    ).toBe(true);
    expect(validateStep(2, { ...filled, ebitdaUsd: "" }).ok).toBe(false);
  });

  it("step 2 requires loanBookUsd once a lending sector is selected, not otherwise", () => {
    const lendingRes = validateStep(2, { ...filled, sectors: ["Banking"], loanBookUsd: "" });
    expect(lendingRes.ok).toBe(false);
    if (!lendingRes.ok) expect(lendingRes.errors.loanBookUsd).toMatch(/loan book/i);

    expect(validateStep(2, { ...filled, sectors: ["Banking"], loanBookUsd: "500000" }).ok).toBe(true);
    expect(validateStep(2, { ...filled, sectors: ["Agribusiness"], loanBookUsd: "" }).ok).toBe(true);
  });

  it("step 3 (funding need) validates instrument + amount together", () => {
    expect(validateStep(3, { ...filled, raiseUsd: "" }).ok).toBe(false);
    expect(validateStep(3, { ...filled, instrument: "" }).ok).toBe(false);
    expect(validateStep(3, filled).ok).toBe(true);
  });

  it("step 4 (ownership & compliance) requires pep/government answers", () => {
    expect(validateStep(4, { ...filled, pepExposure: "" }).ok).toBe(false);
    expect(validateStep(4, filled).ok).toBe(true);
  });

  it("review step (index 5) has nothing to validate", () => {
    expect(validateStep(5, EMPTY_INTAKE_VALUES).ok).toBe(true);
  });
});

describe("needsLoanBook", () => {
  it("is true for FinancialServices/Banking, false otherwise", () => {
    expect(needsLoanBook(["FinancialServices"])).toBe(true);
    expect(needsLoanBook(["Banking"])).toBe(true);
    expect(needsLoanBook(["Agribusiness"])).toBe(false);
    expect(needsLoanBook([])).toBe(false);
  });
});
