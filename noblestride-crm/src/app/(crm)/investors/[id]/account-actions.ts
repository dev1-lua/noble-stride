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
import { requireRealAdmin } from "@/server/auth/require-real-admin";
import { suspendAccount, reactivateAccount, AuthFlowError } from "@/server/auth/accounts";
import { issueStaffResetLink } from "@/server/auth/reset";
import { changeAccountEmailByStaff, EmailChangeError } from "@/server/auth/change-email";
import { prisma } from "@/lib/db";

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
  /** F3.5: whether the reset link was also emailed to the member. */
  emailSent?: boolean;
  /** F3.6: confirmation line after a staff email change. */
  notice?: string;
}

type RunResult = void | { resetLink: string; emailSent: boolean } | { notice: string };

async function run(investorId: string, fn: (adminUserId: string) => Promise<RunResult>): Promise<UserActionState> {
  try {
    const admin = await requireRealAdmin();
    const result = await fn(admin.user!.id);
    revalidatePath(`/investors/${investorId}`);
    return result ?? {};
  } catch (err) {
    if (err instanceof EmailChangeError) return { error: err.message };
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
    const hdrs = await headers();
    const host = hdrs.get("host") ?? "localhost:3000";
    const proto = hdrs.get("x-forwarded-proto") ?? "http";
    const { url, emailSent } = await issueStaffResetLink(accountId, `${proto}://${host}`);
    return { resetLink: url, emailSent };
  });
}

/** F3.6: move the sign-in email on an investor-portal account. */
export async function changeInvestorAccountEmailAction(
  _p: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const investorId = String(formData.get("investorId"));
  const accountId = String(formData.get("accountId"));
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Enter the new email address." };
  return run(investorId, async (adminId) => {
    await requireAccountBelongsToInvestor(accountId, investorId);
    const res = await changeAccountEmailByStaff(accountId, email, {
      type: "HUMAN",
      authenticated: true,
      userId: adminId,
    });
    return {
      notice:
        `Sign-in email changed to ${res.newEmail}. Sessions were signed out` +
        `${res.noticeSent.new ? " and both addresses were notified." : "; we couldn't email the notices."}`,
    };
  });
}
