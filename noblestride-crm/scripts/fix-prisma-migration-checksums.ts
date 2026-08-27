/**
 * scripts/fix-prisma-migration-checksums.ts
 *
 * Re-stamps `_prisma_migrations.checksum` from the migration files on disk.
 *
 * WHY: the local DB is a restored production dump whose `_prisma_migrations`
 * table records migrations whose folders were lost from the repo. Those folders
 * have been re-authored so the DDL is byte-for-byte equivalent in *effect* —
 * `prisma migrate diff --from-migrations prisma/migrations --to-url $DATABASE_URL`
 * is empty — but the re-authored *files* hash differently, so the stored
 * checksums are stale and `prisma migrate deploy` would eventually refuse to
 * run ("migrations have been modified after they were applied").
 *
 * This script fixes ONLY the `checksum` column. It never touches
 * `applied_steps_count`, `finished_at`, `rolled_back_at`, or any application
 * table, and it never inserts or deletes migration rows — a folder with no DB
 * row is reported as a `prisma migrate resolve --applied` command for a human
 * to run, because recording a migration as applied is a decision this script
 * must not make on its own.
 *
 * USAGE (run from noblestride-crm/)
 *   npm run db:fix-checksums                  # DRY RUN (default) — prints SQL
 *   npm run db:fix-checksums -- --execute     # actually UPDATE the checksums
 *   npm run db:fix-checksums -- --allow-remote --execute   # non-localhost DB
 *
 * SAFETY: refuses to run against a non-localhost database host unless
 * `--allow-remote` is passed, so a stray `DATABASE_URL` pointing at production
 * cannot be re-stamped by accident.
 *
 * Exit codes: 0 = nothing to do / done, 2 = folders exist with no DB row
 * (run the printed `migrate resolve` commands first), 1 = usage/connection error.
 */

import { PrismaClient, Prisma } from "@prisma/client";
import { resolve } from "node:path";
import {
  planChecksumFixes,
  readLocalMigrations,
  type DbMigrationRow,
} from "./lib/migration-checksums";

const MIGRATIONS_DIR = resolve(process.cwd(), "prisma/migrations");
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

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
      "Re-run with --allow-remote if you really mean to re-stamp checksums there.",
  );
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

async function main(): Promise<number> {
  const local = readLocalMigrations(MIGRATIONS_DIR);
  const dbRows = await prisma.$queryRaw<DbMigrationRow[]>`
    SELECT migration_name, checksum FROM "_prisma_migrations" ORDER BY migration_name
  `;
  const plan = planChecksumFixes(local, dbRows);

  console.log(`${execute ? "EXECUTE" : "DRY RUN"} — database host: ${host}`);
  console.log(`${local.length} migration folder(s) on disk, ${dbRows.length} _prisma_migrations row(s).\n`);

  if (plan.missingLocally.length > 0) {
    console.log("Rows in the DB with NO folder on disk (left untouched — a lost migration):");
    for (const name of plan.missingLocally) console.log(`  - ${name}`);
    console.log();
  }

  if (plan.update.length === 0) {
    console.log("No checksum mismatches — nothing to update.");
  } else {
    console.log(`${plan.update.length} checksum mismatch(es):`);
    for (const u of plan.update) {
      console.log(`  ${u.name}`);
      console.log(`    from ${u.from}`);
      console.log(`    to   ${u.to}`);
      console.log(
        `    UPDATE "_prisma_migrations" SET checksum='${u.to}' WHERE migration_name='${u.name}';`,
      );
    }
    console.log();
  }

  if (plan.missingInDb.length > 0) {
    console.log("Folders on disk with NO _prisma_migrations row. Run these yourself, then re-run this script:");
    for (const name of plan.missingInDb) console.log(`  npx prisma migrate resolve --applied ${name}`);
    console.log();
    return 2;
  }

  if (!execute) {
    if (plan.update.length > 0) console.log("Dry run — nothing written. Re-run with --execute to apply.");
    return 0;
  }

  let applied = 0;
  for (const u of plan.update) {
    // Guarded by `from` so a concurrent change makes this a no-op instead of a
    // silent clobber of a checksum we never read.
    applied += await prisma.$executeRaw`
      UPDATE "_prisma_migrations" SET checksum = ${u.to}
      WHERE migration_name = ${u.name} AND checksum = ${u.from}
    `;
  }
  console.log(`Updated ${applied} row(s).`);
  if (applied !== plan.update.length) {
    console.error(
      `Expected to update ${plan.update.length} row(s) but updated ${applied}. ` +
        "The DB changed since the plan was built — re-run this script.",
    );
    return 1;
  }
  return 0;
}

main()
  .then(async (code) => {
    await prisma.$disconnect();
    process.exit(code);
  })
  .catch(async (err: unknown) => {
    await prisma.$disconnect();
    if (err instanceof Prisma.PrismaClientInitializationError) {
      console.error(`Could not connect to ${host}: ${err.message}`);
    } else {
      console.error(err);
    }
    process.exit(1);
  });
