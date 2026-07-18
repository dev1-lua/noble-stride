import { z } from "zod";
import { Sector, Source, DealStatus, Priority, AdvisoryStage } from "@prisma/client";

export const advisoryCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  clientId: z.string().trim().min(1, "Client is required"),
  leadId: z.string().trim().optional(),
  assistIds: z.array(z.string().trim().min(1)).optional(),
  stage: z.nativeEnum(AdvisoryStage).optional(),
  dealStatus: z.nativeEnum(DealStatus).optional(),
  feeAmount: z.number().nonnegative().optional(),
  currency: z.string().trim().min(1).optional(),
  sector: z.array(z.nativeEnum(Sector)).optional(),
  country: z.string().trim().optional(),
  source: z.nativeEnum(Source).optional(),
  dateOpened: z.coerce.date().optional(),
  nextAction: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  // Clearable back to unset via the drawer's clearableFields opt-in (see mandate.ts).
  priority: z.nativeEnum(Priority).nullable().optional(),
});
export const advisoryUpdateSchema = advisoryCreateSchema.partial();
export type AdvisoryCreateInput = z.infer<typeof advisoryCreateSchema>;
export type AdvisoryUpdateInput = z.infer<typeof advisoryUpdateSchema>;
