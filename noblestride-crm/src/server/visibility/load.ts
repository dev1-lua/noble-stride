// Visibility engine — data-access glue. Fetches what the projectors need and
// returns ALREADY-PROJECTED results, so callers (resolvers, portal pages)
// never touch raw records for external roles.

import type {
  EngagementStage,
  InvestorEngagementClassification,
  MilestoneKey,
  PrismaClient,
  TransactionStage,
} from "@prisma/client";
import { groupDisbursementsByPeriod, type DisbursementPeriodRow } from "@/server/domain/disbursement";
import { investorTier, isBlockedClassification, type Tier } from "./tiers";
import { applyOpportunityFilters, type OpportunityFilters } from "./filters";
import {
  discoverableDealsForInvestor,
  projectDealForInvestor,
  projectForPartner,
  projectOwnEngagement,
  toNum,
  type ProjectedDeal,
  type ProjectedOwnEngagement,
  type ProjectedPartnerView,
} from "./project";

const ACTIVE_STAGES_FILTER: { notIn: TransactionStage[] } = {
  notIn: ["ClosedWon", "ClosedLost"],
};

export interface InvestorPortalData {
  investor: {
    id: string;
    name: string;
    classification: InvestorEngagementClassification;
  };
  deals: ProjectedDeal[];
}

/**
 * Everything the investor portal renders, pre-projected.
 * Deal set = deals the investor is engaged on (at their engagement tier)
 * ∪ discovery matches (at PRE_INTEREST). Blocked classifications and
 * Declined engagements project to nothing, so they simply drop out.
 * Optional filters (§11.1) intersect that candidate set — they can only
 * narrow it, never widen it.
 */
export async function loadInvestorPortalData(
  prisma: PrismaClient,
  investorId: string,
  filters: OpportunityFilters = {},
): Promise<InvestorPortalData> {
  const investor = await prisma.investor.findUniqueOrThrow({
    where: { id: investorId },
    include: { engagements: true },
  });

  const deals = await prisma.transaction.findMany({
    where: { stage: ACTIVE_STAGES_FILTER },
    include: {
      client: { include: { contacts: true } },
      mandate: true,
      documents: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const engagementByTxn = new Map(investor.engagements.map((e) => [e.transactionId, e]));
  const discoverableIds = new Set(discoverableDealsForInvestor(investor, deals).map((d) => d.id));
  const filteredIds = new Set(applyOpportunityFilters(deals, filters).map((d) => d.id));

  const projected: ProjectedDeal[] = [];
  for (const deal of deals) {
    const engagement = engagementByTxn.get(deal.id) ?? null;
    // Engaged deals are always candidates (tier gates them); otherwise the
    // deal must match the investor's discovery filters.
    if (!engagement && !discoverableIds.has(deal.id)) continue;
    // §11.1 interactive filters narrow the candidate set, never widen it.
    if (!filteredIds.has(deal.id)) continue;
    const projection = projectDealForInvestor(deal, investorTier(investor, engagement));
    if (projection) projected.push(projection);
  }

  return {
    investor: {
      id: investor.id,
      name: investor.name,
      classification: investor.engagementClassification,
    },
    deals: projected,
  };
}

// ─── Investor pipeline (own journey) ─────────────────────────────────────────

export interface InvestorPipelineItem {
  /** The deal, projected at the engagement's tier (Declined → teaser level). */
  deal: ProjectedDeal;
  /** The investor's OWN engagement — allowlisted fields only. */
  own: ProjectedOwnEngagement;
  /** completedAt for individually recorded milestone rows (own journey);
   *  stage-implied milestones have no date. Never includes milestone notes. */
  milestoneDates: Partial<Record<MilestoneKey, Date>>;
}

/**
 * The investor's OWN engagements, joined to their tier-projected deals.
 * - Blocked classifications see nothing (empty pipeline).
 * - Declined engagements still appear (it is the investor's own history) but
 *   the deal is projected at PRE_INTEREST (teaser level — they have already
 *   seen at least that) and the row sorts to the bottom.
 * Never contains: feedback, probability, notes, disbursement amounts,
 * owner/team identities, or other investors' data.
 */
export async function loadInvestorPipeline(
  prisma: PrismaClient,
  investorId: string,
): Promise<InvestorPipelineItem[]> {
  const investor = await prisma.investor.findUniqueOrThrow({ where: { id: investorId } });
  if (isBlockedClassification(investor.engagementClassification)) return [];

  const engagements = await prisma.engagement.findMany({
    where: { investorId },
    include: {
      milestones: true,
      transaction: {
        include: { client: { include: { contacts: true } }, mandate: true, documents: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const items: InvestorPipelineItem[] = [];
  for (const engagement of engagements) {
    const tier = investorTier(investor, engagement);
    const dealTier: Tier = tier === "NONE" ? "PRE_INTEREST" : tier;
    const deal = projectDealForInvestor(engagement.transaction, dealTier);
    if (!deal) continue;
    const milestoneDates: Partial<Record<MilestoneKey, Date>> = {};
    for (const m of engagement.milestones) milestoneDates[m.key] = m.completedAt;
    items.push({
      deal,
      own: projectOwnEngagement(engagement, engagement.milestones),
      milestoneDates,
    });
  }

  // Declined rows sink to the bottom (stable sort keeps recency order above).
  items.sort(
    (a, b) => Number(a.own.stage === "Declined") - Number(b.own.stage === "Declined"),
  );
  return items;
}

/**
 * The investor's own engagement + milestone dates for ONE deal (or null when
 * they have no engagement on it). Same projection rules as the pipeline.
 */
export async function loadOwnEngagementForDeal(
  prisma: PrismaClient,
  investorId: string,
  dealId: string,
): Promise<InvestorPipelineItem | null> {
  const items = await loadInvestorPipeline(prisma, investorId);
  return items.find((item) => item.deal.id === dealId) ?? null;
}

// ─── Investor dashboard (§13) ────────────────────────────────────────────────

export interface InvestorDashboardData {
  investor: { id: string; name: string };
  /** Deals the investor could discover today (same gating as the portal list). */
  matchingOpportunities: number;
  /** Count of the investor's own non-declined engagements. */
  engagedDeals: number;
  /** Own engagements by stage (no deal names, no amounts per deal). */
  pipeline: { stage: EngagementStage; count: number }[];
  /** Aggregate totals over the investor's OWN engagements only. */
  disbursement: { committed: number; disbursed: number; pending: number };
  /** Own disbursements bucketed by calendar quarter. */
  disbursementByPeriod: DisbursementPeriodRow[];
}

/**
 * Aggregates for the investor dashboard (§13). OWN data only: pipeline and
 * disbursement numbers are computed exclusively from the investor's own
 * engagements; the opportunity count reuses the same discovery gating as the
 * portal list. Blocked classifications get zeros. Never contains: deal-level
 * amounts of others, feedback, probability, notes, or team identities.
 */
export async function loadInvestorDashboard(
  prisma: PrismaClient,
  investorId: string,
): Promise<InvestorDashboardData> {
  const investor = await prisma.investor.findUniqueOrThrow({
    where: { id: investorId },
    include: { engagements: true },
  });
  const base = { investor: { id: investor.id, name: investor.name } };
  if (isBlockedClassification(investor.engagementClassification)) {
    return {
      ...base,
      matchingOpportunities: 0,
      engagedDeals: 0,
      pipeline: [],
      disbursement: { committed: 0, disbursed: 0, pending: 0 },
      disbursementByPeriod: [],
    };
  }

  const deals = await prisma.transaction.findMany({
    where: { stage: ACTIVE_STAGES_FILTER },
    include: { client: true },
  });
  const matchingOpportunities = discoverableDealsForInvestor(investor, deals).length;

  const own = investor.engagements.filter((e) => e.engagementStage !== "Declined");
  const stageCounts = new Map<EngagementStage, number>();
  for (const e of own) stageCounts.set(e.engagementStage, (stageCounts.get(e.engagementStage) ?? 0) + 1);

  let committed = 0;
  let disbursed = 0;
  let pending = 0;
  for (const e of own) {
    const total = toNum(e.totalAmount);
    const d = toNum(e.amountDisbursed);
    committed += total ?? 0;
    disbursed += d ?? 0;
    pending += toNum(e.amountPending) ?? (total != null ? total - (d ?? 0) : 0);
  }

  return {
    ...base,
    matchingOpportunities,
    engagedDeals: own.length,
    pipeline: [...stageCounts.entries()].map(([stage, count]) => ({ stage, count })),
    disbursement: { committed, disbursed, pending },
    disbursementByPeriod: groupDisbursementsByPeriod(
      own.map((e) => ({
        totalAmount: toNum(e.totalAmount),
        amountDisbursed: toNum(e.amountDisbursed),
        amountPending: toNum(e.amountPending),
        dateReceived: e.dateReceived,
        year: e.year,
        quarter: e.quarter,
      })),
    ),
  };
}

/** Everything the partner portal renders, pre-projected (§5.4). */
export async function loadPartnerPortalData(
  prisma: PrismaClient,
  partnerId: string,
): Promise<ProjectedPartnerView> {
  const partner = await prisma.partner.findUniqueOrThrow({
    where: { id: partnerId },
    include: { referredMandates: { include: { client: true } } },
  });
  return projectForPartner(partner, partner.referredMandates);
}
