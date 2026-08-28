import { describe, it, expect } from "vitest";
import { APP_SETTING_DEFS, parseBool } from "../app-settings";

describe("parseBool", () => {
  it('parses "true" as true', () => {
    expect(parseBool("true", false)).toBe(true);
  });
  it('parses "false" as false', () => {
    expect(parseBool("false", true)).toBe(false);
  });
  it("falls back for null/undefined/anything else", () => {
    expect(parseBool(null, true)).toBe(true);
    expect(parseBool(undefined, false)).toBe(false);
    expect(parseBool("nonsense", true)).toBe(true);
    expect(parseBool("", false)).toBe(false);
  });
});

describe("APP_SETTING_DEFS", () => {
  it("has the three seeded defs with the expected keys and defaults", () => {
    expect(APP_SETTING_DEFS.map((d) => d.key)).toEqual([
      "portal.dashboard.financeTiles",
      "agent.client.enabled",
      "portal.deal.milestones",
    ]);
    const byKey = Object.fromEntries(APP_SETTING_DEFS.map((d) => [d.key, d]));
    expect(byKey["portal.dashboard.financeTiles"].default).toBe("false");
    expect(byKey["agent.client.enabled"].default).toBe("true");
    expect(byKey["portal.deal.milestones"].default).toBe("false");
    for (const d of APP_SETTING_DEFS) expect(d.type).toBe("boolean");
  });
});
