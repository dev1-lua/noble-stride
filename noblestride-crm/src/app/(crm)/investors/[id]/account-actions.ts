"use server";
// Investor-scoped account management (auth-enhancements plan, Task 9).
// Investor login accounts are managed from the Investors page, not
// /settings/users. Every action re-checks the REAL role server-side (never
// the impersonation lens — an admin impersonating TeamMember still
// administers; a real TeamMember never can). Mirrors
// settings/users/actions.ts's requireRealAdmin + run pattern, but revalidates
// the investor detail path instead of /settings/users.

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getCurrentAuth } from "@/server/auth/current";
import { suspendAccount, reactivateAccount, AuthFlowError } from "@/server/auth/accounts";
import { createAuthToken } from "@/server/auth/tokens";
import { prisma } from "@/lib/db";

async function requireRealAdmin() {
  const auth = await getCurrentAuth();
  if (!auth || auth.account.kind !== "INTERNAL" || auth.user?.role !== "Admin" || !auth.user?.isActive) {
    throw new Error("Not authorized");
  }
  return auth;
}

// Confirms the posted accountId actually belongs to the investor this action
// is scoped to — without this, any admin viewing investor A's page could post
// investor B's accountId and mutate it (the account-actions form only sends
// accountId; investorId comes from the page, not from a trusted source).
async function requireAccountBelongsToInvestor(accountId: string, investorId: string) {
  const account = await prisma.authAccount.findUnique({
    where: { id: accountId },
    include: { person: true },
  });
  if (!account || account.kind !== "INVESTOR" || account.person?.investorId !== investorId) {
    throw new Error("Not authorized");
  }
}

export interface UserActionState {
  error?: string;
  resetLink?: string;
}

async function run(investorId: string, fn: (adminUserId: string) => Promise<void | string>): Promise<UserActionState> {
  try {
    const admin = await requireRealAdmin();
    const result = await fn(admin.user!.id);
    revalidatePath(`/investors/${investorId}`);
    return typeof result === "string" ? { resetLink: result } : {};
  } catch (err) {
    if (err instanceof AuthFlowError) return { error: err.message };
    if (err instanceof Error && err.message === "Not authorized") return { error: "Not authorized." };
    throw err;
  }
}

export async function suspendInvestorAccountAction(_p: UserActionState, formData: FormData): Promise<UserActionState> {
  const investorId = String(formData.get("investorId"));
  const accountId = String(formData.get("accountId"));
  return run(investorId, async (adminId) => {
    await requireAccountBelongsToInvestor(accountId, investorId);
    return suspendAccount(accountId, adminId);
  });
}

export async function reactivateInvestorAccountAction(_p: UserActionState, formData: FormData): Promise<UserActionState> {
  const investorId = String(formData.get("investorId"));
  const accountId = String(formData.get("accountId"));
  return run(investorId, async (adminId) => {
    await requireAccountBelongsToInvestor(accountId, investorId);
    return reactivateAccount(accountId, adminId);
  });
}

export async function generateInvestorResetLinkAction(_p: UserActionState, formData: FormData): Promise<UserActionState> {
  const investorId = String(formData.get("investorId"));
  const accountId = String(formData.get("accountId"));
  return run(investorId, async () => {
    await requireAccountBelongsToInvestor(accountId, investorId);
    const raw = await createAuthToken(accountId, "RESET_PASSWORD");
    const hdrs = await headers();
    const host = hdrs.get("host") ?? "localhost:3000";
    const proto = hdrs.get("x-forwarded-proto") ?? "http";
    return `${proto}://${host}/reset-password/${raw}`;
  });
}
