// Transaction service — single source of truth over Prisma for transaction/execution data.
// Thin layer: Prisma calls + domain helpers only. No GraphQL, no React.

import { prisma } from "@/lib/db";
import { LABELS, label } from "@/lib/vocab";
import {
  ACTIVE_CONVERSATION_STATUSES,
  CLOSED_TXN_STAGES,
} from "@/server/domain/types";
import type { KanbanColumn, TransactionStage } from "@/server/domain/types";
import type { Prisma } from "@prisma/client";
import { transactionCreateSchema, transactionUpdateSchema, type TransactionCreateInput, type TransactionUpdateInput } from "@/lib/schemas/transaction";
import { actorSource, CrudError, sameCalendarDate } from "./crud";
import { recordStageChange } from "./stage-history";
import type { Actor } from "@/graphql/context";

// ─── Filter type ─────────────────────────────────────────────────────────────

interface TransactionFilter {
  stage?: TransactionStage;
  clientId?: string;
}

// ─── TransactionWithCounts type ───────────────────────────────────────────────

// Prisma return type for a transaction (no includes) with derived engagement counts.
type TransactionWithCounts = Prisma.TransactionGetPayload<object> & {
  investorsContacted: number;
  activeConversations: number;
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * List transactions matching the given filter, ordered by updatedAt desc.
 */
export async function listTransactions(filter?: TransactionFilter) {
  const where: { stage?: TransactionStage; clientId?: string } = {};
  if (filter?.stage != null) where.stage = filter.stage;
  if (filter?.clientId != null) where.clientId = filter.clientId;

  return prisma.transaction.findMany({ where, orderBy: { updatedAt: "desc" } });
}

/**
 * Return one KanbanColumn per TransactionStage value, in vocab order.
 * Each transaction carries derived `investorsContacted` and `activeConversations`.
 *
 * N+1 avoidance: all transactions are loaded in a single query (with engagement
 * statuses via select), then counts are computed in-process and records are bucketed
 * by stage. No per-transaction or per-stage DB round-trips.
 */
export async function transactionsByStage(): Promise<KanbanColumn<TransactionWithCounts>[]> {
  const allTransactions = await prisma.transaction.findMany({
    orderBy: { stageEnteredAt: "asc" },
    include: {
      client: true,
      owner: true,
      mandate: true,
      engagements: { select: { status: true } },
    },
  });

  // Compute counts in-process and bucket by stage
  const buckets = new Map<string, TransactionWithCounts[]>();

  for (const txn of allTransactions) {
    const { engagements, ...txnWithoutEngagements } = txn;
    const investorsContacted = engagements.length;
    const activeConversations = engagements.filter((e) =>
      ACTIVE_CONVERSATION_STATUSES.includes(e.status)
    ).length;

    const enriched: TransactionWithCounts = {
      ...txnWithoutEngagements,
      investorsContacted,
      activeConversations,
    };

    const bucket = buckets.get(txn.stage) ?? [];
    bucket.push(enriched);
    buckets.set(txn.stage, bucket);
  }

  // Return columns in vocab order (Object.keys preserves insertion order)
  return Object.keys(LABELS.TransactionStage).map((stage) => ({
    stage,
    label: label("TransactionStage", stage),
    items: buckets.get(stage) ?? [],
  }));
}

/**
 * Fetch a single transaction by id, including related client, mandate, owner,
 * engagements (with investors), activities (ordered by occurredAt desc), and
 * stage-change history (newest first).
 * Returns null when the transaction does not exist.
 */
export async function getTransaction(id: string) {
  return prisma.transaction.findUnique({
    where: { id },
    include: {
      client: true,
      mandate: true,
      owner: true,
      assistant: true,
      engagements: { include: { investor: true } },
      activities: { orderBy: { occurredAt: "desc" } },
      stageChanges: { orderBy: { changedAt: "desc" }, include: { changedBy: true } },
      serviceProviders: { orderBy: { name: "asc" } },
    },
  });
}

/**
 * Move a transaction to a new stage, resetting stageEnteredAt to now.
 * Sets closedAt to now when entering a terminal stage (ClosedWon/ClosedLost),
 * clears it when re-opening to any other stage. Records a StageChange row
 * (SPEC §7.1) when the stage actually changes.
 * This is the write seam the Kanban drag will hit (no Activity logging here).
 */
export async function setTransactionStage(id: string, stage: TransactionStage, actor: Actor = { type: "HUMAN" }) {
  const closedAt = CLOSED_TXN_STAGES.includes(stage) ? new Date() : null;

  return prisma.$transaction(async (tx) => {
    const existing = await tx.transaction.findUniqueOrThrow({ where: { id }, select: { stage: true } });
    const updated = await tx.transaction.update({
      where: { id },
      data: { stage, stageEnteredAt: new Date(), closedAt },
    });
    await recordStageChange(tx, { field: "stage", fromValue: existing.stage, toValue: stage, actor, transactionId: id });
    return updated;
  });
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function createTransaction(input: TransactionCreateInput, actor: Actor) {
  const data = transactionCreateSchema.parse(input);
  return prisma.transaction.create({ data: { ...data, createdSource: actorSource(actor) } });
}

export async function updateTransaction(id: string, input: TransactionUpdateInput, actor: Actor = { type: "HUMAN" }) {
  const data = transactionUpdateSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.transaction.findUniqueOrThrow({
      where: { id },
      select: { dealStatus: true, dealMilestone: true, dateOpened: true },
    });
    if (
      data.dateOpened !== undefined &&
      existing.dateOpened != null &&
      !sameCalendarDate(data.dateOpened, existing.dateOpened)
    ) {
      throw new CrudError("Date opened is locked once set (spec §7.1: creation date is immutable).");
    }
    const updated = await tx.transaction.update({ where: { id }, data });
    if (data.dealStatus !== undefined) {
      await recordStageChange(tx, { field: "dealStatus", fromValue: existing.dealStatus, toValue: data.dealStatus, actor, transactionId: id });
    }
    if (data.dealMilestone !== undefined) {
      await recordStageChange(tx, { field: "dealMilestone", fromValue: existing.dealMilestone, toValue: data.dealMilestone, actor, transactionId: id });
    }
    return updated;
  });
}

export async function deleteTransaction(id: string) {
  const engagements = await prisma.engagement.count({ where: { transactionId: id } });
  if (engagements > 0) {
    throw new CrudError(`Cannot delete: ${engagements} engagement(s) reference this transaction.`);
  }
  return prisma.transaction.delete({ where: { id } });
}
