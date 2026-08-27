// DB-backed smoke tests for workflow-template CRUD (Aug-2026 feedback
// F4.1.2). `zz-` prefixed fixtures; skipped without DATABASE_URL.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { CrudError } from "@/server/services/crud";
import {
  listWorkflowTemplates,
  getWorkflowTemplate,
  createWorkflowTemplate,
  duplicateWorkflowTemplate,
  saveWorkflowTemplate,
  setDefaultWorkflowTemplate,
  deleteWorkflowTemplate,
} from "@/server/services/workflow-templates";
import { DEFAULT_WORKFLOW_TEMPLATE_ID } from "@/server/domain/workflow-default";

const hasDb = Boolean(process.env.DATABASE_URL);
const d = hasDb ? describe : describe.skip;

d("workflow-templates service (smoke)", () => {
  const created: string[] = [];
  let clientId = "";
  let mandateId = "";

  afterAll(async () => {
    if (mandateId) await prisma.mandate.delete({ where: { id: mandateId } }).catch(() => {});
    if (clientId) await prisma.client.delete({ where: { id: clientId } }).catch(() => {});
    for (const id of created) await prisma.workflowTemplate.delete({ where: { id } }).catch(() => {});
    // The seeded template must end up the default again.
    await setDefaultWorkflowTemplate(DEFAULT_WORKFLOW_TEMPLATE_ID);
  });

  beforeAll(async () => {
    const client = await prisma.client.create({ data: { name: "zz-Template Smoke Client" } });
    clientId = client.id;
  });

  it("creates a template seeded with a copy of the 13 default steps", async () => {
    const t = await createWorkflowTemplate({ name: "zz-Copy of defaults" });
    created.push(t.id);
    expect(t.isDefault).toBe(false);
    expect(t.steps).toHaveLength(13);
    expect(t.steps.map((s) => s.order)).toEqual(Array.from({ length: 13 }, (_, i) => i + 1));
    expect(t.steps[0].key).toBe("newOpportunity");
    // ids are fresh, not the seeded template's
    expect(t.steps[0].id).not.toBe("cmt439xcg000995nc32a133fj");
  });

  it("creates a template with explicit steps and lists it with counts", async () => {
    const t = await createWorkflowTemplate({
      name: "zz-Advisory assignment",
      steps: [
        { key: "newOpportunity", title: "New Opportunity", phase: "Qualify", description: null, appliesTo: [] },
        { key: "assignmentScoping", title: "Assignment Scoping", phase: "Qualify", description: null, appliesTo: ["Advisory"] },
        { key: "deliverablesHandover", title: "Deliverables handover", phase: "Execute", description: "Hand over the work product.", appliesTo: ["Advisory"] },
      ],
    });
    created.push(t.id);
    const rows = await listWorkflowTemplates();
    const row = rows.find((r) => r.id === t.id)!;
    expect(row.stepCount).toBe(3);
    expect(row.usedBy).toBe(0);
    expect(rows[0].isDefault).toBe(true); // default sorts first
  });

  it("saves a rename + reorder + add + remove, matching steps by key", async () => {
    const t = await createWorkflowTemplate({
      name: "zz-Save target",
      steps: [
        { key: "alpha", title: "Alpha", phase: "Qualify", description: null, appliesTo: [] },
        { key: "beta", title: "Beta", phase: "Prepare", description: null, appliesTo: [] },
        { key: "gamma", title: "Gamma", phase: "Execute", description: null, appliesTo: [] },
      ],
    });
    created.push(t.id);
    const betaId = t.steps.find((s) => s.key === "beta")!.id;

    const saved = await saveWorkflowTemplate(t.id, {
      name: "zz-Save target renamed",
      steps: [
        { key: "beta", title: "Beta renamed", phase: "Qualify", description: "now first", appliesTo: ["Advisory"] },
        { key: "alpha", title: "Alpha", phase: "Qualify", description: null, appliesTo: [] },
        { key: "delta", title: "Delta", phase: "Execute", description: null, appliesTo: [] },
      ],
    });
    expect(saved.name).toBe("zz-Save target renamed");
    expect(saved.steps.map((s) => s.key)).toEqual(["beta", "alpha", "delta"]);
    expect(saved.steps.map((s) => s.order)).toEqual([1, 2, 3]);
    // matched by key → same row id, so DealStageState rows keyed on it survive
    expect(saved.steps[0].id).toBe(betaId);
    expect(saved.steps[0].title).toBe("Beta renamed");
    expect(saved.steps[0].appliesTo).toEqual(["Advisory"]);
    // gamma was dropped
    expect(saved.steps.map((s) => s.key)).not.toContain("gamma");
    expect(await prisma.workflowStep.count({ where: { templateId: t.id } })).toBe(3);
  });

  it("keeps exactly one default across a flip-flop", async () => {
    const t = await createWorkflowTemplate({ name: "zz-Default candidate" });
    created.push(t.id);
    await setDefaultWorkflowTemplate(t.id);
    expect(await prisma.workflowTemplate.count({ where: { isDefault: true } })).toBe(1);
    expect((await getWorkflowTemplate(t.id))!.isDefault).toBe(true);
    expect((await getWorkflowTemplate(DEFAULT_WORKFLOW_TEMPLATE_ID))!.isDefault).toBe(false);

    await setDefaultWorkflowTemplate(DEFAULT_WORKFLOW_TEMPLATE_ID);
    expect(await prisma.workflowTemplate.count({ where: { isDefault: true } })).toBe(1);
    expect((await getWorkflowTemplate(DEFAULT_WORKFLOW_TEMPLATE_ID))!.isDefault).toBe(true);
  });

  it("refuses to delete the default template or one still in use, then deletes cleanly", async () => {
    await expect(deleteWorkflowTemplate(DEFAULT_WORKFLOW_TEMPLATE_ID)).rejects.toBeInstanceOf(CrudError);

    const t = await createWorkflowTemplate({ name: "zz-In use" });
    created.push(t.id);
    const mandate = await prisma.mandate.create({
      data: { name: "zz-Template Smoke Mandate", clientId, workflowTemplateId: t.id },
    });
    mandateId = mandate.id;
    await expect(deleteWorkflowTemplate(t.id)).rejects.toThrow(/still use this template/);

    await prisma.mandate.update({ where: { id: mandateId }, data: { workflowTemplateId: null } });
    const stepIds = (await getWorkflowTemplate(t.id))!.steps.map((s) => s.id);
    await deleteWorkflowTemplate(t.id);
    created.splice(created.indexOf(t.id), 1);
    expect(await getWorkflowTemplate(t.id)).toBeNull();
    // steps cascade
    expect(await prisma.workflowStep.count({ where: { id: { in: stepIds } } })).toBe(0);
  });

  it("duplicates a template as a non-default copy", async () => {
    const copy = await duplicateWorkflowTemplate(DEFAULT_WORKFLOW_TEMPLATE_ID);
    created.push(copy.id);
    expect(copy.name).toBe("Default Transaction Advisory Workflow (copy)");
    expect(copy.isDefault).toBe(false);
    expect(copy.steps).toHaveLength(13);
  });

  it("throws CrudError for an unknown id", async () => {
    await expect(duplicateWorkflowTemplate("zz-nope")).rejects.toBeInstanceOf(CrudError);
    await expect(setDefaultWorkflowTemplate("zz-nope")).rejects.toBeInstanceOf(CrudError);
    await expect(deleteWorkflowTemplate("zz-nope")).rejects.toBeInstanceOf(CrudError);
    await expect(saveWorkflowTemplate("zz-nope", { name: "x", steps: [{ key: "aa", title: "A", phase: "Qualify", description: null, appliesTo: [] }] })).rejects.toBeInstanceOf(CrudError);
  });
});
