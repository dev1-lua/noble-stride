// F5.6 partner login, end to end at the service level (DB-backed).
// Locks: a partner invite creates a PARTNER account, the SHARED /invite gate
// recognises it (peekInviteToken branches on account.kind), redemption sets a
// usable password, and the resulting session resolves to a partner viewpoint —
// which is the part that was previously impossible.

import { afterAll, beforeAll, describe, expect, it } from "vitest";

const hasDb = Boolean(process.env.DATABASE_URL);
const d = hasDb ? describe : describe.skip;

const UNIQ = `partner-inv-${Date.now()}`;
const BASE_URL = "http://localhost:3000";
const EMAILS = {
  contact: `zz-partner-${UNIQ}@zzadvisors.com`,
  second: `zz-partner2-${UNIQ}@zzadvisors.com`,
  freemail: `zz-partner-${UNIQ}@gmail.com`,
};

let partnerId: string;
let inactivePartnerId: string;

d("partner invites (DB)", () => {
  beforeAll(async () => {
    const { prisma } = await import("@/lib/db");
    const partner = await prisma.partner.create({
      data: { name: `ZZ Savannah Advisors ${UNIQ}`, status: "Active" },
    });
    partnerId = partner.id;
    const inactive = await prisma.partner.create({
      data: { name: `ZZ Dormant Advisors ${UNIQ}`, status: "Inactive" },
    });
    inactivePartnerId = inactive.id;
  });

  afterAll(async () => {
    const { prisma } = await import("@/lib/db");
    await prisma.authAccount.deleteMany({ where: { email: { contains: UNIQ } } });
    await prisma.person.deleteMany({ where: { email: { contains: UNIQ } } });
    await prisma.activity.deleteMany({ where: { subject: { contains: UNIQ } } });
    await prisma.partner.deleteMany({ where: { name: { contains: UNIQ } } });
  });

  it("creates a PARTNER account with a live INVITE token, and reports delivery", async () => {
    const { prisma } = await import("@/lib/db");
    const { createPartnerInvite } = await import("../partner-invites");
    const issued = await createPartnerInvite({
      partnerId,
      name: "Amina Yusuf",
      email: EMAILS.contact,
      invitedByLabel: "Admin",
      baseUrl: BASE_URL,
    });
    expect(typeof issued.emailSent).toBe("boolean");

    const account = await prisma.authAccount.findUnique({
      where: { email: EMAILS.contact },
      include: { person: true },
    });
    expect(account?.kind).toBe("PARTNER");
    // Staff-created, so ACTIVE from the start — the unusable password hash is
    // what keeps it unusable until the invite is redeemed.
    expect(account?.status).toBe("ACTIVE");
    expect(account?.person?.partnerId).toBe(partnerId);
    expect(account?.person?.firstName).toBe("Amina");

    const { verifyPassword } = await import("../password");
    expect(await verifyPassword(account!.passwordHash, "anything-at-all-10")).toBe(false);

    const live = await prisma.authToken.count({
      where: { accountId: account!.id, purpose: "INVITE", usedAt: null, expiresAt: { gt: new Date() } },
    });
    expect(live).toBe(1);
  });

  it("the shared /invite gate reports kind PARTNER and the partner's name", async () => {
    const { createPartnerInvite } = await import("../partner-invites");
    const { peekInviteToken } = await import("../team-invites");
    const issued = await createPartnerInvite({
      partnerId,
      name: "Second Contact",
      email: EMAILS.second,
      invitedByLabel: "Admin",
      baseUrl: BASE_URL,
    });
    const peek = await peekInviteToken(issued.rawToken);
    expect(peek?.kind).toBe("PARTNER");
    expect(peek?.orgName).toContain("ZZ Savannah Advisors");
    expect(peek?.email).toBe(EMAILS.second);
    // Partners have no onboarding queue — an Active partner is "approved".
    expect(peek?.orgApproved).toBe(true);
  });

  it("redeeming a partner invite yields a session that resolves to a partner viewpoint", async () => {
    const { prisma } = await import("@/lib/db");
    const { redeemInvite } = await import("../team-invites");
    const { resolveViewpointFor } = await import("../current");
    const { loginWithPassword } = await import("../login");

    const account = await prisma.authAccount.findUniqueOrThrow({
      where: { email: EMAILS.second },
      include: { person: { include: { investor: true, partner: true } } },
    });
    const token = await prisma.authToken.findFirstOrThrow({
      where: { accountId: account.id, purpose: "INVITE", usedAt: null },
    });
    // The raw token is only returned at creation, so mint a fresh one to redeem.
    const { resendPartnerInvite } = await import("../partner-invites");
    const fresh = await resendPartnerInvite(account.person!.id, partnerId, BASE_URL);
    expect(fresh.rawToken).not.toBe(token.tokenHash);

    const redeemed = await redeemInvite(fresh.rawToken, EMAILS.second, "brand-new-pass-10");
    expect(redeemed).toMatchObject({ ok: true });

    const after = await prisma.authAccount.findUniqueOrThrow({
      where: { email: EMAILS.second },
      include: { person: { include: { investor: true, partner: true } } },
    });
    expect(
      await resolveViewpointFor({ account: after, user: null, person: after.person }),
    ).toEqual({ role: "partner", recordId: partnerId });

    // And a real login lands on the partner portal, not the investor one.
    const res = await loginWithPassword(EMAILS.second, "brand-new-pass-10");
    if (!res.ok) throw new Error(`expected a session, got reason=${res.reason}`);
    expect(res.home).toBe("/portal/partner");
  });

  it("refuses free-provider emails and inactive partners", async () => {
    const { createPartnerInvite, PartnerInviteError } = await import("../partner-invites");
    await expect(createPartnerInvite({
      partnerId, name: "Free Mail", email: EMAILS.freemail, invitedByLabel: "Admin", baseUrl: BASE_URL,
    })).rejects.toBeInstanceOf(PartnerInviteError);
    await expect(createPartnerInvite({
      partnerId: inactivePartnerId,
      name: "Dormant",
      email: `zz-dormant-${UNIQ}@zzadvisors.com`,
      invitedByLabel: "Admin",
      baseUrl: BASE_URL,
    })).rejects.toThrow(/inactive/i);
  });

  it("resend refuses a contact who has already signed in", async () => {
    const { prisma } = await import("@/lib/db");
    const { resendPartnerInvite, PartnerInviteError } = await import("../partner-invites");
    const person = await prisma.person.findFirstOrThrow({ where: { email: EMAILS.second } });
    // The previous test logged this contact in, which stamps lastLoginAt.
    const account = await prisma.authAccount.findUniqueOrThrow({ where: { email: EMAILS.second } });
    expect(account.lastLoginAt).not.toBeNull();
    await expect(resendPartnerInvite(person.id, partnerId, BASE_URL)).rejects.toBeInstanceOf(PartnerInviteError);
  });

  it("listPartnerAccounts and listInvitablePartnerContacts split contacts by access", async () => {
    const { prisma } = await import("@/lib/db");
    const { listPartnerAccounts, listInvitablePartnerContacts } = await import("../partner-invites");
    // A staff-created contact with no login yet.
    await prisma.person.create({
      data: { firstName: "No", lastName: "Login", email: `zz-nologin-${UNIQ}@zzadvisors.com`, partnerId },
    });
    const accounts = await listPartnerAccounts(partnerId);
    expect(accounts.map((a) => a.email).sort()).toEqual([EMAILS.contact, EMAILS.second].sort());
    expect(accounts.every((a) => a.status === "ACTIVE")).toBe(true);

    const invitable = await listInvitablePartnerContacts(partnerId);
    expect(invitable.map((c) => c.email)).toEqual([`zz-nologin-${UNIQ}@zzadvisors.com`]);
  });
});
