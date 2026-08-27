/**
 * scripts/lib/migration-checksums.ts
 *
 * Pure, DB-free logic behind `scripts/fix-prisma-migration-checksums.ts`.
 *
 * WHY THIS EXISTS: the local Postgres is a restored production dump, so
 * `_prisma_migrations` already carries rows for migrations whose folders were
 * lost from the repo. Re-authoring those folders reproduces the DDL exactly
 * (verified with `prisma migrate diff --from-migrations … --to-url …`), but
 * never reproduces the original file *bytes* — so the stored sha256 checksums
 * no longer match, and Prisma will eventually refuse to `migrate deploy`
 * ("migrations have been modified after they were applied").
 *
 * The fix is to re-stamp `_prisma_migrations.checksum` from the re-authored
 * files. That is a data write, so the decision of *what* to write is kept
 * here, pure and unit-tested, separate from the script that talks to the DB.
 *
 * No `@prisma/client`, no env access. `readLocalMigrations` is the only
 * impure export (it reads the migrations directory) and is deliberately kept
 * trivial.
 */

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/** One migration folder on disk: folder name + sha256 of its migration.sql. */
export interface LocalMigration {
  name: string;
  checksum: string;
}

/** One `_prisma_migrations` row (only the two columns we care about). */
export interface DbMigrationRow {
  migration_name: string;
  checksum: string;
}

/** A single checksum re-stamp: set `name`'s checksum from `from` to `to`. */
export interface ChecksumUpdate {
  name: string;
  from: string;
  to: string;
}

export interface ChecksumPlan {
  /** Rows present in both places whose checksum disagrees — these get UPDATEd. */
  update: ChecksumUpdate[];
  /** Folders on disk with no `_prisma_migrations` row (need `migrate resolve`). */
  missingInDb: string[];
  /** Rows in the DB with no folder on disk (a lost migration — human decision). */
  missingLocally: string[];
}

/**
 * Prisma's migration checksum: sha256 of the raw `migration.sql` bytes, hex.
 * No normalization of line endings or trailing whitespace — Prisma hashes the
 * file as-is, so we must too.
 */
export function checksumOf(sql: string): string {
  return createHash("sha256").update(sql).digest("hex");
}

/**
 * Read every `<dir>/<name>/migration.sql`, sorted by folder name (which is
 * also Prisma's application order). Non-directories (e.g. `migration_lock.toml`)
 * and folders without a `migration.sql` are skipped.
 */
export function readLocalMigrations(dir: string): LocalMigration[] {
  const out: LocalMigration[] = [];
  for (const name of readdirSync(dir).sort()) {
    const folder = join(dir, name);
    if (!statSync(folder).isDirectory()) continue;
    let sql: string;
    try {
      sql = readFileSync(join(folder, "migration.sql"), "utf8");
    } catch {
      continue; // a directory without migration.sql is not a migration
    }
    out.push({ name, checksum: checksumOf(sql) });
  }
  return out;
}

/**
 * Compare the folders on disk against the `_prisma_migrations` rows and
 * classify every name into exactly one bucket. Order follows `local` (i.e.
 * migration order) for `update`/`missingInDb` and `db` for `missingLocally`.
 */
export function planChecksumFixes(local: LocalMigration[], db: DbMigrationRow[]): ChecksumPlan {
  const dbByName = new Map(db.map((row) => [row.migration_name, row.checksum]));
  const localNames = new Set(local.map((m) => m.name));

  const update: ChecksumUpdate[] = [];
  const missingInDb: string[] = [];
  for (const m of local) {
    const dbChecksum = dbByName.get(m.name);
    if (dbChecksum === undefined) missingInDb.push(m.name);
    else if (dbChecksum !== m.checksum) update.push({ name: m.name, from: dbChecksum, to: m.checksum });
  }

  const missingLocally = db.map((row) => row.migration_name).filter((name) => !localNames.has(name));
  return { update, missingInDb, missingLocally };
}
