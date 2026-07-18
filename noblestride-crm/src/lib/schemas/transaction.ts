import { z } from "zod";
import { Sector, DealType, Instrument, DealStatus, DealMilestone, DealFinancingType, MaxSellingStake, RegulatoryStatus, Priority, PartnerFeeStatus, TransactionStage } from "@prisma/client";

export const transactionCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  clientId: z.string().trim().min(1, "Client is required"),
  mandateId: z.string().trim().optional(),
  ownerId: z.string().trim().optional(),
  /** Legacy single assistant — superseded by assistIds (kept for API back-compat). */
  assistantId: z.string().trim().optional(),
  assistIds: z.array(z.string().trim().min(1)).optional(),
  dealType: z.nativeEnum(DealType).optional(),
  instrument: z.array(z.nativeEnum(Instrument)).optional(),
  targetRaise: z.number().nonnegative().optional(),
  currency: z.string().trim().min(1).optional(),
  sector: z.array(z.nativeEnum(Sector)).optional(),
  country: z.string().trim().optional(),
  dateOpened: z.coerce.date().optional(),
  stage: z.nativeEnum(TransactionStage).optional(),
  successFeeAmount: z.number().nonnegative().optional(),
  successFeeInvoicedDate: z.coerce.date().optional(),
  successFeePaidDate: z.coerce.date().optional(),
  // Spec-gap: deal status/milestone/financing fields (spec §4.1/§4.3/§4.5/§4.7)
  dealStatus: z.nativeEnum(DealStatus).optional(),
  dealMilestone: z.nativeEnum(DealMilestone).optional(),
  financingType: z.nativeEnum(DealFinancingType).optional(),
  maxSellingStake: z.nativeEnum(MaxSellingStake).optional(),
  targetProfile: z.string().trim().optional(),
  useOfFunds: z.string().trim().optional(),
  vdrLink: z.string().trim().optional(),
  probability: z.number().int().optional(),
  notes: z.string().trim().optional(),
  referredById: z.string().trim().optional(),
  serviceProviderIds: z.array(z.string()).optional(),
  // §3.2 IC approvals + CAK/COMESA regulatory tracking
  icFirstApprovalDate: z.coerce.date().optional(),
  icSecondApprovalDate: z.coerce.date().optional(),
  cakComesaStatus: z.nativeEnum(RegulatoryStatus).optional(),
  cakComesaFiledDate: z.coerce.date().optional(),
  cakComesaApprovedDate: z.coerce.date().optional(),
  // Task 8: priority + partner fee tracking (Task 6 migration)
  // Clearable back to unset via the transaction drawer's clearableFields
  // opt-in (buildMutationInput sends "" as explicit null for these) — must
  // accept null, not just omission.
  priority: z.nativeEnum(Priority).nullable().optional(),
  partnerFeeStatus: z.nativeEnum(PartnerFeeStatus).nullable().optional(),
  partnerFeeAmount: z.number().nonnegative().optional(),
});
export const transactionUpdateSchema = transactionCreateSchema.partial();
export type TransactionCreateInput = z.infer<typeof transactionCreateSchema>;
export type TransactionUpdateInput = z.infer<typeof transactionUpdateSchema>;
