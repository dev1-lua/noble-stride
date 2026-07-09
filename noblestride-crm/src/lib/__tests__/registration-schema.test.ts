import { describe, it, expect } from "vitest";
import { registrationSchema, registrationAccountSchema } from "@/lib/schemas/registration";

const valid = {
  fundName: "Acme Capital",
  contactPerson: "Jane Doe",
  email: "jane@acmecapital.com",
  phone: "+254700000000",
  investorType: "PrivateEquity",
  sectorPreference: ["Agribusiness"],
  dealType: "Equity",
  dealSizeBand: "1m-5m",
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

  it("requires at least one sector", () => {
    expect(registrationSchema.safeParse({ ...valid, sectorPreference: [] }).success).toBe(false);
  });

  it("rejects an unknown deal-size band", () => {
    expect(registrationSchema.safeParse({ ...valid, dealSizeBand: "gt50m" }).success).toBe(false);
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
