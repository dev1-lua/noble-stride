import { describe, it, expect } from "vitest";
import { investorMatchScore, rankInvestorMatches } from "@/server/domain/ranking";
import type { MatchInvestor, MatchTxn } from "@/server/domain/ranking";

// ─── Fixtures ─────────────────────────────────────────────────────────────────
// Both empty (instruments) and null (thresholds) by default so each dimension
// under test can be isolated by overriding only what it needs.

const baseTxn: MatchTxn = {
  sector: ["Technology"],
  targetRaise: 5_000_000,
  geography: ["EastAfrica"],
  instrument: [],
};

const baseInvestor: MatchInvestor = {
  id: "1",
  name: "Investor A",
  sectorFocus: ["Technology"],
  geographicFocus: ["EastAfrica"],
  ticketMin: 1_000_000,
  ticketMax: 10_000_000,
  status: "ActivelyDeploying",
  instruments: [],
  minRevenue: null,
  minEbitda: null,
  minLoanBook: null,
};

// Fixture with sector/geo/ticket knocked out so only the dimension under test
// can contribute to the score.
const isolatedInvestor: MatchInvestor = {
  ...baseInvestor,
  sectorFocus: [],
  geographicFocus: [],
  ticketMin: 50_000_000,
  ticketMax: 100_000_000,
  status: null,
};
const isolatedTxn: MatchTxn = { ...baseTxn, sector: [], geography: [] };

describe("investorMatchScore — sector/geo/ticket (ported from prior suite)", () => {
  it("scores sector+geo+ticket+deploying bonus", () => {
    // 0.35 sector + 0.25 geo + 0.15 ticket + 0.10 deploying bonus = 0.85
    const { score, reasons } = investorMatchScore(baseInvestor, baseTxn);
    expect(score).toBeCloseTo(0.85, 5);
    expect(reasons.some((r) => r.includes("Technology"))).toBe(true);
  });

  it("scores 0 on no overlap at all, and warns dormant investors", () => {
    const investor: MatchInvestor = {
      ...baseInvestor,
      id: "2",
      name: "Investor B",
      sectorFocus: ["Banking"],
      geographicFocus: ["Europe"],
      ticketMin: 50_000_000,
      ticketMax: 100_000_000,
      status: "Dormant",
    };
    const { score, warnings } = investorMatchScore(investor, baseTxn);
    expect(score).toBe(0);
    expect(warnings).toContain("Not currently deploying");
  });

  it("ranks and limits, keeping only positive scores", () => {
    const investorB: MatchInvestor = {
      ...baseInvestor,
      id: "2",
      name: "Investor B",
      sectorFocus: ["Banking"],
      geographicFocus: ["Europe"],
      ticketMin: 50_000_000,
      ticketMax: 100_000_000,
      status: "Dormant",
    };
    const res = rankInvestorMatches([baseInvestor, investorB], baseTxn, 1);
    expect(res).toHaveLength(1);
    expect(res[0].id).toBe("1");
  });
});

describe("rankInvestorMatches — hard instrument filter", () => {
  it("drops investors whose instruments share nothing with the txn's", () => {
    const txn: MatchTxn = { ...baseTxn, instrument: ["Debt"] };
    const investor: MatchInvestor = { ...baseInvestor, instruments: ["Equity"] };
    expect(rankInvestorMatches([investor], txn)).toHaveLength(0);
  });

  it("keeps an investor with no recorded instruments (not a mismatch)", () => {
    const txn: MatchTxn = { ...baseTxn, instrument: ["Debt"] };
    const investor: MatchInvestor = { ...baseInvestor, instruments: [] };
    expect(rankInvestorMatches([investor], txn)).toHaveLength(1);
  });

  it("keeps every investor when the txn records no instrument requirement", () => {
    const investor: MatchInvestor = { ...baseInvestor, instruments: ["Equity"] };
    expect(rankInvestorMatches([investor], baseTxn)).toHaveLength(1);
  });
});

describe("investorMatchScore — instrument overlap", () => {
  it("contributes the full 0.15 when the investor covers every txn instrument", () => {
    const txn: MatchTxn = { ...isolatedTxn, instrument: ["Debt", "Equity"] };
    const investor: MatchInvestor = { ...isolatedInvestor, instruments: ["Debt", "Equity"] };
    const { score, reasons } = investorMatchScore(investor, txn);
    expect(score).toBeCloseTo(0.15, 5);
    expect(reasons).toContain("Instrument match: Debt");
    expect(reasons).toContain("Instrument match: Equity");
  });

  it("contributes a fraction when only some instruments are covered", () => {
    const txn: MatchTxn = { ...isolatedTxn, instrument: ["Debt", "Equity"] };
    const investor: MatchInvestor = { ...isolatedInvestor, instruments: ["Debt"] };
    const { score, reasons } = investorMatchScore(investor, txn);
    expect(score).toBeCloseTo(0.075, 5); // 0.15 * 1/2
    expect(reasons).toEqual(["Instrument match: Debt"]);
  });

  it("contributes nothing, and warns nothing, when either side has no instruments", () => {
    const investor: MatchInvestor = { ...isolatedInvestor, instruments: ["Debt"] };
    const { score, warnings } = investorMatchScore(investor, isolatedTxn); // isolatedTxn.instrument = []
    expect(score).toBe(0);
    expect(warnings).toHaveLength(0);
  });
});

describe("investorMatchScore — threshold fit", () => {
  it("a missed threshold warns and earns no credit", () => {
    const txn: MatchTxn = { ...isolatedTxn, clientFinancials: { revenue: 500_000, ebitda: null, loanBook: null } };
    const investor: MatchInvestor = { ...isolatedInvestor, minRevenue: 1_000_000 };
    const { score, warnings } = investorMatchScore(investor, txn);
    expect(score).toBe(0);
    expect(warnings).toContain("Below revenue threshold");
  });

  it("a defined threshold with no client value on record warns 'not on record', not a miss", () => {
    const txn: MatchTxn = { ...isolatedTxn, clientFinancials: { revenue: null, ebitda: null, loanBook: null } };
    const investor: MatchInvestor = { ...isolatedInvestor, minRevenue: 1_000_000 };
    const { score, warnings } = investorMatchScore(investor, txn);
    expect(score).toBe(0);
    expect(warnings).toContain("Revenue not on record");
    expect(warnings).not.toContain("Below revenue threshold");
  });

  it("meeting every applicable threshold earns the full 0.10", () => {
    const txn: MatchTxn = {
      ...isolatedTxn,
      clientFinancials: { revenue: 2_000_000, ebitda: 500_000, loanBook: 100_000 },
    };
    const investor: MatchInvestor = {
      ...isolatedInvestor,
      minRevenue: 1_000_000,
      minEbitda: 400_000,
      minLoanBook: 50_000,
    };
    const { score, warnings } = investorMatchScore(investor, txn);
    expect(score).toBeCloseTo(0.1, 5);
    expect(warnings).toHaveLength(0);
  });

  it("scores the fraction of applicable thresholds met (unrecorded ones are excluded)", () => {
    const txn: MatchTxn = {
      ...isolatedTxn,
      clientFinancials: { revenue: 2_000_000, ebitda: 100_000, loanBook: null },
    };
    const investor: MatchInvestor = {
      ...isolatedInvestor,
      minRevenue: 1_000_000, // met
      minEbitda: 400_000, // missed
      minLoanBook: 50_000, // not on record — excluded from the fraction
    };
    const { score, warnings } = investorMatchScore(investor, txn);
    expect(score).toBeCloseTo(0.05, 5); // 0.10 * 1/2 applicable
    expect(warnings).toContain("Below EBITDA threshold");
    expect(warnings).toContain("Loan-book not on record");
  });
});

describe("investorMatchScore — deployment status", () => {
  it("Dormant warns and grants no bonus", () => {
    const investor: MatchInvestor = { ...isolatedInvestor, status: "Dormant" };
    const { score, warnings } = investorMatchScore(investor, isolatedTxn);
    expect(score).toBe(0);
    expect(warnings).toContain("Not currently deploying");
  });

  it("FullyDeployed warns and grants no bonus", () => {
    const investor: MatchInvestor = { ...isolatedInvestor, status: "FullyDeployed" };
    const { warnings } = investorMatchScore(investor, isolatedTxn);
    expect(warnings).toContain("Not currently deploying");
  });

  it("ActivelyDeploying grants the +0.10 bonus with no warning", () => {
    const investor: MatchInvestor = { ...isolatedInvestor, status: "ActivelyDeploying" };
    const { score, warnings } = investorMatchScore(investor, isolatedTxn);
    expect(score).toBeCloseTo(0.1, 5);
    expect(warnings).toHaveLength(0);
  });
});

describe("investorMatchScore — perfect match caps at 1.0", () => {
  it("clamps a sum past 1.0 across every dimension", () => {
    const txn: MatchTxn = {
      sector: ["Technology"],
      geography: ["EastAfrica"],
      targetRaise: 5_000_000,
      instrument: ["Debt", "Equity"],
      clientFinancials: { revenue: 2_000_000, ebitda: 500_000, loanBook: 100_000 },
    };
    const investor: MatchInvestor = {
      ...baseInvestor,
      instruments: ["Debt", "Equity"],
      minRevenue: 1_000_000,
      minEbitda: 400_000,
      minLoanBook: 50_000,
      status: "ActivelyDeploying",
    };
    // 0.35 + 0.25 + 0.15 + 0.15 + 0.10 + 0.10 = 1.10 → capped
    const { score } = investorMatchScore(investor, txn);
    expect(score).toBe(1.0);
  });
});

describe("rankInvestorMatches — criteriaStale", () => {
  const now = new Date("2026-07-08T00:00:00.000Z");

  it("is true when criteriaVerifiedAt is null", () => {
    const investor: MatchInvestor = { ...baseInvestor, criteriaVerifiedAt: null };
    const [match] = rankInvestorMatches([investor], baseTxn, undefined, now);
    expect(match.criteriaStale).toBe(true);
  });

  it("is true when criteriaVerifiedAt is 200 days old", () => {
    const criteriaVerifiedAt = new Date(now.getTime() - 200 * 86_400_000);
    const investor: MatchInvestor = { ...baseInvestor, criteriaVerifiedAt };
    const [match] = rankInvestorMatches([investor], baseTxn, undefined, now);
    expect(match.criteriaStale).toBe(true);
  });

  it("is false when criteriaVerifiedAt is 30 days old", () => {
    const criteriaVerifiedAt = new Date(now.getTime() - 30 * 86_400_000);
    const investor: MatchInvestor = { ...baseInvestor, criteriaVerifiedAt };
    const [match] = rankInvestorMatches([investor], baseTxn, undefined, now);
    expect(match.criteriaStale).toBe(false);
  });
});

describe("rankInvestorMatches — contactName passthrough", () => {
  it("passes contactName through, defaulting to null when absent", () => {
    const withContact: MatchInvestor = { ...baseInvestor, contactName: "Jane Doe" };
    const withoutContact: MatchInvestor = { ...baseInvestor, id: "3" };
    const [a] = rankInvestorMatches([withContact], baseTxn);
    const [b] = rankInvestorMatches([withoutContact], baseTxn);
    expect(a.contactName).toBe("Jane Doe");
    expect(b.contactName).toBeNull();
  });
});
