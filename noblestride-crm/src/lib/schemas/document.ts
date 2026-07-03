import { z } from "zod";
import { DocumentType, DocumentAccessLevel, DocumentStatus } from "@prisma/client";

export const documentCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  type: z.nativeEnum(DocumentType),
  version: z.string().trim().optional(),
  accessLevel: z.nativeEnum(DocumentAccessLevel).optional(),
  status: z.nativeEnum(DocumentStatus).optional(),
  fileUrl: z.string().trim().optional(),
  uploadedById: z.string().trim().optional(),
  reviewerId: z.string().trim().optional(),
  reviewedAt: z.coerce.date().optional(),
  approverId: z.string().trim().optional(),
  approvedAt: z.coerce.date().optional(),
  clientReviewedAt: z.coerce.date().optional(),
  transactionId: z.string().trim().optional(),
  clientId: z.string().trim().optional(),
  investorId: z.string().trim().optional(),
});

export const documentUpdateSchema = documentCreateSchema.partial();

export type DocumentCreateInput = z.infer<typeof documentCreateSchema>;
export type DocumentUpdateInput = z.infer<typeof documentUpdateSchema>;
