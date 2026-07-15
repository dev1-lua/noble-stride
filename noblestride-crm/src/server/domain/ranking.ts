// Pure investor-match ranking for the Noblestride CRM.
// No I/O, no Prisma calls, no side-effects — safe to unit-test without a database.

import { formatMoney } from "@/lib/money";
import { label } from "@/lib/vocab";

// ─── Domain types ─────────────────────────────────────────────────────────────

export interface MatchTxn {
  sector: string[];
  targetRaise: number;
  geography: string[];
  instrument: string[];
  clientFinancials?: {
    revenue: number | null;
    ebitda: number | null;
    loanBook: number | null;
  };
}

export interface MatchInvestor {
  id: string;
  name: string;
  sectorFocus: string[];
  geographicFocus: string[];
  ticketMin: number | null;
  ticketMax: number | null;
  status: string | null;
  instruments: string[];
  minRevenue: number | null;
  minEbitda: number | null;
  minLoanBook: number | null;
  contactName?: string | null;
  criteriaVerifiedAt?: Date | null;
}

export interface InvestorMatch {
  id: string;
  name: string;
  score: number;
  reasons: string[];
  warnings: string[];
  contactName: string | null;
  criteriaStale: boolean;
}

// ─── Scoring weights ──────────────────────────────────────────────────────────

const WEIGHT_SECTOR = 0.35;
const WEIGHT_GEOGRAPHY = 0.25;
const WEIGHT_TICKET = 0.15;
const WEIGHT_INSTRUMENT = 0.15;
const WEIGHT_THRESHOLD = 0.1;
const BONUS_ACTIVELY_DEPLOYING = 0.1;

const CRITERIA_STALE_DAYS = 180;

// ─── Core scoring ─────────────────────────────────────────────────────────────

/**
 * Scores a single investor against a transaction.
 * Returns a score in [0, 1.0], human-readable positive `reasons`, and
 * negative/informational `warnings`.
 */
export function investorMatchScore(
  inv: MatchInvestor,
  txn: MatchTxn
): { score: number; reasons: string[]; warnings: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const warnings: string[] = [];

  // Sector overlap: any common element between inv.sectorFocus and txn.sector
  const sectorOverlap = txn.sector.filter((s) => inv.sectorFocus.includes(s));
  if (sectorOverlap.length > 0) {
    score += WEIGHT_SECTOR;
    for (const s of sectorOverlap) {
      reasons.push(`Sector match: ${label("Sector", s)}`);
    }
  }

  // Geography overlap: any common element between inv.geographicFocus and txn.geography
  const geoOverlap = txn.geography.filter((g) => inv.geographicFocus.includes(g));
  if (geoOverlap.length > 0) {
    score += WEIGHT_GEOGRAPHY;
    for (const g of geoOverlap) {
      reasons.push(`Geography match: ${label("Geography", g)}`);
    }
  }

  // Ticket fit: txn.targetRaise within [ticketMin, ticketMax]
  const withinMin = inv.ticketMin == null || txn.targetRaise >= inv.ticketMin;
  const withinMax = inv.ticketMax == null || txn.targetRaise <= inv.ticketMax;
  if (withinMin && withinMax) {
    score += WEIGHT_TICKET;
    reasons.push(`Ticket fits (${formatMoney(txn.targetRaise)})`);
  }

  // Instrument overlap: fraction of txn.instrument the investor covers.
  // If either side has no instruments recorded there's nothing to compare —
  // contribute nothing, silently (no warning).
  if (txn.instrument.length > 0 && inv.instruments.length > 0) {
    const covered = txn.instrument.filter((i) => inv.instruments.includes(i));
    if (covered.length > 0) {
      score += WEIGHT_INSTRUMENT * (covered.length / txn.instrument.length);
      for (const i of covered) {
        reasons.push(`Instrument match: ${label("Instrument", i)}`);
      }
    }
  }

  // Threshold fit: of the investor's defined thresholds that also have a
  // non-null client value on record, what fraction are met. A threshold the
  // investor defines but for which the client has no value on record earns
  // no credit and is excluded from the fraction — that's an "unknown", not
  // an outright miss, so it gets its own warning.
  const thresholdChecks: {
    investorMin: number | null;
    clientValue: number | null | undefined;
    missWarning: string;
    unknownWarning: string;
  }[] = [
    {
      investorMin: inv.minRevenue,
      clientValue: txn.clientFinancials?.revenue,
      missWarning: "Below revenue threshold",
      unknownWarning: "Revenue not on record",
    },
    {
      investorMin: inv.minEbitda,
      clientValue: txn.clientFinancials?.ebitda,
      missWarning: "Below EBITDA threshold",
      unknownWarning: "EBITDA not on record",
    },
    {
      investorMin: inv.minLoanBook,
      clientValue: txn.clientFinancials?.loanBook,
      missWarning: "Below loan-book threshold",
      unknownWarning: "Loan-book not on record",
    },
  ];

  let applicableThresholds = 0;
  let metThresholds = 0;
  for (const check of thresholdChecks) {
    if (check.investorMin == null) continue; // investor has no requirement here
    if (check.clientValue == null) {
      warnings.push(check.unknownWarning);
      continue; // no client figure to compare against — no credit, not counted
    }
    applicableThresholds++;
    if (check.clientValue >= check.investorMin) {
      metThresholds++;
    } else {
      warnings.push(check.missWarning);
    }
  }
  if (applicableThresholds > 0) {
    score += WEIGHT_THRESHOLD * (metThresholds / applicableThresholds);
  }

  // Deployment status: bonus for actively deploying, warning for investors
  // who currently aren't taking on new deals.
  if (inv.status === "ActivelyDeploying") {
    score += BONUS_ACTIVELY_DEPLOYING;
  } else if (inv.status === "Dormant" || inv.status === "FullyDeployed") {
    warnings.push("Not currently deploying");
  }

  // Cap at 1.0
  score = Math.min(score, 1.0);

  return { score, reasons, warnings };
}

/** True if the investor's qualification criteria are missing or stale (>180 days old). */
function isCriteriaStale(verifiedAt: Date | null | undefined, now: Date): boolean {
  if (verifiedAt == null) return true;
  const daysSinceVerified = (now.getTime() - verifiedAt.getTime()) / 86_400_000;
  return daysSinceVerified > CRITERIA_STALE_DAYS;
}

// ─── Ranking ──────────────────────────────────────────────────────────────────

/**
 * Ranks investors against a transaction, returning matches with score > 0,
 * sorted by score descending, optionally limited to `limit` results.
 *
 * Investors are hard-filtered out before scoring when both `txn.instrument`
 * and `inv.instruments` are non-empty and share no element — an outright
 * instrument mismatch, not merely a low-scoring one.
 */
export function rankInvestorMatches(
  invs: MatchInvestor[],
  txn: MatchTxn,
  limit?: number,
  now: Date = new Date()
): InvestorMatch[] {
  const eligible = invs.filter((inv) => {
    if (txn.instrument.length === 0 || inv.instruments.length === 0) return true;
    return txn.instrument.some((i) => inv.instruments.includes(i));
  });

  const scored = eligible
    .map((inv) => {
      const { score, reasons, warnings } = investorMatchScore(inv, txn);
      return {
        id: inv.id,
        name: inv.name,
        score,
        reasons,
        warnings,
        contactName: inv.contactName ?? null,
        criteriaStale: isCriteriaStale(inv.criteriaVerifiedAt, now),
      };
    })
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score);

  if (limit != null) {
    return scored.slice(0, limit);
  }
  return scored;
}
