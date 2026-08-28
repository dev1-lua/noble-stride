import { describe, it, expect, vi, beforeEach } from "vitest";

// The AppSetting service is a thin cached read/write layer over one table.
// Mock the DB (same pattern as flag-investor-for-review.test.ts) so the TTL
// cache and revalidation fan-out can be asserted without Postgres.
const { mocks } = vi.hoisted(() => ({
  mocks: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    upsert: vi.fn(),
    revalidatePath: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    appSetting: { findUnique: mocks.findUnique, findMany: mocks.findMany, upsert: mocks.upsert },
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import {
  getSetting,
  getBoolSetting,
  listSettings,
  setSetting,
  invalidateSettingsCache,
  SETTINGS_TTL_MS,
} from "../app-settings";
import { APP_SETTING_DEFS } from "@/lib/app-settings";

const ACTOR = { id: "user-1" };

beforeEach(() => {
  Object.values(mocks).forEach((m) => m.mockReset());
  invalidateSettingsCache();
  vi.useRealTimers();
});

describe("getSetting / getBoolSetting", () => {
  it("returns the def default when no row exists", async () => {
    mocks.findUnique.mockResolvedValue(null);
    expect(await getSetting("portal.dashboard.financeTiles")).toBe("false");
    expect(await getBoolSetting("portal.dashboard.financeTiles")).toBe(false);
    expect(await getBoolSetting("agent.client.enabled")).toBe(true);
  });

  it("returns the stored value and parses booleans", async () => {
    mocks.findUnique.mockResolvedValue({ key: "portal.dashboard.financeTiles", value: "true", updatedAt: new Date() });
    expect(await getSetting("portal.dashboard.financeTiles")).toBe("true");
    expect(await getBoolSetting("portal.dashboard.financeTiles")).toBe(true);
  });

  it("serves a second read within the TTL from cache (no DB hit)", async () => {
    mocks.findUnique.mockResolvedValue({ key: "agent.client.enabled", value: "false", updatedAt: new Date() });
    await getSetting("agent.client.enabled");
    await getSetting("agent.client.enabled");
    expect(mocks.findUnique).toHaveBeenCalledTimes(1);
  });

  it("re-reads after the TTL elapses", async () => {
    vi.useFakeTimers();
    mocks.findUnique.mockResolvedValue({ key: "agent.client.enabled", value: "false", updatedAt: new Date() });
    await getSetting("agent.client.enabled");
    vi.advanceTimersByTime(SETTINGS_TTL_MS + 1);
    await getSetting("agent.client.enabled");
    expect(mocks.findUnique).toHaveBeenCalledTimes(2);
  });

  it("invalidateSettingsCache forces a re-read", async () => {
    mocks.findUnique.mockResolvedValue(null);
    await getSetting("agent.client.enabled");
    invalidateSettingsCache();
    await getSetting("agent.client.enabled");
    expect(mocks.findUnique).toHaveBeenCalledTimes(2);
  });

  it("throws on an unknown key", async () => {
    await expect(getSetting("nope.unknown")).rejects.toThrow(/unknown app setting/i);
  });
});

describe("setSetting", () => {
  it("upserts, updates the cache and revalidates every path on the def", async () => {
    mocks.upsert.mockResolvedValue({ key: "portal.dashboard.financeTiles", value: "true", updatedAt: new Date() });
    await setSetting("portal.dashboard.financeTiles", "true", ACTOR);
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: "portal.dashboard.financeTiles" },
        create: { key: "portal.dashboard.financeTiles", value: "true" },
        update: { value: "true" },
      }),
    );
    const def = APP_SETTING_DEFS.find((d) => d.key === "portal.dashboard.financeTiles")!;
    for (const p of def.revalidate) expect(mocks.revalidatePath).toHaveBeenCalledWith(p);
    // Cache now holds the new value — no DB read needed.
    expect(await getSetting("portal.dashboard.financeTiles")).toBe("true");
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("rejects a non-boolean value for a boolean def and an unknown key", async () => {
    await expect(setSetting("portal.dashboard.financeTiles", "maybe", ACTOR)).rejects.toThrow(/boolean/i);
    await expect(setSetting("nope.unknown", "true", ACTOR)).rejects.toThrow(/unknown app setting/i);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});

describe("listSettings", () => {
  it("joins every def with its row (or null) in def order", async () => {
    const at = new Date("2026-08-22T12:43:28Z");
    mocks.findMany.mockResolvedValue([{ key: "portal.dashboard.financeTiles", value: "true", updatedAt: at }]);
    const rows = await listSettings();
    expect(rows.map((r) => r.def.key)).toEqual(APP_SETTING_DEFS.map((d) => d.key));
    const ft = rows.find((r) => r.def.key === "portal.dashboard.financeTiles")!;
    expect(ft.value).toBe("true");
    expect(ft.updatedAt).toEqual(at);
    const ac = rows.find((r) => r.def.key === "agent.client.enabled")!;
    expect(ac.value).toBe("true"); // def default
    expect(ac.updatedAt).toBeNull();
  });
});
