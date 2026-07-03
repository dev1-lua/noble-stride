/**
 * Import the client's real mandate/task data (prisma/real-data.json, produced
 * by scripts/parse-real-data.py) into the dev database.
 *
 * Idempotent wipe-and-reload for the entities this script owns:
 *   - Tasks: all deleted, re-inserted from the tracker.
 *   - Mandates: transaction-linked mandates are KEPT (they power the
 *     engagement-pipeline demo) and updated with real NDA/EA fields when a
 *     real row matches; all other mandates are deleted and re-inserted from
 *     the real tracker.
 *   - Clients/Investors/Persons/Partners/Transactions/Engagements: untouched
 *     (except minimal Client creation for imported mandate rows).
 *   - Documents: NDA / Engagement Contract docs derived from signed dates;
 *     existing docs (incl. the 5 seeded ones) kept, dedup by name.
 *
 * Volume control: only rows whose latest date >= IMPORT_SINCE (env, default
 * 2026-03-01) become new mandates — the client's tracker has ~500 rows since
 * 2025-01-01, which would drown the demo board. Non-recent rows whose client
 * already exists in the CRM are imported regardless (they're demo-relevant).
 * Run with IMPORT_SINCE=2025-01-01 to load everything flagged `recent`.
 *
 * Run: npx tsx scripts/import-real-data.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PrismaClient,
  Prisma,
  MandateStage,
  DocStatus,
  TaskStatus,
  ActorSource,
} from "@prisma/client";

const prisma = new PrismaClient();

const IMPORT_SINCE = process.env.IMPORT_SINCE ?? "2026-03-01";

interface RealMandate {
  clientName: string;
  date: string | null;
  ndaSentDate: string | null;
  ndaSignedDate: string | null;
  eaSentDate: string | null;
  eaSignedDate: string | null;
  ndaStatus: "NotSent" | "Sent" | "Signed";
  eaStatus: "NotSent" | "Sent" | "Signed";
  stage: "NewLead" | "Qualification" | "Proposal" | "Negotiation" | "Signed";
  leadName: string | null;
  sourceReferee: string | null;
  dealInfo: string | null;
  recent: boolean;
}

interface RealTask {
  project: string | null;
  actionPoint: string;
  status: "NotStarted" | "Pending" | "Ongoing" | "Done";
  deadline: string | null;
  ownerName: string | null;
  assistName: string | null;
  notes: string | null;
}

const norm = (s: string) => s.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
const toDate = (s: string | null) => (s ? new Date(`${s}T00:00:00.000Z`) : null);

/** casefold containment either direction, with a length guard so tiny
 * fragments ("Case") don't swallow unrelated names. */
function fuzzyEq(a: string, b: string): boolean {
  const na = norm(a);
  const nb = norm(b);
  if (na === nb) return true;
  const [short, long] = na.length <= nb.length ? [na, nb] : [nb, na];
  return short.length >= 4 && long.includes(short);
}

function findFuzzy<T extends { name: string }>(name: string, pool: T[]): T | undefined {
  const n = norm(name);
  return pool.find((p) => norm(p.name) === n) ?? pool.find((p) => fuzzyEq(name, p.name));
}

/** "Ken W" / "Brenda/Cliff" / "Evans M" -> user whose name starts with the
 * first name token (case-insensitive). */
function matchUser(
  name: string | null,
  users: { id: string; name: string }[]
): { id: string; name: string } | undefined {
  if (!name) return undefined;
  const first = name.split(/[/,]/)[0].trim().split(/\s+/)[0];
  if (!first) return undefined;
  const f = first.toLowerCase();
  return users.find((u) => u.name.toLowerCase().startsWith(f));
}

async function main() {
  const dataPath = join(__dirname, "..", "prisma", "real-data.json");
  const { mandates: realMandates, tasks: realTasks } = JSON.parse(
    readFileSync(dataPath, "utf8")
  ) as { mandates: RealMandate[]; tasks: RealTask[] };

  const users = await prisma.user.findMany({ select: { id: true, name: true } });
  const clients = await prisma.client.findMany({ select: { id: true, name: true } });
  const investors = await prisma.investor.findMany({ select: { id: true, name: true } });

  const summary = {
    tasksDeleted: 0,
    mandatesDeleted: 0,
    mandatesKeptUpdated: 0,
    mandatesKeptUnmatched: 0,
    mandatesInserted: 0,
    clientsCreated: 0,
    tasksInserted: 0,
    docsCreated: 0,
    docsSkippedExisting: 0,
    rowsSkippedOld: 0,
    rowsSkippedBeforeCutoff: 0,
  };
  const unmatchedLeads = new Map<string, number>();
  const unlinkedTaskProjects = new Map<string, number>();
  const unmatchedOwners = new Map<string, number>();

  // ── 1. Wipe tasks ──────────────────────────────────────────────────────
  summary.tasksDeleted = (await prisma.task.deleteMany({})).count;

  // ── 2. Keep + update transaction-linked mandates ───────────────────────
  const txLinked = await prisma.mandate.findMany({
    where: { transactions: { some: {} } },
    select: { id: true, client: { select: { name: true } } },
  });
  const consumed = new Set<RealMandate>();
  for (const m of txLinked) {
    const row = realMandates.find((r) => fuzzyEq(r.clientName, m.client.name));
    if (row) {
      consumed.add(row);
      await prisma.mandate.update({
        where: { id: m.id },
        data: {
          ndaStatus: row.ndaStatus as DocStatus,
          ndaSentDate: toDate(row.ndaSentDate),
          ndaSignedDate: toDate(row.ndaSignedDate),
          eaStatus: row.eaStatus as DocStatus,
          eaSentDate: toDate(row.eaSentDate),
          eaSignedDate: toDate(row.eaSignedDate),
          // stage stays as-is: it drives the transaction/engagement demo
        },
      });
      summary.mandatesKeptUpdated++;
    } else {
      summary.mandatesKeptUnmatched++;
    }
  }

  // ── 3. Delete every other mandate ──────────────────────────────────────
  summary.mandatesDeleted = (
    await prisma.mandate.deleteMany({ where: { id: { notIn: txLinked.map((m) => m.id) } } })
  ).count;

  // ── 4. Insert real mandates (creating minimal clients as needed) ───────
  for (const row of realMandates) {
    if (consumed.has(row)) continue;

    const latest = [row.date, row.ndaSentDate, row.ndaSignedDate, row.eaSentDate, row.eaSignedDate]
      .filter((d): d is string => !!d)
      .sort()
      .pop();
    let client = findFuzzy(row.clientName, clients);

    if (!row.recent) {
      // Old rows only come in when the client already exists in the CRM.
      if (!client) {
        summary.rowsSkippedOld++;
        continue;
      }
    } else if (!client && (!latest || latest < IMPORT_SINCE)) {
      summary.rowsSkippedBeforeCutoff++;
      continue;
    }

    if (!client) {
      client = await prisma.client.create({
        data: { name: row.clientName, createdSource: ActorSource.IMPORT },
        select: { id: true, name: true },
      });
      clients.push(client);
      summary.clientsCreated++;
    }

    const lead = matchUser(row.leadName, users);
    if (row.leadName && !lead) {
      unmatchedLeads.set(row.leadName, (unmatchedLeads.get(row.leadName) ?? 0) + 1);
    }
    const notes = [row.sourceReferee, row.dealInfo].filter(Boolean).join(" — ") || null;

    await prisma.mandate.create({
      data: {
        name: `${row.clientName} – Advisory Mandate`,
        stage: row.stage as MandateStage,
        stageEnteredAt: toDate(latest ?? null) ?? new Date(),
        dealSize: null,
        dateOpened: toDate(row.date),
        ndaStatus: row.ndaStatus as DocStatus,
        ndaSentDate: toDate(row.ndaSentDate),
        ndaSignedDate: toDate(row.ndaSignedDate),
        eaStatus: row.eaStatus as DocStatus,
        eaSentDate: toDate(row.eaSentDate),
        eaSignedDate: toDate(row.eaSignedDate),
        source: row.sourceReferee ? "Referral" : null,
        notes,
        createdSource: ActorSource.IMPORT,
        clientId: client.id,
        leadId: lead?.id ?? null,
      },
    });
    summary.mandatesInserted++;
  }

  // ── 5. Insert tasks ─────────────────────────────────────────────────────
  const mandatePool = await prisma.mandate.findMany({ select: { id: true, name: true } });
  const taskRows: Prisma.TaskCreateManyInput[] = [];
  for (const t of realTasks) {
    const assignee = matchUser(t.ownerName, users);
    if (t.ownerName && !assignee) {
      unmatchedOwners.set(t.ownerName, (unmatchedOwners.get(t.ownerName) ?? 0) + 1);
    }
    let clientId: string | undefined;
    let investorId: string | undefined;
    let mandateId: string | undefined;
    if (t.project) {
      const firstSegment = t.project.split(",")[0].trim();
      if (firstSegment) {
        const c = findFuzzy(firstSegment, clients);
        if (c) clientId = c.id;
        else {
          const inv = findFuzzy(firstSegment, investors);
          if (inv) investorId = inv.id;
          else {
            const man = findFuzzy(firstSegment, mandatePool);
            if (man) mandateId = man.id;
            else unlinkedTaskProjects.set(firstSegment, (unlinkedTaskProjects.get(firstSegment) ?? 0) + 1);
          }
        }
      }
    }
    taskRows.push({
      title: t.actionPoint,
      status: t.status as TaskStatus,
      dueAt: toDate(t.deadline),
      body: t.notes,
      assigneeId: assignee?.id ?? null,
      clientId,
      investorId,
      mandateId,
    });
  }
  summary.tasksInserted = (await prisma.task.createMany({ data: taskRows })).count;

  // ── 6. Documents from signed NDA / EA dates ─────────────────────────────
  const signed = await prisma.mandate.findMany({
    where: { OR: [{ ndaSignedDate: { not: null } }, { eaSignedDate: { not: null } }] },
    select: {
      ndaSignedDate: true,
      eaSignedDate: true,
      client: { select: { id: true, name: true } },
    },
  });
  const existingDocNames = new Set(
    (await prisma.document.findMany({ select: { name: true } })).map((d) => d.name)
  );
  const docRows: Prisma.DocumentCreateManyInput[] = [];
  for (const m of signed) {
    const candidates: Array<{ name: string; type: "NDA" | "EngagementContract"; at: Date }> = [];
    if (m.ndaSignedDate) {
      candidates.push({ name: `NDA — ${m.client.name}`, type: "NDA", at: m.ndaSignedDate });
    }
    if (m.eaSignedDate) {
      candidates.push({
        name: `Engagement Contract — ${m.client.name}`,
        type: "EngagementContract",
        at: m.eaSignedDate,
      });
    }
    for (const c of candidates) {
      if (existingDocNames.has(c.name)) {
        summary.docsSkippedExisting++;
        continue;
      }
      existingDocNames.add(c.name);
      docRows.push({
        name: c.name,
        type: c.type,
        accessLevel: "Internal",
        status: "Executed",
        uploadedAt: c.at,
        clientId: m.client.id,
        createdSource: ActorSource.IMPORT,
      });
    }
  }
  summary.docsCreated = (await prisma.document.createMany({ data: docRows })).count;

  // ── Summary ──────────────────────────────────────────────────────────────
  const stageDist = await prisma.mandate.groupBy({ by: ["stage"], _count: true });
  const statusDist = await prisma.task.groupBy({ by: ["status"], _count: true });
  const docCount = await prisma.document.count();
  const clientCount = await prisma.client.count();

  console.log(`\nImport summary (IMPORT_SINCE=${IMPORT_SINCE})`);
  console.table(summary);
  console.log("Mandates by stage:");
  console.table(stageDist.map((s) => ({ stage: s.stage, count: s._count })));
  console.log("Tasks by status:");
  console.table(statusDist.map((s) => ({ status: s.status, count: s._count })));
  console.log(`Documents total: ${docCount}   Clients total: ${clientCount}`);
  if (unmatchedLeads.size) {
    console.log(
      "Mandate leads with no matching user (left null):",
      [...unmatchedLeads.entries()].map(([k, v]) => `${k} x${v}`).join(", ")
    );
  }
  if (unmatchedOwners.size) {
    console.log(
      "Task owners with no matching user:",
      [...unmatchedOwners.entries()].map(([k, v]) => `${k} x${v}`).join(", ")
    );
  }
  if (unlinkedTaskProjects.size) {
    const list = [...unlinkedTaskProjects.entries()];
    console.log(
      `Task projects left unlinked (${list.reduce((a, [, v]) => a + v, 0)} tasks, ${list.length} names) — first 25:`,
      list.slice(0, 25).map(([k, v]) => `${k} x${v}`).join(", ")
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
