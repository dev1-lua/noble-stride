import { describe, it, expect } from "vitest";
import {
  applicableSteps,
  evaluateEvidence,
  resolveWorkflow,
  stepsToMoveTo,
  type WorkflowEvidence,
  type ManualState,
  type WorkflowTemplateLike,
} from "../workflow";
import {
  DEFAULT_WORKFLOW_STEPS,
  DEFAULT_WORKFLOW_TEMPLATE_ID,
  DEFAULT_WORKFLOW_TEMPLATE_NAME,
} from "../workflow-default";
import type { DealKindEnum } from "../deal-kind";

const TEMPLATE: WorkflowTemplateLike = {
  id: DEFAULT_WORKFLOW_TEMPLATE_ID,
  name: DEFAULT_WORKFLOW_TEMPLATE_NAME,
  isDefault: true,
  steps: DEFAULT_WORKFLOW_STEPS,
};

function ev(overrides: Partial<WorkflowEvidence> = {}): WorkflowEvidence {
  return {
    dealKind: "Mandate",
    dealId: "m1",
    createdAt: new Date("2026-08-01T00:00:00Z"),
    sourceLabel: "Website",
    referredByName: null,
    pipelineStatus: "NewLead",
    qualificationVerdict: null,
    classification: null,
    ndaSigned: false,
    ndaSignedAt: null,
    leadId: null,
    leadName: null,
    vdrLink: null,
    documentTypes: [],
    reviewedDocumentCount: 0,
    engagements: [],
    outreachDraftCount: 0,
    meetingCount: 0,
    termSheetDocument: false,
    dealMilestone: null,
    successFeeInvoicedDate: null,
    successFeePaidDate: null,
    primaryTransactionId: null,
    ...overrides,
  };
}

const eng = (o: Partial<WorkflowEvidence["engagements"][number]> = {}) => ({
  id: "e1",
  status: "Contacted",
  engagementStage: "Shared",
  termSheetIssued: false,
  ndaSignedAt: null,
  investorName: "Vantage",
  ...o,
});

describe("applicableSteps", () => {
  it("yields 12 steps per kind from the 13-step default template", () => {
    for (const kind of ["Mandate", "Transaction", "Advisory"] as DealKindEnum[]) {
      expect(applicableSteps(DEFAULT_WORKFLOW_STEPS, kind)).toHaveLength(12);
    }
    const keys = (k: DealKindEnum) => applicableSteps(DEFAULT_WORKFLOW_STEPS, k).map((s) => s.key);
    expect(keys("Advisory")).toContain("assignmentScoping");
    expect(keys("Advisory")).not.toContain("dealAnalysis");
    expect(keys("Mandate")).toContain("dealAnalysis");
    expect(keys("Mandate")).not.toContain("assignmentScoping");
    expect(keys("Transaction")).not.toContain("assignmentScoping");
  });
  it("sorts by order regardless of input order", () => {
    const shuffled = [...DEFAULT_WORKFLOW_STEPS].reverse();
    expect(applicableSteps(shuffled, "Mandate").map((s) => s.order)).toEqual([1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
  });
});

describe("evaluateEvidence", () => {
  it("newOpportunity is always done, linking to the deal with a created/source label", () => {
    const r = evaluateEvidence("newOpportunity", ev({ referredByName: "Acme Advisory" }));
    expect(r.done).toBe(true);
    expect(r.hasRule).toBe(true);
    expect(r.href).toBe("/mandates/m1");
    expect(r.label).toBe("Created 2026-08-01 · Website — referred by Acme Advisory");
    expect(evaluateEvidence("newOpportunity", ev({ dealKind: "Advisory", dealId: "a1", sourceLabel: null })).href).toBe("/advisory/a1");
    expect(evaluateEvidence("newOpportunity", ev({ sourceLabel: null })).label).toBe("Created 2026-08-01");
  });

  it("initialEvaluation per kind", () => {
    expect(evaluateEvidence("initialEvaluation", ev()).done).toBe(false);
    expect(evaluateEvidence("initialEvaluation", ev({ qualificationVerdict: "Qualified" })).done).toBe(true);
    expect(evaluateEvidence("initialEvaluation", ev({ pipelineStatus: "Qualification" })).done).toBe(true);
    expect(evaluateEvidence("initialEvaluation", ev({ dealKind: "Transaction", pipelineStatus: "DealPreparation" })).done).toBe(true);
    expect(evaluateEvidence("initialEvaluation", ev({ dealKind: "Advisory", pipelineStatus: "Scoping" })).done).toBe(false);
    expect(evaluateEvidence("initialEvaluation", ev({ dealKind: "Advisory", pipelineStatus: "Scoping", classification: "Valuation" })).done).toBe(true);
    expect(evaluateEvidence("initialEvaluation", ev({ dealKind: "Advisory", pipelineStatus: "Engaged" })).done).toBe(true);
    expect(evaluateEvidence("initialEvaluation", ev()).href).toBe("#pipeline-status");
  });

  it("ndaSigned follows ev.ndaSigned with a kind-specific anchor", () => {
    expect(evaluateEvidence("ndaSigned", ev()).done).toBe(false);
    const r = evaluateEvidence("ndaSigned", ev({ ndaSigned: true, ndaSignedAt: new Date("2026-08-05T00:00:00Z") }));
    expect(r.done).toBe(true);
    expect(r.label).toBe("Signed 2026-08-05");
    expect(r.href).toBe("#documents-by-stage");
    expect(evaluateEvidence("ndaSigned", ev({ dealKind: "Transaction" })).href).toBe("#documents-by-stage");
    expect(evaluateEvidence("ndaSigned", ev({ dealKind: "Advisory", ndaSigned: true })).href).toBe("#documents");
    expect(evaluateEvidence("ndaSigned", ev({ ndaSigned: true })).label).toBe("Signed");
  });

  it("assignmentScoping via advisory pipeline status or an engagement contract", () => {
    expect(evaluateEvidence("assignmentScoping", ev({ dealKind: "Advisory", pipelineStatus: "Scoping" })).done).toBe(false);
    expect(evaluateEvidence("assignmentScoping", ev({ dealKind: "Advisory", pipelineStatus: "Proposal" })).done).toBe(true);
    expect(evaluateEvidence("assignmentScoping", ev({ dealKind: "Advisory", pipelineStatus: "Delivery" })).done).toBe(true);
    expect(evaluateEvidence("assignmentScoping", ev({ dealKind: "Advisory", pipelineStatus: "Scoping", documentTypes: ["EngagementContract"] })).done).toBe(true);
    expect(evaluateEvidence("assignmentScoping", ev()).href).toBe("#pipeline-status");
  });

  it("dealAnalysis via model/valuation documents or a late mandate pipeline status", () => {
    expect(evaluateEvidence("dealAnalysis", ev()).done).toBe(false);
    expect(evaluateEvidence("dealAnalysis", ev({ documentTypes: ["FinancialModel"] })).done).toBe(true);
    expect(evaluateEvidence("dealAnalysis", ev({ dealKind: "Transaction", documentTypes: ["Valuation"] })).done).toBe(true);
    expect(evaluateEvidence("dealAnalysis", ev({ pipelineStatus: "PitchPresentation" })).done).toBe(true);
    expect(evaluateEvidence("dealAnalysis", ev({ pipelineStatus: "Signed" })).done).toBe(true);
    expect(evaluateEvidence("dealAnalysis", ev({ pipelineStatus: "Qualification" })).done).toBe(false);
    // a Transaction's pipelineStatus never satisfies the mandate-stage clause
    expect(evaluateEvidence("dealAnalysis", ev({ dealKind: "Transaction", pipelineStatus: "Signed" })).done).toBe(false);
    expect(evaluateEvidence("dealAnalysis", ev()).href).toBe("#documents");
  });

  it("dealApproved when a lead is assigned", () => {
    expect(evaluateEvidence("dealApproved", ev()).done).toBe(false);
    const r = evaluateEvidence("dealApproved", ev({ leadId: "u1", leadName: "Sheilla W" }));
    expect(r.done).toBe(true);
    expect(r.label).toBe("Lead: Sheilla W");
    expect(r.href).toBe("#key-facts");
  });

  it("opportunityPreparation via VDR link (external href) or Teaser+IM", () => {
    expect(evaluateEvidence("opportunityPreparation", ev()).done).toBe(false);
    expect(evaluateEvidence("opportunityPreparation", ev()).href).toBe("#documents-by-stage");
    const vdr = evaluateEvidence("opportunityPreparation", ev({ vdrLink: "https://vdr.example.test/zz" }));
    expect(vdr.done).toBe(true);
    expect(vdr.href).toBe("https://vdr.example.test/zz");
    expect(evaluateEvidence("opportunityPreparation", ev({ documentTypes: ["Teaser"] })).done).toBe(false);
    expect(evaluateEvidence("opportunityPreparation", ev({ documentTypes: ["Teaser", "IM"] })).done).toBe(true);
  });

  it("internalReview via reviewed documents", () => {
    expect(evaluateEvidence("internalReview", ev()).done).toBe(false);
    expect(evaluateEvidence("internalReview", ev({ reviewedDocumentCount: 2 })).done).toBe(true);
    expect(evaluateEvidence("internalReview", ev()).href).toBe("#documents");
  });

  it("investorOutreach via engagements or outreach drafts, href by kind", () => {
    expect(evaluateEvidence("investorOutreach", ev()).done).toBe(false);
    expect(evaluateEvidence("investorOutreach", ev({ engagements: [eng()] })).done).toBe(true);
    expect(evaluateEvidence("investorOutreach", ev({ outreachDraftCount: 1 })).done).toBe(true);
    expect(evaluateEvidence("investorOutreach", ev({ primaryTransactionId: "t9" })).href).toBe("/transactions/t9#engagements");
    expect(evaluateEvidence("investorOutreach", ev({ dealKind: "Transaction", dealId: "t1" })).href).toBe("#engagements");
    expect(evaluateEvidence("investorOutreach", ev({ dealKind: "Advisory", dealId: "a1" })).href).toBe("#engagements");
    // Mandate with no transaction yet: nothing to link but the section anchor
    expect(evaluateEvidence("investorOutreach", ev()).href).toBe("#engagements");
  });

  it("investorInterest via engagement status or a post-NDA stage, linking the first match", () => {
    expect(evaluateEvidence("investorInterest", ev({ engagements: [eng()] })).done).toBe(false);
    const byStatus = evaluateEvidence("investorInterest", ev({ engagements: [eng({ id: "e1" }), eng({ id: "e2", status: "Interested" })] }));
    expect(byStatus.done).toBe(true);
    expect(byStatus.href).toBe("/engagement/e2");
    expect(evaluateEvidence("investorInterest", ev({ engagements: [eng({ engagementStage: "NDASigned" })] })).done).toBe(true);
    expect(evaluateEvidence("investorInterest", ev({ engagements: [eng({ engagementStage: "Invested" })] })).done).toBe(true);
    expect(evaluateEvidence("investorInterest", ev({ engagements: [eng({ engagementStage: "TeaserSent" })] })).done).toBe(false);
  });

  it("threePartyDiscussions via meetings", () => {
    expect(evaluateEvidence("threePartyDiscussions", ev()).done).toBe(false);
    expect(evaluateEvidence("threePartyDiscussions", ev({ meetingCount: 1 })).done).toBe(true);
    expect(evaluateEvidence("threePartyDiscussions", ev()).href).toBe("#activity");
  });

  it("termSheet via engagement, document, pipeline status or milestone", () => {
    expect(evaluateEvidence("termSheet", ev()).done).toBe(false);
    expect(evaluateEvidence("termSheet", ev()).href).toBe("#deal-facts");
    const r = evaluateEvidence("termSheet", ev({ engagements: [eng(), eng({ id: "e7", termSheetIssued: true })] }));
    expect(r.done).toBe(true);
    expect(r.href).toBe("/engagement/e7");
    expect(evaluateEvidence("termSheet", ev({ termSheetDocument: true })).done).toBe(true);
    expect(evaluateEvidence("termSheet", ev({ dealKind: "Transaction", pipelineStatus: "Closing" })).done).toBe(true);
    expect(evaluateEvidence("termSheet", ev({ dealMilestone: "TermSheet" })).done).toBe(true);
  });

  it("successFee via paid date; invoiced-only is labelled but not done", () => {
    expect(evaluateEvidence("successFee", ev()).done).toBe(false);
    const inv = evaluateEvidence("successFee", ev({ successFeeInvoicedDate: new Date("2026-08-10T00:00:00Z") }));
    expect(inv.done).toBe(false);
    expect(inv.label).toBe("Invoiced 2026-08-10");
    const paid = evaluateEvidence("successFee", ev({ successFeePaidDate: new Date("2026-08-20T00:00:00Z"), primaryTransactionId: "t9" }));
    expect(paid.done).toBe(true);
    expect(paid.label).toBe("Paid 2026-08-20");
    expect(paid.href).toBe("/transactions/t9#success-fee");
    expect(evaluateEvidence("successFee", ev({ dealKind: "Transaction" })).href).toBe("#success-fee");
  });

  it("unknown keys have no rule", () => {
    expect(evaluateEvidence("deliverablesHandover", ev())).toEqual({ done: false, label: null, href: null, hasRule: false });
  });
});

describe("resolveWorkflow", () => {
  it("merges evidence into statuses with the first non-done step current", () => {
    const wf = resolveWorkflow(TEMPLATE, ev({ pipelineStatus: "Signed", ndaSigned: true, leadId: "u1", leadName: "Sheilla W" }), []);
    expect(wf.dealKind).toBe("Mandate");
    expect(wf.templateId).toBe(DEFAULT_WORKFLOW_TEMPLATE_ID);
    expect(wf.templateName).toBe(DEFAULT_WORKFLOW_TEMPLATE_NAME);
    expect(wf.isDefaultTemplate).toBe(true);
    expect(wf.total).toBe(12);
    // newOpportunity, initialEvaluation, ndaSigned, dealAnalysis (Signed), dealApproved
    expect(wf.done).toBe(5);
    const byKey = new Map(wf.steps.map((s) => [s.key, s]));
    expect(byKey.get("ndaSigned")?.status).toBe("done");
    expect(byKey.get("ndaSigned")?.source).toBe("evidence");
    expect(byKey.get("dealApproved")?.evidenceLabel).toBe("Lead: Sheilla W");
    expect(wf.current?.key).toBe("opportunityPreparation");
    expect(byKey.get("opportunityPreparation")?.status).toBe("current");
    expect(byKey.get("internalReview")?.status).toBe("upcoming");
    expect(byKey.get("successFee")?.status).toBe("upcoming");
    expect(byKey.get("assignmentScoping")).toBeUndefined();
  });

  it("manual complete wins over false evidence and carries who/when/note", () => {
    const manual: ManualState[] = [
      { stepKey: "internalReview", manualStatus: "complete", note: "Reviewed by Brian", completedAt: new Date("2026-08-15T00:00:00Z"), completedById: "u2", completedByName: "Brian B" },
    ];
    const wf = resolveWorkflow(TEMPLATE, ev(), manual);
    const s = wf.steps.find((x) => x.key === "internalReview")!;
    expect(s.status).toBe("done");
    expect(s.source).toBe("manual");
    expect(s.manualStatus).toBe("complete");
    expect(s.completedByName).toBe("Brian B");
    expect(s.completedAt).toEqual(new Date("2026-08-15T00:00:00Z"));
    expect(s.note).toBe("Reviewed by Brian");
  });

  it("manual incomplete wins over true evidence (explicit reopen keeps the note)", () => {
    const manual: ManualState[] = [
      { stepKey: "ndaSigned", manualStatus: "incomplete", note: "NDA needs re-signing", completedAt: null, completedById: "u2", completedByName: "Brian B" },
    ];
    const wf = resolveWorkflow(TEMPLATE, ev({ ndaSigned: true }), manual);
    const s = wf.steps.find((x) => x.key === "ndaSigned")!;
    expect(s.status).not.toBe("done");
    expect(s.source).toBe("manual");
    expect(s.manualStatus).toBe("incomplete");
    expect(s.note).toBe("NDA needs re-signing");
    expect(s.completedByName).toBe("Brian B");
    expect(wf.done).toBe(1); // only newOpportunity
    expect(wf.current?.key).toBe("initialEvaluation");
  });

  it("ignores manual rows for unknown or non-applicable keys", () => {
    const manual: ManualState[] = [
      { stepKey: "bogus", manualStatus: "complete", note: null, completedAt: null, completedById: null, completedByName: null },
      { stepKey: "assignmentScoping", manualStatus: "complete", note: null, completedAt: null, completedById: null, completedByName: null },
    ];
    const wf = resolveWorkflow(TEMPLATE, ev(), manual);
    expect(wf.steps.map((s) => s.key)).not.toContain("bogus");
    expect(wf.steps.map((s) => s.key)).not.toContain("assignmentScoping");
    expect(wf.done).toBe(1);
  });

  it("groups phases Qualify -> Prepare -> Execute with steps in order", () => {
    const wf = resolveWorkflow(TEMPLATE, ev({ dealKind: "Advisory", dealId: "a1", pipelineStatus: "Scoping" }), []);
    expect(wf.phases.map((p) => p.phase)).toEqual(["Qualify", "Prepare", "Execute"]);
    expect(wf.phases.map((p) => p.label)).toEqual(["Qualify", "Prepare", "Execute"]);
    expect(wf.phases[0].steps.map((s) => s.key)).toEqual(["newOpportunity", "initialEvaluation", "ndaSigned", "assignmentScoping"]);
    expect(wf.phases[1].steps.map((s) => s.key)).toEqual(["dealApproved", "opportunityPreparation", "internalReview"]);
    expect(wf.phases[2].steps).toHaveLength(5);
    for (const p of wf.phases) {
      const orders = p.steps.map((s) => s.order);
      expect([...orders].sort((a, b) => a - b)).toEqual(orders);
    }
  });

  it("a custom key has no evidence rule and shows as manual when not done", () => {
    const template: WorkflowTemplateLike = {
      id: "t-custom",
      name: "zz-Advisory template",
      isDefault: false,
      steps: [
        ...DEFAULT_WORKFLOW_STEPS.filter((s) => s.order <= 3),
        { key: "deliverablesHandover", title: "Deliverables handover", phase: "Execute", description: null, order: 4, appliesTo: ["Advisory"] },
      ],
    };
    const wf = resolveWorkflow(template, ev({ dealKind: "Advisory", dealId: "a1", pipelineStatus: "Engaged", ndaSigned: true }), []);
    expect(wf.isDefaultTemplate).toBe(false);
    const s = wf.steps.find((x) => x.key === "deliverablesHandover")!;
    expect(s.hasEvidenceRule).toBe(false);
    expect(s.href).toBeNull();
    // first non-done → current even without a rule
    expect(s.status).toBe("current");
    const wf2 = resolveWorkflow(
      { ...template, steps: [...template.steps, { key: "clientSignoff", title: "Client sign-off", phase: "Execute", description: null, order: 5, appliesTo: [] }] },
      ev({ dealKind: "Advisory", dealId: "a1", pipelineStatus: "Engaged", ndaSigned: true }),
      [],
    );
    expect(wf2.steps.find((x) => x.key === "clientSignoff")?.status).toBe("manual");
  });

  it("everything done leaves current null", () => {
    const manual: ManualState[] = DEFAULT_WORKFLOW_STEPS.map((s) => ({
      stepKey: s.key, manualStatus: "complete" as const, note: null, completedAt: null, completedById: null, completedByName: null,
    }));
    const wf = resolveWorkflow(TEMPLATE, ev(), manual);
    expect(wf.done).toBe(12);
    expect(wf.current).toBeNull();
  });
});

describe("stepsToMoveTo", () => {
  it("returns the earlier applicable non-done steps before the target", () => {
    const wf = resolveWorkflow(TEMPLATE, ev({ ndaSigned: true }), []);
    const keys = stepsToMoveTo(wf, "investorOutreach").map((s) => s.key);
    // done: newOpportunity, ndaSigned → skipped
    expect(keys).toEqual(["initialEvaluation", "dealAnalysis", "dealApproved", "opportunityPreparation", "internalReview"]);
  });
  it("returns [] for an unknown target or the first step", () => {
    const wf = resolveWorkflow(TEMPLATE, ev(), []);
    expect(stepsToMoveTo(wf, "nope")).toEqual([]);
    expect(stepsToMoveTo(wf, "newOpportunity")).toEqual([]);
  });
});
