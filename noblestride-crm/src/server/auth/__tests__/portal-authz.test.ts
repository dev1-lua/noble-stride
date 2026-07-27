// Pure tests for portal seat capabilities (action points 2026-07 item 3):
// Editors act everywhere; Viewers are read-only unless thread-opted-in.

import { describe, it, expect } from "vitest";
import { capabilitiesOf } from "@/server/auth/portal-authz";
import { extraBandSchema, registrationAccountSchema } from "@/lib/schemas/registration";

describe("capabilitiesOf", () => {
  it("Editors can edit and always post in threads (flag irrelevant)", () => {
    expect(capabilitiesOf({ portalRole: "Editor", canPostInThreads: false })).toEqual({
      canEdit: true,
      canPostInThreads: true,
    });
  });

  it("Viewers are read-only by default", () => {
    expect(capabilitiesOf({ portalRole: "Viewer", canPostInThreads: false })).toEqual({
      canEdit: false,
      canPostInThreads: false,
    });
  });

  it("thread opt-in lets a Viewer post without granting edit", () => {
    expect(capabilitiesOf({ portalRole: "Viewer", canPostInThreads: true })).toEqual({
      canEdit: false,
      canPostInThreads: true,
    });
  });
});

describe("registration extra ticket bands (item 4)", () => {
  const base = {
    fundName: "Band Fund",
    contactPerson: "Ada Obi",
    email: "ada@bandfund.com",
    phone: "+254700111222",
    investorType: "PrivateEquity",
    sectorPreference: ["Technology"],
    geographicFocus: ["EastAfrica"],
    dealTypes: ["Equity"],
    ticketMin: "500000",
    ticketMax: "5000000",
    currency: "USD",
    password: "Str0ng-Passw0rd!",
    confirmPassword: "Str0ng-Passw0rd!",
    members: [],
  };

  it("defaults to no extra bands (back-compat)", () => {
    const parsed = registrationAccountSchema.parse(base);
    expect(parsed.extraBands).toEqual([]);
  });

  it("coerces string inputs from the wizard", () => {
    const parsed = extraBandSchema.parse({ min: "1000000", max: "5000000", currency: "KES" });
    expect(parsed).toEqual({ min: 1_000_000, max: 5_000_000, currency: "KES" });
  });

  it("rejects max < min and unknown currencies", () => {
    expect(() => extraBandSchema.parse({ min: "100", max: "50", currency: "USD" })).toThrow(/maximum/i);
    expect(() => extraBandSchema.parse({ min: "100", max: "500", currency: "ZZZ" })).toThrow(/currency/i);
  });

  it("accepts extra bands on the full account schema", () => {
    const parsed = registrationAccountSchema.parse({
      ...base,
      extraBands: [{ min: "129000000", max: "645000000", currency: "KES" }],
    });
    expect(parsed.extraBands).toHaveLength(1);
    expect(parsed.extraBands[0].min).toBe(129_000_000);
  });
});
