// Unit tests for the indicative FX helpers (action points 2026-07 item 4).
// Pure — no DB.

import { describe, it, expect } from "vitest";
import {
  INDICATIVE_USD_RATES,
  missingRateCodes,
  toUsd,
  usdRate,
  compactAmount,
  bandLabel,
  usdComparison,
  fxPairLabel,
} from "@/lib/fx";
import { CURRENCY_CODES } from "@/lib/currencies";

describe("fx rates table", () => {
  it("covers every supported currency", () => {
    expect(missingRateCodes()).toEqual([]);
    for (const code of CURRENCY_CODES) {
      expect(INDICATIVE_USD_RATES[code]).toBeGreaterThan(0);
    }
  });

  it("USD is the identity", () => {
    expect(usdRate("USD")).toBe(1);
    expect(toUsd(1500, "USD")).toBe(1500);
  });

  it("converts KES to USD in the right order of magnitude", () => {
    const usd = toUsd(129_000_000, "KES");
    expect(usd).not.toBeNull();
    expect(usd!).toBeCloseTo(1_000_000, -4); // ≈ $1M at 129 KES/USD
  });

  it("returns null for unknown currencies", () => {
    expect(usdRate("XXX")).toBeNull();
    expect(toUsd(100, "XXX")).toBeNull();
  });
});

describe("formatting", () => {
  it("compacts amounts", () => {
    expect(compactAmount(900)).toBe("900");
    expect(compactAmount(750_000)).toBe("750k");
    expect(compactAmount(1_500_000)).toBe("1.5M");
    expect(compactAmount(2_000_000_000)).toBe("2B");
  });

  it("labels bands including open-ended", () => {
    expect(bandLabel(100_000, 500_000, "USD")).toBe("USD 100k – 500k");
    expect(bandLabel(5_000_000, null, "USD")).toBe("USD 5M+");
  });

  it("shows a ≈USD comparison for non-USD bands only", () => {
    expect(usdComparison(100_000, 500_000, "USD")).toBe("");
    const kes = usdComparison(129_000_000, 645_000_000, "KES");
    expect(kes).toMatch(/^≈ \$1M – \$5M$/);
    expect(usdComparison(129_000_000, null, "KES")).toBe("≈ $1M+");
    expect(usdComparison(100, 200, "XXX")).toBe("");
  });

  it("fxPairLabel combines band + comparison", () => {
    expect(fxPairLabel(129_000_000, 645_000_000, "KES")).toBe("KES 129M – 645M ≈ $1M – $5M");
    expect(fxPairLabel(100_000, 500_000, "USD")).toBe("USD 100k – 500k");
  });
});
