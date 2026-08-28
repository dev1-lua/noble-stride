import { describe, expect, it } from "vitest";
import { applyOpportunityFilters, parseOpportunityFilters } from "@/server/visibility/filters";
import { makeDealFixture } from "./fixtures";

// Fixture: Agribusiness / EastAfrica / Growth / Equity / raise $8M / revenue
// $7.2M / womenLed true / youthLed false.
const deal = makeDealFixture();

describe("applyOpportunityFilters — narrowing only (§11.1)", () => {
  it("empty filters are the identity", () => {
    expect(applyOpportunityFilters([deal], {})).toEqual([deal]);
  });

  it("never returns a deal not in the input (cannot widen)", () => {
    const out = applyOpportunityFilters([deal], { sector: ["Technology"] });
    expect(out.every((d) => d === deal)).toBe(true);
    expect(out).toHaveLength(0);
  });

  it("filters by sector, country, instrument, dealType (single selected value)", () => {
    expect(applyOpportunityFilters([deal], { sector: ["Agribusiness"] })).toHaveLength(1);
    expect(applyOpportunityFilters([deal], { country: ["EastAfrica"] })).toHaveLength(1);
    expect(applyOpportunityFilters([deal], { country: ["WestAfrica"] })).toHaveLength(0);
    expect(applyOpportunityFilters([deal], { instrument: ["Equity"] })).toHaveLength(1);
    expect(applyOpportunityFilters([deal], { instrument: ["Debt"] })).toHaveLength(0);
    expect(applyOpportunityFilters([deal], { dealType: ["Growth"] })).toHaveLength(1);
  });

  it("OR-matches within a dimension when multiple values are selected", () => {
    expect(applyOpportunityFilters([deal], { sector: ["Technology", "Agribusiness"] })).toHaveLength(1);
    expect(applyOpportunityFilters([deal], { country: ["WestAfrica", "EastAfrica"] })).toHaveLength(1);
    expect(applyOpportunityFilters([deal], { instrument: ["Debt", "Equity"] })).toHaveLength(1);
    expect(applyOpportunityFilters([deal], { dealType: ["SeriesA", "Growth"] })).toHaveLength(1);
  });

  it("an empty selected array imposes no constraint on that dimension", () => {
    expect(applyOpportunityFilters([deal], { sector: [] })).toHaveLength(1);
  });

  it("filters by ticket band", () => {
    expect(applyOpportunityFilters([deal], { ticketMin: 10_000_000 })).toHaveLength(0);
    expect(applyOpportunityFilters([deal], { ticketMax: 5_000_000 })).toHaveLength(0);
    expect(applyOpportunityFilters([deal], { ticketMin: 1_000_000, ticketMax: 10_000_000 })).toHaveLength(1);
  });

  it("filters by revenue band", () => {
    expect(applyOpportunityFilters([deal], { revenueMin: 5_000_000 })).toHaveLength(1);
    expect(applyOpportunityFilters([deal], { revenueMin: 10_000_000 })).toHaveLength(0);
    expect(applyOpportunityFilters([deal], { revenueMax: 5_000_000 })).toHaveLength(0);
  });

  it("filters by ebitda band", () => {
    expect(applyOpportunityFilters([deal], { ebitdaMin: 1_000_000 })).toHaveLength(1);
    expect(applyOpportunityFilters([deal], { ebitdaMin: 2_000_000 })).toHaveLength(0);
    expect(applyOpportunityFilters([deal], { ebitdaMax: 1_000_000 })).toHaveLength(0);
  });

  it("excludes a deal with null ebitda when an ebitda filter is set", () => {
    const noEbitda = { ...deal, client: { ...deal.client!, ebitda: null } };
    expect(applyOpportunityFilters([noEbitda], { ebitdaMin: 0 })).toHaveLength(0);
    expect(applyOpportunityFilters([noEbitda], {})).toHaveLength(1);
  });

  it("filters by net profit band", () => {
    expect(applyOpportunityFilters([deal], { netProfitMin: 500_000 })).toHaveLength(1);
    expect(applyOpportunityFilters([deal], { netProfitMin: 2_000_000 })).toHaveLength(0);
    expect(applyOpportunityFilters([deal], { netProfitMax: 500_000 })).toHaveLength(0);
  });

  it("excludes a deal with null net profit when a net profit filter is set", () => {
    const noNetProfit = { ...deal, client: { ...deal.client!, netProfit: null } };
    expect(applyOpportunityFilters([noNetProfit], { netProfitMin: 0 })).toHaveLength(0);
    expect(applyOpportunityFilters([noNetProfit], {})).toHaveLength(1);
  });

  it("honours impact flags", () => {
    expect(applyOpportunityFilters([deal], { womenLed: true })).toHaveLength(1);
    expect(applyOpportunityFilters([deal], { youthLed: true })).toHaveLength(0);
  });
});

describe("parseOpportunityFilters — defensive", () => {
  it("ignores unknown enum values and junk numbers", () => {
    expect(
      parseOpportunityFilters({ sector: "NotASector", ticketMin: "abc", ticketMax: "-5", womenLed: "1" }),
    ).toEqual({ womenLed: true });
  });

  // F6b.1: ?match=1 is the "Matches my mandate" tab. Parsed here, applied
  // after projection in load.ts.
  it("parses the mandate-match tab flag", () => {
    expect(parseOpportunityFilters({ match: "1" })).toEqual({ match: true });
    expect(parseOpportunityFilters({ match: "0" })).toEqual({});
    expect(parseOpportunityFilters({ match: "true" })).toEqual({});
  });

  // Reviewer finding: the portal's tab links re-serialized parsed filters, and
  // String(true) === "true" — which this parser drops, so ticking Women-led and
  // then switching tabs silently WIDENED the grid while the control still read as
  // applied. The round-trip is pinned here so the serializer cannot drift again.
  it("round-trips every filter shape through its own serialization", () => {
    const filters = parseOpportunityFilters({
      sector: "Agribusiness,Technology",
      country: "EastAfrica",
      ticketMin: "500000",
      womenLed: "1",
      youthLed: "1",
      match: "1",
    });
    expect(filters.womenLed).toBe(true);
    expect(filters.youthLed).toBe(true);

    // Serialize the way the portal tabs do, then parse it back.
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value == null) continue;
      if (Array.isArray(value)) params.set(key, value.join(","));
      else if (typeof value === "boolean") {
        if (value) params.set(key, "1");
      } else params.set(key, String(value));
    }
    expect(parseOpportunityFilters(Object.fromEntries(params))).toEqual(filters);
  });

  it("parses valid params", () => {
    expect(parseOpportunityFilters({ sector: "Agribusiness", ticketMax: "5000000" })).toEqual({
      sector: ["Agribusiness"],
      ticketMax: 5_000_000,
    });
  });

  it("parses comma-joined multi-select params into arrays", () => {
    expect(parseOpportunityFilters({ sector: "Agribusiness,Technology" })).toEqual({
      sector: ["Agribusiness", "Technology"],
    });
  });

  it("drops invalid values out of a multi-select list rather than the whole param", () => {
    expect(parseOpportunityFilters({ sector: "Agribusiness,NotASector" })).toEqual({
      sector: ["Agribusiness"],
    });
  });

  it("parses ebitda and net profit params", () => {
    expect(
      parseOpportunityFilters({
        ebitdaMin: "1000000",
        ebitdaMax: "2000000",
        netProfitMin: "500000",
        netProfitMax: "1500000",
      }),
    ).toEqual({
      ebitdaMin: 1_000_000,
      ebitdaMax: 2_000_000,
      netProfitMin: 500_000,
      netProfitMax: 1_500_000,
    });
  });

  it("takes the first value of repeated (non-comma-joined) params", () => {
    expect(parseOpportunityFilters({ sector: ["Agribusiness", "Technology"] })).toEqual({
      sector: ["Agribusiness"],
    });
  });
});
