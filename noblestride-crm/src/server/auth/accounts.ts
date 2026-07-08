// Account lifecycle (real-auth spec §6): signup paths, admin approval,
// suspension. All emails lowercase. AuthFlowError messages are user-safe.

import type { OrgRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { classifyEmail, classifyEmailForSignup, normalizeEmail } from "./guardrails";
import { hashPassword } from "./password";
import { validatePassword } from "./policy";
import { invalidateAllSessions } from "./session";
import { logAuthEvent } from "./audit";

export class AuthFlowError extends Error {}

const GENERIC_EXISTS = "An account with this email already exists. Try signing in instead.";

async function assertNoAccount(email: string): Promise<void> {
  const existing = await prisma.authAccount.findUnique({ where: { email }, select: { id: true } });
  if (existing) throw new AuthFlowError(GENERIC_EXISTS);
}

/** True when `err` is a Prisma unique-constraint violation (P2002). */
export function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: unknown }).code === "P2002";
}

function assertPassword(password: string, email: string): void {
  const err = validatePassword(password, email);
  if (err) throw new AuthFlowError(err);
}

export async function signupInternal(input: {
  email: string;
  name: string;
  jobTitle?: string;
  password: string;
}): Promise<{ status: "active" | "pending" }> {
  const email = normalizeEmail(input.email);
  if (classifyEmail(email).kind !== "internal") {
    throw new AuthFlowError("Internal accounts require a @noblestride.capital email.");
  }
  assertPassword(input.password, email);
  await assertNoAccount(email);
  const passwordHash = await hashPassword(input.password);

  const directoryUser = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  });
  if (directoryUser) {
    if (!directoryUser.isActive) throw new AuthFlowError("This account is deactivated. Contact an administrator.");
    try {
      await prisma.authAccount.create({
        data: { email, passwordHash, kind: "INTERNAL", status: "ACTIVE", userId: directoryUser.id },
      });
    } catch (err) {
      if (isUniqueViolation(err)) throw new AuthFlowError(GENERIC_EXISTS);
      throw err;
    }
    await logAuthEvent(`Auth: internal account activated (directory match) for ${email}`);
    return { status: "active" };
  }
  try {
    await prisma.authAccount.create({
      data: { email, passwordHash, kind: "INTERNAL", status: "PENDING", displayName: input.name, jobTitle: input.jobTitle },
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new AuthFlowError(GENERIC_EXISTS);
    throw err;
  }
  await logAuthEvent(`Auth: internal account requested for ${email} — awaiting admin approval`);
  return { status: "pending" };
}

export async function signupExistingContact(input: {
  email: string;
  password: string;
}): Promise<{ status: "pending" }> {
  const email = normalizeEmail(input.email);
  const cls = await classifyEmailForSignup(email);
  if (cls.kind === "blocked") {
    throw new AuthFlowError(
      cls.reason === "free-provider"
        ? "Please use your official company email — free providers (Gmail, Yahoo, …) are not accepted."
        : "This email is not eligible to register. Contact NobleStride if you believe this is an error.",
    );
  }
  if (cls.kind === "internal") throw new AuthFlowError("NobleStride staff should use the internal sign-up.");
  assertPassword(input.password, email);
  await assertNoAccount(email);

  const person = await prisma.person.findFirst({
    where: { email: { equals: email, mode: "insensitive" }, investorId: { not: null } },
    orderBy: { createdAt: "desc" },
  });
  if (!person) {
    throw new AuthFlowError("No investor contact found for this email. Register your fund first.");
  }
  const passwordHash = await hashPassword(input.password);
  try {
    await prisma.authAccount.create({
      data: { email, passwordHash, kind: "INVESTOR", status: "PENDING", personId: person.id },
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new AuthFlowError(GENERIC_EXISTS);
    throw err;
  }
  await logAuthEvent(
    `Auth: investor account requested for ${email} — awaiting review`,
    undefined,
    { investorId: person.investorId ?? undefined },
  );
  return { status: "pending" };
}

export async function approveInternalAccount(accountId: string, role: OrgRole, approvedByUserId: string): Promise<void> {
  const account = await prisma.authAccount.findUniqueOrThrow({ where: { id: accountId } });
  if (account.kind !== "INTERNAL" || account.status !== "PENDING") {
    throw new AuthFlowError("Only pending internal accounts can be approved this way.");
  }
  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: account.displayName ?? account.email.split("@")[0],
          email: account.email,
          jobTitle: account.jobTitle,
          role,
        },
      });
      await tx.authAccount.update({
        where: { id: account.id },
        data: { status: "ACTIVE", userId: user.id },
      });
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new AuthFlowError(
        "A directory user with this email already exists. Link it from the user management page or reject this request.",
      );
    }
    throw err;
  }
  await logAuthEvent(`Auth: internal account approved for ${account.email} (role ${role}) by user ${approvedByUserId}`);
}

export async function rejectPendingAccount(accountId: string, byUserId: string): Promise<void> {
  const account = await prisma.authAccount.findUniqueOrThrow({ where: { id: accountId } });
  if (account.status !== "PENDING") throw new AuthFlowError("Only pending accounts can be rejected.");
  await prisma.authAccount.delete({ where: { id: accountId } });
  await logAuthEvent(`Auth: pending account rejected for ${account.email} by user ${byUserId}`);
}

export async function suspendAccount(accountId: string, byUserId: string): Promise<void> {
  const account = await prisma.authAccount.update({ where: { id: accountId }, data: { status: "SUSPENDED" } });
  await invalidateAllSessions(accountId);
  await logAuthEvent(`Auth: account suspended for ${account.email} by user ${byUserId}`);
}

export async function reactivateAccount(accountId: string, byUserId: string): Promise<void> {
  const account = await prisma.authAccount.findUniqueOrThrow({ where: { id: accountId } });
  if (account.status !== "SUSPENDED") throw new AuthFlowError("Only suspended accounts can be reactivated.");
  await prisma.authAccount.update({ where: { id: accountId }, data: { status: "ACTIVE", failedLogins: 0, lockedUntil: null } });
  await logAuthEvent(`Auth: account reactivated for ${account.email} by user ${byUserId}`);
}

export async function changeInternalRole(accountId: string, role: OrgRole, byUserId: string): Promise<void> {
  const account = await prisma.authAccount.findUniqueOrThrow({ where: { id: accountId } });
  if (account.kind !== "INTERNAL" || !account.userId) throw new AuthFlowError("Role changes apply to internal accounts only.");
  await prisma.user.update({ where: { id: account.userId }, data: { role } });
  await logAuthEvent(`Auth: role changed to ${role} for ${account.email} by user ${byUserId}`);
}

/** Investor onboarding review → account lifecycle (wired into services in the GraphQL task). */
export async function activateAccountsForInvestor(investorId: string): Promise<void> {
  await prisma.authAccount.updateMany({
    where: { person: { investorId }, status: { in: ["PENDING", "SUSPENDED"] } },
    data: { status: "ACTIVE" },
  });
}

export async function suspendAccountsForInvestor(investorId: string): Promise<void> {
  const accounts = await prisma.authAccount.findMany({
    where: { person: { investorId } }, select: { id: true },
  });
  for (const a of accounts) {
    await prisma.authSession.deleteMany({ where: { accountId: a.id } });
  }
  await prisma.authAccount.updateMany({ where: { person: { investorId } }, data: { status: "SUSPENDED" } });
}
