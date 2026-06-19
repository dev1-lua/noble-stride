import { z } from "zod";
import { Sector, DealType, Instrument } from "@prisma/client";

export const transactionCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  clientId: z.string().trim().min(1, "Client is required"),
  mandateId: z.string().trim().optional(),
  ownerId: z.string().trim().optional(),
  dealType: z.nativeEnum(DealType).optional(),
  instrument: z.array(z.nativeEnum(Instrument)).optional(),
  targetRaise: z.number().nonnegative().optional(),
  currency: z.string().trim().min(1).optional(),
  sector: z.array(z.nativeEnum(Sector)).optional(),
  dateOpened: z.coerce.date().optional(),
});
export const transactionUpdateSchema = transactionCreateSchema.partial();
export type TransactionCreateInput = z.infer<typeof transactionCreateSchema>;
export type TransactionUpdateInput = z.infer<typeof transactionUpdateSchema>;
