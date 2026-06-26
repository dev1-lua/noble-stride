import { z } from "zod";
import { EngagementStage, InterestLevel, NdaType, DisbursementStatus } from "@prisma/client";
export const engagementCreateSchema = z.object({
  transactionId: z.string(), investorId: z.string(), name: z.string().optional(),
  engagementStage: z.nativeEnum(EngagementStage).optional(), interestLevel: z.nativeEnum(InterestLevel).optional(), ndaType: z.nativeEnum(NdaType).optional(),
  termSheetIssued: z.boolean().optional(), termSheetDate: z.date().optional(),
  totalAmount: z.number().optional(), amountDisbursed: z.number().optional(),
  disbursementStatus: z.nativeEnum(DisbursementStatus).optional(), dateReceived: z.date().optional(),
  probability: z.number().optional(), feedback: z.string().optional(), notes: z.string().optional(),
});
export const engagementUpdateSchema = engagementCreateSchema.partial();
export type EngagementCreateInput = z.infer<typeof engagementCreateSchema>;
export type EngagementUpdateInput = z.infer<typeof engagementUpdateSchema>;
