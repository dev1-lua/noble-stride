import { z } from "zod";
import { Sector, Source, DocStatus, DealStatus, Priority, MandateStage } from "@prisma/client";

export const mandateCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  clientId: z.string().trim().min(1, "Client is required"),
  leadId: z.string().trim().optional(),
  assistIds: z.array(z.string().trim().min(1)).optional(),
  referredById: z.string().trim().optional(),
  dealStatus: z.nativeEnum(DealStatus).optional(),
  dealSize: z.number().nonnegative().optional(),
  currency: z.string().trim().min(1).optional(),
  sector: z.array(z.nativeEnum(Sector)).optional(),
  country: z.string().trim().optional(),
  source: z.nativeEnum(Source).optional(),
  stage: z.nativeEnum(MandateStage).optional(),
  qualificationVerdict: z.string().trim().optional(),
  dateOpened: z.coerce.date().optional(),
  ndaStatus: z.nativeEnum(DocStatus).optional(),
  ndaSentDate: z.coerce.date().optional(),
  ndaSignedDate: z.coerce.date().optional(),
  eaStatus: z.nativeEnum(DocStatus).optional(),
  eaSentDate: z.coerce.date().optional(),
  eaSignedDate: z.coerce.date().optional(),
  nextAction: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  // Task 8: retainer tracking + priority + referral-qualification (Task 6 migration)
  retainerAmount: z.number().nonnegative().optional(),
  retainerInvoicedDate: z.coerce.date().optional(),
  retainerPaidDate: z.coerce.date().optional(),
  // Clearable back to unset via the mandate drawer's clearableFields opt-in
  // (buildMutationInput sends "" as explicit null for these) — must accept
  // null, not just omission.
  priority: z.nativeEnum(Priority).nullable().optional(),
  referralQualified: z.boolean().nullable().optional(),
});
export const mandateUpdateSchema = mandateCreateSchema.partial();
export type MandateCreateInput = z.infer<typeof mandateCreateSchema>;
export type MandateUpdateInput = z.infer<typeof mandateUpdateSchema>;
