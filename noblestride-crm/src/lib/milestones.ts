// milestones.ts — the fixed investor milestone cycle from the client's
// "Sectors and Milestones" / "End-to-End Workflow" docs. Order matters: it is
// the investor-perspective journey (teaser → NDA → EOI → data room → DD →
// IC → term sheets → offer → definitive agreements → competition approval),
// plus the post-deal success-fee step.
import type { EngagementStage, MilestoneKey } from "@prisma/client";

export const MILESTONE_ORDER: MilestoneKey[] = [
  "TeaserReview",
  "NdaExecuted",
  "ExpressionOfInterest",
  "DataRoomAccess",
  "PreliminaryDD",
  "ICPaperPrepared",
  "FirstICApproval",
  "NonBindingTermSheet",
  "TermSheetExecuted",
  "OnsiteDD",
  "SecondICApproval",
  "BindingOffer",
  "DefinitiveAgreements",
  "CompetitionApproval",
  "SuccessFeePaid",
];

export const MILESTONE_LABELS: Record<MilestoneKey, string> = {
  TeaserReview: "Teaser received & reviewed",
  NdaExecuted: "NDA executed",
  ExpressionOfInterest: "Expression of interest / LOI",
  DataRoomAccess: "Data room access",
  PreliminaryDD: "Preliminary due diligence",
  ICPaperPrepared: "Internal IC paper",
  FirstICApproval: "First IC approval",
  NonBindingTermSheet: "Non-binding term sheet",
  TermSheetExecuted: "Term sheet executed",
  OnsiteDD: "Onsite due diligence (fin / tax / commercial / ESG / legal)",
  SecondICApproval: "Second IC approval",
  BindingOffer: "Binding offer",
  DefinitiveAgreements: "Loan agreement / SPA & SHA",
  CompetitionApproval: "Competition approval (CAK / COMESA)",
  SuccessFeePaid: "Success fee paid",
};

/**
 * How far along the fixed milestone list an engagement stage implies.
 * Used to backfill/refresh the milestone checklist from the pipeline stage;
 * individually recorded milestones (EngagementMilestone rows) take precedence.
 */
export const STAGE_MILESTONES: Record<EngagementStage, MilestoneKey[]> = {
  Shared: [],
  TeaserSent: ["TeaserReview"],
  NDASigned: ["TeaserReview", "NdaExecuted"],
  Meeting: ["TeaserReview", "NdaExecuted", "ExpressionOfInterest"],
  InfoRequest: ["TeaserReview", "NdaExecuted", "ExpressionOfInterest"],
  IMShared: ["TeaserReview", "NdaExecuted", "ExpressionOfInterest"],
  VDRAccess: ["TeaserReview", "NdaExecuted", "ExpressionOfInterest", "DataRoomAccess"],
  DueDiligence: [
    "TeaserReview", "NdaExecuted", "ExpressionOfInterest", "DataRoomAccess",
    "PreliminaryDD",
  ],
  TermSheet: [
    "TeaserReview", "NdaExecuted", "ExpressionOfInterest", "DataRoomAccess",
    "PreliminaryDD", "ICPaperPrepared", "FirstICApproval", "NonBindingTermSheet",
  ],
  Offer: [
    "TeaserReview", "NdaExecuted", "ExpressionOfInterest", "DataRoomAccess",
    "PreliminaryDD", "ICPaperPrepared", "FirstICApproval", "NonBindingTermSheet",
    "TermSheetExecuted", "OnsiteDD", "SecondICApproval", "BindingOffer",
  ],
  Invested: [
    "TeaserReview", "NdaExecuted", "ExpressionOfInterest", "DataRoomAccess",
    "PreliminaryDD", "ICPaperPrepared", "FirstICApproval", "NonBindingTermSheet",
    "TermSheetExecuted", "OnsiteDD", "SecondICApproval", "BindingOffer",
    "DefinitiveAgreements", "CompetitionApproval",
  ],
  Declined: [], // whatever was individually recorded stands; stage implies nothing further
};

/** Merge stage-implied milestones with individually recorded ones. */
export function effectiveMilestones(
  stage: EngagementStage,
  recorded: MilestoneKey[],
): Set<MilestoneKey> {
  return new Set([...STAGE_MILESTONES[stage], ...recorded]);
}

// ── Target-company deal-preparation milestones (same doc) ────────────────────
// Derived from the document register, not stored.
export const PREP_MILESTONES = [
  { key: "Teaser", label: "Teaser prepared", docType: "Teaser" },
  { key: "FinancialModel", label: "Financial model", docType: "FinancialModel" },
  { key: "IM", label: "Information memorandum", docType: "IM" },
  { key: "Valuation", label: "Valuation report (equity deals)", docType: "Valuation" },
  { key: "BusinessPlan", label: "Business plan (optional)", docType: "BusinessPlan" },
] as const;
