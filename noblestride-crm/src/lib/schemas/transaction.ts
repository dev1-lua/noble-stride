import { z } from "zod";
import { Sector, DealType, Instrument, DealStatus, DealMilestone, DealFinancingType, MaxSellingStake } from "@prisma/client";

export const transactionCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  clientId: z.string().trim().min(1, "Client is required"),
  mandateId: z.string().trim().optional(),
  ownerId: z.string().trim().optional(),
  assistantId: z.string().trim().optional(),
  dealType: z.nativeEnum(DealType).optional(),
  instrument: z.array(z.nativeEnum(Instrument)).optional(),
  targetRaise: z.number().nonnegative().optional(),
  currency: z.string().trim().min(1).optional(),
  sector: z.array(z.nativeEnum(Sector)).optional(),
  dateOpened: z.coerce.date().optional(),
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
});
export const transactionUpdateSchema = transactionCreateSchema.partial();
export type TransactionCreateInput = z.infer<typeof transactionCreateSchema>;
export type TransactionUpdateInput = z.infer<typeof transactionUpdateSchema>;
