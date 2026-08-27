import { describe, it, expect } from "vitest";
import {
  REVENUE_BANDS,
  revenueBandOf,
  revenueBandOptions,
  UNKNOWN_REVENUE_BAND,
} from "@/server/domain/revenue-bands";

describe("revenueBandOf", () => {
  it("buckets a value into exactly one half-open band", () => {
    expect(revenueBandOf(0)).toBe("lt1m");
    expect(revenueBandOf(999_999)).toBe("lt1m");
    expect(revenueBandOf(1_000_000)).toBe("1-5m");
    expect(revenueBandOf(4_999_999)).toBe("1-5m");
    expect(revenueBandOf(5_000_000)).toBe("5-20m");
    expect(revenueBandOf(19_999_999)).toBe("5-20m");
    expect(revenueBandOf(20_000_000)).toBe("20m+");
    expect(revenueBandOf(500_000_000)).toBe("20m+");
  });
  it("reports unknown for missing or unusable values", () => {
    expect(revenueBandOf(null)).toBe(UNKNOWN_REVENUE_BAND);
    expect(revenueBandOf(undefined)).toBe(UNKNOWN_REVENUE_BAND);
    expect(revenueBandOf(Number.NaN)).toBe(UNKNOWN_REVENUE_BAND);
  });
  it("treats a negative revenue as unknown rather than < $1M", () => {
    expect(revenueBandOf(-1)).toBe(UNKNOWN_REVENUE_BAND);
  });
  it("every band is reachable and bands do not overlap", () => {
    for (const b of REVENUE_BANDS) {
      expect(revenueBandOf(b.min)).toBe(b.key);
      if (b.max != null) expect(revenueBandOf(b.max - 1)).toBe(b.key);
    }
  });
});

describe("revenueBandOptions", () => {
  it("offers every band plus Not recorded", () => {
    const opts = revenueBandOptions();
    expect(opts).toHaveLength(REVENUE_BANDS.length + 1);
    expect(opts.at(-1)).toEqual({ value: "unknown", label: "Not recorded" });
    for (const b of REVENUE_BANDS) expect(opts.some((o) => o.value === b.key && o.label === b.label)).toBe(true);
  });
});
