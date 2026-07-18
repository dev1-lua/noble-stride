// Notification service — single source of truth over Prisma for the in-app
// notification bell (Task 14). Thin layer: Prisma calls + domain helpers
// only. No GraphQL, no React.
//
// `notify()` is a best-effort side effect: callers invoke it AFTER their core
// `prisma.$transaction` has committed, so a notification failure can never
// roll back (or even be blamed for) the underlying business mutation. As
// defense-in-depth for call sites that might ever call it differently, the
// write itself is wrapped in try/catch and swallowed (logged) rather than
// re-thrown — `notify` must never surface an error to its caller.

import { prisma } from "@/lib/db";
import type { Notification } from "@prisma/client";

export type NotificationKind =
  | "stage_change"
  | "task_overdue"
  | "new_registration"
  | "new_intake"
  | "interest_expressed"
  // Proactive staff alerts (cron sweep, client feedback 2026-07)
  | "stalled_engagement"
  | "deal_stuck"
  // Investor-portal notifications (Notification.investorId recipients)
  | "deal_shared"
  | "document_shared"
  | "milestone_update";

export interface NotifyInput {
  kind: NotificationKind;
  title: string;
  body?: string;
  href?: string;
}

/**
 * Create one Notification row per recipient. Dedupes `userIds`, drops
 * falsy/empty entries, and no-ops silently if nothing remains — callers can
 * pass an unfiltered recipient list (e.g. `[leadId]` where `leadId` may be
 * null) without a guard. Never throws.
 */
export async function notify(userIds: (string | null | undefined)[], n: NotifyInput): Promise<void> {
  const recipients = Array.from(new Set(userIds.filter((id): id is string => Boolean(id))));
  if (recipients.length === 0) return;

  try {
    await prisma.notification.createMany({
      data: recipients.map((userId) => ({
        userId,
        kind: n.kind,
        title: n.title,
        body: n.body,
        href: n.href,
      })),
    });
  } catch (err) {
    // Best-effort: a notification failure must never fail the caller's
    // (already-committed) business mutation.
    console.error("notify: failed to create notification(s)", err);
  }
}

/**
 * Investor-portal counterpart of notify(): one row per investor recipient
 * (Notification.investorId set, userId null — the schema allows either).
 * Same best-effort contract: never throws.
 */
export async function notifyInvestors(investorIds: (string | null | undefined)[], n: NotifyInput): Promise<void> {
  const recipients = Array.from(new Set(investorIds.filter((id): id is string => Boolean(id))));
  if (recipients.length === 0) return;

  try {
    await prisma.notification.createMany({
      data: recipients.map((investorId) => ({
        investorId,
        kind: n.kind,
        title: n.title,
        body: n.body,
        href: n.href,
      })),
    });
  } catch (err) {
    console.error("notifyInvestors: failed to create notification(s)", err);
  }
}

/** Latest unread portal notifications for an investor, newest first. */
export async function unreadForInvestor(investorId: string, limit = 15): Promise<Notification[]> {
  return prisma.notification.findMany({
    where: { investorId, readAt: null },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/** Unread count for an investor — powers the portal bell badge. */
export async function unreadCountForInvestor(investorId: string): Promise<number> {
  return prisma.notification.count({ where: { investorId, readAt: null } });
}

/** Mark the given notification ids read, scoped to the investor. */
export async function markInvestorNotificationsRead(investorId: string, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const result = await prisma.notification.updateMany({
    where: { id: { in: ids }, investorId, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count;
}

/** Latest unread notifications for a user, newest first. */
export async function unreadFor(userId: string, limit = 15): Promise<Notification[]> {
  return prisma.notification.findMany({
    where: { userId, readAt: null },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/** Unread count for a user — powers the bell badge. */
export async function unreadCountFor(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

/** All active Admin user ids — recipients for org-wide alerts (new registration/intake). */
export async function adminUserIds(): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: { role: "Admin", isActive: true },
    select: { id: true },
  });
  return admins.map((u) => u.id);
}

/**
 * Mark the given notification ids read, scoped to `userId` so a user can
 * only ever mark their own notifications. Returns the number of rows
 * touched.
 */
export async function markNotificationsRead(userId: string, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const result = await prisma.notification.updateMany({
    where: { id: { in: ids }, userId, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count;
}

/** Mark every unread notification for `userId` read. Returns the count touched. */
export async function markAllNotificationsRead(userId: string): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count;
}
