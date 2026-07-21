import type { CrmClient } from "./crm-client";
import { ENGAGEMENTS_BY_DEAL_SCAN } from "./queries";
import { idleDays, type EngagementStage, type FlagReason, type StaleThresholds } from "./staleness";

/**
 * Shared staleness scan: the scan_stalled_engagements tool and the
 * followup-check cron job both run through here so thresholds and behavior
 * can never drift between the on-demand and scheduled paths.
 * evaluateEngagement() is deliberately per-engagement — it is the seam for
 * the phase-2 CRM webhook (re-evaluate one engagement on change).
 */

export interface ScanTransaction {
  id: string;
  name: string;
  stage: string;
  dealStatus: string;
  client: { id: string; name: string } | null;
}

export interface ScanEngagement {
  id: string;
  name: string;
  engagementStage: EngagementStage;
  interestLevel?: string | null;
  lastContact?: string | null;
  updatedAt?: string | null;
  termSheetIssued: boolean;
  termSheetDate?: string | null;
  totalAmount?: number | null;
  amountDisbursed?: number | null;
  amountPending?: number | null;
  disbursementStatus?: string | null;
  investor: { id: string; name: string; engagementClassification?: string | null };
}

export interface StalledFlag {
  engagementId: string;
  reason: FlagReason;
  detail: string;
  idleDays: number;
  thresholdDays: number | null;
  stage: EngagementStage;
  investor: { id: string; name: string };
  transaction: { id: string; name: string };
  link: string;
}

/** Only live deals produce follow-up noise. */
const SCANNED_DEAL_STATUSES = new Set(["Open", "ClosedReopened"]);

/**
 * Belt-and-braces: in production, closing a deal moves its STAGE to
 * ClosedWon/ClosedLost while dealStatus stays "Open" (the CRM never flips it),
 * so the status guard alone is a no-op. A deal in a terminal stage produces no
 * stalled/hygiene noise — only an outstanding disbursement still warrants a
 * chase there (that's money owed after close, the Invested branch's purpose).
 * Exported so the pipeline digest applies the SAME terminal-stage exclusion
 * (2026-07-21 QA: the digest was reporting Closed-Won/Lost deals as "stalled").
 */
export const CLOSED_DEAL_STAGES = new Set(["ClosedWon", "ClosedLost"]);

export interface EvaluateContext {
  thresholds: StaleThresholds;
  now: Date;
  baseUrl: string;
}

export function evaluateEngagement(
  engagement: ScanEngagement,
  transaction: ScanTransaction,
  ctx: EvaluateContext,
): StalledFlag[] {
  if (!SCANNED_DEAL_STATUSES.has(transaction.dealStatus)) return [];
  const dealClosed = CLOSED_DEAL_STAGES.has(transaction.stage);
  if (engagement.engagementStage === "Declined") return [];

  const flags: StalledFlag[] = [];
  const base = {
    engagementId: engagement.id,
    stage: engagement.engagementStage,
    investor: { id: engagement.investor.id, name: engagement.investor.name },
    transaction: { id: transaction.id, name: transaction.name },
    link: `${ctx.baseUrl}/engagement/${engagement.id}`,
  };
  const idle = idleDays(ctx.now, engagement);

  if (engagement.engagementStage === "Invested") {
    // Post-close: only outstanding disbursement warrants a chase.
    const pending = engagement.amountPending ?? 0;
    if (engagement.disbursementStatus === "Ongoing" && pending > 0) {
      const threshold = ctx.thresholds.Invested;
      if (idle >= threshold) {
        flags.push({
          ...base,
          reason: "disbursement_outstanding",
          detail: `Disbursement ongoing with ${pending.toLocaleString()} still pending, no touch in ${idle} days.`,
          idleDays: idle,
          thresholdDays: threshold,
        });
      }
    }
  } else if (!dealClosed) {
    const threshold = ctx.thresholds[engagement.engagementStage];
    if (threshold !== undefined && idle >= threshold) {
      flags.push({
        ...base,
        reason: "stalled",
        detail: `No touch in ${idle} days at stage ${engagement.engagementStage} (threshold ${threshold}d).`,
        idleDays: idle,
        thresholdDays: threshold,
      });
    }
  }

  // Data hygiene, independent of idleness: an issued term sheet must carry its date.
  if (!dealClosed && engagement.termSheetIssued && !engagement.termSheetDate) {
    flags.push({
      ...base,
      reason: "term_sheet_undated",
      detail: "Term sheet is marked issued but has no date recorded.",
      idleDays: idle,
      thresholdDays: null,
    });
  }

  return flags;
}

export interface ScanDeps {
  crm: CrmClient;
  thresholds: StaleThresholds;
  now?: () => Date;
}

export interface ScanFilter {
  transactionId?: string;
  investorId?: string;
}

export async function scanEngagements(deps: ScanDeps, filter: ScanFilter = {}): Promise<StalledFlag[]> {
  const now = deps.now ? deps.now() : new Date();
  const data = await deps.crm.query<{
    engagementsByDeal: Array<{ transaction: ScanTransaction; engagements: ScanEngagement[] }>;
  }>(ENGAGEMENTS_BY_DEAL_SCAN);

  const ctx: EvaluateContext = { thresholds: deps.thresholds, now, baseUrl: deps.crm.baseUrl };
  const flags: StalledFlag[] = [];
  for (const deal of data.engagementsByDeal) {
    if (filter.transactionId && deal.transaction.id !== filter.transactionId) continue;
    for (const engagement of deal.engagements) {
      if (filter.investorId && engagement.investor.id !== filter.investorId) continue;
      flags.push(...evaluateEngagement(engagement, deal.transaction, ctx));
    }
  }
  // Most-idle first — that is the order a deal lead should chase.
  return flags.sort((a, b) => b.idleDays - a.idleDays);
}
