/**
 * Fee-sharing guard (spec §8.4 "Never": act on fee sharing without a recorded
 * agreement). The CRM has no server-side rule here, so this agent-side check is
 * the sole enforcement: a partner fee may only be marked owed (status ≠ NotDue)
 * or given an amount when the partner has a recorded, signed agreement.
 *
 * "Recorded agreement" = feeSharingAgreement === true AND
 * partnerAgreementStatus === "Signed". Recording the agreement itself (via
 * update_partner) is always allowed — that's how staff satisfy the guard.
 */

export interface PartnerAgreementFields {
  name: string;
  feeSharingAgreement: boolean;
  feeSharingTerms?: string | null;
  partnerAgreementStatus: string;
}

export interface FeeChange {
  partnerFeeStatus?: string;
  partnerFeeAmount?: number;
}

export type FeeGuardVerdict =
  | { allowed: true; warning?: string }
  | { allowed: false; message: string };

export function hasRecordedAgreement(partner: PartnerAgreementFields): boolean {
  return partner.feeSharingAgreement === true && partner.partnerAgreementStatus === "Signed";
}

export function checkFeeGuard(
  partner: PartnerAgreementFields | null,
  change: FeeChange,
): FeeGuardVerdict {
  const marksFeeOwed =
    (change.partnerFeeStatus !== undefined && change.partnerFeeStatus !== "NotDue") ||
    change.partnerFeeAmount !== undefined;
  if (!marksFeeOwed) return { allowed: true };

  if (!partner) {
    return {
      allowed: false,
      message:
        "This deal has no referring partner on record — a partner fee cannot be recorded without one. " +
        "Link the originating partner to the deal first (link_partner_to_deal).",
    };
  }

  if (!hasRecordedAgreement(partner)) {
    return {
      allowed: false,
      message:
        `${partner.name} has no recorded fee-sharing agreement ` +
        `(feeSharingAgreement: ${partner.feeSharingAgreement}, agreement status: ${partner.partnerAgreementStatus}) — ` +
        `fee status and amounts cannot be recorded until one is. ` +
        `To proceed, first record the signed agreement on the partner via update_partner ` +
        `(feeSharingAgreement: true, partnerAgreementStatus: Signed, plus the terms), then retry.`,
    };
  }

  const warning =
    !partner.feeSharingTerms || partner.feeSharingTerms.trim() === ""
      ? `${partner.name} has a signed fee-sharing agreement but no terms recorded — consider adding feeSharingTerms via update_partner.`
      : undefined;
  return { allowed: true, warning };
}
