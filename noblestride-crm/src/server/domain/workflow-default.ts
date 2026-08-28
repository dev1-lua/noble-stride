// workflow-default.ts — the default deal-workflow template's constant data
// (Aug-2026 feedback: replaces the hard-coded 17-step journey with a
// configurable WorkflowTemplate/WorkflowStep pair). Pure module, no
// `@prisma/client` import — `WorkflowPhase` is a string-literal union with
// the same values as the Prisma `WorkflowPhase` enum so client components can
// import this file. `scripts/seed-workflow-defaults.ts` is the only writer;
// it upserts exactly these ids/keys/values into the DB.

import type { DealKindEnum } from "./deal-kind";

export type WorkflowPhase = "Qualify" | "Prepare" | "Execute";

export interface WorkflowStepDef {
  id?: string;
  key: string;
  title: string;
  phase: WorkflowPhase;
  description: string | null;
  order: number;
  /** Deal kinds this step applies to; [] means it applies to all kinds. */
  appliesTo: DealKindEnum[];
}

export const DEFAULT_WORKFLOW_TEMPLATE_ID = "cmt439xcg000895nche9zeaz1";
export const DEFAULT_WORKFLOW_TEMPLATE_NAME = "Default Transaction Advisory Workflow";

export const DEFAULT_WORKFLOW_STEPS: WorkflowStepDef[] = [
  {
    id: "cmt439xcg000995nc32a133fj",
    key: "newOpportunity",
    title: "New Opportunity",
    phase: "Qualify",
    description:
      "A new opportunity is sourced — client direct, partner/referral, cold outreach, desk research, or existing network.",
    order: 1,
    appliesTo: [],
  },
  {
    id: "cmt439xcg000a95nc5dai7ub8",
    key: "initialEvaluation",
    title: "Initial Evaluation",
    phase: "Qualify",
    description:
      "Classify the opportunity as a short-term/advisory assignment or a transaction/deal opportunity. Partner-referred deals need a signed Fee Share Agreement.",
    order: 2,
    appliesTo: [],
  },
  {
    id: "cmt439xcg000b95ncq4dupbjo",
    key: "ndaSigned",
    title: "NDA Signed",
    phase: "Qualify",
    description: "The NDA must be signed before detailed information is exchanged or analysed.",
    order: 3,
    appliesTo: [],
  },
  {
    id: "cmt439xcg000c95ncuionvc9t",
    key: "assignmentScoping",
    title: "Assignment Scoping",
    phase: "Qualify",
    description: "Confirm project type, deliverables and requirements per the Advisory Sheets.",
    order: 4,
    appliesTo: ["Advisory"],
  },
  {
    id: "cmt439xcg000d95nce4j8rhg8",
    key: "dealAnalysis",
    title: "Financial & Commercial Analysis",
    phase: "Qualify",
    description: "Only after the NDA: assess viability, criteria fit, and make the proceed decision.",
    order: 5,
    appliesTo: ["Mandate", "Transaction"],
  },
  {
    id: "cmt439xcg000e95ncgy6zfhmq",
    key: "dealApproved",
    title: "Deal Approved / Open for Assignment",
    phase: "Prepare",
    description: "Assign a Deal Lead, plus optional Deal Assistants.",
    order: 6,
    appliesTo: [],
  },
  {
    id: "cmt439xcg000f95ncoieielvz",
    key: "opportunityPreparation",
    title: "Opportunity Preparation",
    phase: "Prepare",
    description:
      "Create the VDR, prepare the Teaser, IM and financial model, collect management and operational information, and develop the investor shortlist.",
    order: 7,
    appliesTo: [],
  },
  {
    id: "cmt439xcg000g95ncvb9ziu69",
    key: "internalReview",
    title: "Internal Review",
    phase: "Prepare",
    description: "Recommended, not a blocker: a colleague reviews the materials, financials, model and presentation.",
    order: 8,
    appliesTo: [],
  },
  {
    id: "cmt439xcg000h95ncbqw1tg7c",
    key: "investorOutreach",
    title: "Investor Outreach",
    phase: "Execute",
    description: "Investors receive only a high-level, non-confidential overview: project code name and brief summary.",
    order: 9,
    appliesTo: [],
  },
  {
    id: "cmt439xcg000i95nc4ou4bbip",
    key: "investorInterest",
    title: "Investor Interest",
    phase: "Execute",
    description: "Assess criteria, suitability and ability; suitable investors sign an NDA and receive additional information.",
    order: 10,
    appliesTo: [],
  },
  {
    id: "cmt439xcg000j95nc0e5sina0",
    key: "threePartyDiscussions",
    title: "Three-Party Discussions",
    phase: "Execute",
    description: "Client, advisor and investor: structure, commercial terms, due diligence, Q&A, negotiation.",
    order: 11,
    appliesTo: [],
  },
  {
    id: "cmt439xcg000k95ncfnocb8kb",
    key: "termSheet",
    title: "Term Sheet / Transaction Progression",
    phase: "Execute",
    description: "Terms are negotiated, a term sheet is issued, parties review and sign, and the deal progresses toward closing.",
    order: 12,
    appliesTo: [],
  },
  {
    id: "cmt439xcg000l95ncbbj4rah3",
    key: "successFee",
    title: "Success Fee",
    phase: "Execute",
    description: "Payable when conditions are met or funds are disbursed; fee share is activated for partner-referred deals.",
    order: 13,
    appliesTo: [],
  },
];
