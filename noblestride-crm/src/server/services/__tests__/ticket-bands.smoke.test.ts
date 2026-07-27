// DB-backed smoke tests for multiple ticket bands (action points 2026-07
// item 4): the band #0 → legacy ticketMin/ticketMax/currency mirror, band
// replacement, and ordered reads.

import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { createInvestor, updateInvestor } from "@/server/services/investors";
import { bandsForInvestor } from "@/server/services/ticket-bands";

const ACTOR = { type: "HUMAN" as const };

describe("investor ticket bands", () => {
  afterAll(async () => {
    await prisma.investor.deleteMany({ where: { name: { startsWith: "ZZ Bands" } } });
  });

  it("create with bands mirrors band #0 into the legacy columns", async () => {
    const created = await createInvestor(
      {
        name: "ZZ Bands Fund",
        investorType: "PrivateEquity",
        ticketBands: [
          { min: 129_000_000, max: 645_000_000, currency: "KES" },
          { min: 1_000_000, max: 5_000_000, currency: "USD" },
        ],
      },
      ACTOR,
    );
    expect(Number(created.ticketMin)).toBe(129_000_000);
    expect(Number(created.ticketMax)).toBe(645_000_000);
    expect(created.currency).toBe("KES");

    const bands = await bandsForInvestor(created.id);
    expect(bands).toHaveLength(2);
    expect(bands[0]).toMatchObject({ min: 129_000_000, max: 645_000_000, currency: "KES" });
    expect(bands[1]).toMatchObject({ min: 1_000_000, max: 5_000_000, currency: "USD" });
  });

  it("update replaces bands (order preserved, open-ended max allowed) and re-mirrors", async () => {
    const created = await createInvestor(
      { name: "ZZ Bands Replace", investorType: "VentureCapital", ticketBands: [{ min: 1, max: 2, currency: "USD" }] },
      ACTOR,
    );
    await updateInvestor(
      created.id,
      { ticketBands: [{ min: 250_000, max: null, currency: "EUR" }, { min: 10_000, max: 50_000, currency: "USD" }] },
      ACTOR,
    );
    const after = await prisma.investor.findUniqueOrThrow({ where: { id: created.id } });
    expect(Number(after.ticketMin)).toBe(250_000);
    expect(after.ticketMax).toBeNull();
    expect(after.currency).toBe("EUR");

    const bands = await bandsForInvestor(created.id);
    expect(bands.map((b) => b.currency)).toEqual(["EUR", "USD"]);
    expect(bands[0].max).toBeNull();
  });

  it("update WITHOUT ticketBands leaves existing bands and legacy columns untouched", async () => {
    const created = await createInvestor(
      { name: "ZZ Bands Untouched", investorType: "PrivateEquity", ticketBands: [{ min: 5, max: 10, currency: "GBP" }] },
      ACTOR,
    );
    await updateInvestor(created.id, { notes: "no band change" }, ACTOR);
    const after = await prisma.investor.findUniqueOrThrow({ where: { id: created.id } });
    expect(Number(after.ticketMin)).toBe(5);
    expect(after.currency).toBe("GBP");
    expect(await bandsForInvestor(created.id)).toHaveLength(1);
  });

  it("explicitly empty bands clear the rows and the legacy range", async () => {
    const created = await createInvestor(
      { name: "ZZ Bands Cleared", investorType: "PrivateEquity", ticketBands: [{ min: 5, max: 10, currency: "USD" }] },
      ACTOR,
    );
    await updateInvestor(created.id, { ticketBands: [] }, ACTOR);
    const after = await prisma.investor.findUniqueOrThrow({ where: { id: created.id } });
    expect(after.ticketMin).toBeNull();
    expect(after.ticketMax).toBeNull();
    expect(await bandsForInvestor(created.id)).toHaveLength(0);
  });

  it("rejects a band whose max is below its min", async () => {
    await expect(
      createInvestor(
        { name: "ZZ Bands Invalid", investorType: "PrivateEquity", ticketBands: [{ min: 100, max: 50, currency: "USD" }] },
        ACTOR,
      ),
    ).rejects.toThrow(/at least the minimum/i);
  });
});
