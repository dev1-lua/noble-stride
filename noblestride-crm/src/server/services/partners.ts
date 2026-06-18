// Partner service — single source of truth over Prisma for partner/referral data.
// Thin layer: Prisma calls + domain helpers only. No GraphQL, no React.

import { prisma } from "@/lib/db";
import { partnerReferralRollup } from "@/server/domain/metrics";
import type { PartnerReferralInput } from "@/server/domain/types";
import type { PartnerType, PartnerStatus } from "@prisma/client";

// ─── Filter type ─────────────────────────────────────────────────────────────

interface PartnerFilter {
  partnerType?: PartnerType;
  status?: PartnerStatus;
}

// ─── partnerReferralStats shape ───────────────────────────────────────────────

export interface PartnerReferralStats {
  totalPartners: number;
  dealsReferred: number;
  closedRevenue: number;
  /** 0–1 ratio; multiply by 100 for a percentage display. */
  conversionRate: number;
  byPartner: {
    name: string;
    referred: number;
    active: number;
    closed: number;
    revenue: number;
  }[];
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * List partners with optional filtering by type and/or status, ordered by
 * name asc.
 */
export async function listPartners(filter?: PartnerFilter) {
  const where: { partnerType?: PartnerType; status?: PartnerStatus } = {};
  if (filter?.partnerType != null) where.partnerType = filter.partnerType;
  if (filter?.status != null) where.status = filter.status;

  return prisma.partner.findMany({ where, orderBy: { name: "asc" } });
}

/**
 * Fetch a single partner by id, including contacts and referred mandates
 * (with their transactions and client). Returns null when the partner does
 * not exist.
 */
export async function getPartner(id: string) {
  return prisma.partner.findUnique({
    where: { id },
    include: {
      contacts: true,
      referredMandates: {
        include: {
          transactions: true,
          client: true,
        },
      },
    },
  });
}

/**
 * Aggregate referral performance across all partners.
 *
 * One DB round-trip loads all partners with their mandates + transactions.
 * Per-partner rollup is computed in-process via `partnerReferralRollup`
 * (no N+1).
 *
 * - `totalPartners`: count of partners in the system.
 * - `dealsReferred`: Σ referred across all partners.
 * - `closedRevenue`: Σ revenue (ClosedWon targetRaise) across all partners.
 * - `conversionRate`: (Σ closed) / dealsReferred as a 0–1 ratio (0 if none referred).
 * - `byPartner`: per-partner rollup rows.
 */
export async function partnerReferralStats(): Promise<PartnerReferralStats> {
  const partners = await prisma.partner.findMany({
    include: {
      referredMandates: {
        include: { transactions: true },
      },
    },
    orderBy: { name: "asc" },
  });

  let totalDealsReferred = 0;
  let totalClosed = 0;
  let totalRevenue = 0;

  const byPartner = partners.map((partner) => {
    const rollupInput: PartnerReferralInput = {
      mandates: partner.referredMandates.map((m) => ({
        transactions: m.transactions.map((t) => ({
          stage: t.stage,
          targetRaise: Number(t.targetRaise ?? 0),
        })),
      })),
    };

    const rollup = partnerReferralRollup(rollupInput);

    totalDealsReferred += rollup.referred;
    totalClosed += rollup.closed;
    totalRevenue += rollup.revenue;

    return {
      name: partner.name,
      referred: rollup.referred,
      active: rollup.active,
      closed: rollup.closed,
      revenue: rollup.revenue,
    };
  });

  return {
    totalPartners: partners.length,
    dealsReferred: totalDealsReferred,
    closedRevenue: totalRevenue,
    conversionRate: totalDealsReferred > 0 ? totalClosed / totalDealsReferred : 0,
    byPartner,
  };
}
