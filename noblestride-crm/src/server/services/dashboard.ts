// Dashboard service — single source of truth over Prisma for dashboard/analytics data.
// Thin layer: Prisma calls + domain helpers only. No GraphQL, no React.

import { prisma } from "@/lib/db";
import { LABELS, label } from "@/lib/vocab";
import { quarterRange } from "@/server/domain/metrics";
import { ACTIVE_MANDATE_STAGES, CLOSED_TXN_STAGES } from "@/server/domain/types";
import type { DashboardStats } from "@/server/domain/types";
// Ticket bands come from the deals-queue registry (not src/lib/ticket-bands,
// the registration wizard's band set) so the "By Ticket Size" drilldown links
// land on a /deals?ticket= filter that buckets identically.
import { TICKET_BANDS as QUEUE_TICKET_BANDS } from "@/server/domain/deals-queue";

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
  // Each delta must count a SUBSET of its value's population, or the card reads
  // "96 active, up 110 in 30 days" (2026-07-21 QA). Two rules enforce that:
  // (1) deltas carry the same stage/status filter as their value; (2) when the
  // value's own window is shorter than 30 days (early in a quarter/year), the
  // delta window is clamped to the value's window.
  const later = (a: Date, b: Date) => (a.getTime() >= b.getTime() ? a : b);
  const qtrDeltaStart = later(thirtyDaysAgo, qStart);
  const ytdDeltaStart = later(thirtyDaysAgo, ytdStart);

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
    // delta: still-active mandates created in the last 30d (subset of value)
    prisma.mandate.count({ where: { stage: { in: ACTIVE_MANDATE_STAGES }, createdAt: { gte: thirtyDaysAgo } } }),
    // active transactions: stage NOT IN CLOSED_TXN_STAGES
    prisma.transaction.count({ where: { stage: { notIn: CLOSED_TXN_STAGES } } }),
    // delta: still-active transactions created in the last 30d (subset of value)
    prisma.transaction.count({ where: { stage: { notIn: CLOSED_TXN_STAGES }, createdAt: { gte: thirtyDaysAgo } } }),
    // investors engaged this quarter: distinct investorId in Activity within quarterRange
    prisma.activity.findMany({
      where: {
        investorId: { not: null },
        occurredAt: { gte: qStart, lte: now },
      },
      distinct: ["investorId"],
      select: { investorId: true },
    }),
    // delta: distinct investors with activity in the last 30d, clamped to the
    // quarter so it stays a subset of the QTD value
    prisma.activity.findMany({
      where: {
        investorId: { not: null },
        occurredAt: { gte: qtrDeltaStart, lte: now },
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
    // capital raised delta: ClosedWon with closedAt in the last 30d, clamped to
    // the year so it stays a subset of the YTD value
    prisma.transaction.aggregate({
      where: {
        stage: "ClosedWon",
        closedAt: { gte: ytdDeltaStart, lte: now },
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
  mandatesActive: number;
  transactionsActive: number;
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

  // Active subtotals — same stage sets dashboardStats() uses, so the KPI
  // cards and this breakdown reconcile.
  const mandatesActive = mandatesByStage
    .filter((row) => (ACTIVE_MANDATE_STAGES as string[]).includes(row.stage))
    .reduce((sum, row) => sum + row.count, 0);

  const transactionsActive = transactionsByStage
    .filter((row) => !(CLOSED_TXN_STAGES as string[]).includes(row.stage))
    .reduce((sum, row) => sum + row.count, 0);

  return { mandatesByStage, transactionsByStage, mandatesActive, transactionsActive };
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
  { month: string; active: number; closed: number; monthStartISO: string; monthEndISO: string }[]
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
    // ISO bounds drive the line-chart drilldowns (active-as-of monthEnd; closed
    // within [monthStart, monthEnd]) so the opened /deals list reproduces the
    // point's count exactly — same definition as the loop above.
    return { month: monthLabel, active, closed, monthStartISO: start.toISOString(), monthEndISO: end.toISOString() };
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
    prisma.transaction.findMany({ where: activeWhere, select: { sector: true, targetRaise: true, client: { select: { sector: true } } } }),
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
  const bandCounts = new Map<string, number>(QUEUE_TICKET_BANDS.map((b) => [b.value, 0]));
  let noBand = 0;

  for (const txn of txnRows) {
    // Own sector first, client's as fallback — the deals queue rows use the
    // same rule (loadRows), so a sector drilldown count matches the list.
    const sectors = txn.sector.length ? txn.sector : (txn.client?.sector ?? []);
    for (const sector of sectors) {
      sectorCounts.set(sector, (sectorCounts.get(sector) ?? 0) + 1);
    }
    const amount = txn.targetRaise == null ? null : Number(txn.targetRaise);
    const band = amount == null || !Number.isFinite(amount)
      ? undefined
      : QUEUE_TICKET_BANDS.find((b) => amount >= b.min && (b.max === null || amount < b.max));
    if (band) bandCounts.set(band.value, (bandCounts.get(band.value) ?? 0) + 1);
    else noBand++;
  }

  const bySector: CountBreakdown[] = [...sectorCounts.entries()]
    .map(([sector, count]) => ({ key: sector, label: label("Sector", sector), count }))
    .sort((a, b) => b.count - a.count);

  const byTicketBand: CountBreakdown[] = QUEUE_TICKET_BANDS.map((band) => ({
    key: band.value,
    label: band.label,
    count: bandCounts.get(band.value) ?? 0,
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

/**
 * Investors awaiting onboarding review, newest registration first, with their
 * primary contact (name + email). Drives the dashboard onboarding alert card.
 */
export async function pendingOnboardingInvestors() {
  const investors = await prisma.investor.findMany({
    where: { onboardingStatus: "PendingReview" },
    orderBy: [{ registeredAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      registeredAt: true,
      contacts: {
        where: { email: { not: null } },
        orderBy: { isPrimaryContact: "desc" },
        take: 1,
        select: { firstName: true, lastName: true, email: true },
      },
    },
  });

  return investors.map((inv) => {
    const c = inv.contacts[0];
    return {
      id: inv.id,
      name: inv.name,
      registeredAt: inv.registeredAt,
      contactName: c ? [c.firstName, c.lastName].filter(Boolean).join(" ") || null : null,
      contactEmail: c?.email ?? null,
    };
  });
}

/**
 * Count of website-intake mandates awaiting review: submitted via the public
 * intake wizard (Task 11), never yet assigned a deal lead, and still open.
 * Drives the dashboard intake callout card (Task 12).
 */
export async function intakeAwaitingReviewCount(): Promise<number> {
  return prisma.mandate.count({
    where: { source: "Website", leadId: null, dealStatus: "Open" },
  });
}

export interface QuietTransaction {
  id: string;
  name: string;
  ownerId: string | null;
}

/**
 * Active transactions (stage NOT in CLOSED_TXN_STAGES) with no logged
 * activity in the last 14 days — "going quiet". Powers `aiOverviewInsights`'s
 * "attention" insight (org-wide, `ownerId` omitted). Kept parameterized by
 * `ownerId` (own-scoped mode) for reuse by any future lens-scoped surface.
 *
 * Query plan: one findMany over active transactions, each with a narrow
 * take:1 lookup for recent activity — filtering (no activity in window)
 * happens in-process. No N+1: the activity check is a nested `select` on the
 * same query, not a per-row follow-up call.
 */
export async function quietTransactions(ownerId?: string): Promise<QuietTransaction[]> {
  const now = new Date();
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const activeTransactions = await prisma.transaction.findMany({
    where: {
      stage: { notIn: CLOSED_TXN_STAGES },
      ...(ownerId ? { ownerId } : {}),
    },
    select: {
      id: true,
      name: true,
      ownerId: true,
      activities: {
        where: { occurredAt: { gte: fourteenDaysAgo } },
        select: { id: true },
        take: 1,
      },
    },
  });

  return activeTransactions
    .filter((t) => t.activities.length === 0)
    .map((t) => ({ id: t.id, name: t.name, ownerId: t.ownerId }));
}

// ─── Spec-gap pass 2: remaining §13 dashboards ────────────────────────────────

export interface ActiveInactiveSplit {
  mandates: { active: number; inactive: number };
  transactions: { active: number; inactive: number };
}

/** Active deal statuses per the design: Open + Closed & Reopened. */
const ACTIVE_DEAL_STATUSES: string[] = ["Open", "ClosedReopened"];

/**
 * Pipeline activity split by dealStatus (spec §13 "active vs inactive").
 * Two groupBy queries — no N+1.
 */
export async function pipelineActiveSplit(): Promise<ActiveInactiveSplit> {
  const [mandateGroups, txnGroups] = await Promise.all([
    prisma.mandate.groupBy({ by: ["dealStatus"], _count: { _all: true } }),
    prisma.transaction.groupBy({ by: ["dealStatus"], _count: { _all: true } }),
  ]);
  const split = (groups: { dealStatus: string; _count: { _all: number } }[]) => {
    let active = 0;
    let inactive = 0;
    for (const g of groups) {
      if (ACTIVE_DEAL_STATUSES.includes(g.dealStatus)) active += g._count._all;
      else inactive += g._count._all;
    }
    return { active, inactive };
  };
  return { mandates: split(mandateGroups), transactions: split(txnGroups) };
}

export interface StageChangeFeedItem {
  id: string;
  field: string;
  fromValue: string | null;
  toValue: string;
  changedAt: Date;
  actorName: string | null;
  createdSource: string;
  entityLabel: string;
  entityHref: string | null;
}

/**
 * Recent stage/status/identifier changes across ALL audited entities
 * (spec §13 "stage history roll-up"). One findMany with narrow includes.
 */
export async function stageChangeFeed(limit = 12): Promise<StageChangeFeedItem[]> {
  const rows = await prisma.stageChange.findMany({
    orderBy: { changedAt: "desc" },
    take: limit,
    include: {
      changedBy: { select: { name: true } },
      mandate: { select: { id: true, name: true } },
      transaction: { select: { id: true, name: true } },
      engagement: { select: { id: true, name: true } },
      client: { select: { id: true, name: true } },
      investor: { select: { id: true, name: true } },
      partner: { select: { id: true, name: true } },
    },
  });
  return rows.map((r) => {
    const target =
      (r.mandate && { label: r.mandate.name, href: `/mandates/${r.mandate.id}` }) ||
      (r.transaction && { label: r.transaction.name, href: `/transactions/${r.transaction.id}` }) ||
      (r.engagement && { label: r.engagement.name, href: `/engagement/${r.engagement.id}` }) ||
      (r.client && { label: r.client.name, href: `/clients/${r.client.id}` }) ||
      (r.investor && { label: r.investor.name, href: `/investors/${r.investor.id}` }) ||
      (r.partner && { label: r.partner.name, href: `/partners/${r.partner.id}` }) ||
      { label: "—", href: null };
    return {
      id: r.id,
      field: r.field,
      fromValue: r.fromValue,
      toValue: r.toValue,
      changedAt: r.changedAt,
      actorName: r.changedBy?.name ?? null,
      createdSource: r.createdSource,
      entityLabel: target.label,
      entityHref: target.href,
    };
  });
}

/**
 * Transition counts by audited field (spec §13 roll-up companion to the feed).
 * One groupBy; labels via the same field map the feed uses.
 */
export async function stageChangeCounts(): Promise<CountBreakdown[]> {
  const FIELD_LABELS: Record<string, string> = {
    stage: "Stage",
    dealStatus: "Deal Status",
    engagementStage: "Engagement Stage",
    dealMilestone: "Milestone",
    name: "Name",
    registrationNo: "Registration No.",
    primaryContact: "Primary Contact",
  };
  const groups = await prisma.stageChange.groupBy({ by: ["field"], _count: { _all: true } });
  return groups
    .map((g) => ({ key: g.field, label: FIELD_LABELS[g.field] ?? g.field, count: g._count._all }))
    .sort((a, b) => b.count - a.count);
}

export interface InvestorEngagementRollupRow {
  investorId: string;
  name: string;
  underReview: number;
  rejected: number;
  invested: number;
}

/**
 * Per-investor engagement rollup (spec §13): deals under review / rejected /
 * invested. One groupBy + one name lookup — no N+1.
 */
export async function investorEngagementRollup(limit = 10): Promise<InvestorEngagementRollupRow[]> {
  const groups = await prisma.engagement.groupBy({
    by: ["investorId", "engagementStage"],
    _count: { _all: true },
  });
  const byInvestor = new Map<string, { underReview: number; rejected: number; invested: number }>();
  for (const g of groups) {
    const bucket = byInvestor.get(g.investorId) ?? { underReview: 0, rejected: 0, invested: 0 };
    if (g.engagementStage === "Invested") bucket.invested += g._count._all;
    else if (g.engagementStage === "Declined") bucket.rejected += g._count._all;
    else bucket.underReview += g._count._all;
    byInvestor.set(g.investorId, bucket);
  }
  const ids = [...byInvestor.keys()];
  const investors = ids.length
    ? await prisma.investor.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
    : [];
  const nameMap = new Map(investors.map((i) => [i.id, i.name]));
  return [...byInvestor.entries()]
    .map(([investorId, b]) => ({ investorId, name: nameMap.get(investorId) ?? "Unknown", ...b }))
    .sort((a, b) => b.underReview + b.rejected + b.invested - (a.underReview + a.rejected + a.invested))
    .slice(0, limit);
}

/**
 * Invested/completed summary stat (spec §13): engagements that reached
 * Invested or have money out the door.
 */
export async function investedSummary(): Promise<{ count: number; totalDisbursed: number }> {
  const agg = await prisma.engagement.aggregate({
    where: { OR: [{ engagementStage: "Invested" }, { disbursementStatus: "Disbursed" }] },
    _count: { _all: true },
    _sum: { amountDisbursed: true },
  });
  return { count: agg._count._all, totalDisbursed: Number(agg._sum.amountDisbursed ?? 0) };
}

export interface HistoricalEngagementRow {
  year: number;
  quarter: number;
  active: number;
  invested: number;
  declined: number;
}

/**
 * Historical engagement summary (spec §13, was ❌): outcome counts by the
 * already-derived year/quarter. One groupBy, bucketed in-process.
 */
export async function historicalEngagementSummary(): Promise<HistoricalEngagementRow[]> {
  const groups = await prisma.engagement.groupBy({
    by: ["year", "quarter", "engagementStage"],
    where: { year: { not: null }, quarter: { not: null } },
    _count: { _all: true },
  });
  const byPeriod = new Map<string, HistoricalEngagementRow>();
  for (const g of groups) {
    const key = `${g.year}-${g.quarter}`;
    const row = byPeriod.get(key) ?? {
      year: g.year as number,
      quarter: g.quarter as number,
      active: 0,
      invested: 0,
      declined: 0,
    };
    if (g.engagementStage === "Invested") row.invested += g._count._all;
    else if (g.engagementStage === "Declined") row.declined += g._count._all;
    else row.active += g._count._all;
    byPeriod.set(key, row);
  }
  return [...byPeriod.values()].sort((a, b) => a.year - b.year || a.quarter - b.quarter);
}

export interface PartnerFunnelRow {
  partnerId: string;
  name: string;
  introduced: number;
  progressed: number;
  won: number;
  lost: number;
}

/**
 * Referral conversion funnel per partner (spec §13), replacing the single
 * aggregate %: introduced → progressed (past NewLead) → Signed / Lost.
 * One findMany with a stage-only select — rollup in-process.
 */
export async function partnerConversionFunnel(): Promise<PartnerFunnelRow[]> {
  const partners = await prisma.partner.findMany({
    include: { referredMandates: { select: { stage: true } } },
    orderBy: { name: "asc" },
  });
  return partners
    .map((p) => {
      const stages = p.referredMandates.map((m) => m.stage as string);
      return {
        partnerId: p.id,
        name: p.name,
        introduced: stages.length,
        progressed: stages.filter((s) => s !== "NewLead").length,
        won: stages.filter((s) => s === "Signed").length,
        lost: stages.filter((s) => s === "Lost").length,
      };
    })
    .filter((r) => r.introduced > 0);
}
