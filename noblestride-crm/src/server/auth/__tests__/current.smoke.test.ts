import { beforeAll, describe, expect, it } from "vitest";
import type { CurrentAuth } from "../current";

beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret-at-least-32-chars-long!!";
});

function internalAuth(role: "Admin" | "DealLead" | "TeamMember"): CurrentAuth {
  return {
    account: { id: "acc1", kind: "INTERNAL" } as CurrentAuth["account"],
    user: { id: "user1", role, isActive: true } as NonNullable<CurrentAuth["user"]>,
    person: null,
  };
}

describe("resolveViewpointFor", () => {
  it("returns null when signed out", async () => {
    const { resolveViewpointFor } = await import("../current");
    expect(await resolveViewpointFor(null)).toBeNull();
  });
  it("derives admin viewpoint for internal users from User.role", async () => {
    const { resolveViewpointFor } = await import("../current");
    expect(await resolveViewpointFor(internalAuth("Admin"))).toEqual({ role: "admin", orgRole: "Admin" });
    expect(await resolveViewpointFor(internalAuth("TeamMember"))).toEqual({
      role: "admin", orgRole: "TeamMember", userId: "user1",
    });
  });
  it("derives investor viewpoint from person.investorId", async () => {
    const { resolveViewpointFor } = await import("../current");
    const auth = {
      account: { id: "acc2", kind: "INVESTOR" },
      user: null,
      person: { id: "p1", investorId: "inv9", investor: { id: "inv9" } },
    } as unknown as CurrentAuth;
    expect(await resolveViewpointFor(auth)).toEqual({ role: "investor", recordId: "inv9" });
  });
  it("real role always governs — an Admin account gets no override (lens removed)", async () => {
    const { resolveViewpointFor } = await import("../current");
    // Admin resolves to the plain admin viewpoint, with no way to land on an
    // investor/partner viewpoint or another user's org-role lens anymore.
    expect(await resolveViewpointFor(internalAuth("Admin"))).toEqual({ role: "admin", orgRole: "Admin" });
    expect(await resolveViewpointFor(internalAuth("TeamMember"))).toEqual({
      role: "admin", orgRole: "TeamMember", userId: "user1",
    });
    const inv = {
      account: { id: "acc2", kind: "INVESTOR" }, user: null,
      person: { id: "p1", investorId: "inv9", investor: { id: "inv9" } },
    } as unknown as CurrentAuth;
    expect(await resolveViewpointFor(inv)).toEqual({ role: "investor", recordId: "inv9" });
  });
});
