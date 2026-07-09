// Engagement service — single source of truth over Prisma for engagement data.
// Thin layer: Prisma calls + domain helpers only. No GraphQL, no React.
//
// `logEngagement` is the key WRITE seam for Task 6: it upserts an Engagement
// (creating if absent) and appends an Activity, all inside a single interactive
// transaction so the two writes are atomic.

import { prisma } from "@/lib/db";
import { LABELS, label } from "@/lib/vocab";
import type { InteractionType, CommChannel, CommDirection } from "@prisma/client";
import type { Actor } from "@/graphql/context";
import { actorSource, CrudError } from "./crud";
import { logActivitySchema, type LogActivityInput } from "@/lib/schemas/activity";

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Return every transaction that has at least one engagement, each with the
 * list of engagements (investor included).
 */
export async function engagementsByDeal() {
  const transactions = await prisma.transaction.findMany({
    where: { engagements: { some: {} } },
    include: {
      client: true,
      engagements: { include: { investor: true } },
    },
  });

  return transactions.map((transaction) => ({
    transaction,
    engagements: transaction.engagements,
  }));
}

/**
 * Per-stage counts for a set of engagements, in vocab order, omitting stages
 * with zero engagements. Shared by the focal (By Deal / By Investor) boards.
 */
export function stageCountsFor(engagements: { engagementStage: string }[]) {
  const counts = new Map<string, number>();
  for (const e of engagements) counts.set(e.engagementStage, (counts.get(e.engagementStage) ?? 0) + 1);
  return Object.keys(LABELS.EngagementStage)
    .filter((stage) => (counts.get(stage) ?? 0) > 0)
    .map((stage) => ({ stage, label: label("EngagementStage", stage), count: counts.get(stage)! }));
}

/**
 * Every investor that has at least one engagement, each with its engagements
 * (transaction included), investors ordered by name. Mirror of
 * engagementsByDeal() with the focal entity flipped.
 */
export async function engagementsByInvestor() {
  const investors = await prisma.investor.findMany({
    where: { engagements: { some: {} } },
    orderBy: { name: "asc" },
    include: { engagements: { include: { transaction: true } } },
  });
  return investors.map((investor) => ({ investor, engagements: investor.engagements }));
}

/**
 * Return one column per EngagementStage value (12, in vocab order), each with
 * the engagements in that stage (investor + transaction included).
 *
 * N+1 avoidance: all engagements are loaded in a single query, then bucketed
 * by stage in-process — same pattern as transactionsByStage.
 */
export async function engagementsByStage() {
  const all = await prisma.engagement.findMany({
    orderBy: { updatedAt: "desc" },
    include: { investor: true, transaction: true },
  });

  const buckets = new Map<string, typeof all>();
  for (const eng of all) {
    const bucket = buckets.get(eng.engagementStage) ?? [];
    bucket.push(eng);
    buckets.set(eng.engagementStage, bucket);
  }

  // Columns in vocab order (Object.keys preserves insertion order)
  return Object.keys(LABELS.EngagementStage).map((stage) => ({
    stage,
    label: label("EngagementStage", stage),
    items: buckets.get(stage) ?? [],
  }));
}

/**
 * Invested engagements with their disbursement fields, newest receipt first.
 * Drives the Disbursements section on the engagement page.
 */
export async function listDisbursements() {
  return prisma.engagement.findMany({
    where: { engagementStage: "Invested" },
    orderBy: [{ dateReceived: "desc" }, { updatedAt: "desc" }],
    include: { investor: true, transaction: true },
  });
}

/**
 * Fetch a single engagement by id, including transaction, investor, owner,
 * activities (newest first), and stage-change history (newest first).
 * Returns null when the engagement does not exist.
 */
export async function getEngagement(id: string) {
  return prisma.engagement.findUnique({
    where: { id },
    include: {
      transaction: true,
      investor: true,
      owner: true,
      activities: { orderBy: { occurredAt: "desc" }, include: { tasks: { select: { id: true, title: true, status: true } } } },
      stageChanges: { orderBy: { changedAt: "desc" }, include: { changedBy: true } },
      milestones: true,
    },
  });
}

// ─── logEngagement input ──────────────────────────────────────────────────────

export interface LogEngagementInput {
  transactionId: string;
  investorId: string;
  type: InteractionType;
  subject?: string;
  body?: string;
  channel?: CommChannel;
  direction?: CommDirection;
}

/**
 * The primary WRITE seam for investor engagement tracking.
 *
 * Atomically (inside a single interactive Prisma transaction):
 *   1. Looks up the existing Engagement for (transactionId, investorId).
 *   2. If MISSING: fetches investor + transaction names to build a canonical
 *      `name`, then creates the Engagement with status "Contacted" and
 *      createdSource "HUMAN".
 *   3. If PRESENT: bumps `lastContact` to now (status unchanged).
 *   4. Creates an Activity linked to the engagement, investor, and transaction,
 *      with createdSource "HUMAN".
 *   5. Returns the created Activity (with engagement, investor, transaction).
 *
 * Provenance: this is a human-initiated action; both records get `HUMAN`.
 * The Lua-AI seam (Task 7) is what sets `AGENT`. `createdById` is still
 * populated from the acting user when present, independent of that source.
 */
export async function logEngagement(input: LogEngagementInput, actor: Actor) {
  const { transactionId, investorId, type, subject, body, channel, direction } = input;

  return prisma.$transaction(async (tx) => {
    // 1. Look up existing engagement
    let engagement = await tx.engagement.findUnique({
      where: { transactionId_investorId: { transactionId, investorId } },
    });

    if (engagement === null) {
      // 2. Create — must set the required `name` field
      const [investor, transaction] = await Promise.all([
        tx.investor.findUniqueOrThrow({ where: { id: investorId }, select: { name: true } }),
        tx.transaction.findUniqueOrThrow({ where: { id: transactionId }, select: { name: true } }),
      ]);

      engagement = await tx.engagement.create({
        data: {
          name: `${investor.name} – ${transaction.name}`,
          status: "Contacted",
          lastContact: new Date(),
          createdSource: "HUMAN",
          transactionId,
          investorId,
        },
      });
    } else {
      // 3. Update — bump lastContact only
      engagement = await tx.engagement.update({
        where: { id: engagement.id },
        data: { lastContact: new Date() },
      });
    }

    // 4. Create the Activity linked to this engagement
    const activity = await tx.activity.create({
      data: {
        type,
        subject,
        body,
        channel,
        direction,
        createdSource: "HUMAN",
        createdById: actor.userId,
        engagementId: engagement.id,
        transactionId,
        investorId,
        occurredAt: new Date(),
      },
      include: {
        investor: true,
        transaction: true,
        engagement: true,
      },
    });

    // 5. Return the created Activity
    return activity;
  });
}

// ─── logActivity — generalized communication logging (spec §3.10) ────────────

/**
 * The generalized WRITE seam for communication/activity logging: unlike
 * `logEngagement`, it does not require a transaction+investor pair and does
 * not touch the Engagement record. It requires `type` and ANY one-or-more of
 * clientId/mandateId/transactionId/investorId/engagementId ("Linked record
 * required" per spec) — logging against a bare client or mandate is valid.
 *
 * `createdById` is populated from `actor.userId` when present (this is the
 * gap `logEngagement` had before this task); `createdSource` follows the
 * acting caller (HUMAN/AGENT/API) via `actorSource`.
 */
export async function logActivity(input: LogActivityInput, actor: Actor) {
  const data = logActivitySchema.parse(input);
  const { clientId, mandateId, transactionId, investorId, engagementId, occurredAt, ...rest } = data;

  if (!clientId && !mandateId && !transactionId && !investorId && !engagementId) {
    throw new CrudError(
      "logActivity requires at least one linked record (client, mandate, transaction, investor, or engagement).",
    );
  }

  return prisma.activity.create({
    data: {
      ...rest,
      occurredAt: occurredAt ?? new Date(),
      createdSource: actorSource(actor),
      createdById: actor.userId,
      clientId,
      mandateId,
      transactionId,
      investorId,
      engagementId,
    },
    include: {
      investor: true,
      transaction: true,
      engagement: true,
      mandate: true,
      client: true,
    },
  });
}
