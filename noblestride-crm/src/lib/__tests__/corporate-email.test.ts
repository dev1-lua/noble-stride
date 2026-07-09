import { describe, it, expect } from "vitest";
import { isCorporateEmail, emailDomain, isFreeEmailDomain } from "@/lib/corporate-email";

describe("isCorporateEmail", () => {
  it.each([
    "jane@acmecapital.com",
    "evans@noblestride.co.ke",
    "a@fund.vc",
  ])("accepts corporate email %s", (email) => {
    expect(isCorporateEmail(email)).toBe(true);
  });

  it.each([
    "jane@gmail.com",
    "jane@GMAIL.COM",
    "jane@yahoo.com",
    "jane@hotmail.com",
    "jane@outlook.com",
    "jane@icloud.com",
    "jane@protonmail.com",
    "jane@yandex.com",
  ])("rejects free-provider email %s", (email) => {
    expect(isCorporateEmail(email)).toBe(false);
  });

  it("rejects malformed input", () => {
    expect(isCorporateEmail("not-an-email")).toBe(false);
    expect(isCorporateEmail("@gmail.com")).toBe(false);
    expect(isCorporateEmail("a@nodot")).toBe(false);
  });
});

describe("emailDomain", () => {
  it("lower-cases and extracts the domain", () => {
    expect(emailDomain("Broker@Acme-Brokers.COM")).toBe("acme-brokers.com");
  });
  it("returns null for malformed input", () => {
    expect(emailDomain("not-an-email")).toBeNull();
    expect(emailDomain("")).toBeNull();
  });
});

describe("isFreeEmailDomain", () => {
  it("flags common consumer providers", () => {
    expect(isFreeEmailDomain("gmail.com")).toBe(true);
    expect(isFreeEmailDomain("yahoo.com")).toBe(true);
  });
  it("does not flag corporate domains", () => {
    expect(isFreeEmailDomain("acme-brokers.com")).toBe(false);
  });
});
