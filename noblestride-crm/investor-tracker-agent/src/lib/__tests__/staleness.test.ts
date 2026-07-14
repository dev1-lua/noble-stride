import { describe, it, expect, vi } from "vitest";
import { DEFAULT_STALE_DAYS, resolveThresholds, idleDays } from "../staleness";

describe("resolveThresholds", () => {
  it("returns defaults when no override is set", () => {
    expect(resolveThresholds(undefined)).toEqual(DEFAULT_STALE_DAYS);
  });

  it("merges a valid JSON override over defaults", () => {
    const merged = resolveThresholds('{"Offer":5,"DueDiligence":14}');
    expect(merged.Offer).toBe(5);
    expect(merged.DueDiligence).toBe(14);
    expect(merged.Shared).toBe(DEFAULT_STALE_DAYS.Shared);
  });

  it("ignores unknown stages and non-positive/non-numeric values", () => {
    const merged = resolveThresholds('{"NotAStage":3,"Offer":-1,"Meeting":"soon"}');
    expect(merged).toEqual(DEFAULT_STALE_DAYS);
  });

  it("falls back to defaults on invalid JSON (with a warning)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(resolveThresholds("{nope")).toEqual(DEFAULT_STALE_DAYS);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("idleDays", () => {
  const now = new Date("2026-07-14T12:00:00Z");

  it("uses the most recent of lastContact and updatedAt", () => {
    expect(idleDays(now, { lastContact: "2026-07-01T12:00:00Z", updatedAt: "2026-07-10T12:00:00Z" })).toBe(4);
    expect(idleDays(now, { lastContact: "2026-07-12T12:00:00Z", updatedAt: "2026-07-01T12:00:00Z" })).toBe(2);
  });

  it("handles a null lastContact", () => {
    expect(idleDays(now, { lastContact: null, updatedAt: "2026-07-07T12:00:00Z" })).toBe(7);
  });

  it("returns Infinity when there is no touch at all", () => {
    expect(idleDays(now, { lastContact: null, updatedAt: null })).toBe(Number.POSITIVE_INFINITY);
  });
});
