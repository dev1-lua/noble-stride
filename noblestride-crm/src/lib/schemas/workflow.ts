// schemas/workflow.ts — validation for admin workflow-template editing
// (Aug-2026 feedback F4.1.2: stages must be customisable). Pure zod + a key
// slugger; imported by both the server actions and the client editor.

import { z } from "zod";
import { WorkflowPhase, DealKind } from "@prisma/client";

/**
 * Step keys are the join between a template row and its evidence rule
 * (src/server/domain/workflow.ts). camelCase, 2..49 chars, letters/digits
 * only — immutable once saved, so a rename can never orphan DealStageState
 * rows silently.
 */
export const STEP_KEY_RE = /^[a-z][A-Za-z0-9]{1,48}$/;

export const workflowStepSchema = z.object({
  id: z.string().trim().min(1).optional(),
  key: z.string().trim().regex(STEP_KEY_RE, "Key must be camelCase letters/digits, 2–49 characters"),
  title: z.string().trim().min(1, "Title is required").max(80, "Title must be 80 characters or fewer"),
  phase: z.nativeEnum(WorkflowPhase),
  description: z.string().trim().max(400, "Description must be 400 characters or fewer").nullable().optional(),
  /** [] = applies to every deal kind. */
  appliesTo: z.array(z.nativeEnum(DealKind)).default([]),
});

export type WorkflowStepInput = z.infer<typeof workflowStepSchema>;

export const workflowTemplateSaveSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(80, "Name must be 80 characters or fewer"),
    steps: z
      .array(workflowStepSchema)
      .min(1, "A template needs at least one step")
      .max(40, "A template can hold at most 40 steps"),
  })
  .refine((v) => new Set(v.steps.map((s) => s.key)).size === v.steps.length, {
    message: "Step keys must be unique within a template",
    path: ["steps"],
  });

export type WorkflowTemplateSaveInput = z.infer<typeof workflowTemplateSaveSchema>;

/**
 * Derive a step key from its title (camelCase), de-duplicating numerically
 * against `existing`. Always returns a STEP_KEY_RE-valid key, even for empty
 * or punctuation-only titles.
 */
export function slugKey(title: string, existing: readonly string[] = []): string {
  const words = title
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  let base = words
    .map((w, i) => (i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()))
    .join("");
  // A key must start with a lower-case letter and be at least 2 characters.
  base = base.replace(/^[^A-Za-z]+/, "");
  if (base.length === 0) base = "step";
  base = base[0].toLowerCase() + base.slice(1);
  if (base.length < 2) base = `${base}1`;
  base = base.slice(0, 49);

  if (!existing.includes(base)) return base;
  for (let n = 2; ; n += 1) {
    const candidate = `${base.slice(0, 49 - String(n).length)}${n}`;
    if (!existing.includes(candidate)) return candidate;
  }
}
