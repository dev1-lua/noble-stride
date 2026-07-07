// Pure mapping: a DocumentType (string) -> the deal-workflow stage it belongs to.
// No schema dependency — cannot drift from the register. See design spec §6.

export type WorkflowStage =
  | "Onboarding"
  | "DealPreparation"
  | "TermSheet"
  | "DueDiligence"
  | "Closing"
  | "DataRoom";

export const WORKFLOW_STAGE_ORDER: WorkflowStage[] = [
  "Onboarding",
  "DealPreparation",
  "TermSheet",
  "DueDiligence",
  "Closing",
  "DataRoom",
];

export const WORKFLOW_STAGE_LABEL: Record<WorkflowStage, string> = {
  Onboarding: "Onboarding",
  DealPreparation: "Deal Preparation",
  TermSheet: "Term Sheet",
  DueDiligence: "Due Diligence",
  Closing: "Closing",
  DataRoom: "Data Room",
};

// One registry, authoritative in both directions.
const STAGE_DOC_TYPES: Record<WorkflowStage, string[]> = {
  Onboarding: ["NDA", "EngagementContract", "FeeShareAgreement"],
  DealPreparation: ["Teaser", "IM", "FinancialModel", "Valuation", "BusinessPlan", "PitchDeck"],
  TermSheet: ["TermSheet"],
  DueDiligence: ["AuditedAccounts", "CR12"],
  Closing: ["LoanAgreement", "SPA", "SHA"],
  DataRoom: [], // VDR is access-driven, not a document type; surfaced from Transaction.vdrLink
};

const DOC_TYPE_STAGE: Record<string, WorkflowStage> = Object.fromEntries(
  WORKFLOW_STAGE_ORDER.flatMap((s) => STAGE_DOC_TYPES[s].map((t) => [t, s])),
);

export function stageForDocType(t: string): WorkflowStage | null {
  return DOC_TYPE_STAGE[t] ?? null;
}

export function docTypesForStage(s: WorkflowStage): string[] {
  return STAGE_DOC_TYPES[s] ?? [];
}
