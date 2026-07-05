// Dashboard service — single source of truth over Prisma for dashboard/analytics data.
// Thin layer: Prisma calls + domain helpers only. No GraphQL, no React.

import { prisma } from "@/lib/db";
import { LABELS, label } from "@/lib/vocab";
import { quarterRange } from "@/server/domain/metrics";
import { ACTIVE_MANDATE_STAGES, CLOSED_TXN_STAGES } from "@/server/domain/types";
import type { DashboardStats } from "@/server/domain/types";

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
