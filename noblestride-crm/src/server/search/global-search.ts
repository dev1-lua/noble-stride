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

function personName(p: { firstName: string; lastName: string | null }): string {
  return [p.firstName, p.lastName ?? ""].join(" ").trim();
}

async function searchForInternal(query: string, limit: number): Promise<SearchResult[]> {
  const ci = { contains: query, mode: "insensitive" as const };

  const [investors, clients, mandates, transactions, partners, serviceProviders, documents, tasks, people, engagements] =
    await Promise.all([
      prisma.investor.findMany({ where: { name: ci }, take: limit, orderBy: { name: "asc" } }),
      prisma.client.findMany({ where: { name: ci }, take: limit, orderBy: { name: "asc" } }),
      prisma.mandate.findMany({
        where: { name: ci },
        take: limit,
        orderBy: { name: "asc" },
        include: { client: true },
      }),
      prisma.transaction.findMany({
        where: { name: ci },
        take: limit,
        orderBy: { name: "asc" },
        include: { client: true },
      }),
      prisma.partner.findMany({ where: { name: ci }, take: limit, orderBy: { name: "asc" } }),
      prisma.serviceProvider.findMany({ where: { name: ci }, take: limit, orderBy: { name: "asc" } }),
      prisma.document.findMany({
        where: { name: ci },
        take: limit,
        orderBy: { name: "asc" },
        include: { transaction: true, client: true, investor: true },
      }),
      prisma.task.findMany({ where: { title: ci }, take: limit, orderBy: { title: "asc" } }),
      prisma.person.findMany({
        where: { OR: [{ firstName: ci }, { lastName: ci }] },
        take: limit,
        orderBy: { firstName: "asc" },
      }),
      prisma.engagement.findMany({
        where: { name: ci },
        take: limit,
        orderBy: { name: "asc" },
        include: { investor: true, transaction: true },
      }),
    ]);

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
