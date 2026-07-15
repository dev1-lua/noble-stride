import type { CrmClient } from "./crm-client";
import { REFERRED_DEALS_SCAN } from "./queries";

/**
 * Flattens every referred deal in the CRM into one list — shared by the
 * referral_pipeline_digest tool and the stage-watch job.
 *
 * Conversion rules (matches partnerReferralRollup): a referred mandate is
 * "converted" (client onboarded) at stage Signed; a referred transaction
 * converts at ClosedWon. Mandate Lost / transaction ClosedLost are "lost".
 *
 * A transaction directly referred by partner P whose parent mandate was ALSO
 * referred by P is skipped — the mandate row already represents that referral.
 */

export interface ReferredDeal {
  /** Stable identity for snapshots/dedupe: "mandate:<id>" | "transaction:<id>". */
  dealKey: string;
  dealId: string;
  dealName: string;
  dealType: "mandate" | "transaction";
  partnerId: string;
  partnerName: string;
  stage: string;
  dealStatus: string;
  /** Path only — callers prefix crm.baseUrl. */
  link: string;
  converted: boolean;
  lost: boolean;
  updatedAt?: string;
}

interface ScanPartner {
  id: string;
  name: string;
  referredMandates: Array<{ id: string; name: string; stage: string; dealStatus: string; updatedAt?: string }>;
  referredTransactions: Array<{ id: string; name: string; stage: string; dealStatus: string; mandateId?: string | null; updatedAt?: string }>;
}

export function flattenReferredDeals(partners: ScanPartner[]): ReferredDeal[] {
  const deals: ReferredDeal[] = [];
  for (const partner of partners) {
    const ownMandateIds = new Set(partner.referredMandates.map((m) => m.id));
    for (const m of partner.referredMandates) {
      deals.push({
        dealKey: `mandate:${m.id}`,
        dealId: m.id,
        dealName: m.name,
        dealType: "mandate",
        partnerId: partner.id,
        partnerName: partner.name,
        stage: m.stage,
        dealStatus: m.dealStatus,
        link: `/mandates/${m.id}`,
        converted: m.stage === "Signed",
        lost: m.stage === "Lost",
        updatedAt: m.updatedAt,
      });
    }
    for (const t of partner.referredTransactions) {
      if (t.mandateId != null && ownMandateIds.has(t.mandateId)) continue;
      deals.push({
        dealKey: `transaction:${t.id}`,
        dealId: t.id,
        dealName: t.name,
        dealType: "transaction",
        partnerId: partner.id,
        partnerName: partner.name,
        stage: t.stage,
        dealStatus: t.dealStatus,
        link: `/transactions/${t.id}`,
        converted: t.stage === "ClosedWon",
        lost: t.stage === "ClosedLost",
        updatedAt: t.updatedAt,
      });
    }
  }
  return deals;
}

export async function scanReferredDeals(crm: CrmClient): Promise<ReferredDeal[]> {
  const result = await crm.query<{ partners: ScanPartner[] }>(REFERRED_DEALS_SCAN);
  return flattenReferredDeals(result.partners);
}
