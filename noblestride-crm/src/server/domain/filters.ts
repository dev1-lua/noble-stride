// Pure Prisma where-builder for investor filtering.
// Uses type-only import — no runtime dependency on @prisma/client.

import type { Prisma } from "@prisma/client";
import type { InvestorFilter } from "@/server/domain/types";

function toArray<T>(v: T | T[] | null | undefined): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

/**
 * Converts an InvestorFilter into a Prisma.InvestorWhereInput.
 * Only emits clauses for fields that are present (non-null/undefined).
 * An empty filter returns {}.
 *
 * Scalar fields (investorType/status) and multi-value array fields
 * (sector/geography) accept either a single value (scalar equality — used by
 * the GraphQL API) or an array (OR-matched via Prisma `in`/`hasSome` — used
 * by the multi-select filter bar). An empty array imposes no constraint.
 */
export function buildInvestorWhere(filter: InvestorFilter): Prisma.InvestorWhereInput {
  const where: Prisma.InvestorWhereInput = {};

  const investorTypes = toArray(filter.investorType);
  if (investorTypes.length === 1) {
    where.investorType = investorTypes[0];
  } else if (investorTypes.length > 1) {
    where.investorType = { in: investorTypes };
  }

  const sectors = toArray(filter.sector);
  if (sectors.length > 0) {
    where.sectorFocus = { hasSome: sectors };
  }

  const geographies = toArray(filter.geography);
  if (geographies.length > 0) {
    where.geographicFocus = { hasSome: geographies };
  }

  const statuses = toArray(filter.status);
  if (statuses.length === 1) {
    where.status = statuses[0];
  } else if (statuses.length > 1) {
    where.status = { in: statuses };
  }

  if (filter.onboardingStatus != null) {
    where.onboardingStatus = filter.onboardingStatus;
  }

  // F3.3: "date onboarded" range. Either bound may stand alone.
  if (filter.approvedFrom != null || filter.approvedTo != null) {
    where.approvedAt = {
      ...(filter.approvedFrom != null ? { gte: filter.approvedFrom } : {}),
      ...(filter.approvedTo != null ? { lte: filter.approvedTo } : {}),
    };
  }

  // F3.4 (image9): one search box has to find a fund by its own name OR by any
  // of its contacts — the client searches for the person they spoke to, not the
  // legal entity. Kept on `where.OR`, deliberately separate from the ticket
  // overlap below, which builds `where.AND`.
  if (filter.search != null) {
    where.OR = [
      { name: { contains: filter.search, mode: "insensitive" } },
      { contacts: { some: { firstName: { contains: filter.search, mode: "insensitive" } } } },
      { contacts: { some: { lastName: { contains: filter.search, mode: "insensitive" } } } },
      { contacts: { some: { email: { contains: filter.search, mode: "insensitive" } } } },
    ];
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
