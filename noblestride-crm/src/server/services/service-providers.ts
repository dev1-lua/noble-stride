// ServiceProvider service — single source of truth over Prisma for service-provider data.
// Thin layer: Prisma calls + domain helpers only. No GraphQL, no React.

import { prisma } from "@/lib/db";
import { actorSource, CrudError } from "./crud";
import type { Actor } from "@/graphql/context";
import { serviceProviderCreateSchema, serviceProviderUpdateSchema } from "@/lib/schemas/service-provider";

export const listServiceProviders = () =>
  prisma.serviceProvider.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { engagedOn: true } } },
  });

export const getServiceProvider = (id: string) =>
  prisma.serviceProvider.findUnique({ where: { id }, include: { engagedOn: true } });

export async function createServiceProvider(raw: unknown, actor: Actor) {
  const input = serviceProviderCreateSchema.parse(raw);
  return prisma.serviceProvider.create({ data: { ...input, createdSource: actorSource(actor) } as never });
}

export async function updateServiceProvider(id: string, raw: unknown) {
  const input = serviceProviderUpdateSchema.parse(raw);
  return prisma.serviceProvider.update({ where: { id }, data: input as never });
}

export async function deleteServiceProvider(id: string) {
  try {
    return await prisma.serviceProvider.delete({ where: { id } });
  } catch {
    throw new CrudError("ServiceProvider not found");
  }
}
