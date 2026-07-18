"use server";

// Portal notification mark-read actions — server actions (NOT the internal
// GraphQL surface, which is staff-only). Scoped by the session viewpoint: an
// investor can only ever touch their own rows; ids from the client are
// re-filtered by investorId inside the service.

import { getViewpoint } from "@/server/viewpoint";
import { markInvestorNotificationsRead } from "@/server/services/notifications";
import { prisma } from "@/lib/db";

async function currentInvestorId(): Promise<string | null> {
  const vp = await getViewpoint();
  return vp?.role === "investor" && vp.recordId ? vp.recordId : null;
}

export async function markPortalNotificationsRead(ids: string[]): Promise<number> {
  const investorId = await currentInvestorId();
  if (!investorId) return 0;
  return markInvestorNotificationsRead(investorId, ids);
}

export async function markAllPortalNotificationsRead(): Promise<number> {
  const investorId = await currentInvestorId();
  if (!investorId) return 0;
  const result = await prisma.notification.updateMany({
    where: { investorId, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count;
}
