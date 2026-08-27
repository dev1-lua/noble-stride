"use server";
// settings/workflows/actions.ts — admin CRUD for workflow templates
// (Aug-2026 feedback F4.1.2). Every action re-checks the REAL admin role.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRealAdmin } from "@/server/auth/require-real-admin";
import { CrudError } from "@/server/services/crud";
import {
  createWorkflowTemplate,
  duplicateWorkflowTemplate,
  saveWorkflowTemplate,
  setDefaultWorkflowTemplate,
  deleteWorkflowTemplate,
} from "@/server/services/workflow-templates";
import { workflowTemplateSaveSchema } from "@/lib/schemas/workflow";

export interface WorkflowActionState {
  error?: string;
  ok?: boolean;
}

async function run(fn: () => Promise<void>): Promise<WorkflowActionState> {
  try {
    await requireRealAdmin();
    await fn();
    revalidatePath("/settings/workflows");
    return { ok: true };
  } catch (err) {
    if (err instanceof CrudError) return { error: err.message };
    if (err instanceof Error && err.message === "Not authorized") return { error: "Not authorized." };
    throw err;
  }
}

export async function createTemplateAction(_p: WorkflowActionState, formData: FormData): Promise<WorkflowActionState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name is required." };
  let newId: string | null = null;
  const state = await run(async () => {
    const created = await createWorkflowTemplate({ name: name.slice(0, 80) });
    newId = created.id;
  });
  if (state.error) return state;
  if (newId) redirect(`/settings/workflows/${newId}`);
  return state;
}

export async function duplicateTemplateAction(_p: WorkflowActionState, formData: FormData): Promise<WorkflowActionState> {
  return run(async () => {
    await duplicateWorkflowTemplate(String(formData.get("id")));
  });
}

export async function setDefaultTemplateAction(_p: WorkflowActionState, formData: FormData): Promise<WorkflowActionState> {
  return run(async () => {
    await setDefaultWorkflowTemplate(String(formData.get("id")));
  });
}

export async function deleteTemplateAction(_p: WorkflowActionState, formData: FormData): Promise<WorkflowActionState> {
  return run(async () => {
    await deleteWorkflowTemplate(String(formData.get("id")));
  });
}

/** Save the editor's whole step list. `payload` is the JSON the client builds. */
export async function saveTemplateAction(_p: WorkflowActionState, formData: FormData): Promise<WorkflowActionState> {
  const id = String(formData.get("id"));
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(formData.get("payload") ?? "{}"));
  } catch {
    return { error: "Could not read the form payload — reload and try again." };
  }
  const result = workflowTemplateSaveSchema.safeParse(parsed);
  if (!result.success) {
    const issue = result.error.issues[0];
    return { error: issue ? `${issue.path.join(".") || "form"}: ${issue.message}` : "Invalid template." };
  }
  const state = await run(async () => {
    await saveWorkflowTemplate(id, result.data);
  });
  if (!state.error) revalidatePath(`/settings/workflows/${id}`);
  return state;
}
