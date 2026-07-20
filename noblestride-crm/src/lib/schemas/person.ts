import { z } from "zod";
import { optionalPhone } from "@/lib/schemas/phone";

export const personCreateSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().optional(),
  email: z.string().trim().optional(),
  phone: optionalPhone,
  jobTitle: z.string().trim().optional(),
  linkedinUrl: z.string().trim().optional(),
  isPrimaryContact: z.boolean().optional(),
  isSSAContact: z.boolean().optional(),
  investorId: z.string().trim().nullish(),
  clientId: z.string().trim().nullish(),
  partnerId: z.string().trim().nullish(),
});
export const personUpdateSchema = personCreateSchema.partial();
export type PersonCreateInput = z.infer<typeof personCreateSchema>;
export type PersonUpdateInput = z.infer<typeof personUpdateSchema>;
