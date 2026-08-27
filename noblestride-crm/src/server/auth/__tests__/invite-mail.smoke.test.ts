// F3.5 delivery contract (DB-backed). The point of these tests is not that a
// mail arrives — no provider is configured locally — but that every issuing
// path REPORTS delivery, mints exactly one live INVITE token, and survives a
// mail transport that is unavailable. Without a RESEND_API_KEY the console
// mailer succeeds, so emailSent is true here; the {sent:false} branch is
// covered by the unit tests in auth-mail.test.ts.

import { afterAll, beforeAll, describe, expect, it } from "vitest";

const hasDb = Boolean(process.env.DATABASE_URL);
const d = hasDb ? describe : describe.skip;

const UNIQ = `inv-mail-${Date.now()}`;
const BASE_URL = "http://localhost:3000";
const EMAILS = {
  member: `zz-mail-${UNIQ}@zzexample-fund.com`,
  pending: `zz-pending-${UNIQ}@zzexample-fund.com`,
};

let investorId: string;
let pendingInvestorId: string;

async function liveInviteTokens(email: string): Promise<number> {
  const { prisma } = await import("@/lib/db");
  const account = await prisma.authAccount.findUnique({ where: { email }, select: { id: true } });
  if (!account) return 0;
  return prisma.authToken.count({
    where: { accountId: account.id, purpose: "INVITE", usedAt: null, expiresAt: { gt: new Date() } },
  });
}

d("invite mail delivery (DB)", () => {
  beforeAll(async () => {
    const { prisma } = await import("@/lib/db");
    const approved = await prisma.investor.create({
      data: { name: `ZZ MailFund ${UNIQ}`, investorType: "PrivateEquity", onboardingStatus: "Approved" },
    });
    investorId = approved.id;
    const pending = await prisma.investor.create({
      data: { name: `ZZ MailPending ${UNIQ}`, investorType: "PrivateEquity", onboardingStatus: "PendingReview" },
    });
    pendingInvestorId = pending.id;
  });

  afterAll(async () => {
    const { prisma } = await import("@/lib/db");
    await prisma.authAccount.deleteMany({ where: { email: { contains: UNIQ } } });
    await prisma.activity.deleteMany({ where: { investorId: { in: [investorId, pendingInvestorId] } } });
    await prisma.person.deleteMany({ where: { email: { contains: UNIQ } } });
    await prisma.investor.deleteMany({ where: { name: { contains: UNIQ } } });
  });

  it("createTeamInvite reports delivery and leaves exactly one live INVITE token", async () => {
    const { createTeamInvite } = await import("../team-invites");
    const issued = await createTeamInvite({
      investorId,
      name: "Mail Tester",
      email: EMAILS.member,
      invitedByLabel: "Prime",
      baseUrl: BASE_URL,
    });
    expect(typeof issued.emailSent).toBe("boolean");
    expect(issued.email).toBe(EMAILS.member);
    expect(issued.rawToken.length).toBeGreaterThan(20);
    expect(await liveInviteTokens(EMAILS.member)).toBe(1);
  });

  it("resendTeamInvite replaces the outstanding token rather than adding one", async () => {
    const { prisma } = await import("@/lib/db");
    const { resendTeamInvite } = await import("../team-invites");
    const person = await prisma.person.findFirstOrThrow({ where: { email: EMAILS.member } });
    const again = await resendTeamInvite(person.id, investorId, BASE_URL, "Prime");
    expect(typeof again.emailSent).toBe("boolean");
    expect(await liveInviteTokens(EMAILS.member)).toBe(1);
  });

  it("sendPendingMemberInvites invites approval-pending members once, and is idempotent", async () => {
    const { prisma } = await import("@/lib/db");
    const { sendPendingMemberInvites } = await import("../pending-member-invites");
    const { unusablePasswordHash } = await import("../team-invites");

    // A member exactly as registration leaves them: ACTIVE account (the org was
    // just approved), never signed in, no invite token yet.
    const person = await prisma.person.create({
      data: { firstName: "Pending", email: EMAILS.pending, investorId: pendingInvestorId },
    });
    await prisma.authAccount.create({
      data: {
        email: EMAILS.pending,
        passwordHash: await unusablePasswordHash(),
        kind: "INVESTOR",
        status: "ACTIVE",
        personId: person.id,
      },
    });

    const first = await sendPendingMemberInvites(pendingInvestorId, BASE_URL);
    expect(first.invited).toBe(1);
    expect(await liveInviteTokens(EMAILS.pending)).toBe(1);

    // Re-approving must not re-issue: the outstanding token is still live.
    const second = await sendPendingMemberInvites(pendingInvestorId, BASE_URL);
    expect(second.invited).toBe(0);
    expect(await liveInviteTokens(EMAILS.pending)).toBe(1);

    const activity = await prisma.activity.findFirst({
      where: { investorId: pendingInvestorId, subject: "Team invitations emailed" },
    });
    expect(activity?.body).toContain(EMAILS.pending);
  });

  it("sendPendingMemberInvites skips the primary contact and anyone who has signed in", async () => {
    const { prisma } = await import("@/lib/db");
    const { sendPendingMemberInvites } = await import("../pending-member-invites");
    const { unusablePasswordHash } = await import("../team-invites");

    const primaryEmail = `zz-primary-${UNIQ}@zzexample-fund.com`;
    const returningEmail = `zz-returning-${UNIQ}@zzexample-fund.com`;
    for (const [email, extra] of [
      [primaryEmail, { isPrimaryContact: true }],
      [returningEmail, {}],
    ] as const) {
      const person = await prisma.person.create({
        data: { firstName: "Skipped", email, investorId, ...extra },
      });
      await prisma.authAccount.create({
        data: {
          email,
          passwordHash: await unusablePasswordHash(),
          kind: "INVESTOR",
          status: "ACTIVE",
          personId: person.id,
          // The returning member has already signed in.
          ...(email === returningEmail ? { lastLoginAt: new Date() } : {}),
        },
      });
    }

    const res = await sendPendingMemberInvites(investorId, BASE_URL);
    expect(res.invited).toBe(0);
    expect(await liveInviteTokens(primaryEmail)).toBe(0);
    expect(await liveInviteTokens(returningEmail)).toBe(0);
  });

  it("issueStaffResetLink returns a usable link and reports delivery", async () => {
    const { prisma } = await import("@/lib/db");
    const { issueStaffResetLink } = await import("../reset");
    const account = await prisma.authAccount.findUniqueOrThrow({ where: { email: EMAILS.member } });
    const res = await issueStaffResetLink(account.id, BASE_URL);
    expect(res.email).toBe(EMAILS.member);
    expect(typeof res.emailSent).toBe("boolean");
    expect(res.url).toMatch(new RegExp(`^${BASE_URL}/reset-password/.+`));
    const live = await prisma.authToken.count({
      where: { accountId: account.id, purpose: "RESET_PASSWORD", usedAt: null },
    });
    expect(live).toBe(1);
  });

  it("issueStaffResetLink refuses an unknown account id", async () => {
    const { issueStaffResetLink } = await import("../reset");
    const { AuthFlowError } = await import("../accounts");
    await expect(issueStaffResetLink("zz-no-such-account", BASE_URL)).rejects.toBeInstanceOf(AuthFlowError);
  });
});
