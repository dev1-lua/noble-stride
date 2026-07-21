/**
 * scripts/restore-qa-records.ts
 *
 * Recovery path for scripts/archive-qa-records.ts: re-inserts every row from a
 * QA archive JSON file, parents before children (the archive's MODEL_ORDER).
 * Rows that already exist (same id) are skipped, so a partial restore can be
 * re-run safely.
 *
 * USAGE (run from noblestride-crm/, prod direct connection required)
 *   DATABASE_URL_UNPOOLED=... npx tsx scripts/restore-qa-records.ts ../qa-reports/archives/2026-07-21-qa-archive.json
 *       # DRY RUN (default): prints what would be restored
 *   DATABASE_URL_UNPOOLED=... npx tsx scripts/restore-qa-records.ts <file> --execute
 */

import { readFileSync } from "node:fs";
import * as readline from "node:readline/promises";
import { PrismaClient } from "@prisma/client";
import { MODEL_ORDER, type Archive, type ModelName } from "./archive-qa-records";

const CONFIRM_PHRASE = "RESTORE QA RECORDS";

const dbUrl = process.env.DATABASE_URL_UNPOOLED;
if (!dbUrl) {
  console.error("Refusing to start: DATABASE_URL_UNPOOLED is not set.");
  process.exit(1);
}
const targetHost = (() => {
  try {
    return new URL(dbUrl).host || "(unknown host)";
  } catch {
    return "(unparseable DATABASE_URL_UNPOOLED)";
  }
})();

const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const execute = process.argv.includes("--execute");
  if (args.length !== 1) {
    console.error("Usage: npx tsx scripts/restore-qa-records.ts <archive.json> [--execute]");
    process.exitCode = 1;
    return;
  }

  const archive = JSON.parse(readFileSync(args[0], "utf8")) as Archive;
  console.log("=".repeat(78));
  console.log(`RESTORE-QA-RECORDS — ${execute ? "EXECUTE" : "DRY RUN"}`);
  console.log(`Archive: ${args[0]} (archived ${archive.meta.archivedAt} from ${archive.meta.dbHost})`);
  console.log(`Target DB host: ${targetHost}`);
  console.log("=".repeat(78));
  for (const model of MODEL_ORDER) {
    const list = (archive.rows[model] ?? []) as Array<{ id: string; name?: string; title?: string }>;
    if (list.length === 0) continue;
    console.log(`\n${model} — ${list.length} row(s):`);
    for (const r of list) console.log(`    - ${r.id}  ${JSON.stringify(r.name ?? r.title ?? "")}`);
  }

  if (!execute) {
    console.log("\nDRY RUN — nothing restored. Re-run with --execute to proceed.");
    return;
  }
  if (!process.stdin.isTTY) {
    console.error("\nRefusing: --execute requires an interactive typed confirmation (stdin is not a TTY).");
    process.exitCode = 1;
    return;
  }

  console.log(`\nType exactly "${CONFIRM_PHRASE}" to re-insert the rows above.`);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  let typed: string;
  try {
    typed = await rl.question("> ");
  } finally {
    rl.close();
  }
  if (typed !== CONFIRM_PHRASE) {
    console.log("\nConfirmation phrase did not match — aborting. Nothing restored.");
    return;
  }

  await prisma.$transaction(
    async (tx) => {
      for (const model of MODEL_ORDER) {
        const rows = (archive.rows[model] ?? []) as Array<Record<string, unknown>>;
        if (rows.length === 0) continue;
        const delegate = (
          tx as unknown as Record<
            ModelName,
            { createMany: (a: { data: unknown[]; skipDuplicates: boolean }) => Promise<{ count: number }> }
          >
        )[model];
        // Folders self-reference (parentId) — insert in passes so parents land first.
        if (model === "folder") {
          let pending = [...rows];
          let inserted = new Set(
            (await (tx as unknown as { folder: { findMany: (a: unknown) => Promise<Array<{ id: string }>> } }).folder
              .findMany({ select: { id: true } }))
              .map((f) => f.id),
          );
          while (pending.length > 0) {
            const ready = pending.filter((f) => !f.parentId || inserted.has(f.parentId as string));
            if (ready.length === 0) throw new Error("Folder restore stuck: unresolved parentId chain.");
            await delegate.createMany({ data: ready, skipDuplicates: true });
            for (const f of ready) inserted.add(f.id as string);
            pending = pending.filter((f) => !ready.includes(f));
          }
          continue;
        }
        const { count } = await delegate.createMany({ data: rows, skipDuplicates: true });
        console.log(`  ${model}: restored ${count}/${rows.length} (skipped rows already exist)`);
      }
    },
    { timeout: 120_000 },
  );

  console.log("\nDone. Archived rows restored.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
