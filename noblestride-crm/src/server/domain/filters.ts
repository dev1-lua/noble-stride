// Pure Prisma where-builder for investor filtering.
// Uses type-only import — no runtime dependency on @prisma/client.

import type { Prisma } from "@prisma/client";
import type { InvestorFilter } from "@/server/domain/types";

/**
 * Converts an InvestorFilter into a Prisma.InvestorWhereInput.
 * Only emits clauses for fields that are present (non-null/undefined).
 * An empty filter returns {}.
 */
export function buildInvestorWhere(filter: InvestorFilter): Prisma.InvestorWhereInput {
  const where: Prisma.InvestorWhereInput = {};

  if (filter.investorType != null) {
    where.investorType = filter.investorType;
  }

  if (filter.sector != null) {
    where.sectorFocus = { has: filter.sector };
  }

  if (filter.geography != null) {
    where.geographicFocus = { has: filter.geography };
  }

  if (filter.status != null) {
    where.status = filter.status;
  }

  if (filter.search != null) {
    where.name = { contains: filter.search, mode: "insensitive" };
  }

  // Ticket overlap: investor range overlaps deal raise when:
  //   investor.ticketMax >= filter.ticketMin (investor can write at least the deal floor)
  //   investor.ticketMin <= filter.ticketMax (investor minimum is within deal ceiling)
  if (filter.ticketMin != null || filter.ticketMax != null) {
    const ticketClauses: Prisma.InvestorWhereInput[] = [];
    if (filter.ticketMin != null) {
      ticketClauses.push({ ticketMax: { gte: filter.ticketMin } });
    }
    if (filter.ticketMax != null) {
      ticketClauses.push({ ticketMin: { lte: filter.ticketMax } });
    }
    if (ticketClauses.length === 1) {
      Object.assign(where, ticketClauses[0]);
    } else {
      where.AND = ticketClauses;
    }
  }

  return where;
}
