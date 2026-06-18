// Activity service — single source of truth over Prisma for activity/interaction data.
// Thin layer: Prisma calls + domain helpers only. No GraphQL, no React.

import { prisma } from "@/lib/db";
import type { InteractionType } from "@prisma/client";

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Return the most recent activities (newest first), with all related records.
 * Defaults to the last 50 entries.
 */
export async function activityTimeline(limit?: number) {
  return prisma.activity.findMany({
    orderBy: { occurredAt: "desc" },
    take: limit ?? 50,
    include: {
      investor: true,
      transaction: true,
      mandate: true,
      engagement: true,
      createdBy: true,
    },
  });
}

// ─── Engagement counter shape ─────────────────────────────────────────────────

export interface EngagementCounters {
  outreach: number;
  ndaSigned: number;
  dataRoom: number;
  meetings: number;
  feedback: number;
  termSheets: number;
}

/**
 * Return counts of Activity records by interaction type using a single groupBy
 * query (no N+1). Unmapped types are ignored; missing types default to 0.
 */
export async function engagementCounters(): Promise<EngagementCounters> {
  const rows = await prisma.activity.groupBy({
    by: ["type"],
    _count: { _all: true },
  });

  // Build a lookup map from the flat groupBy result
  const byType: Partial<Record<InteractionType, number>> = {};
  for (const row of rows) {
    byType[row.type] = row._count._all;
  }

  return {
    outreach: byType["Outreach"] ?? 0,
    ndaSigned: byType["NDASigned"] ?? 0,
    dataRoom: byType["DataRoomAccess"] ?? 0,
    meetings: byType["Meeting"] ?? 0,
    feedback: byType["Feedback"] ?? 0,
    termSheets: byType["TermSheet"] ?? 0,
  };
}
