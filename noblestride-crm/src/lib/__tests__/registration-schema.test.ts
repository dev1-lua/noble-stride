import { describe, it, expect } from "vitest";
import { registrationSchema } from "@/lib/schemas/registration";

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
      const { [key as keyof typeof valid]: _omitted, ...rest } = valid;
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
