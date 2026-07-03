// partner-portal.ts — partner-side helpers for the partner portal.
// Kept separate from src/server/visibility/* on purpose: everything here is
// scoped to the partner's OWN record (never other partners, never investors,
// never internal notes/financials). The referral funnel helper is pure and
// derives entirely from the already-projected referredDeals list.

import type { MandateStage } from "@prisma/client";
import { prisma } from "@/lib/db";

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
