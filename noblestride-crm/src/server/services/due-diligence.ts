// Due-diligence service — deal-level DD workstream tracks (SPEC §6.2).
// Thin layer: Prisma calls only. No GraphQL, no React. Internal-only —
// nothing here is ever fed to the visibility engine.

import type { DDTrack } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ddTrackUpsertSchema, type DDTrackUpsertInput } from "@/lib/schemas/due-diligence";

/** All tracks recorded for one transaction, with owner + provider for display. */
export async function listDDTracks(transactionId: string) {
  return prisma.dueDiligenceTrack.findMany({
    where: { transactionId },
    include: { owner: true, serviceProvider: true },
    orderBy: { track: "asc" },
  });
}

/** Create-or-update one (transaction, track) row — the panel's only write. */
export async function upsertDDTrack(input: DDTrackUpsertInput) {
  const { transactionId, track, ...rest } = ddTrackUpsertSchema.parse(input);
  return prisma.dueDiligenceTrack.upsert({
    where: { transactionId_track: { transactionId, track } },
    create: { transactionId, track, ...rest },
    update: rest,
  });
}

export async function deleteDDTrack(transactionId: string, track: DDTrack) {
  return prisma.dueDiligenceTrack.delete({
    where: { transactionId_track: { transactionId, track } },
  });
}
