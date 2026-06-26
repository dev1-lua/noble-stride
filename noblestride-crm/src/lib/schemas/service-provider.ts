import { z } from "zod";

export const serviceProviderCreateSchema = z.object({
  name: z.string(),
  type: z.string(),
  contactPerson: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  profile: z.string().optional(),
  fee: z.number().optional(),
  currency: z.string().optional(),
  status: z.string().optional(),
});

export const serviceProviderUpdateSchema = serviceProviderCreateSchema.partial();
