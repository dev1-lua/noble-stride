// workflow-templates.ts — admin CRUD for workflow templates (Aug-2026
// feedback F4.1.2/F4.1.3, image14: "stages must be customisable, new
// templates per deal"). Called only from the /settings/workflows server
// actions, which gate on requireRealAdmin().
//
// Invariant: at most ONE template may be `isDefault`. Enforced twice — the
// raw-SQL partial unique index `WorkflowTemplate_single_default` (migration
// 20260822140000) and the clear-then-set $transaction in
// setDefaultWorkflowTemplate.

import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { CrudError } from "./crud";
import { DEFAULT_WORKFLOW_STEPS } from "@/server/domain/workflow-default";
import type { WorkflowStepInput, WorkflowTemplateSaveInput } from "@/lib/schemas/workflow";

export interface WorkflowTemplateSummary {
  id: string;
  name: string;
  isDefault: boolean;
  stepCount: number;
  /** Deals currently pinned to this template (mandates + transactions + advisory). */
  usedBy: number;
  usedByBreakdown: { mandates: number; transactions: number; advisory: number };
  updatedAt: Date;
}

export async function listWorkflowTemplates(): Promise<WorkflowTemplateSummary[]> {
  const rows = await prisma.workflowTemplate.findMany({
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    include: {
      _count: { select: { steps: true, mandates: true, transactions: true, advisoryEngagements: true } },
    },
  });
  return rows.map((t) => ({
    id: t.id,
    name: t.name,
    isDefault: t.isDefault,
    stepCount: t._count.steps,
    usedBy: t._count.mandates + t._count.transactions + t._count.advisoryEngagements,
    usedByBreakdown: {
      mandates: t._count.mandates,
      transactions: t._count.transactions,
      advisory: t._count.advisoryEngagements,
    },
    updatedAt: t.updatedAt,
  }));
}

export async function getWorkflowTemplate(id: string) {
  return prisma.workflowTemplate.findUnique({
    where: { id },
    include: { steps: { orderBy: { order: "asc" } } },
  });
}

/** Steps for a brand-new template: a copy of the org defaults, without their ids. */
function defaultStepsCopy(): WorkflowStepInput[] {
  return DEFAULT_WORKFLOW_STEPS.map((s) => ({
    key: s.key,
    title: s.title,
    phase: s.phase,
    description: s.description,
    appliesTo: [...s.appliesTo],
  }));
}

export async function createWorkflowTemplate(input: { name: string; steps?: WorkflowStepInput[] }) {
  const steps = input.steps && input.steps.length > 0 ? input.steps : defaultStepsCopy();
  return prisma.workflowTemplate.create({
    data: {
      name: input.name,
      isDefault: false,
      steps: {
        create: steps.map((s, i) => ({
          key: s.key,
          title: s.title,
          phase: s.phase,
          description: s.description ?? null,
          order: i + 1,
          appliesTo: s.appliesTo ?? [],
        })),
      },
    },
    include: { steps: { orderBy: { order: "asc" } } },
  });
}

export async function duplicateWorkflowTemplate(id: string) {
  const source = await prisma.workflowTemplate.findUnique({
    where: { id },
    include: { steps: { orderBy: { order: "asc" } } },
  });
  if (!source) throw new CrudError("Template not found.");
  return createWorkflowTemplate({
    name: `${source.name} (copy)`.slice(0, 80),
    steps: source.steps.map((s) => ({
      key: s.key,
      title: s.title,
      phase: s.phase,
      description: s.description,
      appliesTo: s.appliesTo,
    })),
  });
}

/**
 * Replace a template's name + step list. Steps are matched by `key`:
 * existing keys are updated in place (so DealStageState rows keyed on them
 * survive), new keys are created, and keys no longer present are deleted.
 * `order` is re-derived from array position.
 */
export async function saveWorkflowTemplate(id: string, input: WorkflowTemplateSaveInput) {
  const existing = await prisma.workflowTemplate.findUnique({ where: { id }, include: { steps: true } });
  if (!existing) throw new CrudError("Template not found.");

  const keptKeys = input.steps.map((s) => s.key);
  return prisma.$transaction(async (tx) => {
    await tx.workflowStep.deleteMany({ where: { templateId: id, key: { notIn: keptKeys } } });
    for (const [i, s] of input.steps.entries()) {
      await tx.workflowStep.upsert({
        where: { templateId_key: { templateId: id, key: s.key } },
        create: {
          templateId: id,
          key: s.key,
          title: s.title,
          phase: s.phase,
          description: s.description ?? null,
          order: i + 1,
          appliesTo: s.appliesTo ?? [],
        },
        update: {
          title: s.title,
          phase: s.phase,
          description: s.description ?? null,
          order: i + 1,
          appliesTo: s.appliesTo ?? [],
        },
      });
    }
    return tx.workflowTemplate.update({
      where: { id },
      data: { name: input.name },
      include: { steps: { orderBy: { order: "asc" } } },
    });
  });
}

/** Make `id` the org default, clearing any other default in the same transaction. */
export async function setDefaultWorkflowTemplate(id: string) {
  const target = await prisma.workflowTemplate.findUnique({ where: { id }, select: { id: true } });
  if (!target) throw new CrudError("Template not found.");
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.workflowTemplate.updateMany({ where: { isDefault: true, id: { not: id } }, data: { isDefault: false } });
      return tx.workflowTemplate.update({ where: { id }, data: { isDefault: true } });
    });
  } catch (err) {
    // The partial unique index is the backstop if two admins race.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new CrudError("Another default was just set — reload and retry.");
    }
    throw err;
  }
}

export async function deleteWorkflowTemplate(id: string) {
  const t = await prisma.workflowTemplate.findUnique({
    where: { id },
    include: { _count: { select: { mandates: true, transactions: true, advisoryEngagements: true } } },
  });
  if (!t) throw new CrudError("Template not found.");
  if (t.isDefault) throw new CrudError("The default template can't be deleted. Make another template the default first.");
  const usedBy = t._count.mandates + t._count.transactions + t._count.advisoryEngagements;
  if (usedBy > 0) {
    throw new CrudError(
      `${usedBy} deal(s) still use this template. Reassign them (or clear their Workflow template) before deleting.`,
    );
  }
  // Steps cascade via WorkflowStep_templateId_fkey ON DELETE CASCADE.
  return prisma.workflowTemplate.delete({ where: { id } });
}
