// NDA service — records NDAs manually (SOW §06: no automatic signing).
// Open NDA lives on the investor; Closed NDA lives on one engagement.

import type { Engagement, Investor } from "@prisma/client";
import { prisma } from "@/lib/db";
import { actorSource } from "./crud";
import type { Actor } from "@/graphql/context";

export async function recordOpenNda(investorId: string, actor: Actor): Promise<Investor> {
  return prisma.$transaction(async (tx) => {
    const investor = await tx.investor.update({
      where: { id: investorId },
      data: { ndaStatus: "OpenNDA", openNdaSignedAt: new Date() },
    });
    await tx.activity.create({
      data: {
        type: "NDASigned",
        subject: `Open NDA recorded — ${investor.name}`,
        investorId,
        createdSource: actorSource(actor),
      },
    });
    return investor;
  });
}

export async function recordClosedNda(engagementId: string, actor: Actor): Promise<Engagement> {
  return prisma.$transaction(async (tx) => {
    const engagement = await tx.engagement.update({
      where: { id: engagementId },
      data: { ndaType: "Closed", ndaSignedAt: new Date() },
      include: { investor: true },
    });
    if (engagement.investor.ndaStatus === "None") {
      await tx.investor.update({
        where: { id: engagement.investorId },
        data: { ndaStatus: "ClosedNDA" },
      });
    }
    await tx.activity.create({
      data: {
        type: "NDASigned",
        subject: `Closed NDA recorded — ${engagement.name}`,
        engagementId,
        investorId: engagement.investorId,
        transactionId: engagement.transactionId,
        createdSource: actorSource(actor),
      },
    });
    return engagement;
  });
}
