import { describe, it, expect } from "vitest";
import { registrationSchema, registrationAccountSchema } from "@/lib/schemas/registration";

const valid = {
  fundName: "Acme Capital",
  contactPerson: "Jane Doe",
  email: "jane@acmecapital.com",
  phone: "+254700000000",
  investorType: "PrivateEquity",
  sectorPreference: ["Agribusiness"],
  geographicFocus: ["EastAfrica"],
  dealTypes: ["Equity"],
  ticketMin: "1000000",
  ticketMax: "5000000",
  currency: "USD",
};

describe("registrationSchema", () => {
  it("parses a complete registration", () => {
    const parsed = registrationSchema.parse(valid);
    expect(parsed.fundName).toBe("Acme Capital");
  });

  it("rejects free-provider emails", () => {
    expect(registrationSchema.safeParse({ ...valid, email: "jane@gmail.com" }).success).toBe(false);
  });

  it("requires every field (all mandatory)", () => {
    for (const key of Object.keys(valid)) {
      const rest = Object.fromEntries(
        Object.entries(valid).filter(([k]) => k !== key)
      );
      expect(registrationSchema.safeParse(rest).success).toBe(false);
    }
  });

  it("requires at least one sector, geography and deal type", () => {
    expect(registrationSchema.safeParse({ ...valid, sectorPreference: [] }).success).toBe(false);
    expect(registrationSchema.safeParse({ ...valid, geographicFocus: [] }).success).toBe(false);
    expect(registrationSchema.safeParse({ ...valid, dealTypes: [] }).success).toBe(false);
  });

  it("coerces manual ticket entry and rejects max < min", () => {
    const parsed = registrationSchema.parse(valid);
    expect(parsed.ticketMin).toBe(1_000_000);
    expect(parsed.ticketMax).toBe(5_000_000);
    expect(registrationSchema.safeParse({ ...valid, ticketMin: "5000000", ticketMax: "1000000" }).success).toBe(false);
  });

  it("rejects an unknown currency", () => {
    expect(registrationSchema.safeParse({ ...valid, currency: "XYZ" }).success).toBe(false);
  });
});

describe("registrationAccountSchema", () => {
  it("requires matching passwords meeting policy", () => {
    expect(
      registrationAccountSchema.safeParse({ ...valid, password: "short", confirmPassword: "short" }).success,
    ).toBe(false);
    expect(
      registrationAccountSchema.safeParse({
        ...valid,
        password: "long-enough-pass-1",
        confirmPassword: "different-pass-1",
      }).success,
    ).toBe(false);
    expect(
      registrationAccountSchema.safeParse({
        ...valid,
        password: "long-enough-pass-1",
        confirmPassword: "long-enough-pass-1",
      }).success,
    ).toBe(true);
  });
});
