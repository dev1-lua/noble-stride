import { describe, expect, it } from "vitest";
import { assertCan, assertCanDelete, assertCanUpdateOwnScoped, assertAdmin } from "../enforce";
import type { Actor } from "@/graphql/context";

const admin: Actor = { type: "HUMAN", authenticated: true, accountKind: "INTERNAL", orgRole: "Admin", userId: "u1" };
const teamMember: Actor = { type: "HUMAN", authenticated: true, accountKind: "INTERNAL", orgRole: "TeamMember", userId: "u2" };
const dealLead: Actor = { type: "HUMAN", authenticated: true, accountKind: "INTERNAL", orgRole: "DealLead", userId: "u3" };
const investor: Actor = { type: "HUMAN", authenticated: true, accountKind: "INVESTOR" };
const anonymous: Actor = { type: "HUMAN", authenticated: false };
const apiAgent: Actor = { type: "AGENT", authenticated: true, userId: "agent-1" };

describe("assertCan", () => {
  it("admin can do everything; API agents pass (automation path)", () => {
    expect(() => assertCan(admin, "Investors", "D")).not.toThrow();
    expect(() => assertCan(apiAgent, "Investors", "C")).not.toThrow();
  });
  it("TeamMember cannot create or delete investors", () => {
    expect(() => assertCan(teamMember, "Investors", "C")).toThrow();
    expect(() => assertCanDelete(teamMember, "Investors")).toThrow();
  });
  it("anonymous and investor-kind actors are always denied", () => {
    expect(() => assertCan(anonymous, "Tasks", "R")).toThrow();
    expect(() => assertCan(investor, "Engagements", "U")).toThrow();
  });
});

describe("assertCanUpdateOwnScoped", () => {
  it("DealLead can update own transaction but not someone else's", async () => {
    await expect(
      assertCanUpdateOwnScoped(dealLead, "Transactions", async () => ({ ownerId: "u3" })),
    ).resolves.toBeUndefined();
    await expect(
      assertCanUpdateOwnScoped(dealLead, "Transactions", async () => ({ ownerId: "someone-else" })),
    ).rejects.toThrow();
  });
  it("admin skips the ownership fetch", async () => {
    let fetched = false;
    await assertCanUpdateOwnScoped(admin, "Transactions", async () => {
      fetched = true;
      return { ownerId: "x" };
    });
    expect(fetched).toBe(false);
  });
});

describe("assertAdmin", () => {
  it("only Admin org-role or API automation passes", () => {
    expect(() => assertAdmin(admin)).not.toThrow();
    expect(() => assertAdmin(apiAgent)).not.toThrow();
    expect(() => assertAdmin(dealLead)).toThrow();
    expect(() => assertAdmin(anonymous)).toThrow();
  });
});
