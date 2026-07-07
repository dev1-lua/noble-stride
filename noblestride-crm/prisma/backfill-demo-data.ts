// prisma/backfill-demo-data.ts — NON-DESTRUCTIVE, idempotent demo-data
// backfill for an existing DB. Populates Client.hqCity/hqCountry/
// revenueLastYear, Mandate.dealSize, and Investor.ticketMin/ticketMax ONLY
// where the field is currently null, using the same literal maps the seed
// consumes (prisma/demo-financials.ts) so the two never diverge.
//
// Never deletes or resets anything. Safe to re-run — records that already
// have a value are left untouched.
//
// Run with: npx tsx prisma/backfill-demo-data.ts

import { PrismaClient } from "@prisma/client";
import { CLIENT_FINANCIALS, MANDATE_DEAL_SIZES, INVESTOR_TICKETS } from "./demo-financials";

const prisma = new PrismaClient();

async function backfillClients(): Promise<number> {
  let updated = 0;
  for (const [name, financials] of Object.entries(CLIENT_FINANCIALS)) {
    const rows = await prisma.client.findMany({ where: { name } });
    for (const row of rows) {
      const data: { hqCity?: string; hqCountry?: string; revenueLastYear?: number } = {};
      if (row.hqCity == null) data.hqCity = financials.hqCity;
      if (row.hqCountry == null) data.hqCountry = financials.hqCountry;
      if (row.revenueLastYear == null) data.revenueLastYear = financials.revenueLastYear;
      if (Object.keys(data).length === 0) continue;
      await prisma.client.update({ where: { id: row.id }, data });
      updated += 1;
    }
  }
  return updated;
}

async function backfillMandates(): Promise<number> {
  let updated = 0;
  for (const [name, dealSize] of Object.entries(MANDATE_DEAL_SIZES)) {
    const rows = await prisma.mandate.findMany({ where: { name } });
    for (const row of rows) {
      if (row.dealSize != null) continue;
      await prisma.mandate.update({ where: { id: row.id }, data: { dealSize } });
      updated += 1;
    }
  }
  return updated;
}

async function backfillInvestors(): Promise<number> {
  let updated = 0;
  for (const [name, ticket] of Object.entries(INVESTOR_TICKETS)) {
    const rows = await prisma.investor.findMany({ where: { name } });
    for (const row of rows) {
      const data: { ticketMin?: number; ticketMax?: number } = {};
      if (row.ticketMin == null) data.ticketMin = ticket.ticketMin;
      if (row.ticketMax == null) data.ticketMax = ticket.ticketMax;
      if (Object.keys(data).length === 0) continue;
      await prisma.investor.update({ where: { id: row.id }, data });
      updated += 1;
    }
  }
  return updated;
}

async function main() {
  const clientsUpdated = await backfillClients();
  const mandatesUpdated = await backfillMandates();
  const investorsUpdated = await backfillInvestors();

  console.log(`Backfill complete — clients updated: ${clientsUpdated}, mandates updated: ${mandatesUpdated}, investors updated: ${investorsUpdated}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
