"use server";
// outreach/actions.ts — server actions for the /outreach review queue.
// SECURITY: these actions only call the deterministic outreach service
// functions (Task 4). RBAC is enforced there (assertMayReview); nothing here
// re-implements or loosens that check.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getOrgLens } from "@/server/rbac/context";
import { getViewpoint } from "@/server/viewpoint";
import { getCurrentAuth } from "@/server/auth/current";
import {
  sendOutreachDraft,
  rejectOutreachDraft,
  updateOutreachDraft,
  sendAllForTransaction,
  rejectAllForTransaction,
} from "@/server/services/outreach";
import type { ReviewerLens } from "@/server/services/outreach";

// The Admin viewpoint (ADMIN_VIEWPOINT) deliberately carries no userId — it's
// a lens, not an identity. For attribution (reviewedById/createdById on the
// outreach draft + its Activity) we need the real signed-in user, so fall
// back to the session's own user id when the lens didn't supply one.
async function reviewerLens(): Promise<ReviewerLens> {
  // Outreach review is INTERNAL-ONLY. getOrgLens() resolves an external viewpoint
  // (e.g. a signed-in investor) to an Admin lens as a "type-safe fallback" — safe
  // for the internal shell (external users never render it), but a server-action
  // POST bypasses that shell, so guard here: only internal staff (viewpoint role
  // "admin", which carries the real orgRole/userId) may review or release drafts.
  const vp = await getViewpoint();
  if (!vp) redirect("/login");
  if (vp.role !== "admin") throw new Error("Not authorized: outreach review is internal-only");
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

// ── Per-deal bulk actions ─────────────────────────────────────────────────────
// The transactionId comes from the form; the service re-derives the reviewable
// set server-side (never trusts client ids), authorizes once, and sends/rejects
// each draft through the same safe per-draft path. Sends REAL emails — the UI
// gates approve behind an explicit confirm.

export interface BulkActionState {
  error?: string;
  result?:
    | { kind: "send"; sent: number; failed: number; remaining: number }
    | { kind: "reject"; rejected: number; remaining: number };
}

export async function approveAllForDealAction(_prev: BulkActionState, formData: FormData): Promise<BulkActionState> {
  const lens = await reviewerLens();
  const transactionId = String(formData.get("transactionId") ?? "");
  try {
    const r = await sendAllForTransaction(transactionId, lens);
    revalidatePath("/outreach");
    return { result: { kind: "send", sent: r.sent, failed: r.failed, remaining: r.remaining } };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Bulk send failed" };
  }
}

export async function rejectAllForDealAction(_prev: BulkActionState, formData: FormData): Promise<BulkActionState> {
  const lens = await reviewerLens();
  const transactionId = String(formData.get("transactionId") ?? "");
  try {
    const r = await rejectAllForTransaction(transactionId, lens);
    revalidatePath("/outreach");
    return { result: { kind: "reject", rejected: r.rejected, remaining: r.remaining } };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Bulk reject failed" };
  }
}
