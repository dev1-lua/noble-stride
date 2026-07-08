"use server";
// Admin user management (real-auth spec §10). Every action re-checks the REAL
// role server-side (never the lens — an admin impersonating TeamMember still
// administers; a real TeamMember never can).

import { revalidatePath } from "next/cache";
import type { OrgRole } from "@prisma/client";
import { getCurrentAuth } from "@/server/auth/current";
import {
  approveInternalAccount, rejectPendingAccount, suspendAccount,
  reactivateAccount, changeInternalRole, activateAccountsForInvestor, AuthFlowError,
} from "@/server/auth/accounts";
import { createAuthToken } from "@/server/auth/tokens";
import { prisma } from "@/lib/db";
import { headers } from "next/headers";

async function requireRealAdmin() {
  const auth = await getCurrentAuth();
  if (!auth || auth.account.kind !== "INTERNAL" || auth.user?.role !== "Admin" || !auth.user?.isActive) {
    throw new Error("Not authorized");
  }
  return auth;
}

export interface UserActionState {
  error?: string;
  resetLink?: string;
}

async function run(fn: (adminUserId: string) => Promise<void | string>): Promise<UserActionState> {
  try {
    const admin = await requireRealAdmin();
    const result = await fn(admin.user!.id);
    revalidatePath("/settings/users");
    return typeof result === "string" ? { resetLink: result } : {};
  } catch (err) {
    if (err instanceof AuthFlowError) return { error: err.message };
    if (err instanceof Error && err.message === "Not authorized") return { error: "Not authorized." };
    throw err;
  }
}

export async function approveInternalAction(_p: UserActionState, formData: FormData): Promise<UserActionState> {
  const role = String(formData.get("role") ?? "TeamMember") as OrgRole;
  return run((adminId) => approveInternalAccount(String(formData.get("accountId")), role, adminId));
}

export async function approveInvestorAccountAction(_p: UserActionState, formData: FormData): Promise<UserActionState> {
  return run(async () => {
    const account = await prisma.authAccount.findUniqueOrThrow({
      where: { id: String(formData.get("accountId")) },
      include: { person: true },
    });
    if (!account.person?.investorId) throw new AuthFlowError("No linked investor for this account.");
    await activateAccountsForInvestor(account.person.investorId);
  });
}

export async function rejectAccountAction(_p: UserActionState, formData: FormData): Promise<UserActionState> {
  return run((adminId) => rejectPendingAccount(String(formData.get("accountId")), adminId));
}

export async function suspendAccountAction(_p: UserActionState, formData: FormData): Promise<UserActionState> {
  return run((adminId) => suspendAccount(String(formData.get("accountId")), adminId));
}

export async function reactivateAccountAction(_p: UserActionState, formData: FormData): Promise<UserActionState> {
  return run((adminId) => reactivateAccount(String(formData.get("accountId")), adminId));
}

export async function changeRoleAction(_p: UserActionState, formData: FormData): Promise<UserActionState> {
  const role = String(formData.get("role") ?? "") as OrgRole;
  return run((adminId) => changeInternalRole(String(formData.get("accountId")), role, adminId));
}

export async function generateResetLinkAction(_p: UserActionState, formData: FormData): Promise<UserActionState> {
  return run(async () => {
    const raw = await createAuthToken(String(formData.get("accountId")), "RESET_PASSWORD");
    const hdrs = await headers();
    const host = hdrs.get("host") ?? "localhost:3000";
    const proto = hdrs.get("x-forwarded-proto") ?? "http";
    return `${proto}://${host}/reset-password/${raw}`;
  });
}
