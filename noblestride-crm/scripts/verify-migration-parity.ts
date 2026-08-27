/**
 * scripts/verify-migration-parity.ts
 *
 * The two schema-parity checks this project relies on, run safely.
 *
 * 1. DRIFT   `migrate diff --from-url $DATABASE_URL --to-schema-datamodel`
 *            Everything the live database has that schema.prisma does not.
 *            Expected output: exactly the pg_trgm GIN index DROPs, because
 *            Prisma cannot express those and they live in raw SQL only.
 *            NEVER apply that diff — it would drop the global-search indexes.
 *
 * 2. PARITY  `migrate diff --from-migrations prisma/migrations --to-url $DATABASE_URL`
 *            Whether replaying the migration folders from scratch reproduces
 *            the live database exactly. Expected output: an empty migration.
 *
 * WHY THIS SCRIPT EXISTS: check 2 needs a shadow database, and Prisma *resets*
 * whatever it is handed as the shadow — it drops every object in it and replays
 * the migrations there. On 2026-08-27 that check was run with
 * `--shadow-database-url "$DATABASE_URL"`, i.e. with the restored production
 * dump as the scratch database, and it wiped every row in it. The schema was
 * intact and the answer was correct; the data was gone.
 *
 * So: this script creates a THROWAWAY shadow database, refuses to run if the
 * shadow name collides with the real one, and drops the shadow afterwards.
 *
 * USAGE (run from noblestride-crm/)
 *   npm run db:verify-parity
 *
 * Exit codes: 0 = both checks as expected, 1 = unexpected drift or error.
 */

import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const SHADOW_DB = "prisma_parity_shadow";
// The nine indexes Prisma cannot express (pg_trgm GIN). Anything else in the
// drift output is real drift and fails the check.
const ALLOWED_DRIFT = /^(--.*|\s*|DROP INDEX "[A-Za-z]+_(name|title)_trgm_idx";)$/;

if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(".env");
  } catch {
    // fall through
  }
}

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("Refusing to start: DATABASE_URL is not set and .env did not provide one.");
  process.exit(1);
}

let parsed: URL;
try {
  parsed = new URL(dbUrl);
} catch {
  console.error("Refusing to start: DATABASE_URL is not a parseable URL.");
  process.exit(1);
}

const realDbName = parsed.pathname.replace(/^\//, "");
if (realDbName === SHADOW_DB) {
  console.error(
    `Refusing to start: DATABASE_URL points at "${SHADOW_DB}", the name this script ` +
      "uses for its throwaway shadow database. Prisma RESETS the shadow database — " +
      "pointing it at real data destroys that data.",
  );
  process.exit(1);
}

const shadowUrl = new URL(dbUrl);
shadowUrl.pathname = `/${SHADOW_DB}`;

const adminUrl = new URL(dbUrl);
adminUrl.pathname = "/postgres";

function prisma(...args: string[]): string {
  return execFileSync("npx", ["prisma", ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  });
}

async function withAdmin<T>(fn: (client: PrismaClient) => Promise<T>): Promise<T> {
  const client = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } } });
  try {
    return await fn(client);
  } finally {
    await client.$disconnect();
  }
}

async function main(): Promise<number> {
  console.log(`Real database: ${realDbName}   Shadow: ${SHADOW_DB} (throwaway)\n`);

  console.log("1. DRIFT — live database vs prisma/schema.prisma");
  const drift = prisma(
    "migrate", "diff",
    "--from-url", dbUrl!,
    "--to-schema-datamodel", "prisma/schema.prisma",
    "--script",
  );
  const unexpected = drift.split("\n").filter((line) => !ALLOWED_DRIFT.test(line));
  const trgmDrops = drift.split("\n").filter((l) => l.includes("_trgm_idx")).length;
  if (unexpected.length > 0) {
    console.error(`   UNEXPECTED DRIFT (${unexpected.length} line(s)):`);
    for (const line of unexpected) console.error(`     ${line}`);
    console.error("   Fix prisma/schema.prisma to match the database — never apply this diff.");
    return 1;
  }
  console.log(`   OK — ${trgmDrops} pg_trgm index DROP(s) and nothing else (expected).\n`);

  console.log("2. PARITY — replaying prisma/migrations reproduces the live database");
  await withAdmin(async (admin) => {
    // A leftover shadow from an interrupted run would be replayed into, which is
    // harmless, but a clean one keeps the check honest.
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${SHADOW_DB}"`);
    await admin.$executeRawUnsafe(`CREATE DATABASE "${SHADOW_DB}"`);
  });
  try {
    const parity = prisma(
      "migrate", "diff",
      "--from-migrations", "prisma/migrations",
      "--to-url", dbUrl!,
      "--shadow-database-url", shadowUrl.toString(),
      "--script",
    );
    const empty = parity.includes("This is an empty migration");
    if (!empty) {
      console.error("   PARITY FAILED — replaying the migrations does not reproduce the database:");
      console.error(parity.split("\n").slice(0, 40).map((l) => `     ${l}`).join("\n"));
      return 1;
    }
    console.log("   OK — empty migration (the folders reproduce the database exactly).\n");
  } finally {
    await withAdmin(async (admin) => {
      await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${SHADOW_DB}"`);
    });
  }

  console.log("Both parity checks passed.");
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
