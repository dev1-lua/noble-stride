// Global search — case-insensitive "contains" search across the CRM's
// user-facing entities, scoped to what the calling viewer may see.
//
// SECURITY: this is the single seam through which the topbar/command-palette
// reads data. The viewer is derived ONLY from `Actor` (as built by
// `createContext` from the session cookie / Bearer JWT) — callers can never
// pass a client-supplied identity. Two branches:
//   - INVESTOR viewer: reuses `loadInvestorPortalData` (the SAME loader that
//     powers the investor portal's own deal list/detail pages) and matches
//     against its ALREADY-PROJECTED fields. Because the projector
//     (`projectDealForInvestor`) has already masked a PRE_INTEREST deal's
//     name/client identity behind its deal codename before this module ever
//     sees it, an investor can never search their way to a masked client's
//     real name (BUG-01) — the raw name simply isn't in the string this
//     function matches against. Deals/documents the investor has no
//     visibility into (tier NONE — blocked classification, unapproved
//     onboarding, or no engagement/discovery match) are already absent from
//     `loadInvestorPortalData`'s output, so they cannot appear here either.
//   - INTERNAL viewer (or any other authenticated non-investor actor, e.g. a
//     Bearer-token AGENT/API caller — the same read exposure every other
//     list query in this schema already grants such callers): searches the
//     full entity set directly via Prisma, mirroring the `contains` /
//     `mode: "insensitive"` pattern used by the existing list resolvers
//     (see `buildInvestorWhere` in server/domain/filters.ts).
// An unauthenticated actor gets [] — never a DB round-trip.

import { prisma } from "@/lib/db";
import type { Actor } from "@/graphql/context";
import { loadInvestorPortalData } from "@/server/visibility";
import { label } from "@/lib/vocab";

export interface SearchResult {
  id: string;
  type: string;
  title: string;
  subtitle?: string;
  href: string;
}

const DEFAULT_LIMIT = 8;

export async function globalSearch(actor: Actor, query: string, limit = DEFAULT_LIMIT): Promise<SearchResult[]> {
  const q = query.trim();
  if (!q) return [];
  const take = limit > 0 ? limit : DEFAULT_LIMIT;

  // Never trust a client-supplied identity — only ever the actor context.
  if (!actor.authenticated) return [];

  if (actor.accountKind === "INVESTOR") {
    if (!actor.investorId) return [];
    return searchForInvestor(actor.investorId, q, take);
  }

  return searchForInternal(q, take);
}

// ─── Investor-scoped search ───────────────────────────────────────────────────
// Matches ONLY against fields already returned by the visibility projector —
// never against raw Prisma rows — so a masked deal's real client name can
// never surface as a search result or be used to confirm a match.

async function searchForInvestor(investorId: string, query: string, limit: number): Promise<SearchResult[]> {
  const needle = query.toLowerCase();
  const { deals } = await loadInvestorPortalData(prisma, investorId);

  const dealMatches = deals.filter(
    (deal) =>
      deal.name.toLowerCase().includes(needle) ||
      deal.companyProfile.clientName.toLowerCase().includes(needle),
  );
  const dealResults: SearchResult[] = dealMatches.slice(0, limit).map((deal) => ({
    id: deal.id,
    type: "Transaction",
    title: deal.name,
    subtitle: deal.companyProfile.clientName,
    href: `/portal/investor/deals/${deal.id}`,
  }));

  const documentResults: SearchResult[] = [];
  for (const deal of deals) {
    for (const doc of deal.documents) {
      if (doc.name.toLowerCase().includes(needle)) {
        documentResults.push({
          id: doc.id,
          type: "Document",
          title: doc.name,
          subtitle: deal.name,
          href: `/portal/investor/deals/${deal.id}`,
        });
      }
    }
  }

  return [...dealResults, ...documentResults.slice(0, limit)];
}

// ─── Internal (admin) search ──────────────────────────────────────────────────
// Full entity set, unfiltered by visibility (internal roles read everything —
// server/rbac/matrix.ts grants "R" on every RBAC_ENTITY to every OrgRole).
//
// TYPO-TOLERANT MATCHING: rather than a single whole-string `ILIKE '%q%'` (which
// missed a record on ANY typo — e.g. searching "Pharmaceuticals" never found the
// misspelled stored "Phamaceuticals"), candidates are selected by pg_trgm
// similarity + per-word ILIKE, ranked by trigram score. The extension and its
// GIN indexes are provisioned by the 20260721130000_pg_trgm_fuzzy_search
// migration.

function personName(p: { firstName: string; lastName: string | null }): string {
  return [p.firstName, p.lastName ?? ""].join(" ").trim();
}

// Which table/column each entity matches on. Identifiers are static constants —
// never user input — so they are safe to interpolate into SQL. The query text
// and word tokens are always passed as bound parameters ($1, $2…).
const FUZZY = {
  investor: { table: "Investor", expr: '"name"' },
  client: { table: "Client", expr: '"name"' },
  mandate: { table: "Mandate", expr: '"name"' },
  transaction: { table: "Transaction", expr: '"name"' },
  partner: { table: "Partner", expr: '"name"' },
  serviceProvider: { table: "ServiceProvider", expr: '"name"' },
  document: { table: "Document", expr: '"name"' },
  task: { table: "Task", expr: '"title"' },
  person: { table: "Person", expr: `("firstName" || ' ' || COALESCE("lastName", ''))` },
  engagement: { table: "Engagement", expr: '"name"' },
} as const;

// Trigram thresholds. Kept deliberately low so near-misses (one/two typos) still
// surface; ranking by score keeps the best match on top.
const SIM_THRESHOLD = 0.2;
const WORD_SIM_THRESHOLD = 0.35;

/** Split a query into distinct lowercased word tokens worth matching individually. */
function tokenize(query: string): string[] {
  return Array.from(
    new Set(
      query
        .toLowerCase()
        .split(/\s+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 2),
    ),
  );
}

/**
 * Return candidate ids for one entity, scored by trigram similarity and ranked
 * best-first. A row qualifies if the whole query is a substring, OR its trigram
 * similarity clears the threshold, OR any single query word is a substring.
 */
async function fuzzyIds(
  table: string,
  expr: string,
  query: string,
  tokens: string[],
  limit: number,
): Promise<Map<string, number>> {
  const safeLimit = Math.max(1, Math.min(Math.floor(limit), 100));
  // $1 = full query; $2… = individual word tokens.
  const tokenClause = tokens.length
    ? " OR " + tokens.map((_, i) => `${expr} ILIKE ('%' || $${i + 2} || '%')`).join(" OR ")
    : "";
  const sql = `
    SELECT "id", GREATEST(similarity(${expr}, $1), word_similarity($1, ${expr}))::float8 AS score
    FROM "${table}"
    WHERE ${expr} ILIKE ('%' || $1 || '%')
       OR similarity(${expr}, $1) > ${SIM_THRESHOLD}
       OR word_similarity($1, ${expr}) > ${WORD_SIM_THRESHOLD}${tokenClause}
    ORDER BY score DESC
    LIMIT ${safeLimit}
  `;
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; score: number }>>(sql, query, ...tokens);
  return new Map(rows.map((r) => [r.id, Number(r.score)]));
}

async function searchForInternal(query: string, limit: number): Promise<SearchResult[]> {
  const tokens = tokenize(query);
  const [invSc, cliSc, manSc, txSc, partSc, spSc, docSc, taskSc, personSc, engSc] = await Promise.all([
    fuzzyIds(FUZZY.investor.table, FUZZY.investor.expr, query, tokens, limit),
    fuzzyIds(FUZZY.client.table, FUZZY.client.expr, query, tokens, limit),
    fuzzyIds(FUZZY.mandate.table, FUZZY.mandate.expr, query, tokens, limit),
    fuzzyIds(FUZZY.transaction.table, FUZZY.transaction.expr, query, tokens, limit),
    fuzzyIds(FUZZY.partner.table, FUZZY.partner.expr, query, tokens, limit),
    fuzzyIds(FUZZY.serviceProvider.table, FUZZY.serviceProvider.expr, query, tokens, limit),
    fuzzyIds(FUZZY.document.table, FUZZY.document.expr, query, tokens, limit),
    fuzzyIds(FUZZY.task.table, FUZZY.task.expr, query, tokens, limit),
    fuzzyIds(FUZZY.person.table, FUZZY.person.expr, query, tokens, limit),
    fuzzyIds(FUZZY.engagement.table, FUZZY.engagement.expr, query, tokens, limit),
  ]);

  const idsOf = (m: Map<string, number>) => [...m.keys()];
  const byScore = (m: Map<string, number>) => (a: { id: string }, b: { id: string }) =>
    (m.get(b.id) ?? 0) - (m.get(a.id) ?? 0);

  const [investors, clients, mandates, transactions, partners, serviceProviders, documents, tasks, people, engagements] =
    await Promise.all([
      invSc.size ? prisma.investor.findMany({ where: { id: { in: idsOf(invSc) } } }) : [],
      cliSc.size ? prisma.client.findMany({ where: { id: { in: idsOf(cliSc) } } }) : [],
      manSc.size ? prisma.mandate.findMany({ where: { id: { in: idsOf(manSc) } }, include: { client: true } }) : [],
      txSc.size
        ? prisma.transaction.findMany({ where: { id: { in: idsOf(txSc) } }, include: { client: true } })
        : [],
      partSc.size ? prisma.partner.findMany({ where: { id: { in: idsOf(partSc) } } }) : [],
      spSc.size ? prisma.serviceProvider.findMany({ where: { id: { in: idsOf(spSc) } } }) : [],
      docSc.size
        ? prisma.document.findMany({
            where: { id: { in: idsOf(docSc) } },
            include: { transaction: true, client: true, investor: true },
          })
        : [],
      taskSc.size ? prisma.task.findMany({ where: { id: { in: idsOf(taskSc) } } }) : [],
      personSc.size ? prisma.person.findMany({ where: { id: { in: idsOf(personSc) } } }) : [],
      engSc.size
        ? prisma.engagement.findMany({
            where: { id: { in: idsOf(engSc) } },
            include: { investor: true, transaction: true },
          })
        : [],
    ]);

  // Rank each entity's rows by trigram score (findMany does not preserve `in` order).
  investors.sort(byScore(invSc));
  clients.sort(byScore(cliSc));
  mandates.sort(byScore(manSc));
  transactions.sort(byScore(txSc));
  partners.sort(byScore(partSc));
  serviceProviders.sort(byScore(spSc));
  documents.sort(byScore(docSc));
  tasks.sort(byScore(taskSc));
  people.sort(byScore(personSc));
  engagements.sort(byScore(engSc));

  const results: SearchResult[] = [];

  for (const inv of investors) {
    results.push({
      id: inv.id,
      type: "Investor",
      title: inv.name,
      subtitle: label("InvestorType", inv.investorType),
      href: `/investors/${inv.id}`,
    });
  }
  for (const c of clients) {
    results.push({
      id: c.id,
      type: "Client",
      title: c.name,
      subtitle: c.hqCity ?? undefined,
      href: `/clients/${c.id}`,
    });
  }
  for (const m of mandates) {
    results.push({
      id: m.id,
      type: "Mandate",
      title: m.name,
      subtitle: m.client?.name,
      href: `/mandates/${m.id}`,
    });
  }
  for (const t of transactions) {
    results.push({
      id: t.id,
      type: "Transaction",
      title: t.name,
      subtitle: t.client?.name,
      href: `/transactions/${t.id}`,
    });
  }
  for (const p of partners) {
    results.push({
      id: p.id,
      type: "Partner",
      title: p.name,
      subtitle: p.partnerType ? label("PartnerType", p.partnerType) : undefined,
      href: `/partners/${p.id}`,
    });
  }
  for (const sp of serviceProviders) {
    results.push({
      id: sp.id,
      type: "ServiceProvider",
      title: sp.name,
      subtitle: label("ServiceProviderType", sp.type),
      href: "/service-providers",
    });
  }
  for (const d of documents) {
    const href = d.transaction
      ? `/transactions/${d.transaction.id}`
      : d.client
        ? `/clients/${d.client.id}`
        : d.investor
          ? `/investors/${d.investor.id}`
          : "/documents";
    results.push({
      id: d.id,
      type: "Document",
      title: d.name,
      subtitle: label("DocumentType", d.type),
      href,
    });
  }
  for (const task of tasks) {
    results.push({
      id: task.id,
      type: "Task",
      title: task.title,
      subtitle: label("TaskStatus", task.status),
      href: "/tasks",
    });
  }
  for (const p of people) {
    const href = p.investorId
      ? `/investors/${p.investorId}`
      : p.clientId
        ? `/clients/${p.clientId}`
        : p.partnerId
          ? `/partners/${p.partnerId}`
          : "/dashboard";
    results.push({
      id: p.id,
      type: "Person",
      title: personName(p),
      subtitle: p.jobTitle ?? undefined,
      href,
    });
  }
  for (const e of engagements) {
    results.push({
      id: e.id,
      type: "Engagement",
      title: e.name,
      subtitle: e.investor?.name ?? e.transaction?.name,
      href: `/engagement/${e.id}`,
    });
  }

  return results;
}
