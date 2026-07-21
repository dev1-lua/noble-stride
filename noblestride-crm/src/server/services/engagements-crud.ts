import { prisma } from "@/lib/db";
import { label } from "@/lib/vocab";
import { actorSource } from "./crud";
import { recordStageChange } from "./stage-history";
import type { Actor } from "@/graphql/context";
import { amountPending, deriveYearQuarter } from "@/server/domain/disbursement";
import { engagementCreateSchema, engagementUpdateSchema } from "@/lib/schemas/engagement";
import { assertStageAllowed, stageRequiresNda } from "@/server/domain/nda-guard";
import { assertAgentEngagementAllowed, assertAgentEngagementCreateAllowed, isAgentActor } from "@/server/domain/agent-write-guards";
import { notify, notifyInvestors } from "./notifications";

function derived(input: { totalAmount?: number | null; amountDisbursed?: number | null; dateReceived?: Date | null }) {
  const pending = amountPending(input.totalAmount ?? null, input.amountDisbursed ?? null);
  const yq = input.dateReceived ? deriveYearQuarter(input.dateReceived) : null;
  // `amountPending` is `number | null` — pass it through (not `?? undefined`) so a
  // null total NULLs out the column on update. Prisma treats `undefined` as "skip".
  return { amountPending: pending, year: yq?.year, quarter: yq?.quarter };
}

export async function createEngagement(raw: unknown, actor: Actor) {
  const input = engagementCreateSchema.parse(raw);
  // gap F: an agent may not open an engagement (share a deal) with an Excluded/
  // Greylisted investor (SPEC §8.3). Load classification (+ndaStatus for the NDA
  // gate) once. Humans (CRM UI) are unaffected.
  if (isAgentActor(actor)) {
    const guardInvestor = await prisma.investor.findUniqueOrThrow({
      where: { id: input.investorId },
      select: { name: true, engagementClassification: true },
    });
    assertAgentEngagementCreateAllowed(actor, guardInvestor);
  }
  if (input.engagementStage && stageRequiresNda(input.engagementStage)) {
    const investor = await prisma.investor.findUniqueOrThrow({
      where: { id: input.investorId },
      select: { ndaStatus: true },
    });
    assertStageAllowed(input.engagementStage, investor, { ndaType: input.ndaType ?? null });
  }
  const created = await prisma.engagement.create({
    data: { ...input, name: input.name ?? "Engagement", ...derived(input), createdSource: actorSource(actor) } as never,
    include: { transaction: { select: { name: true } } },
  });
  // Portal feed (client feedback 2026-07): an engagement is what shares a
  // deal with an investor — surface it in their portal. Post-commit and
  // best-effort (notifyInvestors never throws). The portal deal page itself
  // stays tier-gated by the visibility engine regardless.
  await notifyInvestors([created.investorId], {
    kind: "deal_shared",
    title: `New opportunity shared: ${created.transaction.name}`,
    href: `/portal/investor/deals/${created.transactionId}`,
  });
  return created;
}

export async function updateEngagement(id: string, raw: unknown, actor: Actor = { type: "HUMAN" }) {
  const input = engagementUpdateSchema.parse(raw);
  // Recompute derived fields over the MERGED state: incoming partial fields
  // override the persisted row, so a single-field money update doesn't reset
  // the other operand to null. Use `"field" in input` so an explicit null
  // (clear) is honored and distinguished from "absent".
  const existing = await prisma.engagement.findUniqueOrThrow({ where: { id } });
  const stageChanging = !!input.engagementStage && input.engagementStage !== existing.engagementStage;
  // Load the investor once for both the gap-F classification guard (agents only,
  // SPEC §8.3 — no advancing/enriching an Excluded/Greylisted investor's
  // engagement) and the NDA stage gate (any actor, on a stage change). Humans are
  // unaffected by the classification guard.
  if (isAgentActor(actor) || stageChanging) {
    const investor = await prisma.investor.findUniqueOrThrow({
      where: { id: existing.investorId },
      select: { name: true, engagementClassification: true, ndaStatus: true },
    });
    if (isAgentActor(actor)) assertAgentEngagementAllowed(actor, investor, input);
    if (stageChanging) {
      const mergedNdaType = "ndaType" in input ? (input.ndaType ?? null) : existing.ndaType;
      assertStageAllowed(input.engagementStage!, investor, { ndaType: mergedNdaType });
    }
  }
  const merged = {
    totalAmount:
      "totalAmount" in input ? input.totalAmount : existing.totalAmount == null ? undefined : Number(existing.totalAmount),
    amountDisbursed:
      "amountDisbursed" in input ? input.amountDisbursed : existing.amountDisbursed == null ? undefined : Number(existing.amountDisbursed),
    dateReceived: "dateReceived" in input ? input.dateReceived : existing.dateReceived ?? undefined,
  };
  const updated = await prisma.$transaction(async (tx) => {
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

  // Notify the engagement's owner of the restage — after the transaction has
  // committed (see notifications.ts). Skipped when there is no owner, the
  // stage didn't actually change, or the owner is the one who made the change.
  if (
    input.engagementStage !== undefined &&
    input.engagementStage !== existing.engagementStage &&
    existing.ownerId &&
    existing.ownerId !== actor.userId
  ) {
    await notify([existing.ownerId], {
      kind: "stage_change",
      title: `${existing.name}: ${label("EngagementStage", existing.engagementStage)} → ${label("EngagementStage", input.engagementStage)}`,
      href: `/engagement/${id}`,
    });
  }

  return updated;
}
