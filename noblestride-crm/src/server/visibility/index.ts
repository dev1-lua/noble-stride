// Visibility engine (§11) — the single gating authority for external roles.
// All investor/partner-facing data MUST flow through this module.

export { investorTier, isBlockedClassification, BLOCKED_CLASSIFICATIONS, type Tier } from "./tiers";
export {
  FIELD_MATRIX,
  FIELD_GROUPS,
  NEVER_VISIBLE_GROUPS,
  HARD_RULE_NEVER_VISIBLE,
  fieldAccess,
  isFieldVisible,
  type FieldAccess,
  type FieldGroup,
  type VisibleTier,
  type HardRule,
} from "./matrix";
export {
  projectDealForInvestor,
  discoverableDealsForInvestor,
  projectForPartner,
  projectOwnEngagement,
  bandCurrency,
  toNum,
  GENERIC_CONTACT_LINE,
  type OwnEngagementInput,
  type OwnMilestoneInput,
  type ProjectedOwnEngagement,
  type DealInput,
  type DealClientInput,
  type DocumentInput,
  type EngagementInput,
  type PersonInput,
  type DiscoveryInvestor,
  type PartnerInput,
  type ReferredMandateInput,
  type ProjectedDeal,
  type ProjectedDocument,
  type ProjectedContact,
  type ProjectedPartnerView,
  type DecimalLike,
} from "./project";
export {
  applyOpportunityFilters,
  parseOpportunityFilters,
  type OpportunityFilters,
} from "./filters";
export {
  loadInvestorPortalData,
  loadInvestorPipeline,
  loadOwnEngagementForDeal,
  loadPartnerPortalData,
  type InvestorPortalData,
  type InvestorPipelineItem,
} from "./load";
