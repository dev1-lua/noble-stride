// Visibility engine — the §5.2 field matrix, encoded as data.
// The projector (project.ts) consults this table; UI never re-derives it.

import type { Tier } from "./tiers";

/** Access level for one field group at one tier. */
export type FieldAccess = "full" | "limited" | "none" | "onRequest";

/** Tiers that can see anything at all. */
export type VisibleTier = Exclude<Tier, "NONE">;

export const FIELD_GROUPS = [
  "companyProfile", // company profile, sector, target profile
  "dealTypeTicket", // deal type, requested ticket size
  "financialsSummary", // revenue, EBITDA, total assets, use of funds
  "matchingMandateStatus", // status of matching active mandates
  "fullFinancials", // full financials, IM, financial model
  "vdrFiles", // Document.accessLevel = VDR
  "advisorClientContacts",
  "otherInvestors",
  "engagementContracts",
  "investorFeedbackOffers",
  "internalMessages",
] as const;

export type FieldGroup = (typeof FIELD_GROUPS)[number];

/** §5.2 field matrix, verbatim. "onRequest" = hidden until VDRAccess (spec §10). */
export const FIELD_MATRIX: Record<FieldGroup, Record<VisibleTier, FieldAccess>> = {
  companyProfile: { PRE_INTEREST: "full", AFTER_NDA: "full", DD: "full" },
  dealTypeTicket: { PRE_INTEREST: "full", AFTER_NDA: "full", DD: "full" },
  financialsSummary: { PRE_INTEREST: "limited", AFTER_NDA: "full", DD: "full" },
  matchingMandateStatus: { PRE_INTEREST: "full", AFTER_NDA: "full", DD: "full" },
  fullFinancials: { PRE_INTEREST: "none", AFTER_NDA: "full", DD: "full" },
  vdrFiles: { PRE_INTEREST: "none", AFTER_NDA: "onRequest", DD: "full" },
  advisorClientContacts: { PRE_INTEREST: "none", AFTER_NDA: "none", DD: "full" },
  otherInvestors: { PRE_INTEREST: "none", AFTER_NDA: "none", DD: "none" },
  engagementContracts: { PRE_INTEREST: "none", AFTER_NDA: "none", DD: "none" },
  investorFeedbackOffers: { PRE_INTEREST: "none", AFTER_NDA: "none", DD: "none" },
  internalMessages: { PRE_INTEREST: "none", AFTER_NDA: "none", DD: "none" },
};

/** Field groups that are "none" at every tier. */
export const NEVER_VISIBLE_GROUPS = [
  "otherInvestors",
  "engagementContracts",
  "investorFeedbackOffers",
  "internalMessages",
] as const satisfies readonly FieldGroup[];

/**
 * HARD RULES (§5.2, never overridable): these categories are NEVER visible to
 * any external role, at any tier — no flag, stage, or classification can
 * surface them. The projector must strip them unconditionally.
 */
export const HARD_RULE_NEVER_VISIBLE = [
  "otherInvestorIdentities",
  "partnerConsultantIdentities",
  "internalNotes",
  "engagementContracts",
] as const;

export type HardRule = (typeof HARD_RULE_NEVER_VISIBLE)[number];

/** Access for a field group at a tier; the NONE tier sees nothing. */
export function fieldAccess(group: FieldGroup, tier: Tier): FieldAccess {
  if (tier === "NONE") return "none";
  return FIELD_MATRIX[group][tier];
}

/**
 * Whether a field group renders at all for a tier.
 * "onRequest" is treated as hidden (spec §10: VDR files stay hidden until the
 * engagement reaches VDRAccess, i.e. tier DD).
 */
export function isFieldVisible(group: FieldGroup, tier: Tier): boolean {
  const access = fieldAccess(group, tier);
  return access === "full" || access === "limited";
}
