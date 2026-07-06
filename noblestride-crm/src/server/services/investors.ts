// Investor service — single source of truth over Prisma for investor data.
// Thin layer: Prisma calls + domain helpers only. No GraphQL, no React.

import { prisma } from "@/lib/db";
import { buildInvestorWhere } from "@/server/domain/filters";
import { isActiveInvestorThisQuarter } from "@/server/domain/metrics";
import type { InvestorFilter, InvestorSegments, Pagination } from "@/server/domain/types";
import { investorCreateSchema, investorUpdateSchema, type InvestorCreateInput, type InvestorUpdateInput } from "@/lib/schemas/investor";
import { actorSource, CrudError } from "./crud";
import { recordStageChange } from "./stage-history";
import type { Actor } from "@/graphql/context";
import type { OnboardingStatus } from "@prisma/client";

/**
 * List investors matching the given filter, ordered by name asc.
 * When `page` is provided, applies offset-based pagination.
 */
export async function listInvestors(filter: InvestorFilter, page?: Pagination) {
  const where = buildInvestorWhere(filter);

  if (page != null) {
    return prisma.investor.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page.page - 1) * page.pageSize,
      take: page.pageSize,
    });
  }

  return prisma.investor.findMany({ where, orderBy: { name: "asc" } });
}

/**
 * Count investors matching the given filter.
 */
export async function countInvestors(filter: InvestorFilter): Promise<number> {
  return prisma.investor.count({ where: buildInvestorWhere(filter) });
}

/**
 * Aggregate investor segments for the dashboard.
 *
 * N+1 avoidance:
 *   - One `groupBy` call gets total + per-type counts in a single query.
 *   - One `findMany` with `select` loads only `status` and `activities.occurredAt`
 *     for all investors (no per-investor round-trips).
 *   - `isActiveInvestorThisQuarter` is applied in-process over the flat result.
 */
export async function investorSegments(now: Date = new Date()): Promise<InvestorSegments> {
  const [typeCounts, onboardingCounts, investors] = await Promise.all([
    prisma.investor.groupBy({
      by: ["investorType"],
      _count: { _all: true },
    }),
    prisma.investor.groupBy({ by: ["onboardingStatus"], _count: { _all: true } }),
    prisma.investor.findMany({
      select: {
        status: true,
        activities: { select: { occurredAt: true } },
      },
    }),
  ]);

  // Build type-count lookup
  const byType: Record<string, number> = {};
  for (const row of typeCounts) {
    byType[row.investorType] = row._count._all;
  }

  // Build onboarding-status-count lookup
  const byOnboarding: Record<string, number> = {};
  for (const row of onboardingCounts) {
    byOnboarding[row.onboardingStatus] = row._count._all;
  }

  // Count active-this-quarter in-process (no N+1)
  let activeThisQuarter = 0;
  for (const inv of investors) {
    const activityDates = inv.activities.map((a) => a.occurredAt);
    if (isActiveInvestorThisQuarter({ status: inv.status, activityDates }, now)) {
      activeThisQuarter++;
    }
  }

  return {
    total: investors.length,
    activeThisQuarter,
    privateEquity: byType["PrivateEquity"] ?? 0,
    ventureCapital: byType["VentureCapital"] ?? 0,
    dfi: byType["DFI"] ?? 0,
    debtProvider: byType["DebtProvider"] ?? 0,
    pendingReview: byOnboarding["PendingReview"] ?? 0,
    rejected: byOnboarding["Rejected"] ?? 0,
  };
}

/**
 * Fetch a single investor by id, including contacts, engagements (with
 * their transaction), and the 20 most recent activities.
 * Returns null when the investor does not exist.
 */
export async function getInvestor(id: string) {
  return prisma.investor.findUnique({
    where: { id },
    include: {
      contacts: true,
      ssaRegionContact: true,
      engagements: { include: { transaction: true } },
      activities: { orderBy: { occurredAt: "desc" }, take: 20 },
      stageChanges: { orderBy: { changedAt: "desc" }, include: { changedBy: true } },
    },
  });
}

export async function createInvestor(input: InvestorCreateInput, actor: Actor) {
  const data = investorCreateSchema.parse(input);
  return prisma.investor.create({ data: { ...data, createdSource: actorSource(actor) } });
}

export async function updateInvestor(id: string, input: InvestorUpdateInput, actor: Actor = { type: "HUMAN" }) {
  const data = investorUpdateSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.investor.findUniqueOrThrow({ where: { id }, select: { name: true } });
    const updated = await tx.investor.update({ where: { id }, data });
    if (data.name !== undefined) {
      await recordStageChange(tx, { field: "name", fromValue: existing.name, toValue: data.name, actor, investorId: id });
    }
    return updated;
  });
}

const ONBOARDING_ACTIVITY_SUBJECT: Record<OnboardingStatus, string> = {
  Approved: "Investor approved",
  Rejected: "Investor rejected",
  PendingReview: "Investor set to pending review",
};

/** Approve/reject a registration; logs the decision on the timeline. */
export async function setOnboardingStatus(id: string, status: OnboardingStatus, actor: Actor) {
  return prisma.$transaction(async (tx) => {
    const investor = await tx.investor.update({ where: { id }, data: { onboardingStatus: status } });
    await tx.activity.create({
      data: {
        type: "Note",
        subject: `${ONBOARDING_ACTIVITY_SUBJECT[status]} — ${investor.name}`,
        investorId: id,
        createdSource: actorSource(actor),
      },
    });
    return investor;
  });
}

export async function deleteInvestor(id: string) {
  const engagements = await prisma.engagement.count({ where: { investorId: id } });
  if (engagements > 0) {
    throw new CrudError(`Cannot delete: ${engagements} engagement(s) reference this investor.`);
  }
  return prisma.investor.delete({ where: { id } });
}
