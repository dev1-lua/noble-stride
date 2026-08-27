/**
 * scripts/backfill-investor-approved-at.ts
 *
 * Fills the new `Investor.approvedAt` column (WS-B migration 7, feedback F3.3
 * "date onboarded") for investors that were approved before the column existed.
 *
 * WHY a script and not a migration default: the real approval date is only
 * recoverable from the timeline. `setOnboardingStatus` has always written an
 * Activity "Investor approved — <name>", so that row's `occurredAt` is the
 * true approval moment. Where no such Activity exists we fall back to
 * `registeredAt`, then `createdAt`, and label which source was used so a human
 * can see how firm each value is.
 *
 * Only rows with `onboardingStatus = Approved AND approvedAt IS NULL` are
 * touched. Re-running is a no-op.
 *
 * USAGE (run from noblestride-crm/)
 *   npm run db:backfill-approved-at                 # DRY RUN (default)
 *   npm run db:backfill-approved-at -- --execute    # write
 *   npm run db:backfill-approved-at -- --allow-remote --execute
 *
 * SAFETY: refuses a non-localhost database host without --allow-remote.
 */

import { PrismaClient } from "@prisma/client";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const APPROVED_SUBJECT_PREFIX = "Investor approved";

const execute = process.argv.includes("--execute");
const allowRemote = process.argv.includes("--allow-remote");

if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(".env");
  } catch {
    // fall through to the explicit error below
  }
}

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("Refusing to start: DATABASE_URL is not set and .env did not provide one.");
  process.exit(1);
}

let host: string;
try {
  host = new URL(dbUrl).hostname;
} catch {
  console.error("Refusing to start: DATABASE_URL is not a parseable URL.");
  process.exit(1);
}
if (!LOCAL_HOSTS.has(host) && !allowRemote) {
  console.error(
    `Refusing to start: DATABASE_URL points at "${host}", which is not localhost.\n` +
      "Re-run with --allow-remote if you really mean to backfill there.",
  );
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

type Source = "activity" | "registeredAt" | "createdAt";

async function main(): Promise<number> {
  const candidates = await prisma.investor.findMany({
    where: { onboardingStatus: "Approved", approvedAt: null },
    select: { id: true, name: true, registeredAt: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  console.log(`${execute ? "EXECUTE" : "DRY RUN"} — database host: ${host}`);
  console.log(`${candidates.length} approved investor(s) with no approvedAt.\n`);
  if (candidates.length === 0) {
    console.log("Nothing to backfill.");
    return 0;
  }

  const plan: Array<{ id: string; name: string; source: Source; value: Date }> = [];
  for (const inv of candidates) {
    const approval = await prisma.activity.findFirst({
      where: { investorId: inv.id, subject: { startsWith: APPROVED_SUBJECT_PREFIX } },
      orderBy: { occurredAt: "asc" },
      select: { occurredAt: true },
    });
    if (approval) plan.push({ id: inv.id, name: inv.name, source: "activity", value: approval.occurredAt });
    else if (inv.registeredAt) plan.push({ id: inv.id, name: inv.name, source: "registeredAt", value: inv.registeredAt });
    else plan.push({ id: inv.id, name: inv.name, source: "createdAt", value: inv.createdAt });
  }

  const width = Math.min(40, Math.max(...plan.map((p) => p.name.length)));
  for (const p of plan) {
    console.log(`  ${p.id}  ${p.name.slice(0, width).padEnd(width)}  ${p.source.padEnd(12)}  ${p.value.toISOString()}`);
  }
  const bySource = plan.reduce<Record<string, number>>((acc, p) => ({ ...acc, [p.source]: (acc[p.source] ?? 0) + 1 }), {});
  console.log(`\nBy source: ${Object.entries(bySource).map(([k, v]) => `${k}=${v}`).join(", ")}`);

  if (!execute) {
    console.log("\nDRY RUN — nothing written. Re-run with --execute to apply.");
    return 0;
  }

  let written = 0;
  for (const p of plan) {
    // Guarded by approvedAt: null so a concurrent approval is never overwritten.
    const res = await prisma.investor.updateMany({
      where: { id: p.id, approvedAt: null },
      data: { approvedAt: p.value },
    });
    written += res.count;
  }
  console.log(`\n${written} investor row(s) updated.`);
  return 0;
}

main()
  .then(async (code) => {
    await prisma.$disconnect();
    process.exit(code);
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
