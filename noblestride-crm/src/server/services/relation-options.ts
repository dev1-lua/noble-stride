import { prisma } from "@/lib/db";

export interface RelationOption { value: string; label: string }

export interface RelationOptions {
  clients: RelationOption[];
  users: RelationOption[];
  partners: RelationOption[];
  mandates: RelationOption[];
}

/** Lightweight {id,name} option lists for form relation pickers (one query each). */
export async function relationOptions(): Promise<RelationOptions> {
  const [clients, users, partners, mandates] = await Promise.all([
    prisma.client.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.partner.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.mandate.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const map = (rows: { id: string; name: string }[]) => rows.map((r) => ({ value: r.id, label: r.name }));
  return { clients: map(clients), users: map(users), partners: map(partners), mandates: map(mandates) };
}
