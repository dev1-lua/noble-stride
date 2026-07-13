// Mandate service — single source of truth over Prisma for mandate/pipeline data.
// Thin layer: Prisma calls + domain helpers only. No GraphQL, no React.

import { prisma } from "@/lib/db";
import { LABELS, label } from "@/lib/vocab";
import type { KanbanColumn, MandateStage } from "@/server/domain/types";
import type { Mandate } from "@prisma/client";
import { mandateCreateSchema, mandateUpdateSchema, type MandateCreateInput, type MandateUpdateInput } from "@/lib/schemas/mandate";
import { actorSource, CrudError, sameCalendarDate } from "./crud";
import { recordStageChange } from "./stage-history";
import type { Actor } from "@/graphql/context";
import { qualifyIntake, type IntakeQualInput } from "@/server/domain/qualification";
import { notify } from "./notifications";
import { reconcileMandateDocDates } from "@/server/domain/doc-dates";

// ─── Filter type ─────────────────────────────────────────────────────────────

interface MandateFilter {
  stage?: MandateStage;
  clientId?: string;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * List mandates matching the given filter, ordered by updatedAt desc.
 */
export async function listMandates(filter?: MandateFilter) {
  const where: { stage?: MandateStage; clientId?: string } = {};
  if (filter?.stage != null) where.stage = filter.stage;
  if (filter?.clientId != null) where.clientId = filter.clientId;

  return prisma.mandate.findMany({ where, orderBy: { updatedAt: "desc" } });
}

/**
 * Return one KanbanColumn per MandateStage value, in vocab order.
 *
 * N+1 avoidance: all mandates are loaded in a single query, then bucketed
 * in-process by stage. No per-stage DB round-trips.
 */
export async function mandatesByStage(): Promise<KanbanColumn<Mandate>[]> {
  const allMandates = await prisma.mandate.findMany({
    orderBy: { stageEnteredAt: "asc" },
    include: { client: true, lead: true, referredBy: true },
  });

  // Build a lookup: stage -> items
  const buckets = new Map<string, Mandate[]>();
  for (const mandate of allMandates) {
    const bucket = buckets.get(mandate.stage) ?? [];
    bucket.push(mandate as unknown as Mandate);
    buckets.set(mandate.stage, bucket);
  }

  // Return columns in vocab order (Object.keys preserves insertion order)
  return Object.keys(LABELS.MandateStage).map((stage) => ({
    stage,
    label: label("MandateStage", stage),
    items: buckets.get(stage) ?? [],
  }));
}

/**
 * Fetch a single mandate by id, including related client, lead, partner,
 * transactions, activities (ordered by occurredAt desc), and stage-change
 * history (newest first).
 * Returns null when the mandate does not exist.
 */
export async function getMandate(id: string) {
  return prisma.mandate.findUnique({
    where: { id },
    include: {
      client: true,
      lead: true,
      referredBy: true,
      transactions: true,
      activities: { orderBy: { occurredAt: "desc" } },
      stageChanges: { orderBy: { changedAt: "desc" }, include: { changedBy: true } },
    },
  });
}

/**
 * Move a mandate to a new stage, resetting stageEnteredAt to now, and record
 * a StageChange row (SPEC §7.1) when the stage actually changes.
 * This is the write seam the Kanban drag will hit (no Activity logging here).
 */
export async function setMandateStage(id: string, stage: MandateStage, actor: Actor = { type: "HUMAN" }): Promise<Mandate> {
  const { updated, fromStage, name, leadId } = await prisma.$transaction(async (tx) => {
    const existing = await tx.mandate.findUniqueOrThrow({ where: { id }, select: { stage: true, name: true, leadId: true } });
    const updated = await tx.mandate.update({
      where: { id },
      data: { stage, stageEnteredAt: new Date() },
    });
    await recordStageChange(tx, { field: "stage", fromValue: existing.stage, toValue: stage, actor, mandateId: id });
    return { updated, fromStage: existing.stage, name: existing.name, leadId: existing.leadId };
  });

  // Notify the mandate's owner (record lead) of the restage — after the
  // transaction has committed, so a notification failure can never roll back
  // the stage change. Skipped when there is no lead, the stage didn't
  // actually change, or the lead is the one who made the change.
  if (fromStage !== stage && leadId && leadId !== actor.userId) {
    await notify([leadId], mandateStageNotification(id, name, fromStage, stage));
  }

  return updated;
}

// ─── CRUD operations ──────────────────────────────────────────────────────────

// Shared by setMandateStage and updateMandate so the restage notification is
// worded identically no matter which write path changed the stage.
function mandateStageNotification(id: string, name: string, fromStage: MandateStage, toStage: MandateStage) {
  return {
    kind: "stage_change" as const,
    title: `${name}: ${label("MandateStage", fromStage)} → ${label("MandateStage", toStage)}`,
    href: `/mandates/${id}`,
  };
}

export async function createMandate(input: MandateCreateInput, actor: Actor) {
  const data = mandateCreateSchema.parse(input);
  const now = new Date();
  const docDates = reconcileMandateDocDates(data, {
    ndaStatus: data.ndaStatus ?? "NotSent",
    ndaSentDate: data.ndaSentDate ?? null,
    ndaSignedDate: data.ndaSignedDate ?? null,
    eaStatus: data.eaStatus ?? "NotSent",
    eaSentDate: data.eaSentDate ?? null,
    eaSignedDate: data.eaSignedDate ?? null,
  }, now);
  return prisma.mandate.create({ data: { ...data, ...docDates, createdSource: actorSource(actor) } });
}

export async function updateMandate(id: string, input: MandateUpdateInput, actor: Actor = { type: "HUMAN" }) {
  const { stage, ...rest } = mandateUpdateSchema.parse(input);
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.mandate.findUniqueOrThrow({
      where: { id },
      select: {
        dealStatus: true, dateOpened: true, source: true, stage: true, name: true, leadId: true,
        ndaStatus: true, ndaSentDate: true, ndaSignedDate: true,
        eaStatus: true, eaSentDate: true, eaSignedDate: true,
      },
    });
    if (rest.dateOpened !== undefined && existing.dateOpened != null && !sameCalendarDate(rest.dateOpened, existing.dateOpened)) {
      throw new CrudError("Date opened is locked once set (spec §7.1: creation date is immutable).");
    }
    if (rest.source !== undefined && existing.source != null && rest.source !== existing.source) {
      throw new CrudError("Source is locked once set (spec §7.1: originating source is immutable).");
    }

    const docDates = reconcileMandateDocDates(rest, existing, now);
    const stageChanging = stage !== undefined && stage !== existing.stage;

    const updated = await tx.mandate.update({
      where: { id },
      data: { ...rest, ...docDates, ...(stageChanging ? { stage, stageEnteredAt: now } : {}) },
    });

    if (rest.dealStatus !== undefined) {
      await recordStageChange(tx, { field: "dealStatus", fromValue: existing.dealStatus, toValue: rest.dealStatus, actor, mandateId: id });
    }
    if (stageChanging) {
      await recordStageChange(tx, { field: "stage", fromValue: existing.stage, toValue: stage, actor, mandateId: id });
    }

    return { updated, existing, stageChanging };
  });

  // Notify the lead of a restage after commit (never rolls back the change).
  if (result.stageChanging && result.existing.leadId && result.existing.leadId !== actor.userId) {
    await notify([result.existing.leadId], mandateStageNotification(id, result.existing.name, result.existing.stage, stage!));
  }

  return result.updated;
}

// ─── Intake review actions (Task 12) ───────────────────────────────────────
// A website-intake mandate (source: "Website", leadId: null) sits in NewLead
// until a human reviews the auto-computed qualification verdict and either
// assigns a deal lead, deprioritizes it, or asks the engine to re-triage it
// against the persisted client/mandate data (e.g. after a manual data fix).

/** Accept a website-intake mandate: assign a deal lead and log the decision. */
export async function acceptIntakeMandate(id: string, leadId: string, actor: Actor = { type: "HUMAN" }) {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.mandate.update({ where: { id }, data: { leadId } });
    await tx.activity.create({
      data: {
        type: "Note",
        subject: "Intake accepted",
        mandateId: id,
        createdSource: actorSource(actor),
      },
    });
    return updated;
  });
}

/** Deprioritize a website-intake mandate: drop it and append the reason to notes. */
export async function deprioritizeIntakeMandate(id: string, reason: string, actor: Actor = { type: "HUMAN" }) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.mandate.findUniqueOrThrow({ where: { id }, select: { dealStatus: true, notes: true } });
    const notes = existing.notes ? `${existing.notes}\n${reason}` : reason;
    const updated = await tx.mandate.update({ where: { id }, data: { dealStatus: "Dropped", notes } });
    await recordStageChange(tx, { field: "dealStatus", fromValue: existing.dealStatus, toValue: "Dropped", actor, mandateId: id });
    await tx.activity.create({
      data: {
        type: "Note",
        subject: "Intake deprioritized",
        body: reason,
        mandateId: id,
        createdSource: actorSource(actor),
      },
    });
    return updated;
  });
}

/**
 * Re-run the qualification engine against the PERSISTED client + mandate data
 * (not the original intake payload — the applicant's data may have been
 * corrected since submission). Only touches verdict/reasons/qualifiedAt.
 */
export async function rerunQualification(id: string) {
  return prisma.$transaction(async (tx) => {
    const mandate = await tx.mandate.findUniqueOrThrow({ where: { id }, include: { client: true } });
    if (!mandate.client) {
      throw new CrudError("Mandate has no linked client to re-qualify against.");
    }
    const client = mandate.client;
    const qualInput: IntakeQualInput = {
      revenueUsd: client.revenueLastYear == null ? null : Number(client.revenueLastYear),
      raiseUsd: mandate.dealSize == null ? null : Number(mandate.dealSize),
      auditedYears: client.auditedFinancialsYears ?? null,
      countries: client.countries,
      sectors: client.sector,
      pepExposure: client.pepExposure,
      governmentOwned: client.governmentOwned,
      ebitdaUsd: client.ebitda == null ? null : Number(client.ebitda),
      yearFounded: client.yearFounded,
      currentYear: new Date().getFullYear(),
    };
    const { verdict, reasons } = qualifyIntake(qualInput);
    return tx.mandate.update({
      where: { id },
      data: { qualificationVerdict: verdict, qualificationReasons: reasons, qualifiedAt: new Date() },
    });
  });
}

export async function deleteMandate(id: string) {
  const transactions = await prisma.transaction.count({ where: { mandateId: id } });
  if (transactions > 0) {
    throw new CrudError(`Cannot delete: ${transactions} transaction(s) reference this mandate.`);
  }
  return prisma.mandate.delete({ where: { id } });
}
