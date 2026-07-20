import { describe, it, expect, vi } from "vitest";
import { shouldRecordFlag, recordFlagEvent } from "../flagging";

describe("shouldRecordFlag (pure dedupe core)", () => {
  const WINDOW = 60 * 60_000;
  const NOW = 1_000_000_000;
  it("records when there is no prior event in the window", () => {
    expect(shouldRecordFlag([], NOW, WINDOW)).toBe(true);
    expect(shouldRecordFlag([NOW - WINDOW - 5000], NOW, WINDOW)).toBe(true);
  });
  it("dedupes when a prior event falls inside the window", () => {
    expect(shouldRecordFlag([NOW - 1000], NOW, WINDOW)).toBe(false);
  });
});

describe("recordFlagEvent (wrapper)", () => {
  it("creates one event on first flag and returns true", async () => {
    const dataCreate = vi.fn(async () => ({}) as never);
    const dataGet = vi.fn(async () => ({ data: [], pagination: { total: 0, page: 1, limit: 500 } })) as never;
    const created = await recordFlagEvent("evil@x.com", ["instruction-override"], {
      dataCreate, dataGet, now: () => 1000, windowMs: 60 * 60_000,
    });
    expect(created).toBe(true);
    expect(dataCreate).toHaveBeenCalledTimes(1);
  });
  it("does not create a duplicate within the window", async () => {
    const dataCreate = vi.fn(async () => ({}) as never);
    const dataGet = vi.fn(async () => ({ data: [{ createdAt: 900 }], pagination: { total: 1, page: 1, limit: 500 } })) as never;
    const created = await recordFlagEvent("evil@x.com", ["x"], {
      dataCreate, dataGet, now: () => 1000, windowMs: 60 * 60_000,
    });
    expect(created).toBe(false);
    expect(dataCreate).not.toHaveBeenCalled();
  });
  it("fails open (returns false, never throws) when the Data API throws", async () => {
    const dataGet = vi.fn(async () => { throw new Error("down"); }) as never;
    const dataCreate = vi.fn(async () => ({}) as never);
    await expect(
      recordFlagEvent("x@x.com", ["x"], { dataCreate, dataGet }),
    ).resolves.toBe(false);
  });
});
