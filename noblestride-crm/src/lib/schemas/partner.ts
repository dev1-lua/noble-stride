import { z } from "zod";
import { PartnerType, PartnerStatus } from "@prisma/client";

export const partnerCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  partnerType: z.nativeEnum(PartnerType).optional(),
  profile: z.string().trim().optional(),
  status: z.nativeEnum(PartnerStatus).optional(),
  location: z.string().trim().optional(),
  amount: z.number().nonnegative().optional(),
  currency: z.string().trim().min(1).optional(),
});
export const partnerUpdateSchema = partnerCreateSchema.partial();
export type PartnerCreateInput = z.infer<typeof partnerCreateSchema>;
export type PartnerUpdateInput = z.infer<typeof partnerUpdateSchema>;
