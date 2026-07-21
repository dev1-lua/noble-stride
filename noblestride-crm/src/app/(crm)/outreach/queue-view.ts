// queue-view.ts — pure, client-safe data shaping for the outreach review queue.
// No Prisma, no RBAC imports (mayReview is computed server-side in page.tsx and
// passed in as data), so this is unit-testable and safe to import from client
// components. The board filters/groups the already-loaded rows entirely here.

export interface DraftRowData {
  id: string;
  subject: string;
  body: string;
  matchRationale: string;
  status: string;
  error: string | null;
  investorName: string;
  contactLine: string | null;
  mayReview: boolean;
  // deal context (repeated per row; grouping keys off transactionId)
  transactionId: string;
  dealName: string;
  ownerId: string | null;
  ownerName: string | null;
}

export interface DealGroup {
  transactionId: string;
  dealName: string;
  ownerId: string | null;
  ownerName: string | null;
  rows: DraftRowData[];
  counts: { total: number; draft: number; failed: number; approved: number };
}

export type StatusFilter = "all" | "Draft" | "Failed" | "Approved";

export interface QueueFilter {
  status: StatusFilter;
  search: string;
  myDealsOnly: boolean;
  currentUserId?: string;
}

/** Overall counts for the summary bar (over the UNFILTERED row set). */
export function summarize(rows: DraftRowData[]): { deals: number; drafts: number; failed: number } {
  const deals = new Set(rows.map((r) => r.transactionId));
  const failed = rows.filter((r) => r.status === "Failed").length;
  return { deals: deals.size, drafts: rows.length, failed };
}

/** Keep a row iff it matches every active filter. Search matches the deal name
 *  OR the investor name (case-insensitive), so searching a deal keeps its rows. */
export function filterRows(rows: DraftRowData[], f: QueueFilter): DraftRowData[] {
  const q = f.search.trim().toLowerCase();
  return rows.filter((r) => {
    if (f.status !== "all" && r.status !== f.status) return false;
    if (f.myDealsOnly && r.ownerId !== (f.currentUserId ?? null)) return false;
    if (q && !r.dealName.toLowerCase().includes(q) && !r.investorName.toLowerCase().includes(q)) return false;
    return true;
  });
}

/** Group rows by deal, preserving first-seen order, with per-deal status counts. */
export function groupByDeal(rows: DraftRowData[]): DealGroup[] {
  const byDeal = new Map<string, DealGroup>();
  for (const r of rows) {
    let g = byDeal.get(r.transactionId);
    if (!g) {
      g = {
        transactionId: r.transactionId,
        dealName: r.dealName,
        ownerId: r.ownerId,
        ownerName: r.ownerName,
        rows: [],
        counts: { total: 0, draft: 0, failed: 0, approved: 0 },
      };
      byDeal.set(r.transactionId, g);
    }
    g.rows.push(r);
    g.counts.total += 1;
    if (r.status === "Draft") g.counts.draft += 1;
    else if (r.status === "Failed") g.counts.failed += 1;
    else if (r.status === "Approved") g.counts.approved += 1;
  }
  return [...byDeal.values()];
}
