// glossary.ts — Wave 1 teaching layer: plain-language definitions for the
// NobleStride vocabulary. Pure data + lookup, no React/UI here (see
// components/ui/help-hint.tsx for the popover that renders these).

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
      "The assignment a client hires NobleStride for — one fundraising or advisory engagement, opened when the engagement contract is signed.",
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

// ─── Journey step help (Task 18) ───────────────────────────────────────────────
// One-line descriptions for the 17-step deal journey (spec §4.1's "Derived
// from" column), for the topbar Help panel's "How a deal flows" section.
//
// IMPORTANT: `title` below MUST stay verbatim-identical, in order, to
// `JOURNEY_TITLES` in src/server/domain/journey.ts — that's the single source
// of truth for the journey spine. See src/lib/__tests__/journey-step-help.test.ts,
// which asserts the two lists match so they can never silently diverge.

export interface JourneyStepHelp {
  title: string;
  description: string;
}

export const JOURNEY_STEP_HELP: JourneyStepHelp[] = [
  {
    title: "Sourcing & origination",
    description: "A mandate is opened — where the lead came from, and who referred it, if anyone.",
  },
  {
    title: "Introductory engagement",
    description: "The first meeting or call with the client to scope the opportunity.",
  },
  {
    title: "NDA",
    description: "A non-disclosure agreement is signed with the client before deeper diligence begins.",
  },
  {
    title: "Data collection & screening",
    description: "The client's information is gathered and the mandate is screened for qualification.",
  },
  {
    title: "Internal review & approval",
    description: "NobleStride reviews the opportunity internally before committing to a pitch or proposal.",
  },
  {
    title: "Engagement contract & retainer",
    description: "The engagement contract is signed and the commencement retainer is paid.",
  },
  {
    title: "VDR setup",
    description: "A virtual data room is set up for the transaction so documents can be shared with investors.",
  },
  {
    title: "Financial analysis",
    description: "A financial model and/or valuation is prepared for the deal.",
  },
  {
    title: "Investor documentation",
    description: "The teaser and Information Memorandum are prepared for investor distribution.",
  },
  {
    title: "Investor shortlisting",
    description: "Investors are identified and added to the transaction as outreach targets.",
  },
  {
    title: "Outreach & engagement",
    description: "Shortlisted investors are contacted and the teaser or IM is shared with them.",
  },
  {
    title: "Offers & negotiation",
    description: "Interested investors submit term sheets or offers, and terms are negotiated.",
  },
  {
    title: "Due diligence",
    description: "The chosen investor(s) carry out detailed financial, legal, tax, commercial and ESG diligence.",
  },
  {
    title: "Structuring & documentation",
    description: "The deal is structured and the definitive documents (SPA, SHA, or loan agreement) are drafted.",
  },
  {
    title: "Financial close & disbursement",
    description: "The transaction closes and investor funds are disbursed.",
  },
  {
    title: "Success fee & closure",
    description: "NobleStride's success fee is invoiced and paid, closing out the transaction.",
  },
  {
    title: "Post-transaction monitoring",
    description: "Ongoing, informal check-ins with the client after close — tracked manually, not derived from data.",
  },
];
