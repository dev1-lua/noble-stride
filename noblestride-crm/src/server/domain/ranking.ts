// Pure investor-match ranking for the NobleStride CRM.
// No I/O, no Prisma calls, no side-effects — safe to unit-test without a database.

import { formatMoney } from "@/lib/money";
import { label } from "@/lib/vocab";

// ─── Domain types ─────────────────────────────────────────────────────────────

export interface MatchInvestor {
  id: string;
  name: string;
  sectorFocus: string[];
  geographicFocus: string[];
  ticketMin: number | null;
  ticketMax: number | null;
  status: string | null;
}

export interface MatchTxn {
  sector: readonly string[];
  targetRaise: number;
  geography?: readonly string[];
}

export interface InvestorMatch {
  id: string;
  name: string;
  score: number;
  reasons: string[];
}

// ─── Scoring weights ──────────────────────────────────────────────────────────

const WEIGHT_SECTOR = 0.5;
const WEIGHT_GEOGRAPHY = 0.3;
const WEIGHT_TICKET = 0.2;
const BONUS_ACTIVELY_DEPLOYING = 0.1;

// ─── Core scoring ─────────────────────────────────────────────────────────────

/**
 * Scores a single investor against a transaction.
 * Returns a score in [0, 1.0] and human-readable reasons.
 */
export function investorMatchScore(
  inv: MatchInvestor,
  txn: MatchTxn
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // Sector overlap: any common element between inv.sectorFocus and txn.sector
  const sectorOverlap = txn.sector.filter((s) => inv.sectorFocus.includes(s));
  if (sectorOverlap.length > 0) {
    score += WEIGHT_SECTOR;
    for (const s of sectorOverlap) {
      reasons.push(`Sector match: ${label("Sector", s)}`);
    }
  }

  // Geography overlap: any common element between inv.geographicFocus and txn.geography
  const txnGeo = txn.geography ?? [];
  const geoOverlap = txnGeo.filter((g) => inv.geographicFocus.includes(g));
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

  // Bonus for actively-deploying status
  if (inv.status === "ActivelyDeploying") {
    score += BONUS_ACTIVELY_DEPLOYING;
  }

  // Cap at 1.0
  score = Math.min(score, 1.0);

  return { score, reasons };
}

// ─── Ranking ──────────────────────────────────────────────────────────────────

/**
 * Ranks investors against a transaction, returning matches with score > 0,
 * sorted by score descending, optionally limited to `limit` results.
 */
export function rankInvestorMatches(
  invs: MatchInvestor[],
  txn: MatchTxn,
  limit?: number
): InvestorMatch[] {
  const scored = invs
    .map((inv) => {
      const { score, reasons } = investorMatchScore(inv, txn);
      return { id: inv.id, name: inv.name, score, reasons };
    })
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score);

  if (limit != null) {
    return scored.slice(0, limit);
  }
  return scored;
}
