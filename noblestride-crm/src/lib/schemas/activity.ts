import { z } from "zod";
import { InteractionType, CommChannel, CommDirection } from "@prisma/client";

// Generalized communication/activity logging (spec §3.10). `type` and
// `subject` (the communication summary) are required; channel/direction/body/
// occurredAt are optional; the caller may link ANY one-or-more of
// client/mandate/transaction/investor/engagement. The "at least one link"
// invariant is a cross-field domain rule enforced by the service (logActivity
// throws CrudError), not here — zod only validates shape and coerces types,
// matching the split used by the other create schemas.
export const logActivitySchema = z.object({
  type: z.nativeEnum(InteractionType),
  channel: z.nativeEnum(CommChannel).optional(),
  direction: z.nativeEnum(CommDirection).optional(),
  subject: z.string().trim().min(1, "Summary is required"),
  body: z.string().trim().optional(),
  flagged: z.boolean().optional(),
  occurredAt: z.coerce.date().optional(),
  clientId: z.string().trim().optional(),
  mandateId: z.string().trim().optional(),
  transactionId: z.string().trim().optional(),
  investorId: z.string().trim().optional(),
  engagementId: z.string().trim().optional(),
});

export type LogActivityInput = z.infer<typeof logActivitySchema>;
