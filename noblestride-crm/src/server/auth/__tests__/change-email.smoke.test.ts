// F3.6 end to end at the service level (DB-backed). The bug this fixes was
// silent: Person.email moved, AuthAccount.email did not, and nobody noticed
// until the person tried to sign in. So these tests assert BOTH rows, plus the
// audit trail and the session kill that make the change safe.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Actor } from "@/graphql/context";

const hasDb = Boolean(process.env.DATABASE_URL);
const d = hasDb ? describe : describe.skip;

const UNIQ = `chg-email-${Date.now()}`;
const EMAILS = {
  start: `zz-start-${UNIQ}@zzexample-fund.com`,
  staffMoved: `zz-moved-${UNIQ}@zzexample-fund.com`,
  selfService: `zz-self-${UNIQ}@zzexample-fund.com`,
  taken: `zz-taken-${UNIQ}@zzother-fund.com`,
  freemail: `zz-${UNIQ}@gmail.com`,
  internal: `zz-${UNIQ}@noblestride.capital`,
};

const ACTOR: Actor = { type: "HUMAN", authenticated: true } as Actor;

let investorId: string;
let personId: string;
let accountId: string;

d("change-email (DB)", () => {
  beforeAll(async () => {
    const { prisma } = await import("@/lib/db");
    const { hashPassword } = await import("../password");
    const investor = await prisma.investor.create({
      data: { name: `ZZ EmailFund ${UNIQ}`, investorType: "PrivateEquity", onboardingStatus: "Approved" },
    });
    investorId = investor.id;
    const person = await prisma.person.create({
      data: { firstName: "Email", lastName: "Mover", email: EMAILS.start, investorId, isPrimaryContact: true },
    });
    personId = person.id;
    const account = await prisma.authAccount.create({
      data: {
        email: EMAILS.start,
        passwordHash: await hashPassword("Str0ng!Passw0rd"),
        kind: "INVESTOR",
        status: "ACTIVE",
        personId: person.id,
      },
    });
    accountId = account.id;
    // An unrelated org already owning EMAILS.taken.
    const other = await prisma.investor.create({
      data: { name: `ZZ EmailOther ${UNIQ}`, investorType: "VentureCapital", onboardingStatus: "Approved" },
    });
    await prisma.person.create({ data: { firstName: "Taken", email: EMAILS.taken, investorId: other.id } });
  });

  afterAll(async () => {
    const { prisma } = await import("@/lib/db");
    await prisma.authAccount.deleteMany({ where: { email: { contains: UNIQ } } });
    await prisma.activity.deleteMany({ where: { investorId } });
    await prisma.stageChange.deleteMany({ where: { investorId } });
    await prisma.person.deleteMany({ where: { email: { contains: UNIQ } } });
    await prisma.investor.deleteMany({ where: { name: { contains: UNIQ } } });
  });

  it("a staff change moves the account AND the contact, audits it, and kills sessions", async () => {
    const { prisma } = await import("@/lib/db");
    const { changeAccountEmailByStaff } = await import("../change-email");
    const { createSession, validateSessionToken } = await import("../session");

    const { token } = await createSession(accountId, {});
    expect(await validateSessionToken(token)).not.toBeNull();

    const res = await changeAccountEmailByStaff(accountId, EMAILS.staffMoved.toUpperCase(), ACTOR);
    expect(res).toMatchObject({ oldEmail: EMAILS.start, newEmail: EMAILS.staffMoved });

    const account = await prisma.authAccount.findUniqueOrThrow({ where: { id: accountId } });
    expect(account.email).toBe(EMAILS.staffMoved);
    const person = await prisma.person.findUniqueOrThrow({ where: { id: personId } });
    expect(person.email).toBe(EMAILS.staffMoved);

    // The change is a credential change — every existing session must be dead.
    expect(await validateSessionToken(token)).toBeNull();

    const change = await prisma.stageChange.findFirst({
      where: { investorId, field: "email" },
      orderBy: { changedAt: "desc" },
    });
    expect(change).toMatchObject({ fromValue: EMAILS.start, toValue: EMAILS.staffMoved });
    const activity = await prisma.activity.findFirst({
      where: { investorId, subject: { startsWith: "Sign-in email changed" } },
    });
    expect(activity?.subject).toContain(EMAILS.staffMoved);
  });

  it("refuses an address in use, a free provider, an internal domain, and a no-op", async () => {
    const { changeAccountEmailByStaff, EmailChangeError } = await import("../change-email");
    await expect(changeAccountEmailByStaff(accountId, EMAILS.taken, ACTOR)).rejects.toBeInstanceOf(EmailChangeError);
    await expect(changeAccountEmailByStaff(accountId, EMAILS.freemail, ACTOR)).rejects.toBeInstanceOf(EmailChangeError);
    // An external account may never take an internal address.
    await expect(changeAccountEmailByStaff(accountId, EMAILS.internal, ACTOR)).rejects.toThrow(/noblestride\.capital/);
    await expect(changeAccountEmailByStaff(accountId, EMAILS.staffMoved, ACTOR)).rejects.toThrow(/already/i);
  });

  it("self-service parks the address and leaves the login untouched until confirmed", async () => {
    const { prisma } = await import("@/lib/db");
    const { requestEmailChangeSelfService } = await import("../change-email");

    const res = await requestEmailChangeSelfService(accountId, EMAILS.selfService);
    expect(res.pendingEmail).toBe(EMAILS.selfService);

    const account = await prisma.authAccount.findUniqueOrThrow({ where: { id: accountId } });
    // The whole point: nothing about signing in has changed yet.
    expect(account.email).toBe(EMAILS.staffMoved);
    expect(account.pendingEmail).toBe(EMAILS.selfService);
    expect(account.pendingEmailRequestedAt).not.toBeNull();

    const tokens = await prisma.authToken.count({
      where: { accountId, purpose: "VERIFY_EMAIL", usedAt: null, expiresAt: { gt: new Date() } },
    });
    expect(tokens).toBe(1);
  });

  it("a second request supersedes the first, so only one link stays live", async () => {
    const { prisma } = await import("@/lib/db");
    const { requestEmailChangeSelfService } = await import("../change-email");
    await requestEmailChangeSelfService(accountId, EMAILS.selfService);
    const live = await prisma.authToken.count({
      where: { accountId, purpose: "VERIFY_EMAIL", usedAt: null, expiresAt: { gt: new Date() } },
    });
    expect(live).toBe(1);
  });

  it("confirming flips the login, clears the pending address, and burns the token", async () => {
    const { prisma } = await import("@/lib/db");
    const { requestEmailChangeSelfService, confirmEmailChange } = await import("../change-email");
    const { hashToken } = await import("../session");

    // requestEmailChangeSelfService returns no raw token (it is emailed), so
    // drive it the way the mail does: request, then read the row it created.
    // The raw token is unknowable from the DB, so mint one we hold instead.
    const { createAuthToken } = await import("../tokens");
    await requestEmailChangeSelfService(accountId, EMAILS.selfService);
    await prisma.authToken.deleteMany({ where: { accountId, purpose: "VERIFY_EMAIL", usedAt: null } });
    const raw = await createAuthToken(accountId, "VERIFY_EMAIL", 60 * 60 * 1000);

    const res = await confirmEmailChange(raw);
    expect(res).toEqual({ ok: true, email: EMAILS.selfService });

    const account = await prisma.authAccount.findUniqueOrThrow({ where: { id: accountId } });
    expect(account.email).toBe(EMAILS.selfService);
    expect(account.pendingEmail).toBeNull();
    expect(account.pendingEmailRequestedAt).toBeNull();
    const person = await prisma.person.findUniqueOrThrow({ where: { id: personId } });
    expect(person.email).toBe(EMAILS.selfService);

    const used = await prisma.authToken.findUnique({ where: { tokenHash: hashToken(raw) } });
    expect(used?.usedAt).not.toBeNull();

    // Consume-once: replaying the link fails.
    expect(await confirmEmailChange(raw)).toMatchObject({ ok: false });
  });

  it("an unknown or purposeless token is refused without touching the account", async () => {
    const { confirmEmailChange } = await import("../change-email");
    expect(await confirmEmailChange("not-a-real-token")).toMatchObject({ ok: false });
  });
});
