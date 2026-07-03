import { describe, it, expect } from "vitest";
import type { InvestorEngagementClassification } from "@prisma/client";
import {
  discoverableDealsForInvestor,
  type DiscoveryInvestor,
  type DealInput,
} from "@/server/visibility/project";

function investor(overrides: Partial<DiscoveryInvestor> = {}): DiscoveryInvestor {
  return {
    engagementClassification: "Active",
    sectorFocus: [],
    geographicFocus: [],
    ticketMin: null,
    ticketMax: null,
    ...overrides,
  };
}

function deal(overrides: Partial<DealInput> = {}): DealInput {
  return {
    id: overrides.id ?? "txn-x",
    name: "Deal",
    stage: "InvestorOutreach",
    sector: ["Agribusiness"],
    targetRaise: 8_000_000,
    client: { name: "Client Co", sector: ["Agribusiness"], countries: ["EastAfrica"] },
    ...overrides,
  };
}

describe("discoverableDealsForInvestor — classification gate (§5.3)", () => {
  const blocked: InvestorEngagementClassification[] = ["Excluded", "Greylisted", "Inactive", "OnHold"];
  for (const classification of blocked) {
    it(`${classification} investor sees an empty portal`, () => {
      expect(
        discoverableDealsForInvestor(investor({ engagementClassification: classification }), [deal()]),
      ).toEqual([]);
    });
  }

  it("Active investor sees matching deals", () => {
    expect(discoverableDealsForInvestor(investor(), [deal()])).toHaveLength(1);
  });
});

describe("discoverableDealsForInvestor — active-stage filter", () => {
  it("excludes ClosedWon / ClosedLost deals", () => {
    const deals = [
      deal({ id: "open" }),
      deal({ id: "won", stage: "ClosedWon" }),
      deal({ id: "lost", stage: "ClosedLost" }),
    ];
    expect(discoverableDealsForInvestor(investor(), deals).map((d) => d.id)).toEqual(["open"]);
  });
});

describe("discoverableDealsForInvestor — sector matching", () => {
  it("no sector focus → matches everything", () => {
    expect(discoverableDealsForInvestor(investor({ sectorFocus: [] }), [deal()])).toHaveLength(1);
  });

  it("overlapping sector matches (deal-level or client-level sector)", () => {
    const inv = investor({ sectorFocus: ["Healthcare"] });
    const clientSectorOnly = deal({
      id: "client-sector",
      sector: [],
      client: { name: "Clinic Co", sector: ["Healthcare"], countries: [] },
    });
    expect(discoverableDealsForInvestor(inv, [clientSectorOnly])).toHaveLength(1);
  });

  it("disjoint sectors do not match", () => {
    const inv = investor({ sectorFocus: ["Technology"] });
    expect(discoverableDealsForInvestor(inv, [deal()])).toEqual([]);
  });

  it("deal with no sector data matches any focus", () => {
    const inv = investor({ sectorFocus: ["Technology"] });
    const blank = deal({ id: "blank", sector: [], client: { name: "X", sector: [], countries: [] } });
    expect(discoverableDealsForInvestor(inv, [blank])).toHaveLength(1);
  });
});

describe("discoverableDealsForInvestor — geography matching", () => {
  it("overlapping geography matches", () => {
    const inv = investor({ geographicFocus: ["EastAfrica"] });
    expect(discoverableDealsForInvestor(inv, [deal()])).toHaveLength(1);
  });

  it("disjoint geography does not match", () => {
    const inv = investor({ geographicFocus: ["WestAfrica"] });
    expect(discoverableDealsForInvestor(inv, [deal()])).toEqual([]);
  });

  it("Global focus matches any country", () => {
    const inv = investor({ geographicFocus: ["Global"] });
    expect(discoverableDealsForInvestor(inv, [deal()])).toHaveLength(1);
  });

  it("no geographic focus matches everything", () => {
    const inv = investor({ geographicFocus: [] });
    expect(discoverableDealsForInvestor(inv, [deal()])).toHaveLength(1);
  });
});

describe("discoverableDealsForInvestor — ticket-size matching", () => {
  it("targetRaise inside [ticketMin, ticketMax] matches", () => {
    const inv = investor({ ticketMin: 5_000_000, ticketMax: 10_000_000 });
    expect(discoverableDealsForInvestor(inv, [deal()])).toHaveLength(1);
  });

  it("targetRaise below ticketMin does not match", () => {
    const inv = investor({ ticketMin: 9_000_000 });
    expect(discoverableDealsForInvestor(inv, [deal()])).toEqual([]);
  });

  it("targetRaise above ticketMax does not match", () => {
    const inv = investor({ ticketMax: 5_000_000 });
    expect(discoverableDealsForInvestor(inv, [deal()])).toEqual([]);
  });

  it("missing targetRaise matches regardless of ticket range", () => {
    const inv = investor({ ticketMin: 9_000_000, ticketMax: 20_000_000 });
    expect(discoverableDealsForInvestor(inv, [deal({ targetRaise: null })])).toHaveLength(1);
  });

  it("no ticket range on the investor matches any raise", () => {
    expect(discoverableDealsForInvestor(investor(), [deal({ targetRaise: 500 })])).toHaveLength(1);
  });
});
