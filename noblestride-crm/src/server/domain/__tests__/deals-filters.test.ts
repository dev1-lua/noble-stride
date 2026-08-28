import { describe, it, expect } from "vitest";
import {
  PRIMARY_FILTERS,
  MORE_FILTERS,
  FILTER_LABELS,
  ALL_FILTERS,
  activeFilterChips,
  moreFilterCount,
  removeChip,
  clearAllFilters,
} from "@/server/domain/deals-filters";

const sp = (qs: string) => new URLSearchParams(qs);

describe("filter registry", () => {
  it("keeps three primary filters and eight behind More filters, all labelled", () => {
    expect(PRIMARY_FILTERS).toEqual(["type", "status", "lead"]);
    expect(MORE_FILTERS).toHaveLength(8);
    expect(MORE_FILTERS).toContain("classification");
    for (const k of ALL_FILTERS) expect(FILTER_LABELS[k]).toBeTruthy();
    expect(new Set(ALL_FILTERS).size).toBe(ALL_FILTERS.length);
  });
});

describe("activeFilterChips", () => {
  it("emits one chip per active value in registry order", () => {
    const chips = activeFilterChips(sp("sector=Agribusiness&type=mandate,advisory&q=acme"));
    expect(chips.map((c) => `${c.key}=${c.value}`)).toEqual(["type=mandate", "type=advisory", "sector=Agribusiness"]);
  });
  it("prettifies values with the supplied option labels", () => {
    const chips = activeFilterChips(sp("classification=DueDiligence"), {
      classification: { DueDiligence: "Due Diligence" },
    });
    expect(chips[0].label).toBe("Classification: Due Diligence");
  });
  it("falls back to the raw value and ignores non-filter params", () => {
    const chips = activeFilterChips(sp("classification=Valuation&view=board&cols=name&sort=ticket&page=2"));
    expect(chips).toHaveLength(1);
    expect(chips[0].label).toBe("Classification: Valuation");
  });
  it("is empty with no filters", () => {
    expect(activeFilterChips(sp(""))).toEqual([]);
    expect(activeFilterChips(sp("type="))).toEqual([]);
  });
});

describe("moreFilterCount", () => {
  it("counts active secondary dimensions, not values", () => {
    expect(moreFilterCount(sp(""))).toBe(0);
    expect(moreFilterCount(sp("type=mandate&status=Open"))).toBe(0); // primary only
    expect(moreFilterCount(sp("sector=A,B"))).toBe(1);
    expect(moreFilterCount(sp("sector=A,B&priority=High&classification=Valuation"))).toBe(3);
  });
});

describe("removeChip", () => {
  it("removes one value and keeps the rest", () => {
    expect(removeChip(sp("type=mandate,advisory"), "type", "mandate")).toBe("type=advisory");
  });
  it("drops the param when the last value goes", () => {
    expect(removeChip(sp("type=mandate&status=Open"), "type", "mandate")).toBe("status=Open");
  });
  it("resets paging and leaves other params alone", () => {
    const out = new URLSearchParams(removeChip(sp("type=mandate,advisory&page=3&view=board"), "type", "advisory"));
    expect(out.get("page")).toBeNull();
    expect(out.get("view")).toBe("board");
    expect(out.get("type")).toBe("mandate");
  });
  it("is a no-op for a value that is not set", () => {
    expect(removeChip(sp("type=mandate"), "type", "advisory")).toBe("type=mandate");
  });
});

describe("clearAllFilters", () => {
  it("keeps only display params", () => {
    const out = new URLSearchParams(
      clearAllFilters(sp("type=mandate&sector=A&q=acme&view=board&cols=name,company&sort=ticket&dir=asc&group=lead&page=4")),
    );
    expect(out.get("view")).toBe("board");
    expect(out.get("cols")).toBe("name,company");
    expect(out.get("sort")).toBe("ticket");
    expect(out.get("dir")).toBe("asc");
    expect(out.get("group")).toBe("lead");
    expect(out.get("type")).toBeNull();
    expect(out.get("sector")).toBeNull();
    expect(out.get("q")).toBeNull();
    // paging must reset — the cleared result set is a different size
    expect(out.get("page")).toBeNull();
  });
});
