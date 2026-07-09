import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword, DUMMY_HASH } from "../password";
import { validatePassword } from "../policy";

describe("password hashing", () => {
  it("hashes with argon2id and round-trips", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword(hash, "correct horse battery")).toBe(true);
    expect(await verifyPassword(hash, "wrong password!!")).toBe(false);
  });
  it("verifyPassword never throws on garbage hashes", async () => {
    expect(await verifyPassword("not-a-hash", "x")).toBe(false);
  });
  it("DUMMY_HASH is a valid argon2id hash that matches nothing we use", async () => {
    expect(DUMMY_HASH).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword(DUMMY_HASH, "anything")).toBe(false);
  });
});

describe("validatePassword", () => {
  it("rejects short passwords", () => {
    expect(validatePassword("short1!")).toMatch(/at least 10/);
  });
  it("rejects common passwords", () => {
    expect(validatePassword("password12")).toMatch(/too common/i);
  });
  it("rejects passwords containing the email local part", () => {
    expect(validatePassword("evans-secret-1", "evans@noblestride.capital")).toMatch(/email/i);
  });
  it("accepts a strong password", () => {
    expect(validatePassword("tr0ub4dor&horse", "evans@noblestride.capital")).toBeNull();
  });
});
