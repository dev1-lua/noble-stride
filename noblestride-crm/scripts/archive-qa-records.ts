/**
 * scripts/archive-qa-records.ts
 *
 * REVERSIBLE cleanup of the QA-created records from the 2026-07-21 production
 * QA (qa-reports/2026-07-21-production-qa.md §3). Unlike cleanup-test-data.ts
 * (allow-list purge, hard delete), this script:
 *   1. targets a SMALL, EXPLICIT list of records (by id / registration no. /
 *      exact name),
 *   2. exports every affected row — the targets AND all their child rows — to
 *      a JSON archive file BEFORE deleting anything, and
 *   3. deletes inside a single transaction, child → parent.
 *
 * The archive file is the recovery path: scripts/restore-qa-records.ts
 * re-inserts everything from it. Delete the archive file later once the
 * records are confidently unneeded.
 *
 * USAGE (run from noblestride-crm/, prod direct connection required)
 *   DATABASE_URL_UNPOOLED=... npx tsx scripts/archive-qa-records.ts
 *       # DRY RUN (default): prints what would be archived+removed, writes nothing
 *   DATABASE_URL_UNPOOLED=... npx tsx scripts/archive-qa-records.ts --execute
 *       # archives to qa-reports/archives/ then deletes, after you type the phrase
 *   ... --include-preexisting
 *       # ALSO target the pre-existing junk from report §3 (exact names below).
 *       # Requires prisma/real-data.json so every name-matched target can be
 *       # double-checked against the protected real-data allow-list.
 *
 * Ambiguous pre-existing junk (duplicate INVESTEC, malformed BlueOrchard,
 * generic person rows) is deliberately NOT targeted — triage those by hand.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as readline from "node:readline/promises";
import { PrismaClient, Prisma } from "@prisma/client";
import { buildProtectedSets, isProtected, type RealData } from "./lib/test-data-guard";

const CONFIRM_PHRASE = "ARCHIVE QA RECORDS";

// ─── Targets ─────────────────────────────────────────────────────────────────

/** 2026-07-21 QA test writes (report §3 checklist). */
const QA_TARGETS = {
  clientRegistrationNos: ["QA-99231"], // [QA-TEST] Zephyr Holdings Ltd intake
  clientNameContains: ["[QA-TEST] Zephyr Holdings"],
  taskTitleContains: ["[QA-TEST] ignore"], // tracker follow-up "[QA-TEST] ignore — QA verification"
  partnerIds: ["cmrugzjh40000jg04tfhf1c3h"], // QA-TEST Referrer Zeta (+ its review task + queued self-update)
  taskIds: ["cmrugzjkk0002jg04laiyrwbs"],
};

/** Pre-existing junk from report §3 — exact (trimmed) name matches only. */
const PREEXISTING_TARGETS = {
  partnerNames: ["QA Test Partner (DELETE)", "Proposal sent", "advisory they are seeking valuation services"],
  mandateNames: ["QA TEST MANDATE (DELETE)"],
  clientNames: ["Savanna Foods Ltd", "ShauryaTestinc", "Shaurya INC"],
  transactionNames: ["LuaTestTransac.", "bbbb", "bbbbbbbb"],
  investorNames: ["Abraaj Group - STOPPED OPERATING"],
};

// ─── Connection guard (same policy as cleanup-test-data.ts) ─────────────────

const dbUrl = process.env.DATABASE_URL_UNPOOLED;
if (!dbUrl) {
  console.error(
    "Refusing to start: DATABASE_URL_UNPOOLED is not set. Point this script at the prod direct connection explicitly.",
  );
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

// ─── Collection ──────────────────────────────────────────────────────────────

type Db = Prisma.TransactionClient | PrismaClient;

/** Every model the archive touches, in RESTORE order (parents before children).
 *  Deletion runs in the REVERSE of this order. restore-qa-records.ts depends on
 *  this ordering — keep the two files in sync. */
export const MODEL_ORDER = [
  "client",
  "partner",
  "investor",
  "mandate",
  "transaction",
  "advisoryEngagement",
  "person",
  "engagement",
  "engagementMilestone",
  "folder",
  "document",
  "activity",
  "task",
  "stageChange",
  "partnerProposedChange",
  "clientOtpChallenge",
] as const;
export type ModelName = (typeof MODEL_ORDER)[number];

export type Archive = {
  meta: { archivedAt: string; dbHost: string; includePreexisting: boolean; confirmPhrase: string };
  rows: Record<ModelName, unknown[]>;
};

async function collect(db: Db, includePreexisting: boolean): Promise<Archive["rows"]> {
  // 1. Resolve top-level target ids.
  const clientWhere: Prisma.ClientWhereInput = {
    OR: [
      { registrationNo: { in: QA_TARGETS.clientRegistrationNos } },
      ...QA_TARGETS.clientNameContains.map((s) => ({ name: { contains: s } })),
      ...(includePreexisting ? [{ name: { in: PREEXISTING_TARGETS.clientNames } }] : []),
    ],
  };
  const clients = await db.client.findMany({ where: clientWhere });
  const clientIds = clients.map((c) => c.id);

  const partners = await db.partner.findMany({
    where: {
      OR: [
        { id: { in: QA_TARGETS.partnerIds } },
        ...(includePreexisting ? [{ name: { in: PREEXISTING_TARGETS.partnerNames } }] : []),
      ],
    },
  });
  const partnerIds = partners.map((p) => p.id);

  const investors = includePreexisting
    ? await db.investor.findMany({ where: { name: { in: PREEXISTING_TARGETS.investorNames } } })
    : [];
  const investorIds = investors.map((i) => i.id);

  // 2. Deal-level children of target clients (+ name-targeted extras).
  const mandates = await db.mandate.findMany({
    where: {
      OR: [
        { clientId: { in: clientIds } },
        ...(includePreexisting ? [{ name: { in: PREEXISTING_TARGETS.mandateNames } }] : []),
      ],
    },
  });
  const mandateIds = mandates.map((m) => m.id);

  const transactions = await db.transaction.findMany({
    where: {
      OR: [
        { clientId: { in: clientIds } },
        ...(includePreexisting ? [{ name: { in: PREEXISTING_TARGETS.transactionNames } }] : []),
      ],
    },
  });
  const transactionIds = transactions.map((t) => t.id);

  // A name-targeted transaction may belong to a NON-target client (Restrict FK
  // is fine — we only delete the transaction). But a target CLIENT must not
  // leave behind transactions we didn't collect, so nothing else to do here.

  const advisoryEngagements = await db.advisoryEngagement.findMany({ where: { clientId: { in: clientIds } } });
  const advisoryIds = advisoryEngagements.map((a) => a.id);

  // 3. Row-level children.
  const engagements = await db.engagement.findMany({
    where: { OR: [{ transactionId: { in: transactionIds } }, { investorId: { in: investorIds } }] },
  });
  const engagementIds = engagements.map((e) => e.id);
  const engagementMilestones = await db.engagementMilestone.findMany({
    where: { engagementId: { in: engagementIds } },
  });

  const persons = await db.person.findMany({
    where: {
      OR: [{ clientId: { in: clientIds } }, { partnerId: { in: partnerIds } }, { investorId: { in: investorIds } }],
    },
  });

  const parentScope = {
    clientIds,
    partnerIds,
    investorIds,
    mandateIds,
    transactionIds,
    advisoryIds,
    engagementIds,
  };

  const tasks = await db.task.findMany({
    where: {
      OR: [
        { id: { in: QA_TARGETS.taskIds } },
        ...QA_TARGETS.taskTitleContains.map((s) => ({ title: { contains: s } })),
        { clientId: { in: clientIds } },
        { partnerId: { in: partnerIds } },
        { investorId: { in: investorIds } },
        { mandateId: { in: mandateIds } },
        { transactionId: { in: transactionIds } },
        { advisoryId: { in: advisoryIds } },
      ],
    },
  });

  const documents = await db.document.findMany({
    where: {
      OR: [
        { clientId: { in: clientIds } },
        { partnerId: { in: partnerIds } },
        { investorId: { in: investorIds } },
        { mandateId: { in: mandateIds } },
        { transactionId: { in: transactionIds } },
        { advisoryId: { in: advisoryIds } },
      ],
    },
  });

  const folders = await db.folder.findMany({
    where: {
      OR: [
        { clientId: { in: clientIds } },
        { investorId: { in: investorIds } },
        { mandateId: { in: mandateIds } },
        { transactionId: { in: transactionIds } },
        { advisoryId: { in: advisoryIds } },
      ],
    },
  });

  const activities = await db.activity.findMany({
    where: {
      OR: [
        { clientId: { in: clientIds } },
        { investorId: { in: investorIds } },
        { mandateId: { in: mandateIds } },
        { transactionId: { in: transactionIds } },
        { advisoryId: { in: advisoryIds } },
        { engagementId: { in: engagementIds } },
      ],
    },
  });

  const stageChanges = await db.stageChange.findMany({
    where: {
      OR: [
        { clientId: { in: clientIds } },
        { partnerId: { in: partnerIds } },
        { investorId: { in: investorIds } },
        { mandateId: { in: mandateIds } },
        { transactionId: { in: transactionIds } },
        { engagementId: { in: engagementIds } },
      ],
    },
  });

  const partnerProposedChanges = await db.partnerProposedChange.findMany({
    where: { partnerId: { in: partnerIds } },
  });

  const clientOtpChallenges = await db.clientOtpChallenge.findMany({
    where: { OR: [{ clientId: { in: clientIds } }, { personId: { in: persons.map((p) => p.id) } }] },
  });

  void parentScope;

  return {
    client: clients,
    partner: partners,
    investor: investors,
    mandate: mandates,
    transaction: transactions,
    advisoryEngagement: advisoryEngagements,
    person: persons,
    engagement: engagements,
    engagementMilestone: engagementMilestones,
    folder: folders,
    document: documents,
    activity: activities,
    task: tasks,
    stageChange: stageChanges,
    partnerProposedChange: partnerProposedChanges,
    clientOtpChallenge: clientOtpChallenges,
  };
}

// ─── Real-data protection check (for name-matched targets) ──────────────────

function assertNothingProtected(rows: Archive["rows"]): void {
  const dataPath = join(__dirname, "..", "prisma", "real-data.json");
  if (!existsSync(dataPath)) {
    throw new Error(
      "prisma/real-data.json not found — refusing to run with --include-preexisting (the name-matched targets can't be checked against the real-data allow-list).",
    );
  }
  const realData = JSON.parse(readFileSync(dataPath, "utf8")) as RealData;
  const sets = buildProtectedSets(realData);
  const checks: Array<[Parameters<typeof isProtected>[0], unknown[]]> = [
    ["investor", rows.investor],
    ["client", rows.client],
    ["partner", rows.partner],
    ["mandate", rows.mandate],
  ];
  for (const [kind, kindRows] of checks) {
    for (const row of kindRows as Array<Record<string, unknown>>) {
      if (isProtected(kind, row as never, sets)) {
        throw new Error(
          `Refusing: targeted ${kind} ${String(row.id)} "${String(row.name)}" matches the PROTECTED real-data allow-list. Nothing archived or deleted.`,
        );
      }
    }
  }
}

// ─── Delete (child → parent, single transaction) ─────────────────────────────

async function deleteArchived(tx: Prisma.TransactionClient, rows: Archive["rows"]): Promise<void> {
  const ids = (model: ModelName) => (rows[model] as Array<{ id: string }>).map((r) => r.id);
  for (const model of [...MODEL_ORDER].reverse()) {
    const modelIds = ids(model);
    if (modelIds.length === 0) continue;
    // Every model here has a String `id` PK; delegate dynamically.
    const delegate = (tx as unknown as Record<string, { deleteMany: (a: unknown) => Promise<{ count: number }>}>)[
      model
    ];
    const { count } = await delegate.deleteMany({ where: { id: { in: modelIds } } });
    if (count !== modelIds.length) {
      throw new Error(
        `Delete-count mismatch on ${model}: expected ${modelIds.length}, deleted ${count}. Rolling back — DB changed since collection.`,
      );
    }
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const execute = process.argv.includes("--execute");
  const includePreexisting = process.argv.includes("--include-preexisting");

  const rows = await collect(prisma, includePreexisting);
  if (includePreexisting) assertNothingProtected(rows);

  console.log("=".repeat(78));
  console.log(`ARCHIVE-QA-RECORDS — ${execute ? "EXECUTE" : "DRY RUN"} (preexisting junk: ${includePreexisting ? "INCLUDED" : "excluded"})`);
  console.log(`Target DB host: ${targetHost}`);
  console.log("=".repeat(78));
  for (const model of MODEL_ORDER) {
    const list = rows[model] as Array<{ id: string; name?: string; title?: string }>;
    if (list.length === 0) continue;
    console.log(`\n${model} — ${list.length} row(s):`);
    for (const r of list) console.log(`    - ${r.id}  ${JSON.stringify(r.name ?? r.title ?? "")}`);
  }
  const total = MODEL_ORDER.reduce((n, m) => n + rows[m].length, 0);
  console.log(`\nTOTAL rows to archive + remove: ${total}`);

  if (!execute) {
    console.log("\nDRY RUN — nothing written or deleted. Re-run with --execute to proceed.");
    return;
  }
  if (total === 0) {
    console.log("\nNothing matched — nothing to do.");
    return;
  }
  if (!process.stdin.isTTY) {
    console.error("\nRefusing: --execute requires an interactive typed confirmation (stdin is not a TTY).");
    process.exitCode = 1;
    return;
  }

  console.log(`\nRows will be EXPORTED to the archive file first, then removed. Type exactly "${CONFIRM_PHRASE}" to proceed.`);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  let typed: string;
  try {
    typed = await rl.question("> ");
  } finally {
    rl.close();
  }
  if (typed !== CONFIRM_PHRASE) {
    console.log("\nConfirmation phrase did not match — aborting. Nothing written or deleted.");
    return;
  }

  await prisma.$transaction(
    async (tx) => {
      // Re-collect INSIDE the transaction so the archive file and the deletes
      // describe the exact same rows (no preview-to-confirm drift).
      const freshRows = await collect(tx, includePreexisting);
      if (includePreexisting) assertNothingProtected(freshRows);

      const archive: Archive = {
        meta: {
          archivedAt: new Date().toISOString(),
          dbHost: targetHost,
          includePreexisting,
          confirmPhrase: CONFIRM_PHRASE,
        },
        rows: freshRows,
      };

      const dir = join(__dirname, "..", "..", "qa-reports", "archives");
      mkdirSync(dir, { recursive: true });
      const file = join(dir, `${new Date().toISOString().slice(0, 10)}-qa-archive.json`);
      if (existsSync(file)) {
        throw new Error(`Archive file already exists: ${file} — move it aside first (never overwrite a recovery file).`);
      }
      // Write the archive BEFORE any delete. If this write fails, the
      // transaction aborts and nothing is removed.
      writeFileSync(file, JSON.stringify(archive, null, 2));
      console.log(`\nArchive written: ${file}`);

      await deleteArchived(tx, freshRows);
    },
    { timeout: 120_000 },
  );

  console.log("\nDone. Rows archived and removed. Restore any time with scripts/restore-qa-records.ts.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
