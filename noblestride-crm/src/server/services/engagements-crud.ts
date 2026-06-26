import { prisma } from "@/lib/db";
import { actorSource } from "./crud";
import type { Actor } from "@/graphql/context";
import { amountPending, deriveYearQuarter } from "@/server/domain/disbursement";
import { engagementCreateSchema, engagementUpdateSchema } from "@/lib/schemas/engagement";

function derived(input: { totalAmount?: number; amountDisbursed?: number; dateReceived?: Date }) {
  const pending = amountPending(input.totalAmount ?? null, input.amountDisbursed ?? null);
  const yq = input.dateReceived ? deriveYearQuarter(input.dateReceived) : null;
  return { amountPending: pending ?? undefined, year: yq?.year, quarter: yq?.quarter };
}

export async function createEngagement(raw: unknown, actor: Actor) {
  const input = engagementCreateSchema.parse(raw);
  return prisma.engagement.create({
    data: { ...input, name: input.name ?? "Engagement", ...derived(input), createdSource: actorSource(actor) } as never,
  });
}

export async function updateEngagement(id: string, raw: unknown) {
  const input = engagementUpdateSchema.parse(raw);
  return prisma.engagement.update({ where: { id }, data: { ...input, ...derived(input) } as never });
}
