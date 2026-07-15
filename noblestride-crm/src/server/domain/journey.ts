// journey.ts — pure deal-journey derivation for the Noblestride CRM. No I/O,
// no Prisma, no Date.now() — everything the engine needs is passed in on
// `JourneyInput`, so it stays fully deterministic and unit-testable without a
// database (see src/server/domain/__tests__/journey.test.ts).
//
// The journey is DISPLAY-ONLY: no journey state is ever stored. Every step's
// "done" trigger is evidence-based and independent of every other step — a
// later step can be done while an earlier one is still pending (out-of-order
// is expected, not a bug). See docs/superpowers/specs/2026-07-08-crm-simplification-design.md §4.1.

// ─── Domain types ─────────────────────────────────────────────────────────────

export type JourneyState = "done" | "current" | "pending" | "manual";

export interface JourneyStep {
  index: number;
  title: string;
  state: JourneyState;
  evidence?: { label: string; href: string };
}

export interface JourneyInput {
  mandate: {
    id: string;
    source: string | null;
    ndaSignedDate: Date | null;
    eaSignedDate: Date | null;
    stage: string;
    retainerPaidDate?: Date | null;
    qualificationVerdict?: string | null;
    referredByName?: string | null;
  };
  /** Every transaction under this mandate. */
  transactions: {
    id: string;
    stage: string;
    vdrLink: string | null;
    successFeeInvoicedDate: Date | null;
    successFeePaidDate: Date | null;
    hasDisbursements: boolean;
  }[];
  /** engagementStage of every investor-outreach row across the mandate's transactions. */
  engagementStages: string[];
  /** Document.type of docs linked to the mandate/transactions/client. */
  documentTypes: string[];
  /** Earliest Activity of type Meeting|Call on the client/mandate, if any. */
  firstMeetingAt: Date | null;
}

// ─── Verbatim step titles (spec §4.1) ─────────────────────────────────────────
// Exported (additive) so the Task-18 help panel's JOURNEY_STEP_HELP
// (src/lib/glossary.ts) can be unit-tested against this list and never drift.

export const JOURNEY_TITLES = [
  "Sourcing & origination",
  "Introductory engagement",
  "NDA",
  "Data collection & screening",
  "Internal review & approval",
  "Engagement contract & retainer",
  "VDR setup",
  "Financial analysis",
  "Investor documentation",
  "Investor shortlisting",
  "Outreach & engagement",
  "Offers & negotiation",
  "Due diligence",
  "Structuring & documentation",
  "Financial close & disbursement",
  "Success fee & closure",
  "Post-transaction monitoring",
] as const;

const STEP_COUNT = JOURNEY_TITLES.length; // 17
const MANUAL_STEP_INDEX = STEP_COUNT; // step 17 is always manual

// ─── Confirmed enum orderings (prisma/schema.prisma) — defined locally so this
// pure module has no dependency on generated Prisma types. ────────────────────

const MANDATE_STAGE_ORDER = [
  "NewLead",
  "Qualification",
  "PitchPresentation",
  "Proposal",
  "Negotiation",
  "Signed",
] as const;
// "Lost" is terminal/off-path — deliberately excluded from the order above so
// an unrecognized/off-path stage never satisfies a "past X" comparison.

const TRANSACTION_STAGE_ORDER = [
  "DealPreparation",
  "InvestorOutreach",
  "DueDiligence",
  "TermSheet",
  "Closing",
  "ClosedWon",
] as const;
// "ClosedLost" is terminal/off-path — deliberately excluded, same reasoning.

const QUALIFICATION_STAGE_INDEX = MANDATE_STAGE_ORDER.indexOf("Qualification");
const DUE_DILIGENCE_STAGE_INDEX = TRANSACTION_STAGE_ORDER.indexOf("DueDiligence");

/** Index of `value` in `order`, or -1 if `value` isn't a recognized on-path stage. */
function stageIndex(order: readonly string[], value: string): number {
  return order.indexOf(value);
}

// ─── Step 1 evidence — source label ──────────────────────────────────────────

/** Human-readable labels for the `Source` enum. Kept local (not vocab.ts) so this stays a dependency-free pure module. */
const SOURCE_LABELS: Record<string, string> = {
  MondayMeeting: "Monday Meeting",
  WhatsApp: "WhatsApp",
  Email: "Email",
  Verbal: "Verbal",
  Referral: "Referral",
  Inbound: "Inbound",
  Outreach: "Outreach",
  Event: "Event",
  Website: "Website",
  DirectEnquiry: "Direct Enquiry",
  Consultant: "Consultant",
  Investor: "Investor",
  Partner: "Partner",
  SocialMedia: "Social Media",
  InternalBusinessDev: "Internal Business Dev",
};

function sourceLabel(source: string | null): string {
  if (source == null) return "Unknown source";
  return SOURCE_LABELS[source] ?? source;
}

function step1Evidence(mandate: JourneyInput["mandate"]): { label: string; href: string } {
  const base = sourceLabel(mandate.source);
  const label = mandate.referredByName ? `${base} — referred by ${mandate.referredByName}` : base;
  return { label, href: `/mandates/${mandate.id}` };
}

// ─── Per-step "done" triggers (steps 1-16; step 17 is always manual) ─────────

function computeDoneFlags(input: JourneyInput): boolean[] {
  const { mandate, transactions, engagementStages, documentTypes, firstMeetingAt } = input;

  const step1 = true; // sourcing & origination — a mandate always exists once the journey is shown

  const step2 = firstMeetingAt != null;

  const step3 = mandate.ndaSignedDate != null;

  const step4 =
    stageIndex(MANDATE_STAGE_ORDER, mandate.stage) > QUALIFICATION_STAGE_INDEX ||
    (mandate.qualificationVerdict ?? null) != null;

  const step5 = mandate.stage === "Proposal" || mandate.stage === "Negotiation" || mandate.stage === "Signed";

  const step6 = mandate.eaSignedDate != null;

  const step7 = transactions.some((t) => t.vdrLink != null);

  const step8 = documentTypes.includes("FinancialModel") || documentTypes.includes("Valuation");

  const step9 = documentTypes.includes("Teaser") && documentTypes.includes("IM");

  const step10 = engagementStages.length > 0;

  const step11 = engagementStages.some((s) => s !== "Shared");

  const step12 = engagementStages.some((s) => s === "TermSheet" || s === "Offer");

  const step13 =
    transactions.some((t) => {
      const idx = stageIndex(TRANSACTION_STAGE_ORDER, t.stage);
      return idx !== -1 && idx >= DUE_DILIGENCE_STAGE_INDEX;
    }) || engagementStages.includes("DueDiligence");

  const step14 =
    documentTypes.includes("SPA") || documentTypes.includes("SHA") || documentTypes.includes("LoanAgreement");

  const step15 = transactions.some((t) => t.stage === "ClosedWon" || t.hasDisbursements);

  const step16 = transactions.some((t) => t.successFeeInvoicedDate != null || t.successFeePaidDate != null);

  return [step1, step2, step3, step4, step5, step6, step7, step8, step9, step10, step11, step12, step13, step14, step15, step16];
}

// ─── Assembly ─────────────────────────────────────────────────────────────────

/**
 * Derives the 17-step deal journey for a mandate from data that already
 * exists elsewhere in the system — no journey state is stored anywhere.
 * Always returns exactly 17 steps, indexed 1..17. Step 17 (post-transaction
 * monitoring) is always "manual". `current` is the first non-done step among
 * 1-16; every other non-done step among 1-16 is "pending" — later steps can
 * be "done" out of order without affecting which step is "current".
 */
export function dealJourney(input: JourneyInput): JourneyStep[] {
  const doneFlags = computeDoneFlags(input);

  const firstNonDoneIndex = doneFlags.findIndex((done) => !done); // 0-based; -1 if all done
  const currentIndex1Based = firstNonDoneIndex === -1 ? null : firstNonDoneIndex + 1;

  const steps: JourneyStep[] = JOURNEY_TITLES.map((title, i) => {
    const index = i + 1;

    if (index === MANUAL_STEP_INDEX) {
      return { index, title, state: "manual" as const };
    }

    const done = doneFlags[i];
    const state: JourneyState = done ? "done" : index === currentIndex1Based ? "current" : "pending";

    const step: JourneyStep = { index, title, state };
    if (index === 1) {
      step.evidence = step1Evidence(input.mandate);
    }
    return step;
  });

  return steps;
}
