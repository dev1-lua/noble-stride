// EngagementMilestone write path (spec §6.2) — record / re-date / unrecord the
// fixed investor milestones per engagement. Display stays derived (stage-implied
// ∪ recorded, see src/lib/milestones.ts); unrecording a stage-implied milestone
// therefore does not hide it — it only removes the explicit record.

import { z } from "zod";
import { MilestoneKey } from "@prisma/client";
import { prisma } from "@/lib/db";
import { actorSource, CrudError } from "./crud";
import { notifyInvestors } from "./notifications";
import { label } from "@/lib/vocab";
import type { Actor } from "@/graphql/context";

const recordMilestoneSchema = z.object({
  engagementId: z.string().min(1),
  key: z.nativeEnum(MilestoneKey),
  completedAt: z.coerce.date().optional(),
  notes: z.string().trim().optional(),
});

export async function recordMilestone(raw: unknown, actor: Actor) {
  const input = recordMilestoneSchema.parse(raw);
  const engagement = await prisma.engagement.findUnique({
    where: { id: input.engagementId },
    select: { id: true, investorId: true, transaction: { select: { id: true, name: true } } },
  });
  if (!engagement) throw new CrudError("Engagement not found");
  const existing = await prisma.engagementMilestone.findUnique({
    where: { engagementId_key: { engagementId: input.engagementId, key: input.key } },
    select: { id: true },
  });
  const milestone = await prisma.engagementMilestone.upsert({
    where: { engagementId_key: { engagementId: input.engagementId, key: input.key } },
    create: {
      engagementId: input.engagementId,
      key: input.key,
      completedAt: input.completedAt ?? new Date(),
      notes: input.notes,
      createdSource: actorSource(actor),
    },
    update: {
      ...(input.completedAt !== undefined ? { completedAt: input.completedAt } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
    },
  });
  // Portal feed (client feedback 2026-07): first recording only — re-dating or
  // annotating an existing milestone is bookkeeping, not investor news.
  if (!existing) {
    await notifyInvestors([engagement.investorId], {
      kind: "milestone_update",
      title: `Milestone reached on ${engagement.transaction.name}: ${label("MilestoneKey", input.key)}`,
      href: `/portal/investor/pipeline`,
    });
  }
  return milestone;
}

export async function unrecordMilestone(engagementId: string, key: MilestoneKey): Promise<boolean> {
  const res = await prisma.engagementMilestone.deleteMany({ where: { engagementId, key } });
  return res.count > 0;
}
