/**
 * Prod DB pre-migration check (read-only):
 * 1. Which migrations are applied (are the 4 x 2026-07-14 ones pending?)
 * 2. Do OutreachDraft / InvestorProposedChange tables exist?
 * 3. Duplicate active (transactionId, investorId) OutreachDraft pairs
 *    that would break the partial unique dedup index.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL_UNPOOLED } },
});

async function main() {
  const applied = await prisma.$queryRawUnsafe<{ migration_name: string }[]>(
    `SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL ORDER BY migration_name`
  );
  const names = applied.map((r) => r.migration_name);
  console.log(`APPLIED_COUNT=${names.length}`);
  const recent = [
    "20260714101241_agent_write_ledger",
    "20260714114718_client_otp_challenge",
    "20260714151126_investor_agent_outreach",
    "20260714165154_outreach_active_dedup_index",
  ];
  for (const m of recent) {
    console.log(`${names.includes(m) ? "APPLIED " : "PENDING "} ${m}`);
  }

  const tables = await prisma.$queryRawUnsafe<{ table_name: string }[]>(
    `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('OutreachDraft','InvestorProposedChange','AgentWriteLog','ClientOtpChallenge')`
  );
  console.log("TABLES_PRESENT=" + tables.map((t) => t.table_name).join(",") || "none");

  if (tables.some((t) => t.table_name === "OutreachDraft")) {
    const dupes = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "transactionId","investorId",count(*) FROM "OutreachDraft"
       WHERE "status" IN ('Draft','Approved','Sent','Failed')
       GROUP BY 1,2 HAVING count(*) > 1`
    );
    console.log(`ACTIVE_DUPLICATE_PAIRS=${dupes.length}`);
    if (dupes.length) console.log(JSON.stringify(dupes, null, 2));
  } else {
    console.log("ACTIVE_DUPLICATE_PAIRS=n/a (OutreachDraft table absent)");
  }
}

main().finally(() => prisma.$disconnect());
