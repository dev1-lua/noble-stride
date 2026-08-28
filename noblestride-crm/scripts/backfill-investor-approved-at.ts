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
 * WHICH FALLBACKS TO TRUST is the operator's call, so `--sources` selects them.
 * On the restored production data, 93 of 94 investors fall back to `createdAt`,
 * and every one of those carries the same bulk-import timestamp — writing that
 * as a "date onboarded" would be inventing history, not recovering it. The
 * default is therefore `activity,registeredAt`: dates that mean something.
 * Pass `--sources=activity,registeredAt,createdAt` to accept the import date
 * too, e.g. when seeding a demo environment.
 *
 * USAGE (run from noblestride-crm/)
 *   npm run db:backfill-approved-at                 # DRY RUN (default)
 *   npm run db:backfill-approved-at -- --execute    # write
 *   npm run db:backfill-approved-at -- --sources=activity,registeredAt,createdAt
 *   npm run db:backfill-approved-at -- --allow-remote --execute
 *
 * SAFETY: refuses a non-localhost database host without --allow-remote.
 */

import { PrismaClient } from "@prisma/client";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const APPROVED_SUBJECT_PREFIX = "Investor approved";

const execute = process.argv.includes("--execute");
const allowRemote = process.argv.includes("--allow-remote");

const ALL_SOURCES = ["activity", "registeredAt", "createdAt"] as const;
type Source = (typeof ALL_SOURCES)[number];

const sourcesArg = process.argv.find((a) => a.startsWith("--sources="))?.slice("--sources=".length);
const sources: Source[] = sourcesArg
  ? (sourcesArg.split(",").map((s) => s.trim()) as Source[])
  : ["activity", "registeredAt"];
const unknown = sources.filter((s) => !(ALL_SOURCES as readonly string[]).includes(s));
if (unknown.length > 0) {
  console.error(`Unknown --sources value(s): ${unknown.join(", ")}. Valid: ${ALL_SOURCES.join(", ")}`);
  process.exit(1);
}

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

  console.log(`Accepted date sources: ${sources.join(", ")}\n`);

  const plan: Array<{ id: string; name: string; source: Source; value: Date }> = [];
  const skipped: Array<{ id: string; name: string; wouldUse: Source }> = [];
  for (const inv of candidates) {
    const approval = sources.includes("activity")
      ? await prisma.activity.findFirst({
          where: { investorId: inv.id, subject: { startsWith: APPROVED_SUBJECT_PREFIX } },
          orderBy: { occurredAt: "asc" },
          select: { occurredAt: true },
        })
      : null;
    if (approval) {
      plan.push({ id: inv.id, name: inv.name, source: "activity", value: approval.occurredAt });
    } else if (inv.registeredAt && sources.includes("registeredAt")) {
      plan.push({ id: inv.id, name: inv.name, source: "registeredAt", value: inv.registeredAt });
    } else if (sources.includes("createdAt")) {
      plan.push({ id: inv.id, name: inv.name, source: "createdAt", value: inv.createdAt });
    } else {
      // No trusted date: leave approvedAt null rather than stamp a guess.
      skipped.push({ id: inv.id, name: inv.name, wouldUse: inv.registeredAt ? "registeredAt" : "createdAt" });
    }
  }

  if (plan.length === 0) {
    console.log(`Nothing to write: ${skipped.length} investor(s) have no date from the accepted sources.`);
    console.log("Their approvedAt stays null — the Onboarded column shows an em-dash for them.");
    return 0;
  }

  const width = Math.min(40, Math.max(...plan.map((p) => p.name.length)));
  for (const p of plan) {
    console.log(`  ${p.id}  ${p.name.slice(0, width).padEnd(width)}  ${p.source.padEnd(12)}  ${p.value.toISOString()}`);
  }
  const bySource = plan.reduce<Record<string, number>>((acc, p) => ({ ...acc, [p.source]: (acc[p.source] ?? 0) + 1 }), {});
  console.log(`\nBy source: ${Object.entries(bySource).map(([k, v]) => `${k}=${v}`).join(", ")}`);
  if (skipped.length > 0) {
    console.log(
      `Skipped ${skipped.length} investor(s) with no accepted date (would have used ` +
        `${[...new Set(skipped.map((s) => s.wouldUse))].join("/")}); their approvedAt stays null.`,
    );
  }

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
