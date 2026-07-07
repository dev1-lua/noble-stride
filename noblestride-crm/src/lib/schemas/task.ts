import { z } from "zod";
import { TaskStatus, TaskSource } from "@prisma/client";

// Spec §3.8: a task must be linked to at least one record (mandate,
// transaction, investor, or client). `escalated` is intentionally NOT a field
// (spec §3.8 marks it Auto — computed by the task service, never caller-set).
const taskBaseSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  status: z.nativeEnum(TaskStatus).optional(),
  source: z.nativeEnum(TaskSource).optional(),
  dueAt: z.coerce.date().optional(),
  body: z.string().trim().optional(),
  assigneeId: z.string().trim().optional(),
  assistantId: z.string().trim().optional(),
  mandateId: z.string().trim().optional(),
  transactionId: z.string().trim().optional(),
  investorId: z.string().trim().optional(),
  clientId: z.string().trim().optional(),
  activityId: z.string().trim().optional(),
});

const hasLinkedRecord = (v: {
  mandateId?: string;
  transactionId?: string;
  investorId?: string;
  clientId?: string;
}) => Boolean(v.mandateId || v.transactionId || v.investorId || v.clientId);

export const taskCreateSchema = taskBaseSchema.refine(hasLinkedRecord, {
  message: "Link the task to at least one record (mandate, transaction, investor, or client).",
});
export const taskUpdateSchema = taskBaseSchema.partial();
export type TaskCreateInput = z.infer<typeof taskCreateSchema>;
export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>;
