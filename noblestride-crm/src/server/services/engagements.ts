// Engagement service — single source of truth over Prisma for engagement data.
// Thin layer: Prisma calls + domain helpers only. No GraphQL, no React.
//
// `logEngagement` is the key WRITE seam for Task 6: it upserts an Engagement
// (creating if absent) and appends an Activity, all inside a single interactive
// transaction so the two writes are atomic.

import { prisma } from "@/lib/db";
import type { InteractionType } from "@prisma/client";

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
 * Fetch a single engagement by id, including transaction, investor, owner,
 * and activities (newest first). Returns null when the engagement does not exist.
 */
export async function getEngagement(id: string) {
  return prisma.engagement.findUnique({
    where: { id },
    include: {
      transaction: true,
      investor: true,
      owner: true,
      activities: { orderBy: { occurredAt: "desc" } },
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
 * The Lua-AI seam (Task 7) is what sets `AGENT`.
 */
export async function logEngagement(input: LogEngagementInput) {
  const { transactionId, investorId, type, subject, body } = input;

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
        createdSource: "HUMAN",
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
