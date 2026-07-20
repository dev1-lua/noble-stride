import { describe, expect, it } from "vitest";
import { registrationAccountSchema, teamMemberSchema } from "../registration";

const BASE = {
  fundName: "Acme Capital",
  contactPerson: "Ada Lovelace",
  email: "ada@acmecap.com",
  phone: "+254700000000",
  investorType: "PrivateEquity",
  sectorPreference: ["Technology"],
  geographicFocus: ["EastAfrica"],
  dealTypes: ["Equity"],
  ticketMin: 100000,
  ticketMax: 500000,
  currency: "USD",
  password: "sufficiently-long-1",
  confirmPassword: "sufficiently-long-1",
};

describe("teamMemberSchema", () => {
  it("accepts a corporate-email member; phone optional", () => {
    expect(teamMemberSchema.safeParse({ name: "Bob Ross", email: "bob@acmecap.com", phone: "" }).success).toBe(true);
  });
  it("rejects free-provider emails", () => {
    expect(teamMemberSchema.safeParse({ name: "Bob", email: "bob@gmail.com", phone: "" }).success).toBe(false);
  });
});

describe("registrationAccountSchema members", () => {
  it("defaults to an empty list", () => {
    const parsed = registrationAccountSchema.parse(BASE);
    expect(parsed.members).toEqual([]);
  });
  it("rejects duplicate member emails and reuse of the primary email", () => {
    const dup = { ...BASE, members: [
      { name: "A", email: "same@acmecap.com", phone: "" },
      { name: "B", email: "Same@acmecap.com", phone: "" },
    ]};
    expect(registrationAccountSchema.safeParse(dup).success).toBe(false);
    const primary = { ...BASE, members: [{ name: "A", email: "ada@acmecap.com", phone: "" }] };
    expect(registrationAccountSchema.safeParse(primary).success).toBe(false);
  });
  it("accepts up to 10 valid members", () => {
    const ok = { ...BASE, members: [{ name: "A", email: "a@acmecap.com", phone: "+254711111111" }] };
    const parsed = registrationAccountSchema.parse(ok);
    expect(parsed.members).toHaveLength(1);
  });
});
