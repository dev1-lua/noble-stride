import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "@/lib/db";
import { parseDealsQuery } from "@/server/domain/deals-queue";
import { listDeals, countsBy, dealsCsvRows } from "../deals-queue";

let dbUp = true;
beforeAll(async () => {
  try { await prisma.$queryRaw`SELECT 1`; } catch { dbUp = false; }
});

describe.skipIf(!dbUp)("deals-queue service (DB)", () => {
  it("lists both kinds and reports a total", async () => {
    const { rows, total } = await listDeals(parseDealsQuery({}));
    expect(Array.isArray(rows)).toBe(true);
    expect(total).toBeGreaterThanOrEqual(rows.length);
    for (const r of rows) expect(r.kind === "mandate" || r.kind === "transaction").toBe(true);
  });
  it("filters to transactions only when type=transaction", async () => {
    const { rows } = await listDeals(parseDealsQuery({ type: "transaction", page: "1" }));
    for (const r of rows) expect(r.kind).toBe("transaction");
  });
  it("paginates: page size 50, total unchanged across pages", async () => {
    const p1 = await listDeals(parseDealsQuery({}));
    expect(p1.rows.length).toBeLessThanOrEqual(50);
    const p2 = await listDeals(parseDealsQuery({ page: "2" }));
    expect(p2.total).toBe(p1.total);
  });
  it("countsBy stage returns counts summing to the type-filtered total", async () => {
    const spec = parseDealsQuery({ type: "mandate" });
    const groups = await countsBy(spec, "stage");
    const sum = groups.reduce((a, g) => a + g.count, 0);
    const { total } = await listDeals(spec);
    expect(sum).toBe(total);
  });
  it("csv rows start with a header and align column counts", async () => {
    const rows = await dealsCsvRows(parseDealsQuery({}));
    expect(rows.length).toBeGreaterThanOrEqual(1);
    const width = rows[0].length;
    for (const r of rows) expect(r.length).toBe(width);
  });
});
