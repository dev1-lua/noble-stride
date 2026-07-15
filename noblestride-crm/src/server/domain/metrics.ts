// Pure metric functions for the Noblestride CRM.
// No I/O, no Prisma calls, no side-effects — safe to unit-test without a database.

import {
  CLOSED_TXN_STAGES,
  type InvestorStatus,
  type PartnerReferralInput,
} from "@/server/domain/types";

// ─── Quarter helpers ──────────────────────────────────────────────────────────

/**
 * Returns the UTC start of the current calendar quarter and the given moment
 * as the end. Consistent with Task 1's `timeZone:"UTC"` choice.
 */
export function quarterRange(now: Date = new Date()): { start: Date; end: Date } {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth(); // 0-indexed
  const quarterStartMonth = Math.floor(month / 3) * 3;
  const start = new Date(Date.UTC(year, quarterStartMonth, 1, 0, 0, 0, 0));
  return { start, end: now };
}

// ─── Stage timing ─────────────────────────────────────────────────────────────

/**
 * Whole days elapsed since `stageEnteredAt`.
 */
export function daysInStage(stageEnteredAt: Date, now: Date = new Date()): number {
  return Math.floor((now.getTime() - stageEnteredAt.getTime()) / 86_400_000);
}

// ─── Deal velocity ────────────────────────────────────────────────────────────

/**
 * Average months from `dateOpened` to `closedAt` across all transactions that
 * have both dates set. Returns null if there are no closed transactions.
 */
export function avgTimeToCloseMonths(
  txns: { dateOpened: Date | null; closedAt: Date | null }[]
): number | null {
  const closed = txns.filter((t) => t.dateOpened != null && t.closedAt != null);
  if (closed.length === 0) return null;
  const totalDays = closed.reduce(
    (sum, t) => sum + (t.closedAt!.getTime() - t.dateOpened!.getTime()) / 86_400_000,
    0
  );
  return totalDays / closed.length / 30.44;
}

// ─── Investor activity ────────────────────────────────────────────────────────

/**
 * True if the investor is `ActivelyDeploying` OR has at least one activity date
 * within the current quarter (inclusive of the quarter start).
 */
export function isActiveInvestorThisQuarter(
  args: { status: InvestorStatus | null; activityDates: Date[] },
  now: Date = new Date()
): boolean {
  if (args.status === "ActivelyDeploying") return true;
  const { start } = quarterRange(now);
  return args.activityDates.some((d) => d >= start && d <= now);
}

// ─── Partner referral rollup ─────────────────────────────────────────────────

/**
 * Summarises a partner's referral contribution.
 *
 * - referred: mandates referred + directly-referred transactions
 * - active:   mandates with ≥1 transaction whose stage is NOT in CLOSED_TXN_STAGES,
 *             plus direct transactions whose own stage is not closed
 * - closed:   total count of ClosedWon transactions (mandate children + direct)
 * - revenue:  Σ targetRaise of ClosedWon transactions
 *
 * `directTransactions` must already exclude transactions that belong to one of
 * `mandates` (the caller dedupes) or they'd be double-counted.
 */
export function partnerReferralRollup(
  input: PartnerReferralInput
): { referred: number; active: number; closed: number; revenue: number } {
  let active = 0;
  let closed = 0;
  let revenue = 0;

  for (const mandate of input.mandates) {
    const hasOpenTxn = mandate.transactions.some(
      (t) => !(CLOSED_TXN_STAGES as string[]).includes(t.stage)
    );
    if (hasOpenTxn) active++;

    for (const txn of mandate.transactions) {
      if (txn.stage === "ClosedWon") {
        closed++;
        revenue += txn.targetRaise;
      }
    }
  }

  const direct = input.directTransactions ?? [];
  for (const txn of direct) {
    if (!(CLOSED_TXN_STAGES as string[]).includes(txn.stage)) active++;
    if (txn.stage === "ClosedWon") {
      closed++;
      revenue += txn.targetRaise;
    }
  }

  return { referred: input.mandates.length + direct.length, active, closed, revenue };
}
