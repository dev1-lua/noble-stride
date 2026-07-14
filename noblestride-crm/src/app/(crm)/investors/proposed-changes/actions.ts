"use server";
// investors/proposed-changes/actions.ts — server actions for the
// proposed-changes inbox. SECURITY: RBAC (assertCan(actor, "Investors", "U"))
// lives inside confirmProposedChange/rejectProposedChange (Task 3); this file
// only builds the Actor from the real session-derived org lens and never
// re-implements or loosens that check.

import { revalidatePath } from "next/cache";
import { getOrgLens } from "@/server/rbac/context";
import { getCurrentAuth } from "@/server/auth/current";
import { confirmProposedChange, rejectProposedChange } from "@/server/services/investor-agent";
import type { Actor } from "@/graphql/context";

// The Admin viewpoint lens carries no userId by design (it's a role lens, not
// an identity) — fall back to the real signed-in user so reviewedById /
// createdById attribution on confirm/reject isn't left NULL for Admins.
async function lensActor(): Promise<Actor> {
  const lens = await getOrgLens();
  const userId = lens.userId ?? (await getCurrentAuth())?.user?.id;
  return { type: "HUMAN", authenticated: true, userId, orgRole: lens.orgRole, accountKind: "INTERNAL" };
}

export interface ChangeActionState {
  error?: string;
  ok?: boolean;
}

export async function confirmChangeAction(_prev: ChangeActionState, formData: FormData): Promise<ChangeActionState> {
  try {
    await confirmProposedChange(String(formData.get("changeId") ?? ""), await lensActor());
    revalidatePath("/investors/proposed-changes");
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Confirm failed" };
  }
}

export async function rejectChangeAction(_prev: ChangeActionState, formData: FormData): Promise<ChangeActionState> {
  try {
    await rejectProposedChange(String(formData.get("changeId") ?? ""), await lensActor());
    revalidatePath("/investors/proposed-changes");
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Reject failed" };
  }
}
