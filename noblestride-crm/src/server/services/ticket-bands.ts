// Investor ticket-size bands (action points 2026-07 item 4): multiple ranges
// per profile, each in its own currency. Band #0 is MIRRORED into the legacy
// Investor.ticketMin/ticketMax/currency columns so AI matching, opportunity
// filters, and every older surface keep working unchanged.
// Thin layer: Prisma calls + domain helpers only. No GraphQL, no React.

import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export interface TicketBandInput {
  min: number;
  /** null/undefined = open-ended upper bound */
  max?: number | null;
  currency?: string;
  note?: string | null;
}

export interface TicketBandView {
  id: string;
  min: number;
  max: number | null;
  currency: string;
  note: string | null;
}

type Tx = Prisma.TransactionClient;

/**
 * Legacy-column mirror for a band list (band #0 is the primary). An EMPTY
 * list clears the legacy range; undefined input should skip calling this.
 */
export function bandMirror(bands: TicketBandInput[]): {
  ticketMin: number | null;
  ticketMax: number | null;
  currency?: string;
} {
  const primary = bands[0];
  if (!primary) return { ticketMin: null, ticketMax: null };
  return {
    ticketMin: primary.min,
    ticketMax: primary.max ?? null,
    currency: primary.currency ?? "USD",
  };
}

/** Replace the investor's band rows (ordered as given). Caller owns the transaction. */
export async function replaceBands(tx: Tx, investorId: string, bands: TicketBandInput[]): Promise<void> {
  await tx.investorTicketBand.deleteMany({ where: { investorId } });
  if (bands.length === 0) return;
  await tx.investorTicketBand.createMany({
    data: bands.map((b, i) => ({
      investorId,
      min: b.min,
      max: b.max ?? null,
      currency: b.currency ?? "USD",
      note: b.note ?? null,
      sortOrder: i,
    })),
  });
}

/** Ordered bands for one investor, Decimals coerced to numbers. */
export async function bandsForInvestor(investorId: string): Promise<TicketBandView[]> {
  const rows = await prisma.investorTicketBand.findMany({
    where: { investorId },
    orderBy: { sortOrder: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    min: Number(r.min),
    max: r.max == null ? null : Number(r.max),
    currency: r.currency,
    note: r.note,
  }));
}

/** Ordered bands for many investors at once (admin match/assignment surfaces). */
export async function bandsForInvestors(investorIds: string[]): Promise<Map<string, TicketBandView[]>> {
  if (investorIds.length === 0) return new Map();
  const rows = await prisma.investorTicketBand.findMany({
    where: { investorId: { in: investorIds } },
    orderBy: { sortOrder: "asc" },
  });
  const map = new Map<string, TicketBandView[]>();
  for (const r of rows) {
    const list = map.get(r.investorId) ?? [];
    list.push({ id: r.id, min: Number(r.min), max: r.max == null ? null : Number(r.max), currency: r.currency, note: r.note });
    map.set(r.investorId, list);
  }
  return map;
}
