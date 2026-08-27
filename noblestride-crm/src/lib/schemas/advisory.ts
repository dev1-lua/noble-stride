import { z } from "zod";
import { Sector, Source, DealStatus, Priority, AdvisoryStage, AdvisoryClassification } from "@prisma/client";

export const advisoryCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  clientId: z.string().trim().min(1, "Client is required"),
  leadId: z.string().trim().optional(),
  assistIds: z.array(z.string().trim().min(1)).optional(),
  stage: z.nativeEnum(AdvisoryStage).optional(),
  dealStatus: z.nativeEnum(DealStatus).optional(),
  feeAmount: z.number().nonnegative().optional(),
  // Aug-2026 feedback F4.2.1: advisory work type + amount actually paid.
  // classification is clearable ("" → null via the drawer's clearableFields).
  classification: z.nativeEnum(AdvisoryClassification).nullable().optional(),
  feePaidAmount: z.number().nonnegative().optional(),
  currency: z.string().trim().min(1).optional(),
  sector: z.array(z.nativeEnum(Sector)).optional(),
  country: z.string().trim().optional(),
  source: z.nativeEnum(Source).optional(),
  dateOpened: z.coerce.date().optional(),
  nextAction: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  // Clearable back to unset via the drawer's clearableFields opt-in (see mandate.ts).
  priority: z.nativeEnum(Priority).nullable().optional(),
  // Aug-2026 feedback: per-deal workflow template; "" → null clears back to the org default.
  workflowTemplateId: z.string().trim().nullable().optional(),
});
export const advisoryUpdateSchema = advisoryCreateSchema.partial();
export type AdvisoryCreateInput = z.infer<typeof advisoryCreateSchema>;
export type AdvisoryUpdateInput = z.infer<typeof advisoryUpdateSchema>;
