import { z } from "zod";
import { AdvisorType, PartnerAgreementStatus, PartnerType, PartnerStatus } from "@prisma/client";

export const partnerCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  partnerType: z.nativeEnum(PartnerType).optional(),
  profile: z.string().trim().optional(),
  status: z.nativeEnum(PartnerStatus).optional(),
  location: z.string().trim().optional(),
  amount: z.number().nonnegative().optional(),
  currency: z.string().trim().min(1).optional(),
  // Task 6: advisor type, fee-sharing, partner agreement, internal-only, direct contact
  advisorType: z.nativeEnum(AdvisorType).optional(),
  organization: z.string().trim().optional(),
  email: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  feeSharingAgreement: z.boolean().optional(),
  feeSharingTerms: z.string().trim().optional(),
  partnerAgreementStatus: z.nativeEnum(PartnerAgreementStatus).optional(),
  internalOnly: z.boolean().optional(),
});
export const partnerUpdateSchema = partnerCreateSchema.partial();
export type PartnerCreateInput = z.infer<typeof partnerCreateSchema>;
export type PartnerUpdateInput = z.infer<typeof partnerUpdateSchema>;
