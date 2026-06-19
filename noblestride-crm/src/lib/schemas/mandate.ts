import { z } from "zod";
import { Sector, Source, DocStatus } from "@prisma/client";

export const mandateCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  clientId: z.string().trim().min(1, "Client is required"),
  leadId: z.string().trim().optional(),
  referredById: z.string().trim().optional(),
  dealSize: z.number().nonnegative().optional(),
  currency: z.string().trim().min(1).optional(),
  sector: z.array(z.nativeEnum(Sector)).optional(),
  source: z.nativeEnum(Source).optional(),
  dateOpened: z.coerce.date().optional(),
  ndaStatus: z.nativeEnum(DocStatus).optional(),
  ndaSentDate: z.coerce.date().optional(),
  ndaSignedDate: z.coerce.date().optional(),
  eaStatus: z.nativeEnum(DocStatus).optional(),
  eaSentDate: z.coerce.date().optional(),
  eaSignedDate: z.coerce.date().optional(),
  nextAction: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});
export const mandateUpdateSchema = mandateCreateSchema.partial();
export type MandateCreateInput = z.infer<typeof mandateCreateSchema>;
export type MandateUpdateInput = z.infer<typeof mandateUpdateSchema>;
