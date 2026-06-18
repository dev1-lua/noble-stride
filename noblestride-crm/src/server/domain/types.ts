// Pure domain types + constants for the NobleStride CRM.
// NO runtime imports from @prisma/client — type-only imports erase at compile time.

import type {
  InvestorStatus,
  InvestorType,
  Sector,
  Geography,
  MandateStage,
  TransactionStage,
  EngagementStatus,
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
  investorType?: InvestorType | null;
  sector?: Sector | null;
  geography?: Geography | null;
  status?: InvestorStatus | null;
  ticketMin?: number | null;
  ticketMax?: number | null;
  search?: string | null;
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

export interface DashboardStats {
  activeMandates: number;
  activeTransactions: number;
  investorCount: number;
  closedWonCount: number;
  totalRevenue: number;
}

export interface InvestorSegments {
  activelyDeploying: number;
  fundraising: number;
  finalClose: number;
  fullyDeployed: number;
  dormant: number;
}

// ─── Partner referral input ───────────────────────────────────────────────────

export interface PartnerReferralInput {
  mandates: Array<{
    transactions: Array<{
      stage: TransactionStage;
      targetRaise: number;
    }>;
  }>;
}
