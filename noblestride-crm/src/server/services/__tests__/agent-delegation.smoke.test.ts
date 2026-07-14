// DB-backed smoke tests for the delegated-actor foundation: resolveDelegatedActor
// resolves the x-agent-key transport to the real staff user it acts for, and the
// RBAC automation bypass must NOT apply to that resolved actor (spec §5.1).
// Follows the setup/teardown convention of client-intake.smoke.test.ts.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { resolveDelegatedActor, resolveStaffUserSummary } from "@/server/services/agent-delegation";
import { assertCan } from "@/server/rbac/enforce";

describe("resolveDelegatedActor", () => {
  let adminId: string, memberId: string;

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: "zztest." } } });
    adminId = (
      await prisma.user.create({ data: { name: "ZZTest Admin", email: "zztest.admin@noblestride.co.ke", role: "Admin" } })
    ).id;
    memberId = (
      await prisma.user.create({
        data: { name: "ZZTest Member", email: "zztest.member@noblestride.co.ke", role: "TeamMember" },
      })
    ).id;
    await prisma.user.create({
      data: { name: "ZZTest Gone", email: "zztest.gone@noblestride.co.ke", role: "Admin", isActive: false },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: "zztest." } } });
  });

  it("resolves an active user case-insensitively with real role", async () => {
    const actor = await resolveDelegatedActor("ZZTEST.ADMIN@noblestride.co.ke");
    expect(actor).toMatchObject({
      type: "AGENT",
      authenticated: true,
      delegated: true,
      userId: adminId,
      orgRole: "Admin",
      accountKind: "INTERNAL",
    });
  });

  it("rejects unknown email", async () => {
    await expect(resolveDelegatedActor("zztest.nobody@x.com")).rejects.toThrow(/no active crm user/i);
  });

  it("rejects inactive user", async () => {
    await expect(resolveDelegatedActor("zztest.gone@noblestride.co.ke")).rejects.toThrow(/no active crm user/i);
  });

  it("rejects blank email", async () => {
    await expect(resolveDelegatedActor("  ")).rejects.toThrow();
  });

  it("delegated actor does NOT get the automation RBAC bypass", async () => {
    const member = await resolveDelegatedActor("zztest.member@noblestride.co.ke");
    expect(() => assertCan(member, "Clients", "U")).toThrow(/not authorized/i); // TeamMember can't update Clients
    const nonDelegated = { type: "AGENT" as const, authenticated: true };
    expect(() => assertCan(nonDelegated, "Clients", "U")).not.toThrow(); // existing bypass unchanged
    expect(member.userId).toBe(memberId);
  });
});

describe("resolveStaffUserSummary", () => {
  let adminId: string;

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: "zztest." } } });
    adminId = (
      await prisma.user.create({ data: { name: "ZZTest Admin", email: "zztest.admin@noblestride.co.ke", role: "Admin" } })
    ).id;
    await prisma.user.create({
      data: { name: "ZZTest Gone", email: "zztest.gone@noblestride.co.ke", role: "Admin", isActive: false },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: "zztest." } } });
  });

  it("returns ok + firstName for an active user", async () => {
    const result = await resolveStaffUserSummary("zztest.admin@noblestride.co.ke");
    expect(result).toEqual({ ok: true, firstName: "ZZTest" });
    expect(adminId).toBeTruthy();
  });

  it("returns the same shape for an unknown email (no enumeration)", async () => {
    const result = await resolveStaffUserSummary("zztest.nobody@x.com");
    expect(result).toEqual({ ok: false, firstName: null });
  });

  it("returns the same shape for an inactive user (no enumeration)", async () => {
    const result = await resolveStaffUserSummary("zztest.gone@noblestride.co.ke");
    expect(result).toEqual({ ok: false, firstName: null });
  });
});
