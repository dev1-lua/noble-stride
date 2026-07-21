import { describe, it, expect, beforeAll } from "vitest";
import {
  generatePartnerAccessCode,
  issuePartnerSelfToken,
  verifyPartnerToken,
  pickPartnerSelfFields,
  PARTNER_SELF_EDITABLE_FIELDS,
} from "../partner-self";

beforeAll(() => {
  process.env.AUTH_SECRET = process.env.AUTH_SECRET ?? "test-secret-partner-self-1234567890";
});

describe("generatePartnerAccessCode", () => {
  it("produces a non-trivial, varying code", () => {
    const a = generatePartnerAccessCode();
    const b = generatePartnerAccessCode();
    expect(a.length).toBeGreaterThanOrEqual(8);
    expect(a).not.toEqual(b); // 64 bits of entropy — collisions are effectively impossible
  });
});

describe("partner-self token round-trip", () => {
  it("verifies a freshly issued token back to its partnerId", async () => {
    const token = await issuePartnerSelfToken("partner_123");
    expect(await verifyPartnerToken(token)).toEqual({ partnerId: "partner_123" });
  });

  it("rejects a garbage/tampered token", async () => {
    expect(await verifyPartnerToken("not-a-jwt")).toBeNull();
    const token = await issuePartnerSelfToken("partner_123");
    expect(await verifyPartnerToken(token + "x")).toBeNull();
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await issuePartnerSelfToken("partner_123");
    const saved = process.env.AUTH_SECRET;
    process.env.AUTH_SECRET = "a-completely-different-secret-value-999";
    try {
      expect(await verifyPartnerToken(token)).toBeNull();
    } finally {
      process.env.AUTH_SECRET = saved;
    }
  });
});

describe("pickPartnerSelfFields (self-editable whitelist)", () => {
  it("allows only contact fields", () => {
    expect(PARTNER_SELF_EDITABLE_FIELDS).toEqual(["email", "phone", "organization"]);
    expect(pickPartnerSelfFields({ email: "a@b.com", phone: "+254700000000" })).toEqual({
      email: "a@b.com",
      phone: "+254700000000",
    });
  });

  it("rejects fee/agreement and identity fields a partner must not self-assert", () => {
    expect(() => pickPartnerSelfFields({ feeSharingAgreement: true })).toThrow(/cannot be self-updated/);
    expect(() => pickPartnerSelfFields({ partnerAgreementStatus: "Signed" })).toThrow(/cannot be self-updated/);
    expect(() => pickPartnerSelfFields({ name: "New Name" })).toThrow(/cannot be self-updated/);
    expect(() => pickPartnerSelfFields({ status: "Active" })).toThrow(/cannot be self-updated/);
  });

  it("rejects non-string or oversized values on whitelisted keys (LOW-2)", () => {
    expect(() => pickPartnerSelfFields({ email: { $ne: null } as unknown as string })).toThrow(/must be a non-empty string/);
    expect(() => pickPartnerSelfFields({ phone: "" })).toThrow(/must be a non-empty string/);
    expect(() => pickPartnerSelfFields({ organization: "x".repeat(400) })).toThrow(/under 300 characters/);
  });
});
