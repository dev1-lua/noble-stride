"use server";
// outreach/actions.ts — server actions for the /outreach review queue.
// SECURITY: these actions only call the deterministic outreach service
// functions (Task 4). RBAC is enforced there (assertMayReview); nothing here
// re-implements or loosens that check.

import { revalidatePath } from "next/cache";
import { getOrgLens } from "@/server/rbac/context";
import { getCurrentAuth } from "@/server/auth/current";
import { sendOutreachDraft, rejectOutreachDraft, updateOutreachDraft } from "@/server/services/outreach";
import type { ReviewerLens } from "@/server/services/outreach";

// The Admin viewpoint (ADMIN_VIEWPOINT) deliberately carries no userId — it's
// a lens, not an identity. For attribution (reviewedById/createdById on the
// outreach draft + its Activity) we need the real signed-in user, so fall
// back to the session's own user id when the lens didn't supply one.
async function reviewerLens(): Promise<ReviewerLens> {
  const lens = await getOrgLens();
  if (lens.userId) return lens;
  const auth = await getCurrentAuth();
  return { ...lens, userId: auth?.user?.id ?? undefined };
}

export interface DraftActionState {
  error?: string;
  ok?: boolean;
}

export async function sendDraftAction(_prev: DraftActionState, formData: FormData): Promise<DraftActionState> {
  const lens = await reviewerLens();
  const id = String(formData.get("draftId") ?? "");
  const subject = String(formData.get("subject") ?? "");
  const body = String(formData.get("body") ?? "");
  try {
    // Persist any inline edits, then send.
    await updateOutreachDraft(id, { subject, body }, lens);
    const result = await sendOutreachDraft(id, lens);
    revalidatePath("/outreach");
    return result.ok ? { ok: true } : { error: result.error ?? "Send failed" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Send failed" };
  }
}

export async function rejectDraftAction(_prev: DraftActionState, formData: FormData): Promise<DraftActionState> {
  const lens = await reviewerLens();
  const id = String(formData.get("draftId") ?? "");
  try {
    await rejectOutreachDraft(id, lens);
    revalidatePath("/outreach");
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Reject failed" };
  }
}
