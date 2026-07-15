// Pure domain types + constants for the Noblestride CRM.
// NO runtime imports from @prisma/client — type-only imports erase at compile time.

import type {
  InvestorStatus,
  InvestorType,
  Sector,
  Geography,
  MandateStage,
  TransactionStage,
  EngagementStatus,
  OnboardingStatus,
} from "@prisma/client";

// ─── Re-export enum types so callers can import from one place ───────────────
export type {
  InvestorStatus,
  InvestorType,
  Sector,
  Geography,
  MandateStage,
  TransactionStage,
  EngagementStatus,
  OnboardingStatus,
};

// ─── Pipeline constants ──────────────────────────────────────────────────────

/** Mandate stages that represent work in progress (excludes terminal stages). */
export const ACTIVE_MANDATE_STAGES: MandateStage[] = [
  "NewLead",
  "Qualification",
  "PitchPresentation",
  "Proposal",
  "Negotiation",
];

/** Transaction stages that represent a closed outcome (won or lost). */
export const CLOSED_TXN_STAGES: TransactionStage[] = ["ClosedWon", "ClosedLost"];

/** Engagement statuses indicating active two-way conversation. */
export const ACTIVE_CONVERSATION_STATUSES: EngagementStatus[] = [
  "InConversation",
  "Interested",
];

// ─── Filter / pagination types ───────────────────────────────────────────────

export interface InvestorFilter {
  // Each accepts a single value (scalar equality — used by the GraphQL API)
  // or an array (multi-select, OR-matched; empty array/undefined imposes no
  // constraint — used by the investors list filter bar).
  investorType?: InvestorType | InvestorType[] | null;
  sector?: Sector | Sector[] | null;
  geography?: Geography | Geography[] | null;
  status?: InvestorStatus | InvestorStatus[] | null;
  ticketMin?: number | null;
  ticketMax?: number | null;
  search?: string | null;
  onboardingStatus?: OnboardingStatus;
}

export interface Pagination {
  page: number;
  pageSize: number;
}

// ─── UI / display types ──────────────────────────────────────────────────────

export interface KanbanColumn<T> {
  stage: string;
  label: string;
  items: T[];
}

export interface StatValue { value: number; delta: number; }

export interface DashboardStats {
  activeMandates: StatValue;
  activeTransactions: StatValue;
  investorsEngagedQtr: StatValue;
  capitalRaisedYtd: StatValue;
}

export interface Insight { kind: "convert" | "attention" | "match"; title: string; detail: string; }

export interface InvestorSegments {
  total: number;
  activeThisQuarter: number;
  privateEquity: number;
  ventureCapital: number;
  dfi: number;
  debtProvider: number;
  pendingReview: number;
  rejected: number;
}

// ─── Partner referral input ───────────────────────────────────────────────────

export interface PartnerReferralInput {
  mandates: Array<{
    transactions: Array<{
      stage: TransactionStage;
      targetRaise: number;
    }>;
  }>;
  /**
   * Transactions referred directly by the partner (Transaction.referredById)
   * that are NOT already counted via one of `mandates` — caller dedupes.
   */
  directTransactions?: Array<{
    stage: TransactionStage;
    targetRaise: number;
  }>;
}
