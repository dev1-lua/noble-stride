// glossary.ts — Wave 1 teaching layer: plain-language definitions for the
// Noblestride vocabulary. Pure data + lookup, no React/UI here (see
// components/ui/help-hint.tsx for the popover that renders these).

import { DEFAULT_WORKFLOW_STEPS } from "@/server/domain/workflow-default";

export interface GlossaryEntry {
  term: string;
  definition: string;
}

// Ordered for display (e.g. an eventual "Glossary" page) — not alphabetical,
// roughly the order a new hire would meet these concepts.
export const GLOSSARY: GlossaryEntry[] = [
  {
    term: "Mandate",
    definition:
      "The assignment a client hires Noblestride for — one fundraising or advisory engagement, opened when the engagement contract is signed.",
  },
  {
    term: "Transaction",
    definition:
      "A live capital raise executed under a mandate — the deal investors are matched against.",
  },
  {
    term: "Investor Engagement",
    definition:
      "One investor's conversation on one deal — from first share to term sheet, NDA and investment.",
  },
  {
    term: "Milestone",
    definition:
      "One of 15 fixed checkpoints an investor passes on a deal, from teaser review to success-fee payment.",
  },
  {
    term: "Open NDA",
    definition:
      "An umbrella NDA with an investor that covers every deal we share with them.",
  },
  {
    term: "Closed NDA",
    definition: "A deal-specific NDA — covers only the named transaction.",
  },
  {
    term: "Teaser",
    definition:
      "A short, anonymised deal summary shared before an NDA — the company appears under a codename.",
  },
  {
    term: "Information Memorandum (IM)",
    definition: "The full confidential deal document shared after an NDA is signed.",
  },
  {
    term: "VDR",
    definition:
      "Virtual data room — the document set an investor can open once access is granted.",
  },
  {
    term: "Term Sheet",
    definition: "An investor's written, non-binding offer terms for the deal.",
  },
  {
    term: "Due Diligence",
    definition:
      "The investor's detailed verification of the business — financial, legal, tax, commercial and ESG.",
  },
  {
    term: "Disbursement",
    definition: "Money actually paid out by an investor after closing.",
  },
  {
    term: "Codename",
    definition:
      "The stand-in name (e.g. 'Project Amber Harrier') that hides a client's identity from investors before an NDA.",
  },
  {
    term: "Lens",
    definition:
      "The role you are viewing the CRM as — Admin, Deal Lead or Team Member — which controls what you can edit.",
  },
  {
    term: "Retainer",
    definition: "The commencement fee a client pays when the engagement contract is signed.",
  },
  {
    term: "Success Fee",
    definition: "The fee invoiced when a transaction closes.",
  },
];

const BY_TERM = new Map(GLOSSARY.map((entry) => [entry.term.toLowerCase(), entry.definition]));

/** Looks up a glossary definition by term (case-insensitive, exact match). */
export function define(term: string): string | undefined {
  if (!term) return undefined;
  return BY_TERM.get(term.toLowerCase());
}

// ─── Workflow step help (Aug-2026 feedback) ──────────────────────────────────
// One-line descriptions of the DEFAULT workflow template's 13 steps, for the
// topbar Help panel's "How a deal flows" section. Derived from the single
// source of truth (src/server/domain/workflow-default.ts) so it can never
// drift from what the seed writes; see src/lib/__tests__/workflow-step-help.test.ts.

export interface WorkflowStepHelp {
  key: string;
  title: string;
  phase: string;
  description: string;
}

export const WORKFLOW_STEP_HELP: WorkflowStepHelp[] = DEFAULT_WORKFLOW_STEPS.map((s) => ({
  key: s.key,
  title: s.title,
  phase: s.phase,
  description: s.description ?? "",
}));
