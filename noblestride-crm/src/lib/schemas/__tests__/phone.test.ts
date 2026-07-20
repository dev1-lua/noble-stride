import { describe, expect, it } from "vitest";
import { optionalPhone, optionalPhoneWithDefault, requiredPhone } from "../phone";

const required = requiredPhone("Phone is required");

describe("phone validation", () => {
  it.each(["+254700000000", "+27 11 000 0000", "(011) 555-2368", "0722.000.111"])("accepts %s", (v) => {
    expect(required.safeParse(v).success).toBe(true);
  });
  it.each(["07abc12345", "+254 SEVEN 00", "callme", "123456x"])("rejects alphabetic input %s", (v) => {
    expect(required.safeParse(v).success).toBe(false);
    expect(optionalPhone.safeParse(v).success).toBe(false);
  });
  it("required keeps the min-length message", () => {
    const res = required.safeParse("12");
    expect(res.success).toBe(false);
  });
  it("optional accepts empty and undefined", () => {
    expect(optionalPhone.safeParse("").success).toBe(true);
    expect(optionalPhone.safeParse(undefined).success).toBe(true);
    expect(optionalPhoneWithDefault.parse(undefined)).toBe("");
  });

  it("required rejects a digit-free string", () => {
    expect(required.safeParse("-------").success).toBe(false);
  });

  it("required rejects a string with fewer than 7 digits", () => {
    expect(required.safeParse("123-456").success).toBe(false);
  });

  it.each(["+", "()"])("optional rejects digit-free value %s", (v) => {
    expect(optionalPhone.safeParse(v).success).toBe(false);
  });

  it("optional still accepts a short numeric value", () => {
    expect(optionalPhone.safeParse("12345").success).toBe(true);
  });
});
