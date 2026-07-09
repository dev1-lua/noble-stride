// partner-portal.ts — partner-side helpers for the partner portal.
// Kept separate from src/server/visibility/* on purpose: everything here is
// scoped to the partner's OWN record (never other partners, never investors,
// never internal notes/financials). The referral funnel helper is pure and
// derives entirely from the already-projected referredDeals list.

import type { MandateStage } from "@prisma/client";
import { prisma } from "@/lib/db";
import { LABELS } from "@/lib/vocab";

// ─── Referral conversion funnel (spec §3.6 lifecycle) ────────────────────────
// introduced → progressing → signed / lost, derived from Mandate.stage.

export interface ReferralFunnel {
  /** Every deal the partner has referred. */
  introduced: number;
  /** Stage past NewLead but not yet Signed/Lost. */
  inProgress: number;
  signed: number;
  lost: number;
}

export function referralFunnel(deals: { stage: MandateStage }[]): ReferralFunnel {
  return {
    introduced: deals.length,
    inProgress: deals.filter(
      (d) => d.stage !== "NewLead" && d.stage !== "Signed" && d.stage !== "Lost",
    ).length,
    signed: deals.filter((d) => d.stage === "Signed").length,
    lost: deals.filter((d) => d.stage === "Lost").length,
  };
}

// ─── Referrals by stage (§13 partner dashboard) ─────────────────────────────
// Pure: derives entirely from the already-projected referredDeals list, so it
// introduces no new leak surface.

export interface ReferralStageRow {
  stage: MandateStage;
  count: number;
  totalSize: number;
}

/** Referred-deal counts + total deal size per stage, in vocab order; empty stages dropped. */
export function referralsByStage(
  deals: { stage: MandateStage; dealSize: number | null }[],
): ReferralStageRow[] {
  const byStage = new Map<MandateStage, ReferralStageRow>();
  for (const d of deals) {
    const row = byStage.get(d.stage) ?? { stage: d.stage, count: 0, totalSize: 0 };
    row.count += 1;
    row.totalSize += d.dealSize ?? 0;
    byStage.set(d.stage, row);
  }
  return (Object.keys(LABELS.MandateStage) as MandateStage[])
    .map((s) => byStage.get(s))
    .filter((r): r is ReferralStageRow => r != null);
}

// ─── Own-record details (My Details page) ────────────────────────────────────
// Explicit select: only fields the partner may see about THEMSELVES. No
// relations, no internal-only fields (profile/amount/internalOnly stay out).

export async function getOwnPartnerDetails(partnerId: string) {
  return prisma.partner.findUniqueOrThrow({
    where: { id: partnerId },
    select: {
      id: true,
      name: true,
      organization: true,
      advisorType: true,
      email: true,
      phone: true,
      partnerAgreementStatus: true,
      feeSharingAgreement: true,
      feeSharingTerms: true,
    },
  });
}
