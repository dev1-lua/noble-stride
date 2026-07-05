// Dashboard service — single source of truth over Prisma for dashboard/analytics data.
// Thin layer: Prisma calls + domain helpers only. No GraphQL, no React.

import { prisma } from "@/lib/db";
import { LABELS, label } from "@/lib/vocab";
import { quarterRange } from "@/server/domain/metrics";
import { ACTIVE_MANDATE_STAGES, CLOSED_TXN_STAGES } from "@/server/domain/types";
import type { DashboardStats } from "@/server/domain/types";
import { TICKET_BANDS, bandForAmount } from "@/lib/ticket-bands";

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Top-level dashboard KPI cards.
 *
 * Query plan (no N+1):
 * - 4 counts run in parallel (active mandates, active txns, investors engaged
 *   this quarter via distinct findMany, capital raised YTD via aggregate).
 * - 4 delta counts run in parallel (last-30d windows).
 * - investorsEngagedQtr uses `distinct: ["investorId"]` on Activity so the
 *   grouping happens in one Prisma call, not N investor look-ups.
 */
export async function dashboardStats(): Promise<DashboardStats> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const { start: qStart } = quarterRange(now);
  const ytdStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));

  const [
    activeMandatesValue,
    activeMandatesDelta,
    activeTransactionsValue,
    activeTransactionsDelta,
    investorsEngagedQtrRows,
    investorsEngagedDeltaRows,
    capitalRaisedYtdAgg,
    capitalRaisedDeltaAgg,
  ] = await Promise.all([
    // active mandates: stage IN ACTIVE_MANDATE_STAGES
    prisma.mandate.count({ where: { stage: { in: ACTIVE_MANDATE_STAGES } } }),
    // delta: mandates created in the last 30d
    prisma.mandate.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    // active transactions: stage NOT IN CLOSED_TXN_STAGES
    prisma.transaction.count({ where: { stage: { notIn: CLOSED_TXN_STAGES } } }),
    // delta: transactions created in the last 30d
    prisma.transaction.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    // investors engaged this quarter: distinct investorId in Activity within quarterRange
    prisma.activity.findMany({
      where: {
        investorId: { not: null },
        occurredAt: { gte: qStart, lte: now },
      },
      distinct: ["investorId"],
      select: { investorId: true },
    }),
    // delta: distinct investors with activity in last 30d
    prisma.activity.findMany({
      where: {
        investorId: { not: null },
        occurredAt: { gte: thirtyDaysAgo, lte: now },
      },
      distinct: ["investorId"],
      select: { investorId: true },
    }),
    // capital raised YTD: sum targetRaise of ClosedWon in current calendar year
    prisma.transaction.aggregate({
      where: {
        stage: "ClosedWon",
        closedAt: { gte: ytdStart, lte: now },
      },
      _sum: { targetRaise: true },
    }),
    // capital raised delta: ClosedWon with closedAt in last 30d
    prisma.transaction.aggregate({
      where: {
        stage: "ClosedWon",
        closedAt: { gte: thirtyDaysAgo, lte: now },
      },
      _sum: { targetRaise: true },
    }),
  ]);

  return {
    activeMandates: {
      value: activeMandatesValue,
      delta: activeMandatesDelta,
    },
    activeTransactions: {
      value: activeTransactionsValue,
      delta: activeTransactionsDelta,
    },
    investorsEngagedQtr: {
      value: investorsEngagedQtrRows.length,
      delta: investorsEngagedDeltaRows.length,
    },
    capitalRaisedYtd: {
      value: Number(capitalRaisedYtdAgg._sum.targetRaise ?? 0),
      delta: Number(capitalRaisedDeltaAgg._sum.targetRaise ?? 0),
    },
  };
}

/**
 * Pipeline overview: count per stage for mandates and transactions.
 * Covers FULL stage list in vocab order; stages with no records get count 0.
 *
 * Two groupBy queries (one mandate, one transaction) — no N+1.
 */
export async function pipelineOverview(): Promise<{
  mandatesByStage: { stage: string; label: string; count: number }[];
  transactionsByStage: { stage: string; label: string; count: number }[];
}> {
  const [mandateCounts, transactionCounts] = await Promise.all([
    prisma.mandate.groupBy({ by: ["stage"], _count: { _all: true } }),
    prisma.transaction.groupBy({ by: ["stage"], _count: { _all: true } }),
  ]);

  // Build lookup maps
  const mandateMap = new Map<string, number>();
  for (const row of mandateCounts) mandateMap.set(row.stage, row._count._all);

  const txnMap = new Map<string, number>();
  for (const row of transactionCounts) txnMap.set(row.stage, row._count._all);

  // Map over full vocab order
  const mandatesByStage = Object.keys(LABELS.MandateStage).map((stage) => ({
    stage,
    label: label("MandateStage", stage),
    count: mandateMap.get(stage) ?? 0,
  }));

  const transactionsByStage = Object.keys(LABELS.TransactionStage).map((stage) => ({
    stage,
    label: label("TransactionStage", stage),
    count: txnMap.get(stage) ?? 0,
  }));

  return { mandatesByStage, transactionsByStage };
}

/**
 * Deal pipeline trend: last 6 calendar months (UTC) ending with the current month.
 *
 * Loads all transactions ONCE (dateOpened, closedAt, createdAt only).
 * All month-bucket arithmetic is done in-process — no per-month queries.
 *
 * - closed: closedAt within [monthStart, monthEnd]
 * - active: (dateOpened ?? createdAt) <= monthEnd AND (closedAt == null || closedAt > monthEnd)
 */
export async function dealPipelineTrend(): Promise<
  { month: string; active: number; closed: number }[]
> {
  const now = new Date();

  // Build exactly 6 month buckets (UTC), oldest first
  const months: { start: Date; end: Date; label: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth();
    const start = new Date(Date.UTC(year, month, 1));
    const end = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0, -1)); // last ms of month
    const shortLabel = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
    months.push({ start, end, label: shortLabel });
  }

  // Single load — minimal select
  const txns = await prisma.transaction.findMany({
    select: { dateOpened: true, closedAt: true, createdAt: true },
  });

  return months.map(({ start, end, label: monthLabel }) => {
    let active = 0;
    let closed = 0;
    for (const txn of txns) {
      if (txn.closedAt != null && txn.closedAt >= start && txn.closedAt <= end) {
        closed++;
      }
      const opened = txn.dateOpened ?? txn.createdAt;
      if (opened <= end && (txn.closedAt == null || txn.closedAt > end)) {
        active++;
      }
    }
    return { month: monthLabel, active, closed };
  });
}

/**
 * Overdue action-point count (spec §3.8/§12.2) — tasks flagged `escalated`.
 * Consumed by the Task 7 "Overdue actions" dashboard stat; no UI here.
 */
export async function overdueTasksCount(): Promise<number> {
  return prisma.task.count({ where: { escalated: true } });
}

/**
 * The N most-overdue escalated tasks (soonest-missed deadline first), for the
 * dashboard's "Overdue actions" list (spec §13 Team & tasks). Single indexed
 * query — pairs with `overdueTasksCount()` for the headline number.
 */
export interface OverdueTaskItem {
  id: string;
  title: string;
  assigneeName: string | null;
  dueAt: Date | null;
}

export async function overdueTasks(limit = 5): Promise<OverdueTaskItem[]> {
  const rows = await prisma.task.findMany({
    where: { escalated: true },
    orderBy: { dueAt: "asc" },
    take: limit,
    select: { id: true, title: true, dueAt: true, assignee: { select: { name: true } } },
  });
  return rows.map((t) => ({
    id: t.id,
    title: t.title,
    assigneeName: t.assignee?.name ?? null,
    dueAt: t.dueAt,
  }));
}

// ─── Pipeline breakdowns (spec §13) ────────────────────────────────────────────

export interface CountBreakdown {
  key: string;
  label: string;
  count: number;
}

/**
 * Active-transaction breakdowns for the dashboard's Pipeline Overview: by
 * deal lead (owner), by sector, by financing type, by ticket-size band.
 *
 * Query plan (no N+1):
 * - `ownerId` and `financingType` are single-valued scalar fields, so each
 *   gets its own `groupBy` (2 queries total).
 * - `sector` is a Prisma scalar-list field (multi-select) and ticket band is
 *   a derived bucket over `targetRaise` — neither can be grouped server-side
 *   the way we need, so BOTH are computed from ONE `findMany` (minimal
 *   `{sector, targetRaise}` select) with the bucketing done in-process.
 * - Owner display names come from a single follow-up `findMany` keyed by the
 *   distinct ownerIds already returned by the groupBy (not per-row lookups).
 */
export async function pipelineBreakdowns(): Promise<{
  byLead: CountBreakdown[];
  bySector: CountBreakdown[];
  byFinancingType: CountBreakdown[];
  byTicketBand: CountBreakdown[];
}> {
  const activeWhere = { stage: { notIn: CLOSED_TXN_STAGES } } as const;

  const [byOwnerRaw, byFinancingRaw, txnRows] = await Promise.all([
    prisma.transaction.groupBy({ by: ["ownerId"], where: activeWhere, _count: { _all: true } }),
    prisma.transaction.groupBy({ by: ["financingType"], where: activeWhere, _count: { _all: true } }),
    prisma.transaction.findMany({ where: activeWhere, select: { sector: true, targetRaise: true } }),
  ]);

  const ownerIds = byOwnerRaw.map((r) => r.ownerId).filter((id): id is string => id != null);
  const owners = ownerIds.length
    ? await prisma.user.findMany({ where: { id: { in: ownerIds } }, select: { id: true, name: true } })
    : [];
  const ownerNameMap = new Map(owners.map((o) => [o.id, o.name]));

  const byLead: CountBreakdown[] = byOwnerRaw
    .map((r) => ({
      key: r.ownerId ?? "unassigned",
      label: r.ownerId ? (ownerNameMap.get(r.ownerId) ?? "Unknown") : "Unassigned",
      count: r._count._all,
    }))
    .sort((a, b) => b.count - a.count);

  const byFinancingType: CountBreakdown[] = byFinancingRaw
    .map((r) => ({
      key: r.financingType ?? "none",
      label: r.financingType ? label("DealFinancingType", r.financingType) : "Not set",
      count: r._count._all,
    }))
    .sort((a, b) => b.count - a.count);

  // sector + ticket band: bucketed in-process from the single findMany above.
  const sectorCounts = new Map<string, number>();
  const bandCounts = new Map<string, number>(TICKET_BANDS.map((b) => [b.key, 0]));
  let noBand = 0;

  for (const txn of txnRows) {
    for (const sector of txn.sector) {
      sectorCounts.set(sector, (sectorCounts.get(sector) ?? 0) + 1);
    }
    const amount = txn.targetRaise == null ? null : Number(txn.targetRaise);
    const band = bandForAmount(amount);
    if (band) bandCounts.set(band.key, (bandCounts.get(band.key) ?? 0) + 1);
    else noBand++;
  }

  const bySector: CountBreakdown[] = [...sectorCounts.entries()]
    .map(([sector, count]) => ({ key: sector, label: label("Sector", sector), count }))
    .sort((a, b) => b.count - a.count);

  const byTicketBand: CountBreakdown[] = TICKET_BANDS.map((band) => ({
    key: band.key,
    label: band.label,
    count: bandCounts.get(band.key) ?? 0,
  }));
  if (noBand > 0) byTicketBand.push({ key: "none", label: "Not set", count: noBand });

  return { byLead, bySector, byFinancingType, byTicketBand };
}

// ─── Disbursement by year/quarter (spec §13) ───────────────────────────────────

export interface PeriodDisbursement {
  year: number;
  quarter: number;
  total: number;
  disbursed: number;
  pending: number;
}

/**
 * Disbursement totals grouped by (year, quarter) — a single `groupBy` with
 * `_sum` over the three amount fields already stored on Engagement. Rows
 * with no year/quarter set are excluded (nothing to bucket them into).
 */
export async function disbursementByPeriod(): Promise<PeriodDisbursement[]> {
  const rows = await prisma.engagement.groupBy({
    by: ["year", "quarter"],
    where: { year: { not: null }, quarter: { not: null } },
    _sum: { totalAmount: true, amountDisbursed: true, amountPending: true },
  });

  return rows
    .map((r) => ({
      year: r.year as number,
      quarter: r.quarter as number,
      total: Number(r._sum.totalAmount ?? 0),
      disbursed: Number(r._sum.amountDisbursed ?? 0),
      pending: Number(r._sum.amountPending ?? 0),
    }))
    .sort((a, b) => a.year - b.year || a.quarter - b.quarter);
}

// ─── Team & tasks (spec §13) ────────────────────────────────────────────────────

export interface TeamWorkload {
  userId: string;
  name: string;
  openMandates: number;
  activeTransactions: number;
}

/**
 * Deal load per team member: open mandates (ACTIVE_MANDATE_STAGES) + active
 * transactions (stage not closed) led/owned by each active user.
 *
 * Query plan (no N+1): one `groupBy` on Mandate.leadId, one on
 * Transaction.ownerId, one `findMany` for active user names — 3 queries
 * total, independent of team size.
 */
export async function teamWorkload(): Promise<TeamWorkload[]> {
  const [mandateGroups, txnGroups, users] = await Promise.all([
    prisma.mandate.groupBy({
      by: ["leadId"],
      where: { stage: { in: ACTIVE_MANDATE_STAGES } },
      _count: { _all: true },
    }),
    prisma.transaction.groupBy({
      by: ["ownerId"],
      where: { stage: { notIn: CLOSED_TXN_STAGES } },
      _count: { _all: true },
    }),
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const mandateMap = new Map(
    mandateGroups.filter((r) => r.leadId != null).map((r) => [r.leadId as string, r._count._all]),
  );
  const txnMap = new Map(
    txnGroups.filter((r) => r.ownerId != null).map((r) => [r.ownerId as string, r._count._all]),
  );

  return users
    .map((u) => ({
      userId: u.id,
      name: u.name,
      openMandates: mandateMap.get(u.id) ?? 0,
      activeTransactions: txnMap.get(u.id) ?? 0,
    }))
    .filter((w) => w.openMandates > 0 || w.activeTransactions > 0)
    .sort((a, b) => b.openMandates + b.activeTransactions - (a.openMandates + a.activeTransactions));
}

export interface TaskStatusByOwner {
  userId: string;
  name: string;
  counts: Partial<Record<string, number>>;
}

/**
 * Task-status × owner cross-tab: for each active user with at least one
 * assigned task, a count per TaskStatus. Unassigned tasks are excluded (no
 * owner to cross-tab against) — `dashboardStats`/`overdueTasksCount` already
 * cover team-wide totals.
 *
 * Query plan (no N+1): one `groupBy` on (Task.assigneeId, Task.status) —
 * counts for every user/status pair come back in one call — plus one
 * `findMany` for active user names.
 */
export async function taskStatusByOwner(): Promise<TaskStatusByOwner[]> {
  const [groups, users] = await Promise.all([
    prisma.task.groupBy({ by: ["assigneeId", "status"], _count: { _all: true } }),
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const byUser = new Map<string, Partial<Record<string, number>>>();
  for (const row of groups) {
    if (row.assigneeId == null) continue;
    const bucket = byUser.get(row.assigneeId) ?? {};
    bucket[row.status] = row._count._all;
    byUser.set(row.assigneeId, bucket);
  }

  return users
    .map((u) => ({ userId: u.id, name: u.name, counts: byUser.get(u.id) ?? {} }))
    .filter((r) => Object.keys(r.counts).length > 0);
}

/** Investor-onboarding dashboard stats (design spec §7). */
export async function onboardingStats(now: Date = new Date()) {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [pendingReview, approvedThisMonth, ndaGroups] = await Promise.all([
    prisma.investor.count({ where: { onboardingStatus: "PendingReview" } }),
    prisma.activity.count({
      where: { subject: { startsWith: "Investor approved" }, occurredAt: { gte: monthStart } },
    }),
    prisma.investor.groupBy({
      by: ["ndaStatus"],
      where: { engagementClassification: "Active", onboardingStatus: "Approved" },
      _count: { _all: true },
    }),
  ]);
  const byNda: Record<string, number> = {};
  for (const row of ndaGroups) byNda[row.ndaStatus] = row._count._all;
  return {
    pendingReview,
    approvedThisMonth,
    ndaOpen: byNda["OpenNDA"] ?? 0,
    ndaClosed: byNda["ClosedNDA"] ?? 0,
    ndaNone: byNda["None"] ?? 0,
  };
}
