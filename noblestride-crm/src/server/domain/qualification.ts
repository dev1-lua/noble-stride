// qualification.ts — pure client-intake qualification engine for the
// Noblestride CRM. No I/O, no Prisma, no Date.now() — the caller passes
// `currentYear` so the engine stays fully deterministic and unit-testable
// without a database (see src/server/domain/__tests__/qualification.test.ts).

export const RESTRICTED_SECTORS = ["OilAndGas", "Mining", "Gambling", "Alcohol", "Tobacco", "RealEstate"] as const;

/** Sub-Saharan Africa geography values — a submission needs at least one country in this list. */
export const SSA_GEOGRAPHIES = [
  "EastAfrica",
  "WestAfrica",
  "SouthernAfrica",
  "SubSaharanAfrica",
  "PanAfrica",
  "FrancophoneAfrica",
] as const;

// ─── Domain types ─────────────────────────────────────────────────────────────

export type QualificationVerdict = "Qualified" | "NeedsReview" | "Deprioritized";

export interface IntakeQualInput {
  /** Revenue for the last full financial year, in USD. */
  revenueUsd: number | null;
  /** Amount being raised, in USD. */
  raiseUsd: number | null;
  /** Number of years of audited financial statements available. */
  auditedYears: number | null;
  /** Countries the applicant operates in. */
  countries: string[];
  /** Sectors the applicant operates in. */
  sectors: string[];
  pepExposure: boolean | null;
  governmentOwned: boolean | null;
  /** EBITDA for the last full financial year, in USD. */
  ebitdaUsd: number | null;
  yearFounded: number | null;
  /** Caller-supplied "now", in years — never computed inside the engine. */
  currentYear: number;
}

export interface QualifyIntakeResult {
  verdict: QualificationVerdict;
  reasons: string[];
}

// ─── Formatting ───────────────────────────────────────────────────────────────

function formatUsd(amount: number): string {
  return `USD ${amount.toLocaleString("en-US")}`;
}

// ─── Engine ───────────────────────────────────────────────────────────────────

const MIN_REVENUE = 1_000_000;
const MIN_RAISE_FOR_REVIEW = 500_000;
const MIN_RAISE_FOR_PASS = 1_000_000;
const MIN_AUDITED_YEARS = 3;
const MIN_OPERATING_HISTORY_YEARS = 3;

/**
 * Triages a client intake submission against Marko's qualification rules.
 * Deprioritize beats NeedsReview beats Qualified, but every triggered check
 * (hard or soft) contributes its own reason string to the result — a
 * Deprioritized verdict can carry multiple reasons, including ones that on
 * their own would only have been soft/missing-data flags.
 */
export function qualifyIntake(input: IntakeQualInput): QualifyIntakeResult {
  const deprioritizeReasons: string[] = [];
  const reviewReasons: string[] = [];

  // Revenue
  if (input.revenueUsd != null && input.revenueUsd < MIN_REVENUE) {
    deprioritizeReasons.push(`Revenue below USD 1M (${formatUsd(input.revenueUsd)} reported)`);
  } else if (input.revenueUsd == null) {
    reviewReasons.push("Revenue not provided");
  }

  // Raise amount
  if (input.raiseUsd != null && input.raiseUsd < MIN_RAISE_FOR_REVIEW) {
    deprioritizeReasons.push(`Raise amount below USD 500K (${formatUsd(input.raiseUsd)} reported)`);
  } else if (input.raiseUsd != null && input.raiseUsd < MIN_RAISE_FOR_PASS) {
    reviewReasons.push(`Raise amount between USD 500K and USD 1M (${formatUsd(input.raiseUsd)} reported)`);
  } else if (input.raiseUsd == null) {
    reviewReasons.push("Raise amount not provided");
  }

  // Audited financial years
  if (input.auditedYears != null && input.auditedYears < MIN_AUDITED_YEARS) {
    deprioritizeReasons.push(`Fewer than 3 years of audited financials (${input.auditedYears} reported)`);
  } else if (input.auditedYears == null) {
    reviewReasons.push("Audited financial years not provided");
  }

  // Geography — always checked; an empty countries array has no SSA match.
  const hasSsaCountry = input.countries.some((c) => (SSA_GEOGRAPHIES as readonly string[]).includes(c));
  if (!hasSsaCountry) {
    deprioritizeReasons.push("Operating outside Sub-Saharan Africa geographies");
  }

  // Sector — always checked; one reason per matched restricted sector.
  for (const sector of input.sectors) {
    if ((RESTRICTED_SECTORS as readonly string[]).includes(sector)) {
      deprioritizeReasons.push(`Operating in a restricted sector: ${sector}`);
    }
  }

  // PEP exposure
  if (input.pepExposure === true) {
    deprioritizeReasons.push("PEP exposure flagged");
  }

  // Government ownership
  if (input.governmentOwned === true) {
    deprioritizeReasons.push("Government ownership flagged");
  }

  // EBITDA
  if (input.ebitdaUsd != null && input.ebitdaUsd <= 0) {
    deprioritizeReasons.push(`EBITDA not profitable (${formatUsd(input.ebitdaUsd)} reported)`);
  } else if (input.ebitdaUsd == null) {
    reviewReasons.push("EBITDA not provided");
  }

  // Operating history
  if (input.yearFounded != null && input.yearFounded > input.currentYear - MIN_OPERATING_HISTORY_YEARS) {
    deprioritizeReasons.push(`Operating history under 3 years (founded ${input.yearFounded})`);
  } else if (input.yearFounded == null) {
    reviewReasons.push("Year founded not provided");
  }

  if (deprioritizeReasons.length > 0) {
    return { verdict: "Deprioritized", reasons: [...deprioritizeReasons, ...reviewReasons] };
  }
  if (reviewReasons.length > 0) {
    return { verdict: "NeedsReview", reasons: reviewReasons };
  }
  return { verdict: "Qualified", reasons: [] };
}
