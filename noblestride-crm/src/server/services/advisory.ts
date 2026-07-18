// Advisory service — single source of truth over Prisma for the advisory-work
// pipeline (third deal kind alongside mandates/transactions).
// Thin layer: Prisma calls + domain helpers only. No GraphQL, no React.

import { prisma } from "@/lib/db";
import { LABELS, label } from "@/lib/vocab";
import type { KanbanColumn, AdvisoryStage } from "@/server/domain/types";
import type { AdvisoryEngagement } from "@prisma/client";
import { advisoryCreateSchema, advisoryUpdateSchema, type AdvisoryCreateInput, type AdvisoryUpdateInput } from "@/lib/schemas/advisory";
import { actorSource, CrudError, sameCalendarDate } from "./crud";
import { recordStageChange } from "./stage-history";
import type { Actor } from "@/graphql/context";
import { notify } from "./notifications";

// ─── Public API ───────────────────────────────────────────────────────────────

export async function listAdvisory(filter?: { stage?: AdvisoryStage; clientId?: string }) {
  const where: { stage?: AdvisoryStage; clientId?: string } = {};
  if (filter?.stage != null) where.stage = filter.stage;
  if (filter?.clientId != null) where.clientId = filter.clientId;

  return prisma.advisoryEngagement.findMany({ where, orderBy: { updatedAt: "desc" } });
}

/**
 * One KanbanColumn per AdvisoryStage value, in vocab order. Single query,
 * bucketed in-process (same N+1 avoidance as mandatesByStage).
 */
export async function advisoryByStage(): Promise<KanbanColumn<AdvisoryEngagement>[]> {
  const all = await prisma.advisoryEngagement.findMany({
    orderBy: { stageEnteredAt: "asc" },
    include: { client: true, lead: true },
  });

  const buckets = new Map<string, AdvisoryEngagement[]>();
  for (const advisory of all) {
    const bucket = buckets.get(advisory.stage) ?? [];
    bucket.push(advisory as unknown as AdvisoryEngagement);
    buckets.set(advisory.stage, bucket);
  }

  return Object.keys(LABELS.AdvisoryStage).map((stage) => ({
    stage,
    label: label("AdvisoryStage", stage),
    items: buckets.get(stage) ?? [],
  }));
}

export async function getAdvisory(id: string) {
  return prisma.advisoryEngagement.findUnique({
    where: { id },
    include: {
      client: true,
      lead: true,
      assists: true,
      activities: { orderBy: { occurredAt: "desc" } },
      stageChanges: { orderBy: { changedAt: "desc" }, include: { changedBy: true } },
    },
  });
}

/**
 * Move an advisory engagement to a new stage, resetting stageEnteredAt, and
 * record a StageChange row when the stage actually changes (the Kanban drag seam).
 */
export async function setAdvisoryStage(id: string, stage: AdvisoryStage, actor: Actor = { type: "HUMAN" }): Promise<AdvisoryEngagement> {
  const { updated, fromStage, name, leadId } = await prisma.$transaction(async (tx) => {
    const existing = await tx.advisoryEngagement.findUniqueOrThrow({ where: { id }, select: { stage: true, name: true, leadId: true } });
    const updated = await tx.advisoryEngagement.update({
      where: { id },
      data: { stage, stageEnteredAt: new Date() },
    });
    await recordStageChange(tx, { field: "stage", fromValue: existing.stage, toValue: stage, actor, advisoryId: id });
    return { updated, fromStage: existing.stage, name: existing.name, leadId: existing.leadId };
  });

  // Post-commit lead notification, same contract as the mandate sibling.
  if (fromStage !== stage && leadId && leadId !== actor.userId) {
    await notify([leadId], advisoryStageNotification(id, name, fromStage, stage));
  }

  return updated;
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

// Shared by setAdvisoryStage and updateAdvisory (identical wording).
function advisoryStageNotification(id: string, name: string, fromStage: AdvisoryStage, toStage: AdvisoryStage) {
  return {
    kind: "stage_change" as const,
    title: `${name}: ${label("AdvisoryStage", fromStage)} → ${label("AdvisoryStage", toStage)}`,
    href: `/advisory/${id}`,
  };
}

export async function createAdvisory(input: AdvisoryCreateInput, actor: Actor) {
  const { assistIds, ...data } = advisoryCreateSchema.parse(input);
  // Deal country defaults from the client's HQ country when not provided.
  const country = data.country ?? (await prisma.client.findUnique({ where: { id: data.clientId }, select: { hqCountry: true } }))?.hqCountry ?? undefined;
  return prisma.advisoryEngagement.create({
    data: {
      ...data,
      country,
      createdSource: actorSource(actor),
      ...(assistIds ? { assists: { connect: assistIds.map((id) => ({ id })) } } : {}),
    },
  });
}

export async function updateAdvisory(id: string, input: AdvisoryUpdateInput, actor: Actor = { type: "HUMAN" }) {
  const { assistIds, stage, ...rest } = advisoryUpdateSchema.parse(input);
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.advisoryEngagement.findUniqueOrThrow({
      where: { id },
      select: { dealStatus: true, dateOpened: true, source: true, stage: true, name: true, leadId: true },
    });
    if (rest.dateOpened !== undefined && existing.dateOpened != null && !sameCalendarDate(rest.dateOpened, existing.dateOpened)) {
      throw new CrudError("Date opened is locked once set (spec §7.1: creation date is immutable).");
    }
    if (rest.source !== undefined && existing.source != null && rest.source !== existing.source) {
      throw new CrudError("Source is locked once set (spec §7.1: originating source is immutable).");
    }

    // Inlined restage logic must stay behaviorally identical to setAdvisoryStage
    // (same rationale as the mandate/transaction services).
    const stageChanging = stage !== undefined && stage !== existing.stage;

    const updated = await tx.advisoryEngagement.update({
      where: { id },
      data: {
        ...rest,
        ...(assistIds ? { assists: { set: assistIds.map((userId) => ({ id: userId })) } } : {}),
        ...(stageChanging ? { stage, stageEnteredAt: now } : {}),
      },
    });

    if (rest.dealStatus !== undefined) {
      await recordStageChange(tx, { field: "dealStatus", fromValue: existing.dealStatus, toValue: rest.dealStatus, actor, advisoryId: id });
    }
    if (stageChanging) {
      await recordStageChange(tx, { field: "stage", fromValue: existing.stage, toValue: stage, actor, advisoryId: id });
    }

    return { updated, existing, stageChanging };
  });

  if (result.stageChanging && result.existing.leadId && result.existing.leadId !== actor.userId) {
    await notify([result.existing.leadId], advisoryStageNotification(id, result.existing.name, result.existing.stage, stage!));
  }

  return result.updated;
}

export async function deleteAdvisory(id: string) {
  const documents = await prisma.document.count({ where: { advisoryId: id } });
  if (documents > 0) {
    throw new CrudError(`Cannot delete: ${documents} document(s) reference this advisory engagement.`);
  }
  return prisma.advisoryEngagement.delete({ where: { id } });
}
