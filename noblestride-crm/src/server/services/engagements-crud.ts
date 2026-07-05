import { prisma } from "@/lib/db";
import { actorSource } from "./crud";
import { recordStageChange } from "./stage-history";
import type { Actor } from "@/graphql/context";
import { amountPending, deriveYearQuarter } from "@/server/domain/disbursement";
import { engagementCreateSchema, engagementUpdateSchema } from "@/lib/schemas/engagement";
import { assertStageAllowed, stageRequiresNda } from "@/server/domain/nda-guard";

function derived(input: { totalAmount?: number | null; amountDisbursed?: number | null; dateReceived?: Date | null }) {
  const pending = amountPending(input.totalAmount ?? null, input.amountDisbursed ?? null);
  const yq = input.dateReceived ? deriveYearQuarter(input.dateReceived) : null;
  // `amountPending` is `number | null` — pass it through (not `?? undefined`) so a
  // null total NULLs out the column on update. Prisma treats `undefined` as "skip".
  return { amountPending: pending, year: yq?.year, quarter: yq?.quarter };
}

export async function createEngagement(raw: unknown, actor: Actor) {
  const input = engagementCreateSchema.parse(raw);
  if (input.engagementStage && stageRequiresNda(input.engagementStage)) {
    const investor = await prisma.investor.findUniqueOrThrow({
      where: { id: input.investorId },
      select: { ndaStatus: true },
    });
    assertStageAllowed(input.engagementStage, investor, { ndaType: input.ndaType ?? null });
  }
  return prisma.engagement.create({
    data: { ...input, name: input.name ?? "Engagement", ...derived(input), createdSource: actorSource(actor) } as never,
  });
}

export async function updateEngagement(id: string, raw: unknown, actor: Actor = { type: "HUMAN" }) {
  const input = engagementUpdateSchema.parse(raw);
  // Recompute derived fields over the MERGED state: incoming partial fields
  // override the persisted row, so a single-field money update doesn't reset
  // the other operand to null. Use `"field" in input` so an explicit null
  // (clear) is honored and distinguished from "absent".
  const existing = await prisma.engagement.findUniqueOrThrow({ where: { id } });
  if (input.engagementStage && input.engagementStage !== existing.engagementStage) {
    const investor = await prisma.investor.findUniqueOrThrow({
      where: { id: existing.investorId },
      select: { ndaStatus: true },
    });
    const mergedNdaType = "ndaType" in input ? (input.ndaType ?? null) : existing.ndaType;
    assertStageAllowed(input.engagementStage, investor, { ndaType: mergedNdaType });
  }
  const merged = {
    totalAmount:
      "totalAmount" in input ? input.totalAmount : existing.totalAmount == null ? undefined : Number(existing.totalAmount),
    amountDisbursed:
      "amountDisbursed" in input ? input.amountDisbursed : existing.amountDisbursed == null ? undefined : Number(existing.amountDisbursed),
    dateReceived: "dateReceived" in input ? input.dateReceived : existing.dateReceived ?? undefined,
  };
  return prisma.$transaction(async (tx) => {
    const updated = await tx.engagement.update({ where: { id }, data: { ...input, ...derived(merged) } as never });
    if (input.engagementStage !== undefined) {
      await recordStageChange(tx, {
        field: "engagementStage",
        fromValue: existing.engagementStage,
        toValue: input.engagementStage,
        actor,
        engagementId: id,
      });
    }
    return updated;
  });
}
