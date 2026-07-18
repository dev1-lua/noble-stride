import { prisma } from "@/lib/db";

export interface RelationOption { value: string; label: string }

export interface RelationOptions {
  clients: RelationOption[];
  users: RelationOption[];
  partners: RelationOption[];
  mandates: RelationOption[];
  transactions: RelationOption[];
  investors: RelationOption[];
  serviceProviders: RelationOption[];
}

/** Lightweight {id,name} option lists for form relation pickers (one query each). */
export async function relationOptions(): Promise<RelationOptions> {
  const [clients, users, partners, mandates, transactions, investors, serviceProviders] = await Promise.all([
    prisma.client.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.partner.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.mandate.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.transaction.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.investor.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.serviceProvider.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const map = (rows: { id: string; name: string }[]) => rows.map((r) => ({ value: r.id, label: r.name }));
  return {
    clients: map(clients), users: map(users), partners: map(partners), mandates: map(mandates),
    transactions: map(transactions), investors: map(investors), serviceProviders: map(serviceProviders),
  };
}

/**
 * Distinct deal countries across all three deal kinds (free-text field
 * defaulted from Client.hqCountry) — feeds the /deals Country filter.
 */
export async function dealCountryOptions(): Promise<RelationOption[]> {
  const [m, t, a, c] = await Promise.all([
    prisma.mandate.findMany({ where: { country: { not: null } }, select: { country: true }, distinct: ["country"] }),
    prisma.transaction.findMany({ where: { country: { not: null } }, select: { country: true }, distinct: ["country"] }),
    prisma.advisoryEngagement.findMany({ where: { country: { not: null } }, select: { country: true }, distinct: ["country"] }),
    // Legacy rows without their own country fall back to the client HQ in the
    // deals queue — include those values so the filter can reach them too.
    prisma.client.findMany({ where: { hqCountry: { not: null } }, select: { hqCountry: true }, distinct: ["hqCountry"] }),
  ]);
  const names = new Set<string>();
  for (const r of [...m, ...t, ...a]) if (r.country) names.add(r.country);
  for (const r of c) if (r.hqCountry) names.add(r.hqCountry);
  return [...names].sort((x, y) => x.localeCompare(y)).map((name) => ({ value: name, label: name }));
}
