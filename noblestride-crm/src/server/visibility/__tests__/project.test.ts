import { describe, it, expect } from "vitest";
import {
  projectDealForInvestor,
  bandCurrency,
  GENERIC_CONTACT_LINE,
} from "@/server/visibility/project";
import type { Tier } from "@/server/visibility/tiers";
import { dealCodename } from "@/server/visibility/codename";
import { FORBIDDEN_STRINGS, makeDealFixture } from "./fixtures";

const VISIBLE_TIERS: Exclude<Tier, "NONE">[] = ["PRE_INTEREST", "AFTER_NDA", "DD"];

function docIds(tier: Exclude<Tier, "NONE">, ndaSatisfied = false): string[] {
  const projected = projectDealForInvestor(makeDealFixture(), tier, { ndaSatisfied });
  if (!projected) throw new Error("expected a projection");
  return projected.documents.map((d) => d.id).sort();
}

describe("projectDealForInvestor — tier gating (§5.2)", () => {
  it("NONE tier gets nothing", () => {
    expect(projectDealForInvestor(makeDealFixture(), "NONE")).toBeNull();
  });

  describe("always-full groups at every visible tier", () => {
    for (const tier of VISIBLE_TIERS) {
      it(`company profile + deal type/ticket + mandate status @ ${tier}`, () => {
        const p = projectDealForInvestor(makeDealFixture(), tier);
        expect(p).not.toBeNull();
        // Client identity is masked at PRE_INTEREST (teaser codename) and
        // unmasked from AFTER_NDA onward (design spec §5).
        const expectedClientName = tier === "PRE_INTEREST" ? dealCodename("txn-1") : "Acme Agri Ltd";
        expect(p?.companyProfile.clientName).toBe(expectedClientName);
        expect(p?.companyProfile.sector).toContain("Agribusiness");
        expect(p?.companyProfile.description).toBe("Vertically integrated grain processor");
        expect(p?.dealTypeTicket.dealType).toBe("Growth");
        expect(p?.dealTypeTicket.targetRaise).toBe(8_000_000);
        expect(p?.matchingMandateStatus).toBe("Signed");
        expect(p?.contact).toBe(GENERIC_CONTACT_LINE);
      });
    }
  });

  describe("teaser masking (PRE_INTEREST only)", () => {
    it("masks the deal name with a deterministic codename", () => {
      const p = projectDealForInvestor(makeDealFixture(), "PRE_INTEREST");
      const code = dealCodename("txn-1");
      expect(p?.name).toBe(code);
      expect(p?.companyProfile.clientName).toBe(code);
    });

    it("unmasks the deal and client name at AFTER_NDA and DD", () => {
      for (const tier of ["AFTER_NDA", "DD"] as const) {
        const p = projectDealForInvestor(makeDealFixture(), tier, { ndaSatisfied: true });
        expect(p?.name).toBe("Project Baobab");
        expect(p?.companyProfile.clientName).toBe("Acme Agri Ltd");
      }
    });
  });

  describe("financials summary: limited → banded, full → raw", () => {
    it("PRE_INTEREST gets coarse bands, no raw numbers", () => {
      const p = projectDealForInvestor(makeDealFixture(), "PRE_INTEREST");
      expect(p?.financialsSummary.disclosure).toBe("limited");
      expect(p?.financialsSummary.revenueLastYear).toBe("$5M–$10M");
      expect(p?.financialsSummary.revenueForecast).toBe("$10M–$25M");
      const json = JSON.stringify(p);
      expect(json).not.toContain("7200000");
      expect(json).not.toContain("12500000");
    });

    for (const tier of ["AFTER_NDA", "DD"] as const) {
      it(`${tier} gets raw figures`, () => {
        const p = projectDealForInvestor(makeDealFixture(), tier);
        expect(p?.financialsSummary.disclosure).toBe("full");
        expect(p?.financialsSummary.revenueLastYear).toBe(7_200_000);
        expect(p?.financialsSummary.revenueForecast).toBe(12_500_000);
        expect(p?.financialsSummary.profitable).toBe(true);
      });
    }
  });

  describe("document gating by accessLevel + type", () => {
    it("PRE_INTEREST: teaser-level InvestorShared docs only", () => {
      expect(docIds("PRE_INTEREST")).toEqual(["doc-deck", "doc-teaser"]);
    });

    it("AFTER_NDA: all InvestorShared incl. IM + model; VDR still hidden (on request → hidden)", () => {
      expect(docIds("AFTER_NDA")).toEqual(["doc-deck", "doc-im", "doc-model", "doc-teaser"]);
    });

    it("DD without a satisfied NDA: InvestorShared only, VDR still hidden", () => {
      expect(docIds("DD")).toEqual(["doc-deck", "doc-im", "doc-model", "doc-teaser"]);
    });

    it("DD with a satisfied NDA: InvestorShared + VDR", () => {
      expect(docIds("DD", true)).toEqual(["doc-deck", "doc-im", "doc-model", "doc-teaser", "doc-vdr"]);
    });
  });

  describe("advisor & client contacts: DD only", () => {
    it("hidden below DD", () => {
      expect(projectDealForInvestor(makeDealFixture(), "PRE_INTEREST")?.advisorClientContacts).toBeNull();
      expect(projectDealForInvestor(makeDealFixture(), "AFTER_NDA")?.advisorClientContacts).toBeNull();
      const preJson = JSON.stringify(projectDealForInvestor(makeDealFixture(), "AFTER_NDA"));
      expect(preJson).not.toContain("Grace");
      expect(preJson).not.toContain("grace@acmeagri.example");
    });

    it("visible at DD", () => {
      const p = projectDealForInvestor(makeDealFixture(), "DD");
      expect(p?.advisorClientContacts).toEqual([
        {
          name: "Grace Mwangi",
          jobTitle: "CFO",
          email: "grace@acmeagri.example",
          phone: "+254700000000",
        },
      ]);
    });
  });

  describe("HARD RULES — never visible at ANY tier", () => {
    for (const tier of VISIBLE_TIERS) {
      it(`no other-investor identities, partner/provider identities, internal notes, contracts, internal/client docs, team identities @ ${tier}`, () => {
        const json = JSON.stringify(projectDealForInvestor(makeDealFixture(), tier));
        for (const forbidden of FORBIDDEN_STRINGS) {
          expect(json).not.toContain(forbidden);
        }
        // No engagement objects at all — not even the investor's own (feedback/offers are internal).
        expect(json).not.toContain("eng-own");
        expect(json).not.toContain("eng-other");
      });
    }
  });
});

describe("bandCurrency", () => {
  const cases: [number, string][] = [
    [0, "< $1M"],
    [999_999, "< $1M"],
    [1_000_000, "$1M–$5M"],
    [4_999_999, "$1M–$5M"],
    [5_000_000, "$5M–$10M"],
    [7_200_000, "$5M–$10M"],
    [10_000_000, "$10M–$25M"],
    [25_000_000, "$25M–$50M"],
    [50_000_000, "$50M–$100M"],
    [100_000_000, "$100M+"],
    [1_250_000_000, "$100M+"],
  ];
  for (const [amount, band] of cases) {
    it(`${amount} → ${band}`, () => expect(bandCurrency(amount)).toBe(band));
  }
  it("null/undefined → null", () => {
    expect(bandCurrency(null)).toBeNull();
    expect(bandCurrency(undefined)).toBeNull();
  });
  it("accepts Decimal-like objects", () => {
    expect(bandCurrency({ toString: () => "7200000" })).toBe("$5M–$10M");
  });
});
