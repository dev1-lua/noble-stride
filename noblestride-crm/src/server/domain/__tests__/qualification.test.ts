import { describe, it, expect } from "vitest";
import { qualifyIntake, SSA_GEOGRAPHIES } from "@/server/domain/qualification";
import type { IntakeQualInput } from "@/server/domain/qualification";
import { RESTRICTED_SECTORS } from "@/server/domain/qualification";

// ─── Fixtures ─────────────────────────────────────────────────────────────────
// An input that clears every check on its own so each rule can be isolated by
// overriding only the field(s) under test.

const CURRENT_YEAR = 2026;

const baseInput: IntakeQualInput = {
  revenueUsd: 2_000_000,
  raiseUsd: 2_000_000,
  auditedYears: 4,
  countries: ["EastAfrica"],
  sectors: ["Technology"],
  pepExposure: false,
  governmentOwned: false,
  ebitdaUsd: 100_000,
  yearFounded: CURRENT_YEAR - 10,
  currentYear: CURRENT_YEAR,
};

describe("qualifyIntake — all-pass input", () => {
  it("returns Qualified with an empty reasons array", () => {
    const result = qualifyIntake(baseInput);
    expect(result.verdict).toBe("Qualified");
    expect(result.reasons).toEqual([]);
  });
});

describe("qualifyIntake — deprioritize rules (each in isolation)", () => {
  it("revenue below USD 1M deprioritizes with the reported figure", () => {
    const result = qualifyIntake({ ...baseInput, revenueUsd: 400_000 });
    expect(result.verdict).toBe("Deprioritized");
    expect(result.reasons.some((r) => r.includes("Revenue") && r.includes("400,000"))).toBe(true);
  });

  it("raise below USD 500K deprioritizes with the reported figure", () => {
    const result = qualifyIntake({ ...baseInput, raiseUsd: 300_000 });
    expect(result.verdict).toBe("Deprioritized");
    expect(result.reasons.some((r) => r.includes("Raise") && r.includes("300,000"))).toBe(true);
  });

  it("fewer than 3 audited years deprioritizes", () => {
    const result = qualifyIntake({ ...baseInput, auditedYears: 2 });
    expect(result.verdict).toBe("Deprioritized");
    expect(result.reasons.some((r) => r.toLowerCase().includes("audited"))).toBe(true);
  });

  it("no country in SSA_GEOGRAPHIES deprioritizes", () => {
    const result = qualifyIntake({ ...baseInput, countries: ["Europe"] });
    expect(result.verdict).toBe("Deprioritized");
    expect(result.reasons.some((r) => r.toLowerCase().includes("sub-saharan"))).toBe(true);
  });

  it("an empty countries array deprioritizes (no SSA match, per rule as written)", () => {
    const result = qualifyIntake({ ...baseInput, countries: [] });
    expect(result.verdict).toBe("Deprioritized");
    expect(result.reasons.some((r) => r.toLowerCase().includes("sub-saharan"))).toBe(true);
  });

  it("any restricted sector deprioritizes with one reason per matched sector", () => {
    const result = qualifyIntake({ ...baseInput, sectors: ["Technology", "Mining", "Gambling"] });
    expect(result.verdict).toBe("Deprioritized");
    expect(result.reasons).toContain("Operating in a restricted sector: Mining");
    expect(result.reasons).toContain("Operating in a restricted sector: Gambling");
    expect(result.reasons.filter((r) => r.startsWith("Operating in a restricted sector:"))).toHaveLength(2);
  });

  it("uses the exact existing RESTRICTED_SECTORS constant (does not redefine it)", () => {
    expect(RESTRICTED_SECTORS).toEqual([
      "OilAndGas",
      "Mining",
      "Gambling",
      "Alcohol",
      "Tobacco",
      "RealEstate",
    ]);
  });

  it("pepExposure === true deprioritizes", () => {
    const result = qualifyIntake({ ...baseInput, pepExposure: true });
    expect(result.verdict).toBe("Deprioritized");
    expect(result.reasons.some((r) => r.toLowerCase().includes("pep"))).toBe(true);
  });

  it("governmentOwned === true deprioritizes", () => {
    const result = qualifyIntake({ ...baseInput, governmentOwned: true });
    expect(result.verdict).toBe("Deprioritized");
    expect(result.reasons.some((r) => r.toLowerCase().includes("government"))).toBe(true);
  });

  it("EBITDA at or below zero deprioritizes with the reported figure", () => {
    const result = qualifyIntake({ ...baseInput, ebitdaUsd: 0 });
    expect(result.verdict).toBe("Deprioritized");
    expect(result.reasons.some((r) => r.toLowerCase().includes("ebitda"))).toBe(true);

    const negative = qualifyIntake({ ...baseInput, ebitdaUsd: -50_000 });
    expect(negative.verdict).toBe("Deprioritized");
    expect(negative.reasons.some((r) => r.includes("-50,000") || r.includes("50,000"))).toBe(true);
  });

  it("yearFounded newer than (currentYear - 3) deprioritizes", () => {
    const result = qualifyIntake({ ...baseInput, yearFounded: CURRENT_YEAR - 1 });
    expect(result.verdict).toBe("Deprioritized");
    expect(result.reasons.some((r) => r.toLowerCase().includes("operating history") || r.toLowerCase().includes("founded"))).toBe(true);
  });

  it("yearFounded exactly (currentYear - 2) deprioritizes (adjacent to the boundary)", () => {
    const result = qualifyIntake({ ...baseInput, yearFounded: CURRENT_YEAR - 2 });
    expect(result.verdict).toBe("Deprioritized");
    expect(result.reasons.some((r) => r.toLowerCase().includes("operating history") || r.toLowerCase().includes("founded"))).toBe(true);
  });

  it("yearFounded exactly (currentYear - 3) does NOT deprioritize (boundary)", () => {
    const result = qualifyIntake({ ...baseInput, yearFounded: CURRENT_YEAR - 3 });
    expect(result.verdict).toBe("Qualified");
  });

  it("revenue exactly at USD 1,000,000 does NOT deprioritize (boundary)", () => {
    const result = qualifyIntake({ ...baseInput, revenueUsd: 1_000_000 });
    expect(result.verdict).toBe("Qualified");
  });

  it("auditedYears exactly 3 does NOT deprioritize (boundary)", () => {
    const result = qualifyIntake({ ...baseInput, auditedYears: 3 });
    expect(result.verdict).toBe("Qualified");
  });
});

describe("qualifyIntake — missing numeric data never deprioritizes", () => {
  it("null revenue does not trigger the revenue deprioritize check", () => {
    const result = qualifyIntake({ ...baseInput, revenueUsd: null });
    expect(result.verdict).not.toBe("Deprioritized");
  });

  it("null raise does not trigger the raise deprioritize check", () => {
    const result = qualifyIntake({ ...baseInput, raiseUsd: null });
    expect(result.verdict).not.toBe("Deprioritized");
  });

  it("null auditedYears does not trigger the audited-years deprioritize check", () => {
    const result = qualifyIntake({ ...baseInput, auditedYears: null });
    expect(result.verdict).not.toBe("Deprioritized");
  });

  it("null ebitda does not trigger the EBITDA deprioritize check", () => {
    const result = qualifyIntake({ ...baseInput, ebitdaUsd: null });
    expect(result.verdict).not.toBe("Deprioritized");
  });

  it("null yearFounded does not trigger the operating-history deprioritize check", () => {
    const result = qualifyIntake({ ...baseInput, yearFounded: null });
    expect(result.verdict).not.toBe("Deprioritized");
  });
});

describe("qualifyIntake — NeedsReview", () => {
  it("raise in [500K, 1M) needs review", () => {
    const result = qualifyIntake({ ...baseInput, raiseUsd: 750_000 });
    expect(result.verdict).toBe("NeedsReview");
    expect(result.reasons.some((r) => r.includes("750,000"))).toBe(true);
  });

  it("raise exactly at 500,000 needs review (lower bound inclusive)", () => {
    const result = qualifyIntake({ ...baseInput, raiseUsd: 500_000 });
    expect(result.verdict).toBe("NeedsReview");
  });

  it("raise exactly at 1,000,000 does not need review (upper bound exclusive) and is Qualified", () => {
    const result = qualifyIntake({ ...baseInput, raiseUsd: 1_000_000 });
    expect(result.verdict).toBe("Qualified");
  });

  it.each([
    ["revenue", { revenueUsd: null }, "Revenue not provided"],
    ["raise", { raiseUsd: null }, "Raise amount not provided"],
    ["auditedYears", { auditedYears: null }, "Audited financial years not provided"],
    ["ebitda", { ebitdaUsd: null }, "EBITDA not provided"],
    ["yearFounded", { yearFounded: null }, "Year founded not provided"],
  ] as const)("null %s needs review with a 'not provided' reason", (_field, override, expectedReason) => {
    const result = qualifyIntake({ ...baseInput, ...override });
    expect(result.verdict).toBe("NeedsReview");
    expect(result.reasons).toContain(expectedReason);
  });
});

describe("qualifyIntake — precedence", () => {
  it("deprioritize beats a simultaneous soft/review condition", () => {
    const result = qualifyIntake({ ...baseInput, revenueUsd: 400_000, ebitdaUsd: null });
    expect(result.verdict).toBe("Deprioritized");
    expect(result.reasons.some((r) => r.includes("400,000"))).toBe(true);
  });

  it("multiple deprioritize checks all contribute their own reason", () => {
    const result = qualifyIntake({
      ...baseInput,
      revenueUsd: 400_000,
      pepExposure: true,
      sectors: ["Mining"],
    });
    expect(result.verdict).toBe("Deprioritized");
    expect(result.reasons.length).toBeGreaterThanOrEqual(3);
  });
});

describe("SSA_GEOGRAPHIES", () => {
  it("contains exactly the six expected values", () => {
    expect(SSA_GEOGRAPHIES).toEqual([
      "EastAfrica",
      "WestAfrica",
      "SouthernAfrica",
      "SubSaharanAfrica",
      "PanAfrica",
      "FrancophoneAfrica",
    ]);
  });

  it("any single SSA geography among several countries is enough to pass", () => {
    const result = qualifyIntake({ ...baseInput, countries: ["Europe", "WestAfrica"] });
    expect(result.verdict).toBe("Qualified");
  });
});
