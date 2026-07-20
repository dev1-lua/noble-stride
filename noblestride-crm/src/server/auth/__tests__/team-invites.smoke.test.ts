// Team-invite smoke tests (DB-backed, same fixture style as
// accounts.smoke.test.ts). Locks the share-link security model: server-bound
// email, consume-once token, unusable password pre-redemption, pending-org
// gate, no-enumeration errors, self-removal ban.

import { afterAll, beforeAll, describe, expect, it } from "vitest";

const hasDb = Boolean(process.env.DATABASE_URL);
const d = hasDb ? describe : describe.skip;

const UNIQ = `team-inv-${Date.now()}`;
const EMAILS = {
  prime: `zz-prime-${UNIQ}@zzexample-fund.com`,
  member: `zz-member-${UNIQ}@zzexample-fund.com`,
  member2: `zz-member2-${UNIQ}@zzexample-fund.com`,
  taken: `zz-taken-${UNIQ}@zzother-fund.com`,
  freemail: `zz-${UNIQ}@gmail.com`,
  pendingOrg: `zz-pending-${UNIQ}@zzexample-fund.com`,
};

let approvedInvestorId: string;
let pendingInvestorId: string;
let primaryPersonId: string;

d("team invites (DB)", () => {
  beforeAll(async () => {
    const { prisma } = await import("@/lib/db");
    const approved = await prisma.investor.create({
      data: { name: `ZZ Fund ${UNIQ}`, investorType: "PrivateEquity", onboardingStatus: "Approved" },
    });
    approvedInvestorId = approved.id;
    const primary = await prisma.person.create({
      data: { firstName: "Prime", email: EMAILS.prime, isPrimaryContact: true, investorId: approved.id },
    });
    primaryPersonId = primary.id;
    // An unrelated org already owning EMAILS.taken (cross-org rejection case).
    const other = await prisma.investor.create({
      data: { name: `ZZ Other ${UNIQ}`, investorType: "VentureCapital", onboardingStatus: "Approved" },
    });
    await prisma.person.create({ data: { firstName: "Taken", email: EMAILS.taken, investorId: other.id } });
    const pending = await prisma.investor.create({
      data: { name: `ZZ Pending ${UNIQ}`, investorType: "PrivateEquity", onboardingStatus: "PendingReview" },
    });
    pendingInvestorId = pending.id;
  });

  afterAll(async () => {
    const { prisma } = await import("@/lib/db");
    await prisma.authAccount.deleteMany({ where: { email: { contains: UNIQ } } });
    await prisma.activity.deleteMany({ where: { investorId: { in: [approvedInvestorId, pendingInvestorId] } } });
    await prisma.person.deleteMany({ where: { email: { contains: UNIQ } } });
    await prisma.investor.deleteMany({ where: { name: { contains: UNIQ } } });
  });

  it("creates member + ACTIVE account + redeemable link for an approved org", async () => {
    const { prisma } = await import("@/lib/db");
    const { createTeamInvite, redeemInvite } = await import("../team-invites");
    const { rawToken } = await createTeamInvite({
      investorId: approvedInvestorId, name: "Priya Patel", email: EMAILS.member, invitedByLabel: "Prime",
    });
    const account = await prisma.authAccount.findUnique({
      where: { email: EMAILS.member }, include: { person: true },
    });
    expect(account?.kind).toBe("INVESTOR");
    expect(account?.status).toBe("ACTIVE");
    expect(account?.person?.investorId).toBe(approvedInvestorId);
    expect(account?.person?.firstName).toBe("Priya");

    // Pre-redemption the password is unusable.
    const { verifyPassword } = await import("../password");
    expect(await verifyPassword(account!.passwordHash, "anything-at-all-10")).toBe(false);

    // Wrong email at the gate → generic email error; right email redeems.
    const wrong = await redeemInvite(rawToken, EMAILS.member2, "brand-new-pass-10");
    expect(wrong).toMatchObject({ ok: false, reason: "email" });
    const right = await redeemInvite(rawToken, EMAILS.member.toUpperCase(), "brand-new-pass-10");
    expect(right).toMatchObject({ ok: true });
    const after = await prisma.authAccount.findUnique({ where: { email: EMAILS.member } });
    expect(await verifyPassword(after!.passwordHash, "brand-new-pass-10")).toBe(true);

    // Consume-once: a second redemption of the same token fails.
    const again = await redeemInvite(rawToken, EMAILS.member, "another-pass-1010");
    expect(again).toMatchObject({ ok: false, reason: "invalid" });
  });

  it("rejects free-provider and already-taken emails with TeamInviteError", async () => {
    const { TeamInviteError, createTeamInvite } = await import("../team-invites");
    await expect(createTeamInvite({
      investorId: approvedInvestorId, name: "X", email: EMAILS.freemail, invitedByLabel: "Prime",
    })).rejects.toBeInstanceOf(TeamInviteError);
    await expect(createTeamInvite({
      investorId: approvedInvestorId, name: "X", email: EMAILS.taken, invitedByLabel: "Prime",
    })).rejects.toBeInstanceOf(TeamInviteError);
    // Own-team duplicate points at resend instead of creating a second Person.
    await expect(createTeamInvite({
      investorId: approvedInvestorId, name: "X", email: EMAILS.prime, invitedByLabel: "Prime",
    })).rejects.toThrow(/already on your team/);
  });

  it("pending org: account lands PENDING and redemption is gated until approval", async () => {
    const { prisma } = await import("@/lib/db");
    const { createTeamInvite, redeemInvite } = await import("../team-invites");
    const { rawToken } = await createTeamInvite({
      investorId: pendingInvestorId, name: "Waiting One", email: EMAILS.pendingOrg, invitedByLabel: "Founder",
    });
    const account = await prisma.authAccount.findUnique({ where: { email: EMAILS.pendingOrg } });
    expect(account?.status).toBe("PENDING");
    const res = await redeemInvite(rawToken, EMAILS.pendingOrg, "brand-new-pass-10");
    expect(res).toMatchObject({ ok: false, reason: "pending" });
    // Staff approve → same link now works.
    await prisma.investor.update({ where: { id: pendingInvestorId }, data: { onboardingStatus: "Approved" } });
    const ok = await redeemInvite(rawToken, EMAILS.pendingOrg, "brand-new-pass-10");
    expect(ok).toMatchObject({ ok: true });
  });

  it("resend invalidates the old link; revoke deletes the pre-login account (no resurrection)", async () => {
    const { prisma } = await import("@/lib/db");
    const { createTeamInvite, resendTeamInvite, revokeTeamInvite, redeemInvite, inviteExistingContact } =
      await import("../team-invites");
    const { personId, rawToken: first } = await createTeamInvite({
      investorId: approvedInvestorId, name: "Rene Vue", email: EMAILS.member2, invitedByLabel: "Prime",
    });
    const second = await resendTeamInvite(personId, approvedInvestorId);
    expect(await redeemInvite(first, EMAILS.member2, "brand-new-pass-10")).toMatchObject({ ok: false, reason: "invalid" });
    await revokeTeamInvite(personId, approvedInvestorId);
    expect(await redeemInvite(second, EMAILS.member2, "brand-new-pass-10")).toMatchObject({ ok: false, reason: "invalid" });
    // The seat is gone entirely, not merely suspended — org approval can't
    // resurrect it (activateAccountsForInvestor only ever sees an existing row).
    const account = await prisma.authAccount.findFirst({ where: { email: EMAILS.member2 } });
    expect(account).toBeNull();
    // Re-inviting the now account-less Person goes through inviteExistingContact
    // and yields a fresh redeemable link — the Team page's "Invite" affordance.
    const third = await inviteExistingContact(personId, approvedInvestorId, "Prime");
    expect(typeof third).toBe("string");
    expect(await redeemInvite(third, EMAILS.member2, "brand-new-pass-12")).toMatchObject({ ok: true });
  });

  it("removeTeamMember deletes the account + keeps the Person; self-removal is refused", async () => {
    const { prisma } = await import("@/lib/db");
    const { TeamInviteError, removeTeamMember } = await import("../team-invites");
    const member = await prisma.person.findFirst({ where: { email: EMAILS.member } });
    await removeTeamMember(member!.id, approvedInvestorId, primaryPersonId);
    const account = await prisma.authAccount.findUnique({ where: { email: EMAILS.member } });
    expect(account).toBeNull();
    expect(await prisma.person.findUnique({ where: { id: member!.id } })).not.toBeNull();
    await expect(removeTeamMember(primaryPersonId, approvedInvestorId, primaryPersonId))
      .rejects.toBeInstanceOf(TeamInviteError);
  });
});
