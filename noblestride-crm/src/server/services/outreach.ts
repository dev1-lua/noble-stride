// Investor Agent (spec 2026-07-14) — outreach draft lifecycle + deterministic send.
// SECURITY: no LLM anywhere in this file. Sent/Rejected are terminal states.
// The send path is plain code: it POSTs to Lua's email-channel HTTP API and
// writes deterministic status/Activity/Engagement rows — nothing here calls a
// model or interprets model output.
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { CrudError } from "./crud";
import { canUpdateRecord } from "@/server/rbac/matrix";
import { logActivity } from "./engagements";
import type { OrgRoleLens } from "@/lib/viewpoint";

export interface ReviewerLens {
  orgRole: OrgRoleLens;
  userId?: string;
}

/**
 * Statuses that count as "already in play" for the save-drafts dedup guard.
 * Failed is included: a failed send is still retryable from the review
 * queue (see REVIEWABLE_STATUSES below), so it must keep blocking a second
 * draft from being generated for the same deal x investor pair.
 */
export const ACTIVE_DRAFT_STATUSES = ["Draft", "Approved", "Sent", "Failed"] as const;

/** Statuses from which a draft may still be edited, rejected, or (re)sent. */
const REVIEWABLE_STATUSES = ["Draft", "Approved", "Failed"] as const;

/** Max drafts a single bulk invocation processes — a backstop against a very
 *  large deal exhausting the serverless duration budget mid-send. Callers
 *  surface `remaining` so the reviewer can run it again for the rest. */
const BULK_CAP = 25;

function assertMayReview(lens: ReviewerLens, txnOwnerId: string | null): void {
  const allowed = canUpdateRecord(lens.orgRole, "Transactions", lens.userId, { ownerId: txnOwnerId });
  if (!allowed) throw new CrudError("Not authorized: only an Admin or the deal owner can review outreach");
}

export async function saveOutreachDrafts(
  transactionId: string,
  drafts: Array<{ investorId: string; personId?: string | null; subject: string; body: string; matchRationale: string }>,
): Promise<{ ok: true; created: number; skipped: number }> {
  const txn = await prisma.transaction.findUnique({ where: { id: transactionId } });
  if (!txn) throw new CrudError("Transaction not found");

  let created = 0;
  let skipped = 0;
  for (const d of drafts) {
    if (!d.subject.trim() || !d.body.trim()) {
      skipped += 1;
      continue;
    }
    const existing = await prisma.outreachDraft.findFirst({
      where: { transactionId, investorId: d.investorId, status: { in: [...ACTIVE_DRAFT_STATUSES] } },
    });
    if (existing) {
      skipped += 1;
      continue;
    }
    try {
      await prisma.outreachDraft.create({
        data: {
          transactionId,
          investorId: d.investorId,
          personId: d.personId ?? null,
          subject: d.subject,
          body: d.body,
          matchRationale: d.matchRationale,
          createdSource: "AGENT",
        },
      });
      created += 1;
    } catch (e) {
      // DB-level backstop: the partial unique index "OutreachDraft_active_pair_key"
      // (see prisma/migrations/20260714165154_outreach_active_dedup_index) rejects a
      // second active draft for the same (transactionId, investorId) pair. The
      // findFirst check above is a TOCTOU race under concurrent calls — this catch
      // keeps the API contract (skipped, not a 500) when the DB wins the race instead.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        skipped += 1;
        continue;
      }
      throw e;
    }
  }
  return { ok: true, created, skipped };
}

export interface OutreachQueueItem {
  id: string;
  status: string;
  subject: string;
  body: string;
  matchRationale: string;
  error: string | null;
  createdAt: Date;
  transactionId: string;
  transactionName: string;
  transactionOwnerId: string | null;
  transactionOwnerName: string | null;
  investorId: string;
  investorName: string;
  personId: string | null;
  contactName: string | null;
  contactEmail: string | null;
}

export async function listOutreachQueue(): Promise<OutreachQueueItem[]> {
  const rows = await prisma.outreachDraft.findMany({
    where: { status: { in: ["Draft", "Approved", "Failed"] } },
    include: {
      transaction: { select: { id: true, name: true, ownerId: true, owner: { select: { name: true } } } },
      investor: { select: { id: true, name: true } },
      person: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
    orderBy: [{ transactionId: "asc" }, { createdAt: "asc" }],
  });

  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    subject: row.subject,
    body: row.body,
    matchRationale: row.matchRationale,
    error: row.error,
    createdAt: row.createdAt,
    transactionId: row.transaction.id,
    transactionName: row.transaction.name,
    transactionOwnerId: row.transaction.ownerId,
    transactionOwnerName: row.transaction.owner?.name ?? null,
    investorId: row.investor.id,
    investorName: row.investor.name,
    personId: row.person?.id ?? null,
    contactName: row.person ? [row.person.firstName, row.person.lastName].filter(Boolean).join(" ") : null,
    contactEmail: row.person?.email ?? null,
  }));
}

export interface OutreachDraftFilter {
  transactionId?: string;
  investorId?: string;
  status?: string;
}

/**
 * Flat read across ALL draft statuses (incl. Sent/Rejected) — the agent-facing
 * counterpart to listOutreachQueue, which is scoped to the human review queue.
 */
export async function listOutreachDrafts(filter?: OutreachDraftFilter) {
  const where: Prisma.OutreachDraftWhereInput = {};
  if (filter?.transactionId) where.transactionId = filter.transactionId;
  if (filter?.investorId) where.investorId = filter.investorId;
  if (filter?.status) where.status = filter.status as Prisma.OutreachDraftWhereInput["status"];
  return prisma.outreachDraft.findMany({
    where,
    include: { transaction: true, investor: true, person: true },
    orderBy: { createdAt: "desc" },
  });
}

async function loadReviewableDraft(id: string) {
  const draft = await prisma.outreachDraft.findUnique({
    where: { id },
    include: {
      transaction: { select: { id: true, name: true, ownerId: true } },
      investor: { include: { contacts: { orderBy: { isPrimaryContact: "desc" } } } },
      person: true,
    },
  });
  if (!draft) throw new CrudError("Draft not found");
  return draft;
}

export async function updateOutreachDraft(
  id: string,
  patch: { subject?: string; body?: string },
  lens: ReviewerLens,
): Promise<{ ok: true }> {
  const draft = await loadReviewableDraft(id);
  assertMayReview(lens, draft.transaction.ownerId);
  if (!(REVIEWABLE_STATUSES as readonly string[]).includes(draft.status)) {
    throw new CrudError("This draft can no longer be edited");
  }
  await prisma.outreachDraft.update({
    where: { id },
    data: {
      subject: patch.subject?.trim() ? patch.subject : undefined,
      body: patch.body?.trim() ? patch.body : undefined,
    },
  });
  return { ok: true };
}

export async function rejectOutreachDraft(id: string, lens: ReviewerLens): Promise<{ ok: true }> {
  const draft = await loadReviewableDraft(id);
  assertMayReview(lens, draft.transaction.ownerId);
  // Status-guarded UPDATE (not read-then-write): a reject racing an in-flight
  // send must never flip a row that just became Sent back to Rejected — the
  // email already left, and Rejected would drop the pair out of the dedup
  // index, letting a duplicate draft be created for an already-emailed pair.
  const rejected = await prisma.outreachDraft.updateMany({
    where: { id, status: { in: [...REVIEWABLE_STATUSES] } },
    data: { status: "Rejected", reviewedById: lens.userId ?? null, reviewedAt: new Date() },
  });
  if (rejected.count === 0) {
    throw new CrudError("This draft can no longer be rejected");
  }
  return { ok: true };
}

export async function sendOutreachDraft(
  id: string,
  lens: ReviewerLens,
  deps?: { fetchFn?: typeof fetch },
): Promise<{ ok: boolean; error?: string }> {
  const fetchFn = deps?.fetchFn ?? fetch;
  const draft = await loadReviewableDraft(id);
  assertMayReview(lens, draft.transaction.ownerId);
  if (!(REVIEWABLE_STATUSES as readonly string[]).includes(draft.status)) {
    throw new CrudError("This draft cannot be sent (already sent or rejected)");
  }

  // Pre-claim failure writes are status-guarded so a config/recipient failure
  // racing a concurrent send or reject can never clobber Sent/Rejected.
  const failClosed = (error: string) =>
    prisma.outreachDraft.updateMany({
      where: { id, status: { in: [...REVIEWABLE_STATUSES] } },
      data: { status: "Failed", error },
    });

  const recipient = draft.person?.email ?? draft.investor.contacts.find((c) => c.email)?.email ?? null;
  if (!recipient) {
    await failClosed("No contact email on file");
    return { ok: false, error: "No contact email on file for this investor" };
  }

  const agentId = process.env.LUA_AGENT_ID;
  const apiKey = process.env.LUA_API_KEY;
  // Full channel identifier address (the "Identifier" from `lua channels list`),
  // e.g. "noblestride-investor-relations@heymail.ai". Passed verbatim as
  // options.channelIdentifier — do NOT reconstruct the domain here: generated
  // inboxes issue on heymail.ai, older SES channels on mail.heylua.ai.
  const channelId = process.env.LUA_EMAIL_CHANNEL_ID;
  const baseUrl = process.env.LUA_API_BASE_URL ?? "https://api.heylua.ai";
  if (!agentId || !apiKey) {
    await failClosed("Lua email not configured (LUA_AGENT_ID / LUA_API_KEY missing)");
    return { ok: false, error: "Lua email is not configured on the server" };
  }
  if (!channelId) {
    await failClosed("Lua email channel not configured (LUA_EMAIL_CHANNEL_ID missing)");
    return { ok: false, error: "Lua email is not configured on the server" };
  }

  // Atomically claim the draft BEFORE the network call. Two concurrent sends
  // can both pass the checks above (both read the same pre-claim status), but
  // this single UPDATE ... WHERE status IN (...) can only match the row once —
  // Postgres serializes concurrent updates to the same row, so only one caller
  // observes count === 1. The loser observes count === 0 and throws instead of
  // firing a second network send. On network failure we revert to Failed below
  // so the draft stays retryable.
  const now = new Date();
  const claimed = await prisma.outreachDraft.updateMany({
    where: { id, status: { in: [...REVIEWABLE_STATUSES] } },
    data: { status: "Sent", sentAt: now, reviewedById: lens.userId ?? null, reviewedAt: now, error: null },
  });
  if (claimed.count === 0) {
    throw new CrudError("This draft cannot be sent (already sent or rejected)");
  }

  try {
    const res = await fetchFn(`${baseUrl}/developer/agents/${agentId}/channels/email/send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        to: { email: recipient },
        subject: draft.subject,
        text: draft.body,
        options: { channelIdentifier: channelId },
      }),
      // Bound each send so one hung upstream call can't consume the whole
      // serverless budget mid-batch during a bulk "Approve & send all". On
      // timeout the AbortError is caught below → draft rolls back to Failed
      // (retryable), never a silent half-send.
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Lua email send failed (${res.status}): ${detail.slice(0, 200)}`);
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown send error";
    // The claim already moved this row to Sent; a failed send must roll it
    // back to Failed (retryable) and clear the claim's sentAt — no email
    // actually went out. reviewedById/reviewedAt stay: they record who
    // attempted the release.
    await prisma.outreachDraft.update({
      where: { id },
      data: { status: "Failed", error: message, sentAt: null },
    });
    return { ok: false, error: message };
  }

  const engagement = await prisma.engagement.upsert({
    where: { transactionId_investorId: { transactionId: draft.transactionId, investorId: draft.investorId } },
    update: { lastContact: now }, // never downgrade an existing stage
    create: {
      name: `${draft.investor.name} x ${draft.transaction.name}`,
      transactionId: draft.transactionId,
      investorId: draft.investorId,
      engagementStage: "Shared",
      status: "Contacted",
      lastContact: now,
      ownerId: draft.transaction.ownerId ?? lens.userId ?? null,
      createdSource: "HUMAN",
    },
  });

  await logActivity(
    {
      type: "Outreach",
      channel: "Email",
      direction: "Outbound",
      subject: `Outreach sent - ${draft.subject}`,
      body: `Approved outreach released to ${recipient}.`,
      investorId: draft.investorId,
      transactionId: draft.transactionId,
      engagementId: engagement.id,
    },
    { type: "HUMAN", authenticated: true, userId: lens.userId },
  );

  return { ok: true };
}

/** Owner/admin auth for a whole transaction's outreach (single up-front check
 *  for bulk ops, so a non-owner gets ONE error, not one per draft). */
async function assertMayReviewTransaction(transactionId: string, lens: ReviewerLens): Promise<void> {
  const txn = await prisma.transaction.findUnique({ where: { id: transactionId }, select: { ownerId: true } });
  if (!txn) throw new CrudError("Transaction not found");
  assertMayReview(lens, txn.ownerId);
}

/**
 * Bulk "Approve & send all" for one deal. Authorizes once up front, then sends
 * each reviewable draft through the SAME per-draft `sendOutreachDraft` path
 * (its atomic claim guarantees at-most-once send, so this is safe under
 * concurrent/duplicate submits). Every send is wrapped so one failure never
 * aborts the batch after real emails have gone out; failures stay retryable
 * (the draft is left/returned to Failed by sendOutreachDraft). Capped at
 * BULK_CAP per call — `remaining` tells the caller to run again.
 */
export async function sendAllForTransaction(
  transactionId: string,
  lens: ReviewerLens,
  deps?: { fetchFn?: typeof fetch },
): Promise<{ sent: number; failed: number; remaining: number; errors: string[] }> {
  await assertMayReviewTransaction(transactionId, lens);
  const reviewable = await prisma.outreachDraft.findMany({
    where: { transactionId, status: { in: [...REVIEWABLE_STATUSES] } },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  const batch = reviewable.slice(0, BULK_CAP);
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];
  for (const d of batch) {
    try {
      const r = await sendOutreachDraft(d.id, lens, deps);
      if (r.ok) sent += 1;
      else {
        failed += 1;
        if (r.error) errors.push(r.error);
      }
    } catch (e) {
      failed += 1;
      errors.push(e instanceof Error ? e.message : "send failed");
    }
  }
  return { sent, failed, remaining: Math.max(0, reviewable.length - batch.length), errors };
}

/** Bulk "Reject all" for one deal — authorize once, then reject each reviewable
 *  draft through the existing status-guarded `rejectOutreachDraft`. */
export async function rejectAllForTransaction(
  transactionId: string,
  lens: ReviewerLens,
): Promise<{ rejected: number; remaining: number }> {
  await assertMayReviewTransaction(transactionId, lens);
  const reviewable = await prisma.outreachDraft.findMany({
    where: { transactionId, status: { in: [...REVIEWABLE_STATUSES] } },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  const batch = reviewable.slice(0, BULK_CAP);
  let rejected = 0;
  for (const d of batch) {
    try {
      await rejectOutreachDraft(d.id, lens);
      rejected += 1;
    } catch {
      // A draft that raced to Sent/Rejected is simply skipped — bulk reject is
      // best-effort over whatever is still reviewable.
    }
  }
  return { rejected, remaining: Math.max(0, reviewable.length - batch.length) };
}
