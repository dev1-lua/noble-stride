import { describe, it, expect } from "vitest";
import { investorMatchScore, rankInvestorMatches } from "@/server/domain/ranking";

const txn = { sector: ["Technology"], targetRaise: 5_000_000, geography: ["EastAfrica"] } as const;

describe("ranking", () => {
  it("scores sector+geo+ticket", () => {
    const { score, reasons } = investorMatchScore(
      { id: "1", name: "A", sectorFocus: ["Technology"], geographicFocus: ["EastAfrica"],
        ticketMin: 1_000_000, ticketMax: 10_000_000, status: "ActivelyDeploying" }, txn);
    expect(score).toBeCloseTo(1.0, 1);
    expect(reasons.some(r => r.includes("Technology"))).toBe(true);
  });
  it("low score on no overlap", () => {
    const { score } = investorMatchScore(
      { id: "2", name: "B", sectorFocus: ["Banking"], geographicFocus: ["Europe"],
        ticketMin: 50_000_000, ticketMax: 100_000_000, status: "Dormant" }, txn);
    expect(score).toBeLessThan(0.2);
  });
  it("ranks and limits", () => {
    const res = rankInvestorMatches([
      { id: "1", name: "A", sectorFocus: ["Technology"], geographicFocus: ["EastAfrica"], ticketMin: 1e6, ticketMax: 1e7, status: "ActivelyDeploying" },
      { id: "2", name: "B", sectorFocus: ["Banking"], geographicFocus: ["Europe"], ticketMin: 5e7, ticketMax: 1e8, status: "Dormant" },
    ], txn, 1);
    expect(res).toHaveLength(1);
    expect(res[0].id).toBe("1");
  });
});
