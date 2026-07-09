import { afterAll, describe, expect, it } from "vitest";
import { isUniqueViolation } from "../accounts";

const hasDb = Boolean(process.env.DATABASE_URL);
const d = hasDb ? describe : describe.skip;

describe("isUniqueViolation", () => {
  it("is true for a Prisma P2002 unique-constraint error", () => {
    expect(isUniqueViolation({ code: "P2002" })).toBe(true);
  });

  it("is false for other Prisma error codes", () => {
    expect(isUniqueViolation({ code: "P2025" })).toBe(false);
  });

  it("is false for null", () => {
    expect(isUniqueViolation(null)).toBe(false);
  });

  it("is false for a plain Error without a code", () => {
    expect(isUniqueViolation(new Error("x"))).toBe(false);
  });
});

// Note: markers are kept lowercase — AuthAccount.email is always stored
// lowercase (normalizeEmail), and Postgres string equality is case-sensitive,
// so a mixed-case literal here would never match the persisted row.
const EMAILS = {
  directory: "zz-test-directory-uniq@noblestride.capital",
  unknownInternal: "zz-test-newstaff-uniq@noblestride.capital",
  freemail: "zz-test-uniq@gmail.com",
  contact: "zz-test-contact-uniq@zzexample-fund.com",
};

d("accounts core (DB)", () => {
  afterAll(async () => {
    const { prisma } = await import("@/lib/db");
    await prisma.authAccount.deleteMany({ where: { email: { in: Object.values(EMAILS) } } });
    await prisma.user.deleteMany({ where: { email: { in: [EMAILS.directory, EMAILS.unknownInternal] } } });
    await prisma.person.deleteMany({ where: { email: EMAILS.contact } });
    await prisma.investor.deleteMany({ where: { name: "ZZ Test Fund UNIQ-accounts" } });
    await prisma.activity.deleteMany({ where: { subject: { contains: "zz-test-" } } });
  });

  it("internal signup with a directory match activates immediately with the User's role", async () => {
    const { prisma } = await import("@/lib/db");
    const { signupInternal } = await import("../accounts");
    const user = await prisma.user.create({
      data: { name: "ZZ Test Staff", email: EMAILS.directory, role: "DealLead" },
    });
    const res = await signupInternal({ email: EMAILS.directory, name: "ZZ Test Staff", password: "long-enough-pass-1" });
    expect(res.status).toBe("active");
    const account = await prisma.authAccount.findUnique({ where: { email: EMAILS.directory } });
    expect(account?.status).toBe("ACTIVE");
    expect(account?.userId).toBe(user.id);
    expect(account?.kind).toBe("INTERNAL");
  });

  it("internal signup without a directory match lands PENDING; approval creates the User", async () => {
    const { prisma } = await import("@/lib/db");
    const { signupInternal, approveInternalAccount } = await import("../accounts");
    const res = await signupInternal({
      email: EMAILS.unknownInternal, name: "ZZ New Staff", jobTitle: "Analyst", password: "long-enough-pass-1",
    });
    expect(res.status).toBe("pending");
    const account = await prisma.authAccount.findUnique({ where: { email: EMAILS.unknownInternal } });
    expect(account?.status).toBe("PENDING");
    const approver = await prisma.user.findFirst({ where: { email: EMAILS.directory } });
    await approveInternalAccount(account!.id, "TeamMember", approver!.id);
    const after = await prisma.authAccount.findUnique({
      where: { email: EMAILS.unknownInternal }, include: { user: true },
    });
    expect(after?.status).toBe("ACTIVE");
    expect(after?.user?.role).toBe("TeamMember");
    expect(after?.user?.name).toBe("ZZ New Staff");
  });

  it("rejects free-mail and duplicate signups with AuthFlowError", async () => {
    const { AuthFlowError, signupInternal, signupExistingContact } = await import("../accounts");
    await expect(signupExistingContact({ email: EMAILS.freemail, password: "long-enough-pass-1" }))
      .rejects.toBeInstanceOf(AuthFlowError);
    await expect(signupInternal({ email: EMAILS.directory, name: "x", password: "long-enough-pass-1" }))
      .rejects.toBeInstanceOf(AuthFlowError); // account already exists
  });

  it("existing investor-contact signup lands PENDING; investor activation flips it ACTIVE", async () => {
    const { prisma } = await import("@/lib/db");
    const { signupExistingContact, activateAccountsForInvestor, suspendAccountsForInvestor } = await import("../accounts");
    const investor = await prisma.investor.create({
      data: { name: "ZZ Test Fund UNIQ-accounts", investorType: "PrivateEquity", onboardingStatus: "Approved" },
    });
    await prisma.person.create({
      data: { firstName: "ZZ", lastName: "Contact", email: EMAILS.contact, investorId: investor.id, isPrimaryContact: true },
    });
    const res = await signupExistingContact({ email: EMAILS.contact, password: "long-enough-pass-1" });
    expect(res.status).toBe("pending");
    await activateAccountsForInvestor(investor.id);
    let account = await prisma.authAccount.findUnique({ where: { email: EMAILS.contact } });
    expect(account?.status).toBe("ACTIVE");
    await suspendAccountsForInvestor(investor.id);
    account = await prisma.authAccount.findUnique({ where: { email: EMAILS.contact } });
    expect(account?.status).toBe("SUSPENDED");
  });
});
