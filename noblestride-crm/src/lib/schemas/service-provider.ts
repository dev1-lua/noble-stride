import { z } from "zod";
import { ServiceProviderType } from "@prisma/client";

export const serviceProviderCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  type: z.nativeEnum(ServiceProviderType),
  contactPerson: z.string().trim().optional(),
  email: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  profile: z.string().trim().optional(),
  fee: z.number().nonnegative().optional(),
  currency: z.string().trim().min(1).optional(),
  status: z.string().trim().optional(),
});
export const serviceProviderUpdateSchema = serviceProviderCreateSchema.partial();
export type ServiceProviderCreateInput = z.infer<typeof serviceProviderCreateSchema>;
export type ServiceProviderUpdateInput = z.infer<typeof serviceProviderUpdateSchema>;
