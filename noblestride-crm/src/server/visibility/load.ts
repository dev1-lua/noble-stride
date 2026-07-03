// Visibility engine — data-access glue. Fetches what the projectors need and
// returns ALREADY-PROJECTED results, so callers (resolvers, portal pages)
// never touch raw records for external roles.

import type { InvestorEngagementClassification, PrismaClient, TransactionStage } from "@prisma/client";
import { investorTier } from "./tiers";
import {
  discoverableDealsForInvestor,
  projectDealForInvestor,
  projectForPartner,
  type ProjectedDeal,
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
 */
export async function loadInvestorPortalData(
  prisma: PrismaClient,
  investorId: string,
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

  const projected: ProjectedDeal[] = [];
  for (const deal of deals) {
    const engagement = engagementByTxn.get(deal.id) ?? null;
    // Engaged deals are always candidates (tier gates them); otherwise the
    // deal must match the investor's discovery filters.
    if (!engagement && !discoverableIds.has(deal.id)) continue;
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
