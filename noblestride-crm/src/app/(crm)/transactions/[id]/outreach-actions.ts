"use server";

// outreach-actions.ts — Server action for the "Generate investor outreach"
// button on the transaction detail page (Task 8). RBAC-gated server-side
// (Admin or the deal's owner); fails closed with an inline error when the
// investor-agent webhook env vars are unset (expected state until Task 12
// wires up the agent-side webhook).
//
// NOTE: every async export of a "use server" module becomes a client-invocable
// endpoint, so ONLY the RBAC-gated action may live here — the raw webhook
// caller lives in @/server/services/outreach-webhook.

import { getOrgLens } from "@/server/rbac/context";
import { getCurrentAuth } from "@/server/auth/current";
import { canUpdateRecord } from "@/server/rbac/matrix";
import { prisma } from "@/lib/db";
import { callOutreachWebhook } from "@/server/services/outreach-webhook";

export interface OutreachRequestState {
  error?: string;
  ok?: boolean;
}

export async function requestOutreachDraftsAction(
  _prev: OutreachRequestState,
  formData: FormData,
): Promise<OutreachRequestState> {
  const lens = await getOrgLens();
  // The Admin lens carries no userId by design — fall back to the real
  // signed-in user id so any downstream attribution keyed off this actor
  // (not just the ownership check below, which Admins already pass) reflects
  // who actually requested the drafts.
  const userId = lens.userId ?? (await getCurrentAuth())?.user?.id;
  const transactionId = String(formData.get("transactionId") ?? "");
  const txn = await prisma.transaction.findUnique({ where: { id: transactionId }, select: { ownerId: true } });
  if (!txn) return { error: "Deal not found" };
  if (!canUpdateRecord(lens.orgRole, "Transactions", userId, { ownerId: txn.ownerId }))
    return { error: "Only an admin or the deal owner can request outreach drafts" };

  const url = process.env.INVESTOR_AGENT_WEBHOOK_URL;
  const secret = process.env.INVESTOR_AGENT_WEBHOOK_SECRET;
  if (!url || !secret) return { error: "Investor agent webhook is not configured on the server" };

  return callOutreachWebhook(url, secret, transactionId);
}
