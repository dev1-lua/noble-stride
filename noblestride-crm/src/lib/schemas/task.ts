import { z } from "zod";
import { TaskStatus, TaskSource } from "@prisma/client";

// Spec §3.10: "extracted action items" — a lightweight task, optionally sourced
// from a communication/activity and linked to at most the caller's choice of
// mandate/transaction/investor/client (all optional; no one-of enforcement here,
// matching Task's existing free-linking convention in schema.prisma).
//
// Note: `escalated` is intentionally NOT a field here — spec §3.8 marks it
// Auto, so it is computed by the task service (createTask/updateTask), never
// caller-settable. Any `escalated` key on the input is stripped by zod.
export const taskCreateSchema = z.object({
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
export const taskUpdateSchema = taskCreateSchema.partial();
export type TaskCreateInput = z.infer<typeof taskCreateSchema>;
export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>;
