// F3.6 (image11/12): changing a contact's email must change the account they
// sign in with. The policy half is pure, so it is tested without a DB: which
// account kind may hold which address, and — just as important — that the
// refusal never echoes the address back into a page.

import { describe, it, expect } from "vitest";
import { emailPolicyFor } from "../change-email";

const internal = { kind: "internal" as const };
const external = { kind: "external" as const };
const free = { kind: "blocked" as const, reason: "free-provider" as const };
const grey = { kind: "blocked" as const, reason: "greylisted" as const };
const invalid = { kind: "blocked" as const, reason: "invalid" as const };

describe("emailPolicyFor", () => {
  it("INTERNAL accounts require a Noblestride address", () => {
    expect(emailPolicyFor("INTERNAL", "a@noblestride.capital", internal)).toEqual({ ok: true });
    expect(emailPolicyFor("INTERNAL", "a@fund.test", external).ok).toBe(false);
  });

  it("INVESTOR and PARTNER accounts require an external corporate address", () => {
    expect(emailPolicyFor("INVESTOR", "a@fund.test", external)).toEqual({ ok: true });
    expect(emailPolicyFor("PARTNER", "a@partner.test", external)).toEqual({ ok: true });
    expect(emailPolicyFor("INVESTOR", "a@noblestride.capital", internal).ok).toBe(false);
    expect(emailPolicyFor("PARTNER", "a@noblestride.capital", internal).ok).toBe(false);
  });

  it("rejects free providers, greylisted and malformed addresses for every kind", () => {
    for (const kind of ["INTERNAL", "INVESTOR", "PARTNER"] as const) {
      expect(emailPolicyFor(kind, "a@gmail.com", free).ok).toBe(false);
      expect(emailPolicyFor(kind, "a@blocked.test", grey).ok).toBe(false);
      expect(emailPolicyFor(kind, "nonsense", invalid).ok).toBe(false);
    }
  });

  it("error copy never echoes the address back", () => {
    for (const [kind, email, cls] of [
      ["INVESTOR", "a@gmail.com", free],
      ["INTERNAL", "a@fund.test", external],
      ["PARTNER", "a@blocked.test", grey],
    ] as const) {
      const r = emailPolicyFor(kind, email, cls);
      if (r.ok) throw new Error("expected a refusal");
      expect(r.error).not.toContain(email);
      expect(r.error.length).toBeGreaterThan(10);
    }
  });
});
