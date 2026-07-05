import { describe, it, expect } from "vitest";
import { isCorporateEmail } from "@/lib/corporate-email";

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
