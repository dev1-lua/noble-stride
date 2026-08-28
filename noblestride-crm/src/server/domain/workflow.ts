// workflow.ts — the pure deal-workflow engine (Aug-2026 feedback F4.1.x /
// image32). Replaces the hard-coded 17-step `journey.ts`.
//
// A deal's workflow = the applicable steps of its WorkflowTemplate, each
// resolved to a status from (a) an evidence rule keyed on the step `key` and
// (b) an optional manual override row (DealStageState). Rules:
//   - manual "complete"   → done (source manual), wins over false evidence
//   - manual "incomplete" → NOT done even if evidence is true (explicit reopen;
//                           the UI shows "Reopened by <name>" + note)
//   - no manual row       → evidence decides
//   - keys with no evidence rule (custom template steps) are manual-only
// `current` = first applicable step that is not done.
//
// Pure: no Prisma, no DB. The service layer (`services/workflow.ts`) builds
// `WorkflowEvidence` and `ManualState[]` and calls `resolveWorkflow`.

import { dealHref, type DealKindEnum } from "./deal-kind";
import type { WorkflowPhase, WorkflowStepDef } from "./workflow-default";

export type { WorkflowPhase, WorkflowStepDef } from "./workflow-default";

export type StepStatus = "done" | "current" | "upcoming" | "manual";

export type StepState = {
  key: string;
  title: string;
  phase: WorkflowPhase;
  order: number;
  description: string | null;
  status: StepStatus;
  source: "evidence" | "manual" | null;
  completedAt: Date | null;
  completedById: string | null;
  completedByName: string | null;
  note: string | null;
  evidenceLabel: string | null;
  href: string | null;
  hasEvidenceRule: boolean;
  manualStatus: "complete" | "incomplete" | null;
};

export type DealWorkflow = {
  dealKind: DealKindEnum;
  dealId: string;
  templateId: string;
  templateName: string;
  isDefaultTemplate: boolean;
  steps: StepState[];
  phases: { phase: WorkflowPhase; label: string; steps: StepState[] }[];
  done: number;
  total: number;
  current: StepState | null;
};

export type WorkflowEvidence = {
  dealKind: DealKindEnum;
  dealId: string;
  createdAt: Date;
  sourceLabel: string | null;
  referredByName: string | null;
  /** The enum "pipeline status" (MandateStage / TransactionStage / AdvisoryStage value). */
  pipelineStatus: string;
  qualificationVerdict: string | null;
  classification: string | null;
  ndaSigned: boolean;
  ndaSignedAt: Date | null;
  leadId: string | null;
  leadName: string | null;
  vdrLink: string | null;
  documentTypes: string[];
  reviewedDocumentCount: number;
  engagements: {
    id: string;
    status: string;
    engagementStage: string | null;
    termSheetIssued: boolean;
    ndaSignedAt: Date | null;
    investorName: string;
  }[];
  outreachDraftCount: number;
  meetingCount: number;
  termSheetDocument: boolean;
  dealMilestone: string | null;
  successFeeInvoicedDate: Date | null;
  successFeePaidDate: Date | null;
  /** For a Mandate: the transaction whose execution steps we link to. */
  primaryTransactionId: string | null;
};

export type ManualState = {
  stepKey: string;
  manualStatus: "complete" | "incomplete";
  note: string | null;
  completedAt: Date | null;
  completedById: string | null;
  completedByName: string | null;
};

export type WorkflowTemplateLike = {
  id: string;
  name: string;
  isDefault: boolean;
  steps: WorkflowStepDef[];
};

export const WORKFLOW_PHASES: WorkflowPhase[] = ["Qualify", "Prepare", "Execute"];

export const WORKFLOW_PHASE_LABELS: Record<WorkflowPhase, string> = {
  Qualify: "Qualify",
  Prepare: "Prepare",
  Execute: "Execute",
};

/** Steps of a template that apply to `kind` ([] = all kinds), ordered by `order`. */
export function applicableSteps(steps: WorkflowStepDef[], kind: DealKindEnum): WorkflowStepDef[] {
  return steps
    .filter((s) => s.appliesTo.length === 0 || s.appliesTo.includes(kind))
    .slice()
    .sort((a, b) => a.order - b.order);
}

// ─── Evidence rules ───────────────────────────────────────────────────────────

type Evidence = { done: boolean; label: string | null; href: string | null; hasRule: boolean };

const NO_RULE: Evidence = { done: false, label: null, href: null, hasRule: false };

const ymd = (d: Date) => d.toISOString().slice(0, 10);

const INTEREST_STATUSES = new Set(["Interested", "InConversation", "Committed"]);
const POST_NDA_STAGES = new Set([
  "NDASigned", "IMShared", "VDRAccess", "Meeting", "InfoRequest", "DueDiligence", "TermSheet", "Offer", "Invested",
]);
const SCOPED_ADVISORY = new Set(["Proposal", "Engaged", "Delivery", "Completed"]);
const ANALYSED_MANDATE = new Set(["PitchPresentation", "Proposal", "Negotiation", "Signed"]);
const TERM_SHEET_TXN = new Set(["TermSheet", "Closing", "ClosedWon"]);

function txnAnchor(ev: WorkflowEvidence, anchor: string): string {
  if (ev.dealKind === "Mandate" && ev.primaryTransactionId) {
    return `/transactions/${ev.primaryTransactionId}${anchor}`;
  }
  return anchor;
}

const RULES: Record<string, (ev: WorkflowEvidence) => Evidence> = {
  newOpportunity(ev) {
    let label = `Created ${ymd(ev.createdAt)}`;
    if (ev.sourceLabel) label += ` · ${ev.sourceLabel}`;
    if (ev.referredByName) label += ` — referred by ${ev.referredByName}`;
    return { done: true, label, href: dealHref(ev.dealKind, ev.dealId), hasRule: true };
  },
  initialEvaluation(ev) {
    let done: boolean;
    if (ev.dealKind === "Transaction") done = true;
    else if (ev.dealKind === "Advisory") done = ev.classification != null || ev.pipelineStatus !== "Scoping";
    else done = ev.qualificationVerdict != null || ev.pipelineStatus !== "NewLead";
    return { done, label: null, href: "#pipeline-status", hasRule: true };
  },
  ndaSigned(ev) {
    const label = ev.ndaSigned ? (ev.ndaSignedAt ? `Signed ${ymd(ev.ndaSignedAt)}` : "Signed") : null;
    return {
      done: ev.ndaSigned,
      label,
      href: ev.dealKind === "Advisory" ? "#documents" : "#documents-by-stage",
      hasRule: true,
    };
  },
  assignmentScoping(ev) {
    const done = SCOPED_ADVISORY.has(ev.pipelineStatus) || ev.documentTypes.includes("EngagementContract");
    return { done, label: null, href: "#pipeline-status", hasRule: true };
  },
  dealAnalysis(ev) {
    const done =
      ev.documentTypes.includes("FinancialModel") ||
      ev.documentTypes.includes("Valuation") ||
      (ev.dealKind === "Mandate" && ANALYSED_MANDATE.has(ev.pipelineStatus));
    return { done, label: null, href: "#documents", hasRule: true };
  },
  dealApproved(ev) {
    const done = ev.leadId != null;
    return { done, label: done ? `Lead: ${ev.leadName ?? "assigned"}` : null, href: "#key-facts", hasRule: true };
  },
  opportunityPreparation(ev) {
    const done = ev.vdrLink != null || (ev.documentTypes.includes("Teaser") && ev.documentTypes.includes("IM"));
    return { done, label: ev.vdrLink ? "VDR set up" : null, href: ev.vdrLink ?? "#documents-by-stage", hasRule: true };
  },
  internalReview(ev) {
    const done = ev.reviewedDocumentCount > 0;
    return { done, label: done ? `${ev.reviewedDocumentCount} document(s) reviewed` : null, href: "#documents", hasRule: true };
  },
  investorOutreach(ev) {
    const done = ev.engagements.length > 0 || ev.outreachDraftCount > 0;
    let href: string;
    if (ev.dealKind === "Mandate" && ev.primaryTransactionId) href = `/transactions/${ev.primaryTransactionId}#engagements`;
    else href = "#engagements";
    const label = done
      ? `${ev.engagements.length} engagement(s)${ev.outreachDraftCount ? `, ${ev.outreachDraftCount} outreach draft(s)` : ""}`
      : null;
    return { done, label, href, hasRule: true };
  },
  investorInterest(ev) {
    const match = ev.engagements.find(
      (e) => INTEREST_STATUSES.has(e.status) || (e.engagementStage != null && POST_NDA_STAGES.has(e.engagementStage)),
    );
    return {
      done: match != null,
      label: match ? `${match.investorName} interested` : null,
      href: match ? `/engagement/${match.id}` : txnAnchor(ev, "#engagements"),
      hasRule: true,
    };
  },
  threePartyDiscussions(ev) {
    const done = ev.meetingCount > 0;
    return { done, label: done ? `${ev.meetingCount} meeting(s) / call(s)` : null, href: "#activity", hasRule: true };
  },
  termSheet(ev) {
    const issued = ev.engagements.find((e) => e.termSheetIssued);
    const done =
      issued != null ||
      ev.termSheetDocument ||
      TERM_SHEET_TXN.has(ev.pipelineStatus) ||
      ev.dealMilestone === "TermSheet";
    return {
      done,
      label: issued ? `Term sheet issued to ${issued.investorName}` : null,
      href: issued ? `/engagement/${issued.id}` : "#deal-facts",
      hasRule: true,
    };
  },
  successFee(ev) {
    const done = ev.successFeePaidDate != null;
    const label = done
      ? `Paid ${ymd(ev.successFeePaidDate!)}`
      : ev.successFeeInvoicedDate
        ? `Invoiced ${ymd(ev.successFeeInvoicedDate)}`
        : null;
    return { done, label, href: txnAnchor(ev, "#success-fee"), hasRule: true };
  },
};

/** Keys that carry an evidence rule (custom templates reusing them inherit the rule). */
export const EVIDENCE_RULE_KEYS: readonly string[] = Object.keys(RULES);

export function evaluateEvidence(stepKey: string, ev: WorkflowEvidence): Evidence {
  const rule = RULES[stepKey];
  return rule ? rule(ev) : NO_RULE;
}

// ─── Resolution ───────────────────────────────────────────────────────────────

export function resolveWorkflow(template: WorkflowTemplateLike, ev: WorkflowEvidence, manual: ManualState[]): DealWorkflow {
  const steps = applicableSteps(template.steps, ev.dealKind);
  const manualByKey = new Map(manual.map((m) => [m.stepKey, m]));

  let currentAssigned = false;
  const states: StepState[] = steps.map((def) => {
    const evidence = evaluateEvidence(def.key, ev);
    const m = manualByKey.get(def.key) ?? null;

    let done: boolean;
    let source: StepState["source"];
    if (m?.manualStatus === "complete") {
      done = true;
      source = "manual";
    } else if (m?.manualStatus === "incomplete") {
      done = false;
      source = "manual";
    } else {
      done = evidence.done;
      source = evidence.done ? "evidence" : null;
    }

    let status: StepStatus;
    if (done) status = "done";
    else if (!currentAssigned) {
      status = "current";
      currentAssigned = true;
    } else status = evidence.hasRule ? "upcoming" : "manual";

    return {
      key: def.key,
      title: def.title,
      phase: def.phase,
      order: def.order,
      description: def.description,
      status,
      source,
      completedAt: m?.completedAt ?? null,
      completedById: m?.completedById ?? null,
      completedByName: m?.completedByName ?? null,
      note: m?.note ?? null,
      evidenceLabel: evidence.label,
      href: evidence.href,
      hasEvidenceRule: evidence.hasRule,
      manualStatus: m?.manualStatus ?? null,
    };
  });

  const phases = WORKFLOW_PHASES.map((phase) => ({
    phase,
    label: WORKFLOW_PHASE_LABELS[phase],
    steps: states.filter((s) => s.phase === phase),
  }));

  return {
    dealKind: ev.dealKind,
    dealId: ev.dealId,
    templateId: template.id,
    templateName: template.name,
    isDefaultTemplate: template.isDefault,
    steps: states,
    phases,
    done: states.filter((s) => s.status === "done").length,
    total: states.length,
    current: states.find((s) => s.status === "current") ?? null,
  };
}

/**
 * G2 "Move deal here": the applicable, not-yet-done steps that sit BEFORE
 * `targetKey` in order — marking them done leaves the target as `current`.
 */
export function stepsToMoveTo(workflow: DealWorkflow, targetKey: string): StepState[] {
  const target = workflow.steps.find((s) => s.key === targetKey);
  if (!target) return [];
  return workflow.steps.filter((s) => s.order < target.order && s.status !== "done");
}
