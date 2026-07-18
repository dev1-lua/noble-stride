// Proactive staff-alert sweep (client feedback 2026-07) — run by the Vercel
// cron route /api/cron/alerts. Loads candidate rows, applies the pure
// decision logic in domain/alerts.ts, dedupes against recent notifications,
// and writes via notify(). Thin layer: Prisma + domain helpers only.

import { prisma } from "@/lib/db";
import { label } from "@/lib/vocab";
import { CLOSED_TXN_STAGES } from "@/server/domain/types";
import {
  stalledEngagementAlert,
  stuckDealAlert,
  overdueTaskAlert,
  dedupeAlerts,
  ALERT_REPEAT_WINDOW_DAYS,
  CHASEABLE_ENGAGEMENT_STATUSES,
  type AlertCandidate,
} from "@/server/domain/alerts";
import { notify } from "./notifications";
import type { EngagementStatus } from "@prisma/client";

export interface StaffAlertsResult {
  candidates: number;
  deduped: number;
  notified: number;
}

export async function runStaffAlerts(now = new Date()): Promise<StaffAlertsResult> {
  const [engagements, mandates, transactions, advisory, tasks] = await Promise.all([
    prisma.engagement.findMany({
      where: { status: { in: CHASEABLE_ENGAGEMENT_STATUSES as unknown as EngagementStatus[] } },
      select: {
        id: true,
        status: true,
        lastContact: true,
        ownerId: true,
        investor: { select: { name: true } },
        transaction: { select: { name: true, ownerId: true } },
      },
    }),
    prisma.mandate.findMany({
      where: { dealStatus: "Open", stage: { notIn: ["Signed", "Lost"] } },
      select: { id: true, name: true, stage: true, stageEnteredAt: true, leadId: true, assists: { select: { id: true } } },
    }),
    prisma.transaction.findMany({
      where: { dealStatus: "Open", stage: { notIn: CLOSED_TXN_STAGES } },
      select: { id: true, name: true, stage: true, stageEnteredAt: true, ownerId: true, assists: { select: { id: true } } },
    }),
    prisma.advisoryEngagement.findMany({
      where: { dealStatus: "Open", stage: { notIn: ["Completed", "Lost"] } },
      select: { id: true, name: true, stage: true, stageEnteredAt: true, leadId: true, assists: { select: { id: true } } },
    }),
    prisma.task.findMany({
      where: { status: { notIn: ["Done", "Dropped"] }, dueAt: { lt: now }, assigneeId: { not: null } },
      select: { id: true, title: true, dueAt: true, assigneeId: true },
    }),
  ]);

  const candidates: AlertCandidate[] = [
    ...engagements
      .map((e) =>
        stalledEngagementAlert(
          {
            id: e.id,
            status: e.status,
            lastContact: e.lastContact,
            investorName: e.investor.name,
            transactionName: e.transaction.name,
            ownerId: e.ownerId,
            transactionOwnerId: e.transaction.ownerId,
          },
          now,
        ),
      )
      .filter((a): a is AlertCandidate => a !== null),
    ...mandates
      .map((m) =>
        stuckDealAlert(
          { id: m.id, kind: "mandate", name: m.name, stageLabel: label("MandateStage", m.stage), stageEnteredAt: m.stageEnteredAt, leadId: m.leadId, assistIds: m.assists.map((a) => a.id) },
          now,
        ),
      )
      .filter((a): a is AlertCandidate => a !== null),
    ...transactions
      .map((t) =>
        stuckDealAlert(
          { id: t.id, kind: "transaction", name: t.name, stageLabel: label("TransactionStage", t.stage), stageEnteredAt: t.stageEnteredAt, leadId: t.ownerId, assistIds: t.assists.map((a) => a.id) },
          now,
        ),
      )
      .filter((a): a is AlertCandidate => a !== null),
    ...advisory
      .map((a) =>
        stuckDealAlert(
          { id: a.id, kind: "advisory", name: a.name, stageLabel: label("AdvisoryStage", a.stage), stageEnteredAt: a.stageEnteredAt, leadId: a.leadId, assistIds: a.assists.map((u) => u.id) },
          now,
        ),
      )
      .filter((c): c is AlertCandidate => c !== null),
    ...tasks.map((t) => overdueTaskAlert(t, now)).filter((a): a is AlertCandidate => a !== null),
  ];

  // Dedupe against every alert-kind notification created inside the repeat
  // window (or still unread) — one query, filtered in the pure helper.
  const windowStart = new Date(now.getTime() - ALERT_REPEAT_WINDOW_DAYS * 86_400_000);
  const recent = await prisma.notification.findMany({
    where: {
      kind: { in: ["stalled_engagement", "deal_stuck", "task_overdue"] },
      OR: [{ readAt: null }, { createdAt: { gte: windowStart } }],
    },
    select: { kind: true, href: true, readAt: true, createdAt: true },
  });

  const fresh = dedupeAlerts(candidates, recent, now);
  for (const alert of fresh) {
    await notify(alert.recipientIds, { kind: alert.kind, title: alert.title, body: alert.body, href: alert.href });
  }

  return { candidates: candidates.length, deduped: candidates.length - fresh.length, notified: fresh.length };
}
