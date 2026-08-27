// F3.3 (image8: "date onboarded should be a column and a filter") and F3.4
// (image9: "I want an overview of all investors — search a person and get their
// profile, fund and contacts"). The where-builder is pure, so both are pinned
// here rather than through the page.

import { describe, it, expect } from "vitest";
import { buildInvestorWhere } from "@/server/domain/filters";

describe("buildInvestorWhere — approvedAt + people search", () => {
  it("emits an approvedAt range", () => {
    const from = new Date("2026-01-01");
    const to = new Date("2026-06-30");
    expect(buildInvestorWhere({ approvedFrom: from, approvedTo: to })).toMatchObject({
      approvedAt: { gte: from, lte: to },
    });
  });

  it("emits an open-ended range from one bound", () => {
    const from = new Date("2026-01-01");
    expect(buildInvestorWhere({ approvedFrom: from })).toMatchObject({ approvedAt: { gte: from } });
    const to = new Date("2026-06-30");
    expect(buildInvestorWhere({ approvedTo: to })).toMatchObject({ approvedAt: { lte: to } });
  });

  it("search ORs the fund name with contact first/last/email", () => {
    const where = buildInvestorWhere({ search: "oulula" });
    expect(where.OR).toEqual([
      { name: { contains: "oulula", mode: "insensitive" } },
      { contacts: { some: { firstName: { contains: "oulula", mode: "insensitive" } } } },
      { contacts: { some: { lastName: { contains: "oulula", mode: "insensitive" } } } },
      { contacts: { some: { email: { contains: "oulula", mode: "insensitive" } } } },
    ]);
    // The name-only clause is gone, not merely supplemented.
    expect(where.name).toBeUndefined();
  });

  it("the search OR survives alongside the other constraints", () => {
    // The search builds `OR` and the ticket overlap builds `AND`/scalars; a
    // regression that merged the two would silently turn "matches any of these
    // people" into "matches all of them".
    const where = buildInvestorWhere({
      search: "fund",
      ticketMin: 1_000_000,
      ticketMax: 5_000_000,
      onboardingStatus: "Approved",
    });
    expect(where.OR).toHaveLength(4);
    expect(where.AND).toHaveLength(2);
    expect(where.onboardingStatus).toBe("Approved");
  });

  it("an empty filter is still {}", () => {
    expect(buildInvestorWhere({})).toEqual({});
  });
});
