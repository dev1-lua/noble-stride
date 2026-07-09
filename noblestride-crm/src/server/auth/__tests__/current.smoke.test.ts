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
    expect(await resolveViewpointFor(null, undefined)).toBeNull();
  });
  it("derives admin viewpoint for internal users from User.role", async () => {
    const { resolveViewpointFor } = await import("../current");
    expect(await resolveViewpointFor(internalAuth("Admin"), undefined)).toEqual({ role: "admin", orgRole: "Admin" });
    expect(await resolveViewpointFor(internalAuth("TeamMember"), undefined)).toEqual({
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
    expect(await resolveViewpointFor(auth, undefined)).toEqual({ role: "investor", recordId: "inv9" });
  });
  it("applies a signed impersonation lens ONLY for Admin org-role", async () => {
    const { resolveViewpointFor } = await import("../current");
    const { signImpersonation } = await import("../impersonation");
    const lens = await signImpersonation({ role: "investor", recordId: "inv1", impersonating: true });
    expect(await resolveViewpointFor(internalAuth("Admin"), lens)).toEqual({
      role: "investor", recordId: "inv1", impersonating: true,
    });
    // Non-admin real role: lens ignored
    expect(await resolveViewpointFor(internalAuth("TeamMember"), lens)).toEqual({
      role: "admin", orgRole: "TeamMember", userId: "user1",
    });
    // Investor account: lens ignored
    const inv = {
      account: { id: "acc2", kind: "INVESTOR" }, user: null,
      person: { id: "p1", investorId: "inv9", investor: { id: "inv9" } },
    } as unknown as CurrentAuth;
    expect(await resolveViewpointFor(inv, lens)).toEqual({ role: "investor", recordId: "inv9" });
  });
});
