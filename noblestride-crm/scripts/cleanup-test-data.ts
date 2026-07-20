/**
 * scripts/cleanup-test-data.ts
 *
 * SAFETY-CRITICAL. Read this whole comment before running anything.
 *
 * WHAT THIS DOES
 * The prod DB has (a) the client's REAL data, imported from their excel
 * files, and (b) test data a developer typed in while building/testing
 * (wizard test investors, agent test writes, demo "plant" script rows).
 * `createdSource` cannot tell these apart — see the doc comment at the top
 * of `scripts/lib/test-data-guard.ts` for why. The only trustworthy ground
 * truth for "real" is `prisma/real-data.json`. This script is ALLOW-LIST
 * driven: it protects everything matching real-data.json (by normalized
 * name/email) plus every `@noblestride.capital` account, and only ever
 * proposes deleting rows that match nothing protected.
 *
 * GUARANTEE
 * The real excel-derived data is hard-checked TWICE, and BOTH checks run on
 * data re-read from inside the transaction — never on the pre-prompt preview
 * fetch. Once as a fresh re-classification of every candidate list right
 * before its delete statement runs, and once again as a fresh protected-row-
 * count invariant right before commit. Every id set the deletes actually use
 * is likewise recomputed from that same fresh, in-transaction read. This
 * makes both checks immune to anything that changes the DB between the
 * preview and the typed confirmation (a row renamed to a real client name, a
 * fresh real-data import landing mid-prompt, etc.) — if either check finds a
 * protected row would be lost, or would have been lost, for ANY reason,
 * including an FK cascade you didn't anticipate or the DB simply having
 * changed since the preview, the whole transaction throws and rolls back.
 * Nothing is left half-deleted. If this script has a bug, the failure mode is
 * "deletes nothing and prints an error", never "deletes something it
 * shouldn't".
 *
 * USAGE (run from noblestride-crm/)
 *   npx tsx scripts/cleanup-test-data.ts                 # dry run (DEFAULT)
 *   npx tsx scripts/cleanup-test-data.ts --execute        # actually delete
 *
 * With no flags, this is a DRY RUN: it connects read-only, prints the full
 * deletion preview (every candidate row, the protected-count table, and
 * what's being deliberately left alone), and exits WITHOUT writing anything.
 *
 * `--execute` runs the same preview, then requires an interactive prompt —
 * you must type exactly:
 *
 *     DELETE TEST DATA
 *
 * Anything else (including Ctrl-C, empty input, or a non-TTY stdin, e.g.
 * piping this into a CI job) aborts with nothing deleted. There is no
 * `--yes` / `--force` flag and none should be added — a human must read the
 * preview and type the phrase.
 *
 * BEFORE YOU RUN --execute FOR REAL: take a DB snapshot/backup first. This
 * script is defensive, not a substitute for a restore point.
 *
 * KNOWN RESIDUAL RISK (read this): `scripts/import-real-data.ts` uses fuzzy
 * (substring-containment) client-name matching when linking a real tracker
 * row to an existing Client, so a persisted `Client.name` can in principle
 * differ from the literal string in `real-data.json`'s `mandates[].clientName`.
 * This script's protection check is intentionally the simpler, spec'd exact
 * (normalized) match — see requirement 5. The preview below lists every
 * candidate Client/Mandate by name specifically so a human can eyeball it
 * for anything that looks real before typing the confirmation phrase.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as readline from "node:readline/promises";
import { PrismaClient, Prisma } from "@prisma/client";
import {
  buildProtectedSets,
  partitionRows,
  assertNoneProtected,
  isProtected,
  ProtectedDataError,
  type RealData,
  type CandidateKind,
} from "./lib/test-data-guard";

const CONFIRM_PHRASE = "DELETE TEST DATA";

// ─────────────────────────────────────────────────────────────────────────────
// Connection guard (behavioral spec §7)
// ─────────────────────────────────────────────────────────────────────────────

const dbUrl = process.env.DATABASE_URL_UNPOOLED;
if (!dbUrl) {
  console.error(
    "Refusing to start: DATABASE_URL_UNPOOLED is not set. This script must be pointed at the prod direct connection explicitly — it will not fall back to DATABASE_URL."
  );
  process.exit(1);
}

function hostOnly(url: string): string {
  try {
    const u = new URL(url);
    return u.host || "(unknown host)";
  } catch {
    return "(unparseable DATABASE_URL_UNPOOLED)";
  }
}

const targetHost = hostOnly(dbUrl);

const prisma = new PrismaClient({
  datasources: { db: { url: dbUrl } },
});

// ─────────────────────────────────────────────────────────────────────────────
// Minimal row projections
// ─────────────────────────────────────────────────────────────────────────────

type Db = PrismaClient | Prisma.TransactionClient;

interface NamedProjection {
  id: string;
  name: string;
  email?: string | null;
  createdAt: Date;
  createdSource?: string | null;
}

interface MandateProjection {
  id: string;
  name: string;
  clientId: string;
  createdAt: Date;
  createdSource: string;
  client: { name: string };
}

interface UserProjection {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

interface PersonProjection {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  investorId: string | null;
  clientId: string | null;
  partnerId: string | null;
  createdAt: Date;
}

async function fetchProjections(db: Db) {
  const [investors, clients, partners, serviceProviders, mandates, users, persons] = await Promise.all([
    db.investor.findMany({ select: { id: true, name: true, createdAt: true, createdSource: true } }),
    db.client.findMany({ select: { id: true, name: true, createdAt: true, createdSource: true } }),
    db.partner.findMany({ select: { id: true, name: true, createdAt: true, createdSource: true } }),
    db.serviceProvider.findMany({
      select: { id: true, name: true, email: true, createdAt: true, createdSource: true },
    }),
    db.mandate.findMany({
      select: {
        id: true,
        name: true,
        clientId: true,
        createdAt: true,
        createdSource: true,
        client: { select: { name: true } },
      },
    }),
    db.user.findMany({ select: { id: true, name: true, email: true, createdAt: true } }),
    db.person.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        investorId: true,
        clientId: true,
        partnerId: true,
        createdAt: true,
      },
    }),
  ]);
  return { investors, clients, partners, serviceProviders, mandates, users, persons } as {
    investors: NamedProjection[];
    clients: NamedProjection[];
    partners: NamedProjection[];
    serviceProviders: NamedProjection[];
    mandates: MandateProjection[];
    users: UserProjection[];
    persons: PersonProjection[];
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Classification (behavioral spec §4 — scope of deletion)
// ─────────────────────────────────────────────────────────────────────────────

type ProtectedSets = ReturnType<typeof buildProtectedSets>;

function classify(sets: ProtectedSets, proj: Awaited<ReturnType<typeof fetchProjections>>) {
  const investorP = partitionRows("investor", proj.investors, sets);
  const clientP = partitionRows("client", proj.clients, sets);
  const partnerP = partitionRows("partner", proj.partners, sets);
  const spP = partitionRows("serviceProvider", proj.serviceProviders, sets);

  const mandateRows = proj.mandates.map((m) => ({ ...m, clientName: m.client.name }));
  const mandateP = partitionRows("mandate", mandateRows, sets);

  const userP = partitionRows("user", proj.users, sets);

  const candidateInvestorIds = new Set(investorP.candidates.map((r) => r.id));
  const candidateClientIds = new Set(clientP.candidates.map((r) => r.id));
  const candidatePartnerIds = new Set(partnerP.candidates.map((r) => r.id));

  // Person: NOT protected by contact identity, AND linked to a candidate
  // parent (spec §4 bullet 4) — an unlinked person, or one linked only to a
  // *protected* investor/client/partner, is never a candidate.
  const personCandidates: PersonProjection[] = [];
  const personProtected: PersonProjection[] = [];
  for (const p of proj.persons) {
    const structural =
      (!!p.investorId && candidateInvestorIds.has(p.investorId)) ||
      (!!p.clientId && candidateClientIds.has(p.clientId)) ||
      (!!p.partnerId && candidatePartnerIds.has(p.partnerId));
    if (!structural || isProtected("person", p, sets)) personProtected.push(p);
    else personCandidates.push(p);
  }

  return {
    investorP,
    clientP,
    partnerP,
    spP,
    mandateP,
    userP,
    personCandidates,
    personProtected,
    candidateInvestorIds,
    candidateClientIds,
    candidatePartnerIds,
    candidateMandateIds: new Set(mandateP.candidates.map((r) => r.id)),
    candidateServiceProviderIds: new Set(spP.candidates.map((r) => r.id)),
    candidateUserIds: new Set(userP.candidates.map((r) => r.id)),
    candidatePersonIds: new Set(personCandidates.map((r) => r.id)),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Preview (behavioral spec §6)
// ─────────────────────────────────────────────────────────────────────────────

function fmtRow(r: {
  id: string;
  name?: string;
  email?: string | null;
  createdAt: Date;
  createdSource?: string | null;
}): string {
  const label = r.name ?? r.email ?? "(no name)";
  const src = r.createdSource != null ? ` source=${r.createdSource}` : "";
  return `    - ${r.id}  "${label}"  createdAt=${r.createdAt.toISOString()}${src}`;
}

function printSection<T extends { id: string }>(title: string, rows: T[], fmt: (r: T) => string) {
  console.log(`\n${title} — ${rows.length} candidate(s) for deletion`);
  for (const r of rows) console.log(fmt(r));
}

function printPreview(
  cls: ReturnType<typeof classify>,
  extra: {
    transactions: NamedProjection[];
    advisoryEngagements: NamedProjection[];
    engagementCount: number;
    taskCandidates: Array<{ id: string; title: string; createdAt: Date; createdSource: string }>;
    standaloneTaskCount: number;
  }
) {
  console.log("=".repeat(78));
  console.log("CLEANUP-TEST-DATA — DELETION PREVIEW");
  console.log(`Target DB host: ${targetHost}`);
  console.log("=".repeat(78));

  printSection("Investors", cls.investorP.candidates, fmtRow);
  printSection("Clients", cls.clientP.candidates, fmtRow);
  printSection("Partners", cls.partnerP.candidates, fmtRow);
  printSection("Service Providers", cls.spP.candidates, fmtRow);
  printSection(
    "Mandates",
    cls.mandateP.candidates,
    (r: MandateProjection & { clientName: string }) =>
      `    - ${r.id}  "${r.name}" (client: ${r.clientName})  createdAt=${r.createdAt.toISOString()} source=${r.createdSource}`
  );
  printSection(
    "Users",
    cls.userP.candidates,
    (r: UserProjection) => `    - ${r.id}  ${r.name} <${r.email}>  createdAt=${r.createdAt.toISOString()}`
  );
  printSection(
    "Persons (contacts)",
    cls.personCandidates,
    (r: PersonProjection) =>
      `    - ${r.id}  ${r.firstName} ${r.lastName ?? ""} <${r.email ?? "no email"}>  createdAt=${r.createdAt.toISOString()}`
  );
  printSection(
    "Transactions (child of candidate Client)",
    extra.transactions,
    (r: NamedProjection) => `    - ${r.id}  "${r.name}"  createdAt=${r.createdAt.toISOString()} source=${r.createdSource}`
  );
  printSection(
    "Advisory Engagements (child of candidate Client)",
    extra.advisoryEngagements,
    (r: NamedProjection) => `    - ${r.id}  "${r.name}"  createdAt=${r.createdAt.toISOString()} source=${r.createdSource}`
  );
  console.log(
    `\nEngagements (child of candidate Investor/Transaction) — ${extra.engagementCount} candidate(s) for deletion`
  );
  printSection(
    "Tasks (attached to a candidate parent — see below for what's kept)",
    extra.taskCandidates,
    (r: { id: string; title: string; createdAt: Date; createdSource: string }) =>
      `    - ${r.id}  "${r.title}"  createdAt=${r.createdAt.toISOString()} source=${r.createdSource}`
  );

  console.log("\n" + "-".repeat(78));
  console.log("PROTECTED-COUNT TABLE (must never decrease)");
  console.log("-".repeat(78));
  const table: Array<[string, number, number]> = [
    ["Investor", cls.investorP.protected.length, cls.investorP.candidates.length],
    ["Client", cls.clientP.protected.length, cls.clientP.candidates.length],
    ["Partner", cls.partnerP.protected.length, cls.partnerP.candidates.length],
    ["ServiceProvider", cls.spP.protected.length, cls.spP.candidates.length],
    ["Mandate", cls.mandateP.protected.length, cls.mandateP.candidates.length],
    ["User", cls.userP.protected.length, cls.userP.candidates.length],
    ["Person", cls.personProtected.length, cls.personCandidates.length],
  ];
  for (const [name, protectedCount, candidateCount] of table) {
    console.log(`  ${name.padEnd(16)} protected=${protectedCount}  candidates=${candidateCount}`);
  }

  console.log("\n" + "-".repeat(78));
  console.log("DELIBERATELY LEFT UNTOUCHED");
  console.log("-".repeat(78));
  console.log(
    `  Standalone Tasks (no mandate/investor/client/transaction/advisory parent, or parent is protected): ${extra.standaloneTaskCount} — NEVER deleted regardless of provenance (see spec §4).`
  );
  console.log("=".repeat(78));
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const execute = process.argv.includes("--execute");

  const dataPath = join(__dirname, "..", "prisma", "real-data.json");
  const realData = JSON.parse(readFileSync(dataPath, "utf8")) as RealData;
  const sets = buildProtectedSets(realData);

  const proj = await fetchProjections(prisma);
  const cls = classify(sets, proj);

  const candidateTransactionIdsPromise = prisma.transaction.findMany({
    where: { clientId: { in: [...cls.candidateClientIds] } },
    select: { id: true, name: true, createdAt: true, createdSource: true },
  });
  const candidateAdvisoryIdsPromise = prisma.advisoryEngagement.findMany({
    where: { clientId: { in: [...cls.candidateClientIds] } },
    select: { id: true, name: true, createdAt: true, createdSource: true },
  });
  const [transactions, advisoryEngagements] = await Promise.all([
    candidateTransactionIdsPromise,
    candidateAdvisoryIdsPromise,
  ]);
  const candidateTransactionIds = new Set(transactions.map((t) => t.id));
  const candidateAdvisoryIds = new Set(advisoryEngagements.map((a) => a.id));

  const engagementCount = await prisma.engagement.count({
    where: {
      OR: [
        { transactionId: { in: [...candidateTransactionIds] } },
        { investorId: { in: [...cls.candidateInvestorIds] } },
      ],
    },
  });

  const taskWhere = {
    OR: [
      { mandateId: { in: [...cls.candidateMandateIds] } },
      { investorId: { in: [...cls.candidateInvestorIds] } },
      { clientId: { in: [...cls.candidateClientIds] } },
      { transactionId: { in: [...candidateTransactionIds] } },
      { advisoryId: { in: [...candidateAdvisoryIds] } },
    ],
  } satisfies Prisma.TaskWhereInput;
  const [taskCandidates, totalTaskCount] = await Promise.all([
    prisma.task.findMany({
      where: taskWhere,
      select: { id: true, title: true, createdAt: true, createdSource: true },
    }),
    prisma.task.count(),
  ]);
  const standaloneTaskCount = totalTaskCount - taskCandidates.length;

  printPreview(cls, {
    transactions,
    advisoryEngagements,
    engagementCount,
    taskCandidates,
    standaloneTaskCount,
  });

  if (!execute) {
    console.log("\nDRY RUN — nothing deleted. Re-run with --execute to proceed to the confirmation prompt.");
    return;
  }

  if (!process.stdin.isTTY) {
    console.error(
      "\nRefusing to proceed: stdin is not a TTY. --execute requires an interactive typed confirmation — no non-interactive deletes."
    );
    process.exitCode = 1;
    return;
  }

  console.log(`\nTarget DB host: ${targetHost}`);
  console.log(`Type exactly "${CONFIRM_PHRASE}" to permanently delete the candidates listed above.`);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  let typed: string;
  try {
    typed = await rl.question("> ");
  } finally {
    rl.close();
  }
  if (typed !== CONFIRM_PHRASE) {
    console.log("\nConfirmation phrase did not match — aborting. Nothing deleted.");
    return;
  }

  // Hard checks #1 and #2 (spec §2, §3) both run from INSIDE the transaction
  // below, on data re-fetched at that point — never on `cls`, which is the
  // pre-prompt preview snapshot and may be stale by the time the human
  // finishes typing the confirmation phrase. `cls`'s candidate id sets are
  // still passed in (captured by closure) as the "what did the preview
  // propose" reference the in-transaction check uses to detect a row that
  // became protected between the preview and the confirmation.

  try {
    await prisma.$transaction(
      async (tx) => {
        // ── TOCTOU guard ─────────────────────────────────────────────────
        // Re-fetch and re-classify from inside the transaction. Nothing
        // computed before this point (`cls`, `candidateTransactionIds`,
        // `candidateAdvisoryIds`) is used for a delete below — only to
        // detect a state change (see the check right after this fetch). A
        // row renamed to a real client name, or freshly imported as real,
        // between the preview and the typed confirmation can therefore never
        // be deleted by a now-stale id.
        const freshProj = await fetchProjections(tx);
        const freshCls = classify(sets, freshProj);

        // If anything the preview proposed for deletion is now protected,
        // the DB changed under us in a protection-relevant way since the
        // preview was printed — abort and make the human re-run for a fresh
        // preview rather than silently deleting (or silently not deleting)
        // around the change. A candidate that simply disappeared since the
        // preview is fine — there's nothing to delete for it either way.
        const staleToProtectedChecks: Array<[CandidateKind, Set<string>, Array<{ id: string }>]> = [
          ["investor", cls.candidateInvestorIds, freshCls.investorP.protected],
          ["client", cls.candidateClientIds, freshCls.clientP.protected],
          ["partner", cls.candidatePartnerIds, freshCls.partnerP.protected],
          ["serviceProvider", cls.candidateServiceProviderIds, freshCls.spP.protected],
          ["mandate", cls.candidateMandateIds, freshCls.mandateP.protected],
          ["user", cls.candidateUserIds, freshCls.userP.protected],
          ["person", cls.candidatePersonIds, freshCls.personProtected],
        ];
        for (const [kind, originalCandidateIds, freshProtectedRows] of staleToProtectedChecks) {
          const nowProtected = freshProtectedRows.filter((r) => originalCandidateIds.has(r.id));
          if (nowProtected.length > 0) {
            throw new ProtectedDataError(
              `Refusing to delete: ${nowProtected.length} "${kind}" row(s) from the deletion preview are now protected — the database changed since the preview was printed (e.g. a rename to a real client name, or a fresh real-data import). Rolling back — nothing deleted. Re-run the script to get a fresh preview.`,
              kind,
              nowProtected
            );
          }
        }

        // Hard check #1 (spec §2), now against data fetched inside this
        // transaction: re-verify every candidate list right before it is
        // used for a delete. Throws (does not skip) on any match. This is
        // the literal "rows freshly re-fetched inside the same transaction"
        // the doc comment on `assertNoneProtected` promises.
        const freshKindChecks: Array<[CandidateKind, unknown[]]> = [
          ["investor", freshCls.investorP.candidates],
          ["client", freshCls.clientP.candidates],
          ["partner", freshCls.partnerP.candidates],
          ["serviceProvider", freshCls.spP.candidates],
          ["mandate", freshCls.mandateP.candidates],
          ["user", freshCls.userP.candidates],
          ["person", freshCls.personCandidates],
        ];
        for (const [kind, rows] of freshKindChecks) {
          assertNoneProtected(kind as any, rows as any, sets);
        }

        // Hard check #2 (spec §3) baseline: snapshot protected counts from
        // THIS fresh, in-transaction classification (not the pre-prompt
        // `cls`) — the post-delete recount below must compare against the
        // state the deletes below actually ran on.
        const snapshotProtectedCounts = {
          investor: freshCls.investorP.protected.length,
          client: freshCls.clientP.protected.length,
          partner: freshCls.partnerP.protected.length,
          serviceProvider: freshCls.spP.protected.length,
          mandate: freshCls.mandateP.protected.length,
          user: freshCls.userP.protected.length,
          person: freshCls.personProtected.length,
        };

        const investorIds = [...freshCls.candidateInvestorIds];
        const clientIds = [...freshCls.candidateClientIds];
        const partnerIds = [...freshCls.candidatePartnerIds];
        const serviceProviderIds = [...freshCls.candidateServiceProviderIds];
        const mandateIds = [...freshCls.candidateMandateIds];
        const userIds = [...freshCls.candidateUserIds];
        const personIds = [...freshCls.candidatePersonIds];

        // Transaction/AdvisoryEngagement have no protected-identifier set of
        // their own — they're protected only transitively, via their
        // Client — so re-derive their candidate ids from the FRESH candidate
        // Client ids, using the same where-clauses as the pre-transaction
        // preview, instead of trusting `candidateTransactionIds`/
        // `candidateAdvisoryIds` computed before the prompt.
        const [freshTransactions, freshAdvisoryEngagements] = await Promise.all([
          tx.transaction.findMany({ where: { clientId: { in: clientIds } }, select: { id: true } }),
          tx.advisoryEngagement.findMany({ where: { clientId: { in: clientIds } }, select: { id: true } }),
        ]);
        const transactionIds = freshTransactions.map((t) => t.id);
        const advisoryIds = freshAdvisoryEngagements.map((a) => a.id);

        // 1. Auth dependents (User- and Person-linked accounts), child→parent.
        const authAccounts = await tx.authAccount.findMany({
          where: { OR: [{ userId: { in: userIds } }, { personId: { in: personIds } }] },
          select: { id: true },
        });
        const authAccountIds = authAccounts.map((a) => a.id);
        await tx.authOtpChallenge.deleteMany({ where: { accountId: { in: authAccountIds } } });
        await tx.authToken.deleteMany({ where: { accountId: { in: authAccountIds } } });
        await tx.authSession.deleteMany({ where: { accountId: { in: authAccountIds } } });
        await tx.authAccount.deleteMany({ where: { id: { in: authAccountIds } } });

        // 2. Portal web-chat OTP challenges tied to a candidate Client/Person.
        await tx.clientOtpChallenge.deleteMany({
          where: { OR: [{ clientId: { in: clientIds } }, { personId: { in: personIds } }] },
        });

        // 3. Notifications tied to a candidate User/Investor (cascades anyway;
        // explicit for an auditable per-model count).
        await tx.notification.deleteMany({
          where: { OR: [{ userId: { in: userIds } }, { investorId: { in: investorIds } }] },
        });

        // 4. Tasks attached to a candidate parent ONLY. A task with every
        // parent FK null (or every parent FK pointing at a PROTECTED row)
        // matches none of these `in` clauses and is structurally untouchable
        // here — that is how "standalone tasks are never deleted" is enforced.
        await tx.task.deleteMany({
          where: {
            OR: [
              { mandateId: { in: mandateIds } },
              { investorId: { in: investorIds } },
              { clientId: { in: clientIds } },
              { transactionId: { in: transactionIds } },
              { advisoryId: { in: advisoryIds } },
            ],
          },
        });

        // 5. Documents scoped to a candidate parent.
        await tx.document.deleteMany({
          where: {
            OR: [
              { transactionId: { in: transactionIds } },
              { clientId: { in: clientIds } },
              { investorId: { in: investorIds } },
              { mandateId: { in: mandateIds } },
              { advisoryId: { in: advisoryIds } },
              { partnerId: { in: partnerIds } },
            ],
          },
        });

        // 6. Activities scoped to a candidate parent (engagementId-linked
        // activities are handled by the Engagement cascade in step 8).
        await tx.activity.deleteMany({
          where: {
            OR: [
              { transactionId: { in: transactionIds } },
              { investorId: { in: investorIds } },
              { mandateId: { in: mandateIds } },
              { advisoryId: { in: advisoryIds } },
              { clientId: { in: clientIds } },
            ],
          },
        });

        // 7. Folders scoped to a candidate parent (self-referencing children
        // cascade automatically).
        await tx.folder.deleteMany({
          where: {
            OR: [
              { transactionId: { in: transactionIds } },
              { mandateId: { in: mandateIds } },
              { advisoryId: { in: advisoryIds } },
              { clientId: { in: clientIds } },
              { investorId: { in: investorIds } },
            ],
          },
        });

        // 8. Engagements (join rows) — Cascade deletes EngagementMilestone /
        // Activity(engagementId) / StageChange(engagementId) automatically.
        await tx.engagement.deleteMany({
          where: { OR: [{ transactionId: { in: transactionIds } }, { investorId: { in: investorIds } }] },
        });

        // 9. Service providers themselves (implicit M:N to Transaction clears
        // automatically; DueDiligenceTrack.serviceProviderId is SetNull).
        await tx.serviceProvider.deleteMany({ where: { id: { in: serviceProviderIds } } });

        // 10. Transactions (child of candidate Client — Client.transactions is
        // onDelete: Restrict, so this MUST run before deleting the Client).
        await tx.transaction.deleteMany({ where: { id: { in: transactionIds } } });

        // 11. Mandates (name-pattern-or-client candidates).
        await tx.mandate.deleteMany({ where: { id: { in: mandateIds } } });

        // 12. Advisory engagements (child of candidate Client — also Restrict).
        await tx.advisoryEngagement.deleteMany({ where: { id: { in: advisoryIds } } });

        // 13. Persons (contacts) — must precede Client/Investor/Partner so we
        // don't leave orphaned (SetNull'd) contact rows behind.
        await tx.person.deleteMany({ where: { id: { in: personIds } } });

        // 14. Clients — all Restrict-children (transactions/mandates/advisory)
        // above are already gone.
        await tx.client.deleteMany({ where: { id: { in: clientIds } } });

        // 15. Investors.
        await tx.investor.deleteMany({ where: { id: { in: investorIds } } });

        // 16. Partners.
        await tx.partner.deleteMany({ where: { id: { in: partnerIds } } });

        // 17. Users (auth accounts already removed in step 1).
        await tx.user.deleteMany({ where: { id: { in: userIds } } });

        // Hard check #2 (spec §3): recount protected rows the SAME way,
        // inside this transaction, and refuse to commit if any decreased.
        const postProj = await fetchProjections(tx);
        const postCls = classify(sets, postProj);
        const postCounts = {
          investor: postCls.investorP.protected.length,
          client: postCls.clientP.protected.length,
          partner: postCls.partnerP.protected.length,
          serviceProvider: postCls.spP.protected.length,
          mandate: postCls.mandateP.protected.length,
          user: postCls.userP.protected.length,
          person: postCls.personProtected.length,
        };
        const decreased = (Object.keys(snapshotProtectedCounts) as Array<keyof typeof snapshotProtectedCounts>).filter(
          (k) => postCounts[k] < snapshotProtectedCounts[k]
        );
        if (decreased.length > 0) {
          throw new ProtectedDataError(
            `Protected-row count decreased for: ${decreased.join(", ")}. Rolling back — nothing will be deleted.`,
            decreased[0] as CandidateKind,
            []
          );
        }
      },
      { timeout: 120_000 }
    );
  } catch (err) {
    if (err instanceof ProtectedDataError) {
      console.error(`\nROLLED BACK — nothing deleted. Reason: ${err.message}`);
      process.exitCode = 1;
      return;
    }
    throw err;
  }

  console.log("\nDone. Candidates listed above were deleted; every protected row was re-verified intact.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
