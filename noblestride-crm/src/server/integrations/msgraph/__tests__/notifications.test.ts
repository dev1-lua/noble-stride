// src/server/integrations/msgraph/__tests__/notifications.test.ts
import { describe, it, expect } from "vitest";
import { parseGraphNotifications } from "../notifications";

describe("parseGraphNotifications", () => {
  it("extracts subscriptionId + resource from each notification", () => {
    const out = parseGraphNotifications({
      value: [{ subscriptionId: "s1", resource: "Users/u/Messages/m1", clientState: "ns-crm" }],
    });
    expect(out).toEqual([{ subscriptionId: "s1", resource: "Users/u/Messages/m1" }]);
  });

  it("extracts multiple notifications", () => {
    const out = parseGraphNotifications({
      value: [
        { subscriptionId: "s1", resource: "Users/u/Messages/m1" },
        { subscriptionId: "s2", resource: "Users/u/Messages/m2" },
      ],
    });
    expect(out).toEqual([
      { subscriptionId: "s1", resource: "Users/u/Messages/m1" },
      { subscriptionId: "s2", resource: "Users/u/Messages/m2" },
    ]);
  });

  it("drops notifications missing subscriptionId or resource", () => {
    const out = parseGraphNotifications({
      value: [
        { subscriptionId: "s1" },
        { resource: "Users/u/Messages/m2" },
        { subscriptionId: "s3", resource: "Users/u/Messages/m3" },
      ],
    });
    expect(out).toEqual([{ subscriptionId: "s3", resource: "Users/u/Messages/m3" }]);
  });

  it("returns [] for malformed payloads without throwing", () => {
    expect(parseGraphNotifications(null)).toEqual([]);
    expect(parseGraphNotifications(undefined)).toEqual([]);
    expect(parseGraphNotifications({})).toEqual([]);
    expect(parseGraphNotifications({ value: null })).toEqual([]);
    expect(parseGraphNotifications("not json")).toEqual([]);
    expect(parseGraphNotifications(42)).toEqual([]);
    expect(parseGraphNotifications({ value: "not an array" })).toEqual([]);
  });
});
