// workflow.ts — DB-facing side of the deal workflow (Aug-2026 feedback
// F4.1.x / G2). Loads a deal's template + evidence + manual overrides, hands
// them to the pure engine in `src/server/domain/workflow.ts`, and owns the two
// writes (mark done / reopen, "move deal here"). Replaces `services/journey.ts`.

import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import type { Actor } from "@/graphql/context";
import { CrudError, actorSource } from "./crud";
import { recordStageChange } from "./stage-history";
import { notify } from "./notifications";
import { label } from "@/lib/vocab";
import { dealHref, type DealKindEnum } from "@/server/domain/deal-kind";
import {
  DEFAULT_WORKFLOW_STEPS,
  DEFAULT_WORKFLOW_TEMPLATE_ID,
  DEFAULT_WORKFLOW_TEMPLATE_NAME,
} from "@/server/domain/workflow-default";
import {
  applicableSteps,
  resolveWorkflow,
  stepsToMoveTo,
  type DealWorkflow,
  type ManualState,
  type WorkflowEvidence,
  type WorkflowTemplateLike,
} from "@/server/domain/workflow";

// ─── Templates ────────────────────────────────────────────────────────────────

const templateInclude = { steps: { orderBy: { order: "asc" as const } } } satisfies Prisma.WorkflowTemplateInclude;

type TemplateRow = Prisma.WorkflowTemplateGetPayload<{ include: typeof templateInclude }>;

function toTemplateLike(t: TemplateRow): WorkflowTemplateLike {
  return {
    id: t.id,
    name: t.name,
    isDefault: t.isDefault,
    steps: t.steps.map((s) => ({
      id: s.id,
      key: s.key,
      title: s.title,
      phase: s.phase,
      description: s.description,
      order: s.order,
      appliesTo: s.appliesTo,
    })),
  };
}

/** In-memory fallback so a fresh DB (before `seed:workflow`) still renders a workflow. */
const BUILTIN_DEFAULT: WorkflowTemplateLike = {
  id: DEFAULT_WORKFLOW_TEMPLATE_ID,
  name: DEFAULT_WORKFLOW_TEMPLATE_NAME,
  isDefault: true,
  steps: DEFAULT_WORKFLOW_STEPS,
};

/** The org default template — never null (falls back to the built-in 13 steps). */
export async function getDefaultTemplate(): Promise<WorkflowTemplateLike> {
  const row = await prisma.workflowTemplate.findFirst({ where: { isDefault: true }, include: templateInclude });
  return row && row.steps.length > 0 ? toTemplateLike(row) : BUILTIN_DEFAULT;
}

/** A deal's template: its explicit `workflowTemplateId` when set and present, else the default. */
export async function getTemplateForDeal(_kind: DealKindEnum, workflowTemplateId: string | null): Promise<WorkflowTemplateLike> {
  if (workflowTemplateId) {
    const row = await prisma.workflowTemplate.findUnique({ where: { id: workflowTemplateId }, include: templateInclude });
    if (row && row.steps.length > 0) return toTemplateLike(row);
  }
  return getDefaultTemplate();
}

// ─── Evidence ─────────────────────────────────────────────────────────────────

const docSelect = { type: true, status: true, reviewedAt: true, approvedAt: true } satisfies Prisma.DocumentSelect;
type DocRow = Prisma.DocumentGetPayload<{ select: typeof docSelect }>;

const engagementSelect = {
  id: true,
  status: true,
  engagementStage: true,
  termSheetIssued: true,
  ndaSignedAt: true,
  investor: { select: { name: true } },
} satisfies Prisma.EngagementSelect;
type EngRow = Prisma.EngagementGetPayload<{ select: typeof engagementSelect }>;

const reviewedCount = (docs: DocRow[]) =>
  docs.filter((d) => d.reviewedAt != null || d.approvedAt != null || d.status === "Approved").length;
const hasExecutedNda = (docs: DocRow[]) => docs.some((d) => d.type === "NDA" && d.status === "Executed");
const mapEngagements = (rows: EngRow[]): WorkflowEvidence["engagements"] =>
  rows.map((e) => ({
    id: e.id,
    status: e.status,
    engagementStage: e.engagementStage,
    termSheetIssued: e.termSheetIssued,
    ndaSignedAt: e.ndaSignedAt,
    investorName: e.investor.name,
  }));

const MEETING_TYPES = ["Meeting", "Call"] as const;

async function loadMandateEvidence(id: string): Promise<WorkflowEvidence | null> {
  const m = await prisma.mandate.findUnique({
    where: { id },
    include: {
      client: { select: { documents: { select: docSelect } } },
      referredBy: { select: { name: true } },
      lead: { select: { name: true } },
      documents: { select: docSelect },
      transactions: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          stage: true,
          vdrLink: true,
          dealMilestone: true,
          successFeeInvoicedDate: true,
          successFeePaidDate: true,
          documents: { select: docSelect },
          engagements: { select: engagementSelect },
          _count: { select: { outreachDrafts: true, meetings: true } },
        },
      },
    },
  });
  if (!m) return null;

  const txnIds = m.transactions.map((t) => t.id);
  const engIds = m.transactions.flatMap((t) => t.engagements.map((e) => e.id));
  const activityMeetings = await prisma.activity.count({
    where: {
      type: { in: [...MEETING_TYPES] },
      OR: [{ mandateId: id }, ...(txnIds.length ? [{ transactionId: { in: txnIds } }] : []), ...(engIds.length ? [{ engagementId: { in: engIds } }] : [])],
    },
  });

  const allDocs: DocRow[] = [...m.documents, ...m.transactions.flatMap((t) => t.documents), ...m.client.documents];
  // The "primary" transaction = the live one we deep-link execution steps to
  // (first non-lost, else the first created).
  const primary = m.transactions.find((t) => t.stage !== "ClosedLost") ?? m.transactions[0] ?? null;
  const paidTxn = m.transactions.find((t) => t.successFeePaidDate != null) ?? null;
  const invoicedTxn = m.transactions.find((t) => t.successFeeInvoicedDate != null) ?? null;

  return {
    dealKind: "Mandate",
    dealId: m.id,
    createdAt: m.createdAt,
    sourceLabel: m.source ? label("Source", m.source) : null,
    referredByName: m.referredBy?.name ?? null,
    pipelineStatus: m.stage,
    qualificationVerdict: m.qualificationVerdict,
    classification: null,
    ndaSigned: m.ndaStatus === "Signed" || m.ndaSignedDate != null || hasExecutedNda(allDocs),
    ndaSignedAt: m.ndaSignedDate,
    leadId: m.leadId,
    leadName: m.lead?.name ?? null,
    vdrLink: m.transactions.find((t) => t.vdrLink)?.vdrLink ?? null,
    documentTypes: allDocs.map((d) => d.type),
    reviewedDocumentCount: reviewedCount(allDocs),
    engagements: mapEngagements(m.transactions.flatMap((t) => t.engagements)),
    outreachDraftCount: m.transactions.reduce((n, t) => n + t._count.outreachDrafts, 0),
    meetingCount: m.transactions.reduce((n, t) => n + t._count.meetings, 0) + activityMeetings,
    termSheetDocument: allDocs.some((d) => d.type === "TermSheet"),
    dealMilestone: primary?.dealMilestone ?? null,
    successFeeInvoicedDate: invoicedTxn?.successFeeInvoicedDate ?? null,
    successFeePaidDate: paidTxn?.successFeePaidDate ?? null,
    primaryTransactionId: primary?.id ?? null,
  };
}

async function loadTransactionEvidence(id: string): Promise<WorkflowEvidence | null> {
  const t = await prisma.transaction.findUnique({
    where: { id },
    include: {
      client: { select: { documents: { select: docSelect } } },
      mandate: { select: { ndaStatus: true, ndaSignedDate: true, source: true } },
      owner: { select: { name: true } },
      referredBy: { select: { name: true } },
      documents: { select: docSelect },
      engagements: { select: engagementSelect },
      _count: { select: { outreachDrafts: true, meetings: true } },
    },
  });
  if (!t) return null;

  const engIds = t.engagements.map((e) => e.id);
  const activityMeetings = await prisma.activity.count({
    where: {
      type: { in: [...MEETING_TYPES] },
      OR: [{ transactionId: id }, ...(engIds.length ? [{ engagementId: { in: engIds } }] : [])],
    },
  });
  const allDocs: DocRow[] = [...t.documents, ...t.client.documents];
  const mandateNda = t.mandate?.ndaStatus === "Signed" || t.mandate?.ndaSignedDate != null;

  return {
    dealKind: "Transaction",
    dealId: t.id,
    createdAt: t.createdAt,
    sourceLabel: t.mandate?.source ? label("Source", t.mandate.source) : null,
    referredByName: t.referredBy?.name ?? null,
    pipelineStatus: t.stage,
    qualificationVerdict: null,
    classification: null,
    ndaSigned: mandateNda || hasExecutedNda(allDocs),
    ndaSignedAt: t.mandate?.ndaSignedDate ?? null,
    leadId: t.ownerId,
    leadName: t.owner?.name ?? null,
    vdrLink: t.vdrLink,
    documentTypes: allDocs.map((d) => d.type),
    reviewedDocumentCount: reviewedCount(allDocs),
    engagements: mapEngagements(t.engagements),
    outreachDraftCount: t._count.outreachDrafts,
    meetingCount: t._count.meetings + activityMeetings,
    termSheetDocument: allDocs.some((d) => d.type === "TermSheet"),
    dealMilestone: t.dealMilestone,
    successFeeInvoicedDate: t.successFeeInvoicedDate,
    successFeePaidDate: t.successFeePaidDate,
    primaryTransactionId: t.id,
  };
}

async function loadAdvisoryEvidence(id: string): Promise<WorkflowEvidence | null> {
  const a = await prisma.advisoryEngagement.findUnique({
    where: { id },
    include: {
      client: { select: { documents: { select: docSelect } } },
      lead: { select: { name: true } },
      documents: { select: docSelect },
    },
  });
  if (!a) return null;
  const activityMeetings = await prisma.activity.count({ where: { type: { in: [...MEETING_TYPES] }, advisoryId: id } });
  const allDocs: DocRow[] = [...a.documents, ...a.client.documents];
  const nda = allDocs.find((d) => d.type === "NDA" && d.status === "Executed");

  return {
    dealKind: "Advisory",
    dealId: a.id,
    createdAt: a.createdAt,
    sourceLabel: a.source ? label("Source", a.source) : null,
    referredByName: null,
    pipelineStatus: a.stage,
    qualificationVerdict: null,
    classification: a.classification,
    ndaSigned: nda != null,
    ndaSignedAt: nda?.approvedAt ?? null,
    leadId: a.leadId,
    leadName: a.lead?.name ?? null,
    vdrLink: null,
    documentTypes: allDocs.map((d) => d.type),
    reviewedDocumentCount: reviewedCount(allDocs),
    engagements: [],
    outreachDraftCount: 0,
    meetingCount: activityMeetings,
    termSheetDocument: allDocs.some((d) => d.type === "TermSheet"),
    dealMilestone: null,
    successFeeInvoicedDate: null,
    successFeePaidDate: null,
    primaryTransactionId: null,
  };
}

/** Everything the evidence rules need, in one graph load (+ one Activity count). */
export async function loadEvidence(kind: DealKindEnum, id: string): Promise<WorkflowEvidence | null> {
  if (kind === "Mandate") return loadMandateEvidence(id);
  if (kind === "Transaction") return loadTransactionEvidence(id);
  return loadAdvisoryEvidence(id);
}

/** Manual overrides (DealStageState rows) for a deal, with the completing user's name. */
export async function loadManualStates(kind: DealKindEnum, id: string): Promise<ManualState[]> {
  const rows = await prisma.dealStageState.findMany({
    where: { dealKind: kind, dealId: id },
    include: { completedBy: { select: { name: true } } },
  });
  return rows
    .filter((r) => r.manualStatus === "complete" || r.manualStatus === "incomplete")
    .map((r) => ({
      stepKey: r.stepKey,
      manualStatus: r.manualStatus as "complete" | "incomplete",
      note: r.note,
      completedAt: r.completedAt,
      completedById: r.completedById,
      completedByName: r.completedBy?.name ?? null,
    }));
}

// ─── Deal head (name / owner / template) ─────────────────────────────────────

interface DealHead {
  name: string;
  /** Deal lead (Mandate/Advisory `leadId`, Transaction `ownerId`). */
  leadId: string | null;
  workflowTemplateId: string | null;
}

async function loadDealHead(kind: DealKindEnum, id: string): Promise<DealHead | null> {
  if (kind === "Mandate") {
    const m = await prisma.mandate.findUnique({ where: { id }, select: { name: true, leadId: true, workflowTemplateId: true } });
    return m ?? null;
  }
  if (kind === "Transaction") {
    const t = await prisma.transaction.findUnique({ where: { id }, select: { name: true, ownerId: true, workflowTemplateId: true } });
    return t ? { name: t.name, leadId: t.ownerId, workflowTemplateId: t.workflowTemplateId } : null;
  }
  const a = await prisma.advisoryEngagement.findUnique({ where: { id }, select: { name: true, leadId: true, workflowTemplateId: true } });
  return a ?? null;
}

/** The FK column an audit row / activity uses for this deal kind. */
function dealFk(kind: DealKindEnum, id: string): { mandateId?: string; transactionId?: string; advisoryId?: string } {
  if (kind === "Mandate") return { mandateId: id };
  if (kind === "Transaction") return { transactionId: id };
  return { advisoryId: id };
}

// ─── Resolve ──────────────────────────────────────────────────────────────────

/** The full resolved workflow for a deal, or null when the deal does not exist. */
export async function resolveDealWorkflow(kind: DealKindEnum, id: string): Promise<DealWorkflow | null> {
  const head = await loadDealHead(kind, id);
  if (!head) return null;
  const [template, evidence, manual] = await Promise.all([
    getTemplateForDeal(kind, head.workflowTemplateId),
    loadEvidence(kind, id),
    loadManualStates(kind, id),
  ]);
  if (!evidence) return null;
  return resolveWorkflow(template, evidence, manual);
}

// ─── Writes ───────────────────────────────────────────────────────────────────

export interface SetDealStageStateInput {
  dealKind: DealKindEnum;
  dealId: string;
  stepKey: string;
  done: boolean;
  note?: string | null;
}

async function upsertStepState(
  tx: Prisma.TransactionClient,
  { dealKind, dealId, stepKey, done, note }: SetDealStageStateInput,
  actor: Actor,
  now: Date,
): Promise<{ prev: string | null; next: "complete" | "incomplete" }> {
  const where = { dealKind_dealId_stepKey: { dealKind, dealId, stepKey } };
  const prev = await tx.dealStageState.findUnique({ where, select: { manualStatus: true } });
  const manualStatus = done ? "complete" : "incomplete";
  const completion = done
    ? { completedAt: now, completedById: actor.userId ?? null }
    : { completedAt: null, completedById: actor.userId ?? null };
  await tx.dealStageState.upsert({
    where,
    create: { dealKind, dealId, stepKey, manualStatus, note: note ?? null, ...completion },
    update: { manualStatus, note: note ?? null, ...completion },
  });
  await recordStageChange(tx, {
    field: "workflowStep",
    fromValue: prev ? `${stepKey}:${prev.manualStatus}` : null,
    toValue: `${stepKey}:${manualStatus}`,
    actor,
    ...dealFk(dealKind, dealId),
  });
  return { prev: prev?.manualStatus ?? null, next: manualStatus };
}

/**
 * Mark one workflow step done (manual override) or reopen it. Validates the
 * key against the deal's template, writes the DealStageState row, a
 * StageChange (`field: "workflowStep"`) and a Note activity in one
 * transaction; notifies the deal lead post-commit.
 */
export async function setDealStageState(input: SetDealStageStateInput, actor: Actor = { type: "HUMAN" }): Promise<DealWorkflow> {
  const { dealKind, dealId, stepKey, done } = input;
  const head = await loadDealHead(dealKind, dealId);
  if (!head) throw new CrudError("Deal not found.");
  const template = await getTemplateForDeal(dealKind, head.workflowTemplateId);
  const step = applicableSteps(template.steps, dealKind).find((s) => s.key === stepKey);
  if (!step) throw new CrudError(`Step "${stepKey}" is not part of this deal's workflow.`);

  const now = new Date();
  const note = input.note?.trim() || null;
  await prisma.$transaction(async (tx) => {
    await upsertStepState(tx, { ...input, note }, actor, now);
    await tx.activity.create({
      data: {
        type: "Note",
        subject: done ? `Workflow step completed — ${step.title}` : `Workflow step reopened — ${step.title}`,
        body: note ?? undefined,
        occurredAt: now,
        createdById: actor.userId,
        createdSource: actorSource(actor),
        ...dealFk(dealKind, dealId),
      },
    });
  });

  if (head.leadId && head.leadId !== actor.userId) {
    await notify([head.leadId], {
      kind: "stage_change",
      title: `${head.name}: ${step.title} ${done ? "completed" : "reopened"}`,
      body: note ?? undefined,
      href: dealHref(dealKind, dealId),
    });
  }

  const wf = await resolveDealWorkflow(dealKind, dealId);
  if (!wf) throw new CrudError("Deal not found.");
  return wf;
}

export interface MoveDealInput {
  dealKind: DealKindEnum;
  dealId: string;
  stepKey: string;
  note?: string | null;
}

/**
 * G2 "Move deal here": mark every earlier, not-yet-done applicable step done
 * so `stepKey` becomes the current step. One StageChange per step, ONE
 * activity ("Workflow moved to <title>").
 */
export async function moveDealToWorkflowStep(input: MoveDealInput, actor: Actor = { type: "HUMAN" }): Promise<DealWorkflow> {
  const { dealKind, dealId, stepKey } = input;
  const head = await loadDealHead(dealKind, dealId);
  if (!head) throw new CrudError("Deal not found.");
  const wf = await resolveDealWorkflow(dealKind, dealId);
  if (!wf) throw new CrudError("Deal not found.");
  const target = wf.steps.find((s) => s.key === stepKey);
  if (!target) throw new CrudError(`Step "${stepKey}" is not part of this deal's workflow.`);

  const toComplete = stepsToMoveTo(wf, stepKey);
  const now = new Date();
  const note = input.note?.trim() || `Moved to ${target.title}`;
  if (toComplete.length > 0) {
    await prisma.$transaction(async (tx) => {
      for (const s of toComplete) {
        await upsertStepState(tx, { dealKind, dealId, stepKey: s.key, done: true, note }, actor, now);
      }
      await tx.activity.create({
        data: {
          type: "Note",
          subject: `Workflow moved to ${target.title}`,
          body: `${toComplete.length} earlier step(s) marked done: ${toComplete.map((s) => s.title).join(", ")}.`,
          occurredAt: now,
          createdById: actor.userId,
          createdSource: actorSource(actor),
          ...dealFk(dealKind, dealId),
        },
      });
    });
    if (head.leadId && head.leadId !== actor.userId) {
      await notify([head.leadId], {
        kind: "stage_change",
        title: `${head.name}: workflow moved to ${target.title}`,
        href: dealHref(dealKind, dealId),
      });
    }
  }

  const refreshed = await resolveDealWorkflow(dealKind, dealId);
  if (!refreshed) throw new CrudError("Deal not found.");
  return refreshed;
}
