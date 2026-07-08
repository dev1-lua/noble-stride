import { describe, expect, it, afterAll } from "vitest";
import { classifyEmail, classifyEmailForSignup, normalizeEmail, INTERNAL_EMAIL_DOMAIN } from "../guardrails";
import { prisma } from "@/lib/db";

describe("normalizeEmail", () => {
  it("lowercases and trims", () => {
    expect(normalizeEmail("  Evans@NobleStride.Capital ")).toBe("evans@noblestride.capital");
  });
});

describe("classifyEmail", () => {
  it("classifies @noblestride.capital as internal (case-insensitive)", () => {
    expect(classifyEmail("evans@noblestride.capital")).toEqual({ kind: "internal" });
    expect(classifyEmail("Solomon@NOBLESTRIDE.CAPITAL")).toEqual({ kind: "internal" });
  });
  it("does NOT treat other noblestride TLDs as internal (tightens old @noblestride.* regex)", () => {
    expect(classifyEmail("x@noblestride.com")).toEqual({ kind: "external" });
  });
  it("does NOT treat a subdomain of the internal domain as internal (internal is EXACTLY noblestride.capital)", () => {
    expect(classifyEmail("x@mail.noblestride.capital")).toEqual({ kind: "external" });
  });
  it("classifies corporate emails as external", () => {
    expect(classifyEmail("jane@acmefund.com")).toEqual({ kind: "external" });
  });
  it("blocks free providers", () => {
    expect(classifyEmail("jane@gmail.com")).toEqual({ kind: "blocked", reason: "free-provider" });
    expect(classifyEmail("jane@yahoo.com")).toEqual({ kind: "blocked", reason: "free-provider" });
    expect(classifyEmail("jane@outlook.com")).toEqual({ kind: "blocked", reason: "free-provider" });
  });
  it("blocks malformed emails", () => {
    expect(classifyEmail("not-an-email")).toEqual({ kind: "blocked", reason: "invalid" });
    expect(classifyEmail("@nodomain")).toEqual({ kind: "blocked", reason: "invalid" });
  });
  it("exports the exact internal domain", () => {
    expect(INTERNAL_EMAIL_DOMAIN).toBe("noblestride.capital");
  });
});

const hasDb = Boolean(process.env.DATABASE_URL);
const d = hasDb ? describe : describe.skip;

d("classifyEmailForSignup (DB-backed greylist)", () => {
  const GREYLISTED_DOMAIN = "zz-test-greylisted-uniq.com";

  afterAll(async () => {
    await prisma.blockedRegistration.deleteMany({
      where: { kind: "Domain", value: GREYLISTED_DOMAIN },
    });
  });

  it("blocks an external email whose domain has a BlockedRegistration row", async () => {
    await prisma.blockedRegistration.create({
      data: { kind: "Domain", value: GREYLISTED_DOMAIN, reason: "test" },
    });
    await expect(classifyEmailForSignup(`jane@${GREYLISTED_DOMAIN}`)).resolves.toEqual({
      kind: "blocked",
      reason: "greylisted",
    });
  });

  it("classifies an external email with no greylist entry as external", async () => {
    await expect(classifyEmailForSignup("jane@acmefund.com")).resolves.toEqual({ kind: "external" });
  });

  it("short-circuits internal emails before hitting the DB", async () => {
    await expect(classifyEmailForSignup("evans@noblestride.capital")).resolves.toEqual({ kind: "internal" });
  });

  it("short-circuits free-provider emails before hitting the DB", async () => {
    await expect(classifyEmailForSignup("jane@gmail.com")).resolves.toEqual({
      kind: "blocked",
      reason: "free-provider",
    });
  });
});
