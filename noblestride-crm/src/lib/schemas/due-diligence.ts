import { z } from "zod";
import { DDStatus, DDTrack } from "@prisma/client";

export const ddTrackUpsertSchema = z.object({
  transactionId: z.string().trim().min(1, "Transaction is required"),
  track: z.nativeEnum(DDTrack),
  status: z.nativeEnum(DDStatus).optional(),
  ownerId: z.string().trim().optional(),
  serviceProviderId: z.string().trim().optional(),
  startedAt: z.coerce.date().optional(),
  completedAt: z.coerce.date().optional(),
  notes: z.string().trim().optional(),
});
export type DDTrackUpsertInput = z.infer<typeof ddTrackUpsertSchema>;
