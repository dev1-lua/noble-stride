// Stage-history write helper (SPEC §7.1) — shared by the mandate/transaction/
// engagement services that own a stage-like field. Append-only: a StageChange
// row is written only when the value actually changes, inside the caller's
// `prisma.$transaction`.

import type { Prisma } from "@prisma/client";
import { actorSource } from "./crud";
import type { Actor } from "@/graphql/context";

export type StageChangeField =
  | "stage" | "dealStatus" | "engagementStage" | "dealMilestone"
  | "name" | "registrationNo" | "primaryContact";

interface StageChangeTargets {
  mandateId?: string;
  transactionId?: string;
  engagementId?: string;
  clientId?: string;
  investorId?: string;
  partnerId?: string;
}

interface RecordStageChangeParams extends StageChangeTargets {
  field: StageChangeField;
  fromValue: string | null | undefined;
  toValue: string | null | undefined;
  actor: Actor;
}

/**
 * Create a StageChange row when `toValue` differs from `fromValue`. No-ops on
 * create (no prior value to compare) and on unchanged updates. Must be called
 * with a transaction client so the write is atomic with the entity update.
 */
export async function recordStageChange(
  tx: Prisma.TransactionClient,
  { field, fromValue, toValue, actor, ...targets }: RecordStageChangeParams,
): Promise<void> {
  if (toValue == null || fromValue === toValue) return;

  await tx.stageChange.create({
    data: {
      field,
      fromValue: fromValue ?? null,
      toValue,
      createdSource: actorSource(actor),
      changedById: actor.userId,
      ...targets,
    },
  });
}
