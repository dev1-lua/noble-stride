import { z } from "zod";
export const engagementCreateSchema = z.object({
  transactionId: z.string(), investorId: z.string(), name: z.string().optional(),
  engagementStage: z.string().optional(), interestLevel: z.string().optional(), ndaType: z.string().optional(),
  termSheetIssued: z.boolean().optional(), termSheetDate: z.date().optional(),
  totalAmount: z.number().optional(), amountDisbursed: z.number().optional(),
  disbursementStatus: z.string().optional(), dateReceived: z.date().optional(),
  probability: z.number().optional(), feedback: z.string().optional(), notes: z.string().optional(),
});
export const engagementUpdateSchema = engagementCreateSchema.partial();
export type EngagementCreateInput = z.infer<typeof engagementCreateSchema>;
export type EngagementUpdateInput = z.infer<typeof engagementUpdateSchema>;
