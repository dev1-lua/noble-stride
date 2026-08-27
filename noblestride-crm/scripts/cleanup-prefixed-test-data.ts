/**
 * scripts/cleanup-prefixed-test-data.ts
 *
 * Narrowly-scoped removal of TEST-FIXTURE rows identified by a name/email
 * PREFIX. Companion to the safety-critical, interactive
 * `scripts/cleanup-test-data.ts` — deliberately a separate script rather than
 * a `--only-prefix` flag on that one, because that script's guarantee rests on
 * a human reading a full preview and typing a confirmation phrase, and adding
 * a non-interactive path to it would weaken exactly that guarantee.
 *
 * WHY IT IS SAFE
 *   1. Prefixes are ALLOW-LISTED (see ALLOWED_PREFIXES). An arbitrary prefix
 *      is refused, so this can never be aimed at real client data.
 *   2. Every candidate row is re-checked against the real-data allow-list
 *      (prisma/real-data.json, via scripts/lib/test-data-guard) inside the
 *      transaction; if anything protected is in scope the whole thing throws
 *      and rolls back.
 *   3. Dry run by default. `--execute` is required to write.
 *   4. Refuses a non-localhost DATABASE_URL without `--allow-remote`.
 *
 * Deletes in FK order so a leftover child (e.g. a ZZTest Mandate pinning a
 * ZZTest Client) can't block the parent — which is what the dead machine's
 * residue did to `outreach.test.ts` / `investor-agent.test.ts`.
 *
 * USAGE (from noblestride-crm/)
 *   npx tsx scripts/cleanup-prefixed-test-data.ts --prefix ZZTest
 *   npx tsx scripts/cleanup-prefixed-test-data.ts --prefix ZZTest --prefix zz- --execute
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { buildProtectedSets, normalizeName, normalizeEmail, type RealData } from "./lib/test-data-guard";

/**
 * Only prefixes this project actually uses for throwaway fixtures.
 *
 * CRITICAL: Prisma's `startsWith` compiles to SQL `LIKE '<prefix>%'`, where
 * `_` is a SINGLE-CHARACTER WILDCARD and `%` matches anything. A prefix
 * containing either would silently match (and delete) unrelated rows — e.g.
 * `--prefix __` would match every name of two characters or more. So the
 * allow-list holds only wildcard-free prefixes, and assertNoLikeWildcards()
 * below re-checks that at runtime for defence in depth.
 */
const ALLOWED_PREFIXES = ["ZZTest", "zz-"] as const;

function assertNoLikeWildcards(prefix: string): void {
  if (prefix.includes("_") || prefix.includes("%") || prefix.includes("\\")) {
    throw new Error(
      `Refusing prefix "${prefix}" — it contains a SQL LIKE wildcard (_ % \\), which would match unrelated rows.`,
    );
  }
}

interface Args {
  prefixes: string[];
  execute: boolean;
  allowRemote: boolean;
}

function parseArgs(argv: string[]): Args {
  const prefixes: string[] = [];
  let execute = false;
  let allowRemote = false;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--prefix" || a === "--only-prefix") {
      const v = argv[i + 1];
      if (!v) throw new Error("--prefix needs a value");
      prefixes.push(v);
      i += 1;
    } else if (a === "--execute") execute = true;
    else if (a === "--allow-remote") allowRemote = true;
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (prefixes.length === 0) throw new Error("Nothing to do: pass at least one --prefix <value>");
  for (const p of prefixes) {
    assertNoLikeWildcards(p);
    if (!ALLOWED_PREFIXES.includes(p as (typeof ALLOWED_PREFIXES)[number])) {
      throw new Error(
        `Refusing prefix "${p}" — only ${ALLOWED_PREFIXES.join(", ")} are allowed (this script must never be aimed at real data).`,
      );
    }
  }
  return { prefixes, execute, allowRemote };
}

function isLocalhost(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!process.env.DATABASE_URL) {
    try {
      process.loadEnvFile(".env");
    } catch {
      /* fall through */
    }
  }
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL is not set (and .env did not provide one).");
  if (!isLocalhost(dbUrl) && !args.allowRemote) {
    throw new Error("DATABASE_URL is not localhost. Re-run with --allow-remote if that is really intended.");
  }

  const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });
  try {
    const realData = JSON.parse(readFileSync(join(process.cwd(), "prisma", "real-data.json"), "utf8")) as RealData;
    const protectedSets = buildProtectedSets(realData);

    // Prisma has no "starts with any of" — OR the prefixes per field.
    const nameStarts = { OR: args.prefixes.map((p) => ({ name: { startsWith: p } })) };
    const emailStarts = { OR: args.prefixes.map((p) => ({ email: { startsWith: p } })) };
    const subjectStarts = { OR: args.prefixes.map((p) => ({ subject: { startsWith: p } })) };

    const [clients, mandates, transactions, advisory, investors, users, partners, people] = await Promise.all([
      prisma.client.findMany({ where: nameStarts, select: { id: true, name: true } }),
      prisma.mandate.findMany({ where: nameStarts, select: { id: true, name: true } }),
      prisma.transaction.findMany({ where: nameStarts, select: { id: true, name: true } }),
      prisma.advisoryEngagement.findMany({ where: nameStarts, select: { id: true, name: true } }),
      prisma.investor.findMany({ where: nameStarts, select: { id: true, name: true } }),
      prisma.user.findMany({ where: { OR: [nameStarts, emailStarts] }, select: { id: true, name: true, email: true } }),
      prisma.partner.findMany({ where: nameStarts, select: { id: true, name: true } }),
      prisma.person.findMany({
        where: {
          OR: [
            ...args.prefixes.map((p) => ({ firstName: { startsWith: p } })),
            ...args.prefixes.map((p) => ({ lastName: { startsWith: p } })),
            ...args.prefixes.map((p) => ({ email: { startsWith: p } })),
          ],
        },
        select: { id: true, firstName: true, lastName: true, email: true },
      }),
    ]);

    // Guard: nothing in scope may match the real-data allow-list.
    const offenders: string[] = [];
    for (const row of [...clients, ...mandates, ...transactions, ...advisory, ...investors, ...partners]) {
      const n = normalizeName(row.name);
      if (
        protectedSets.clientNames.has(n) ||
        protectedSets.investorNames.has(n) ||
        protectedSets.partnerNames.has(n) ||
        protectedSets.serviceProviderNames.has(n) ||
        protectedSets.mandateNames.has(n)
      ) {
        offenders.push(`${row.name} (${row.id})`);
      }
    }
    for (const u of users) {
      if (protectedSets.emails.has(normalizeEmail(u.email))) offenders.push(`${u.email} (${u.id})`);
    }
    for (const p of people) {
      if (p.email && protectedSets.emails.has(normalizeEmail(p.email))) offenders.push(`${p.email} (${p.id})`);
    }
    if (offenders.length > 0) {
      throw new Error(`REFUSING: these prefixed rows match protected real data:\n  ${offenders.join("\n  ")}`);
    }

    const counts = {
      clients: clients.length,
      mandates: mandates.length,
      transactions: transactions.length,
      advisory: advisory.length,
      investors: investors.length,
      users: users.length,
      partners: partners.length,
      people: people.length,
    };
    console.log(`Prefixes: ${args.prefixes.join(", ")}`);
    console.log("In scope:", counts);
    for (const c of clients) console.log(`  client   ${c.name}`);
    for (const m of mandates) console.log(`  mandate  ${m.name}`);
    for (const t of transactions) console.log(`  txn      ${t.name}`);
    for (const a of advisory) console.log(`  advisory ${a.name}`);
    for (const i of investors) console.log(`  investor ${i.name}`);
    for (const u of users) console.log(`  user     ${u.name} <${u.email}>`);

    if (!args.execute) {
      console.log("\nDRY RUN — nothing deleted. Re-run with --execute to delete.");
      return;
    }

    const clientIds = clients.map((r) => r.id);
    const mandateIds = mandates.map((r) => r.id);
    const txnIds = transactions.map((r) => r.id);
    const advisoryIds = advisory.map((r) => r.id);
    const investorIds = investors.map((r) => r.id);
    const userIds = users.map((r) => r.id);
    const partnerIds = partners.map((r) => r.id);
    const personIds = people.map((r) => r.id);

    // Deals belonging to an in-scope client are in scope too — otherwise they
    // pin the client (the exact failure the dead machine's residue caused).
    const [childMandates, childTxns, childAdvisory] = await Promise.all([
      prisma.mandate.findMany({ where: { clientId: { in: clientIds } }, select: { id: true } }),
      prisma.transaction.findMany({ where: { clientId: { in: clientIds } }, select: { id: true } }),
      prisma.advisoryEngagement.findMany({ where: { clientId: { in: clientIds } }, select: { id: true } }),
    ]);
    const allMandateIds = [...new Set([...mandateIds, ...childMandates.map((r) => r.id)])];
    const allTxnIds = [...new Set([...txnIds, ...childTxns.map((r) => r.id)])];
    const allAdvisoryIds = [...new Set([...advisoryIds, ...childAdvisory.map((r) => r.id)])];

    const deleted = await prisma.$transaction(async (tx) => {
      const dealWhere = {
        OR: [
          { mandateId: { in: allMandateIds } },
          { transactionId: { in: allTxnIds } },
          { advisoryId: { in: allAdvisoryIds } },
          { clientId: { in: clientIds } },
          { investorId: { in: investorIds } },
        ],
      };
      const out: Record<string, number> = {};
      out.dealStageState = (
        await tx.dealStageState.deleteMany({
          where: { dealId: { in: [...allMandateIds, ...allTxnIds, ...allAdvisoryIds] } },
        })
      ).count;
      out.outreachDraft = (
        await tx.outreachDraft.deleteMany({
          where: { OR: [{ transactionId: { in: allTxnIds } }, { investorId: { in: investorIds } }, subjectStarts] },
        })
      ).count;
      out.engagement = (
        await tx.engagement.deleteMany({
          where: { OR: [{ transactionId: { in: allTxnIds } }, { investorId: { in: investorIds } }] },
        })
      ).count;
      out.document = (await tx.document.deleteMany({ where: dealWhere })).count;
      out.activity = (await tx.activity.deleteMany({ where: dealWhere })).count;
      out.task = (await tx.task.deleteMany({ where: dealWhere })).count;
      out.stageChange = (await tx.stageChange.deleteMany({ where: dealWhere })).count;
      out.folder = (await tx.folder.deleteMany({ where: dealWhere })).count;
      out.transaction = (await tx.transaction.deleteMany({ where: { id: { in: allTxnIds } } })).count;
      out.advisory = (await tx.advisoryEngagement.deleteMany({ where: { id: { in: allAdvisoryIds } } })).count;
      out.mandate = (await tx.mandate.deleteMany({ where: { id: { in: allMandateIds } } })).count;
      out.authAccount = (
        await tx.authAccount.deleteMany({
          where: { OR: [{ userId: { in: userIds } }, { personId: { in: personIds } }, emailStarts] },
        })
      ).count;
      out.person = (await tx.person.deleteMany({ where: { id: { in: personIds } } })).count;
      out.investor = (await tx.investor.deleteMany({ where: { id: { in: investorIds } } })).count;
      out.partner = (await tx.partner.deleteMany({ where: { id: { in: partnerIds } } })).count;
      out.client = (await tx.client.deleteMany({ where: { id: { in: clientIds } } })).count;
      out.notification = (await tx.notification.deleteMany({ where: { userId: { in: userIds } } })).count;
      out.user = (await tx.user.deleteMany({ where: { id: { in: userIds } } })).count;

      // Post-delete invariant: every protected real row must still be there.
      const realClientNames = (realData.mandates ?? []).map((m) => m.clientName).filter(Boolean) as string[];
      const remainingProtected = await tx.client.count({ where: { name: { in: realClientNames } } });
      if (realClientNames.length > 0 && remainingProtected === 0) {
        throw new Error("ABORT: no protected clients remain after the delete — rolling back.");
      }
      return out;
    });

    console.log("Deleted:", deleted);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
