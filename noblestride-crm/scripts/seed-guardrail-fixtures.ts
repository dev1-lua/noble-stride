/**
 * scripts/seed-guardrail-fixtures.ts
 *
 * Seeds the two guardrail fixtures the 2026-07-21 production QA could not
 * exercise end-to-end: an ENGAGED investor classified Excluded and one
 * classified Greylisted (the investor-tracker must refuse to discuss either).
 * Creates, idempotently by exact name:
 *   - Client       "QA Guardrail Fixture Co"
 *   - Transaction  "QA Guardrail Fixture Raise" (on that client, stage DealPreparation)
 *   - Investor     "QA Seed - Excluded Capital"    (engagementClassification Excluded)
 *   - Investor     "QA Seed - Greylisted Partners" (engagementClassification Greylisted)
 *   - Engagement   one per investor on the fixture transaction (stage Shared)
 *
 * These are INTENTIONALLY persistent test fixtures (clearly named), so the
 * tracker's discuss-refusal path stays testable in prod. Remove them by name
 * if they're ever unwanted.
 *
 * USAGE (run from noblestride-crm/, prod direct connection required)
 *   DATABASE_URL_UNPOOLED=... npx tsx scripts/seed-guardrail-fixtures.ts            # DRY RUN
 *   DATABASE_URL_UNPOOLED=... npx tsx scripts/seed-guardrail-fixtures.ts --execute
 */

import * as readline from "node:readline/promises";
import { PrismaClient } from "@prisma/client";

const CONFIRM_PHRASE = "SEED GUARDRAIL FIXTURES";

const CLIENT_NAME = "QA Guardrail Fixture Co";
const TXN_NAME = "QA Guardrail Fixture Raise";
const EXCLUDED_NAME = "QA Seed - Excluded Capital";
const GREYLISTED_NAME = "QA Seed - Greylisted Partners";

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
  const execute = process.argv.includes("--execute");

  const [client, txn, excluded, greylisted] = await Promise.all([
    prisma.client.findFirst({ where: { name: CLIENT_NAME } }),
    prisma.transaction.findFirst({ where: { name: TXN_NAME } }),
    prisma.investor.findFirst({ where: { name: EXCLUDED_NAME } }),
    prisma.investor.findFirst({ where: { name: GREYLISTED_NAME } }),
  ]);

  console.log("=".repeat(78));
  console.log(`SEED-GUARDRAIL-FIXTURES — ${execute ? "EXECUTE" : "DRY RUN"}`);
  console.log(`Target DB host: ${targetHost}`);
  console.log("=".repeat(78));
  console.log(`  Client     "${CLIENT_NAME}":            ${client ? `exists (${client.id})` : "will create"}`);
  console.log(`  Transaction "${TXN_NAME}":         ${txn ? `exists (${txn.id})` : "will create"}`);
  console.log(`  Investor   "${EXCLUDED_NAME}":     ${excluded ? `exists (${excluded.id})` : "will create (Excluded)"}`);
  console.log(`  Investor   "${GREYLISTED_NAME}":  ${greylisted ? `exists (${greylisted.id})` : "will create (Greylisted)"}`);
  console.log(`  Engagements: ensured for both investors on the fixture transaction`);

  if (!execute) {
    console.log("\nDRY RUN — nothing created. Re-run with --execute to proceed.");
    return;
  }
  if (!process.stdin.isTTY) {
    console.error("\nRefusing: --execute requires an interactive typed confirmation (stdin is not a TTY).");
    process.exitCode = 1;
    return;
  }
  console.log(`\nType exactly "${CONFIRM_PHRASE}" to create the fixtures above.`);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  let typed: string;
  try {
    typed = await rl.question("> ");
  } finally {
    rl.close();
  }
  if (typed !== CONFIRM_PHRASE) {
    console.log("\nConfirmation phrase did not match — aborting. Nothing created.");
    return;
  }

  await prisma.$transaction(async (tx) => {
    const theClient =
      (await tx.client.findFirst({ where: { name: CLIENT_NAME } })) ??
      (await tx.client.create({
        data: {
          name: CLIENT_NAME,
          description: "Persistent QA fixture — anchors the Excluded/Greylisted guardrail engagements. Do not pitch.",
          createdSource: "API",
        },
      }));

    const theTxn =
      (await tx.transaction.findFirst({ where: { name: TXN_NAME } })) ??
      (await tx.transaction.create({
        data: {
          name: TXN_NAME,
          clientId: theClient.id,
          stage: "DealPreparation",
          dealStatus: "Open",
          notes: "Persistent QA fixture transaction — exists so the tracker's Excluded/Greylisted discuss-refusal is testable.",
          createdSource: "API",
        },
      }));

    const ensureInvestor = async (name: string, classification: "Excluded" | "Greylisted") => {
      const existing = await tx.investor.findFirst({ where: { name } });
      if (existing) return existing;
      return tx.investor.create({
        data: {
          name,
          investorType: "PrivateEquity",
          engagementClassification: classification,
          notes: `Persistent QA fixture — classification ${classification}; the tracker must refuse to discuss this investor.`,
          createdSource: "API",
        },
      });
    };
    const theExcluded = await ensureInvestor(EXCLUDED_NAME, "Excluded");
    const theGreylisted = await ensureInvestor(GREYLISTED_NAME, "Greylisted");

    for (const inv of [theExcluded, theGreylisted]) {
      const existing = await tx.engagement.findFirst({
        where: { transactionId: theTxn.id, investorId: inv.id },
      });
      if (!existing) {
        await tx.engagement.create({
          data: {
            name: `${inv.name} × ${TXN_NAME}`,
            transactionId: theTxn.id,
            investorId: inv.id,
            engagementStage: "Shared",
            status: "NotContacted",
            createdSource: "API",
          },
        });
      }
    }
  });

  console.log("\nDone. Fixtures ensured. Tracker discuss-refusal is now end-to-end testable.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
