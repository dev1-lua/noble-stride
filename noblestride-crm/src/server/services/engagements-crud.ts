import { prisma } from "@/lib/db";
import { actorSource } from "./crud";
import type { Actor } from "@/graphql/context";
import { amountPending, deriveYearQuarter } from "@/server/domain/disbursement";
import { engagementCreateSchema, engagementUpdateSchema } from "@/lib/schemas/engagement";

function derived(input: { totalAmount?: number | null; amountDisbursed?: number | null; dateReceived?: Date | null }) {
  const pending = amountPending(input.totalAmount ?? null, input.amountDisbursed ?? null);
  const yq = input.dateReceived ? deriveYearQuarter(input.dateReceived) : null;
  // `amountPending` is `number | null` — pass it through (not `?? undefined`) so a
  // null total NULLs out the column on update. Prisma treats `undefined` as "skip".
  return { amountPending: pending, year: yq?.year, quarter: yq?.quarter };
}

export async function createEngagement(raw: unknown, actor: Actor) {
  const input = engagementCreateSchema.parse(raw);
  return prisma.engagement.create({
    data: { ...input, name: input.name ?? "Engagement", ...derived(input), createdSource: actorSource(actor) } as never,
  });
}

export async function updateEngagement(id: string, raw: unknown) {
  const input = engagementUpdateSchema.parse(raw);
  // Recompute derived fields over the MERGED state: incoming partial fields
  // override the persisted row, so a single-field money update doesn't reset
  // the other operand to null. Use `"field" in input` so an explicit null
  // (clear) is honored and distinguished from "absent".
  const existing = await prisma.engagement.findUniqueOrThrow({ where: { id } });
  const merged = {
    totalAmount:
      "totalAmount" in input ? input.totalAmount : existing.totalAmount == null ? undefined : Number(existing.totalAmount),
    amountDisbursed:
      "amountDisbursed" in input ? input.amountDisbursed : existing.amountDisbursed == null ? undefined : Number(existing.amountDisbursed),
    dateReceived: "dateReceived" in input ? input.dateReceived : existing.dateReceived ?? undefined,
  };
  return prisma.engagement.update({ where: { id }, data: { ...input, ...derived(merged) } as never });
}
