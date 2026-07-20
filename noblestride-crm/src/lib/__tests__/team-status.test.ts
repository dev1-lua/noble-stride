import { describe, expect, it } from "vitest";
import { deriveMemberStatus } from "../team-status";

describe("deriveMemberStatus", () => {
  it("is 'No account' without an AuthAccount", () => {
    expect(deriveMemberStatus(null)).toBe("No account");
  });
  it("is 'Suspended' for suspended accounts regardless of login history", () => {
    expect(deriveMemberStatus({ status: "SUSPENDED", lastLoginAt: new Date() })).toBe("Suspended");
    expect(deriveMemberStatus({ status: "SUSPENDED", lastLoginAt: null })).toBe("Suspended");
  });
  it("is 'Invited' for accounts that never signed in (ACTIVE or PENDING)", () => {
    expect(deriveMemberStatus({ status: "ACTIVE", lastLoginAt: null })).toBe("Invited");
    expect(deriveMemberStatus({ status: "PENDING", lastLoginAt: null })).toBe("Invited");
  });
  it("is 'Active' once the member has signed in", () => {
    expect(deriveMemberStatus({ status: "ACTIVE", lastLoginAt: new Date() })).toBe("Active");
  });
});
