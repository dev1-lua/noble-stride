// Pure decision logic for the proactive staff-alert sweep (client feedback
// 2026-07): which engagements/deals warrant an alert, and which candidate
// alerts survive dedupe against recent notifications. No DB, no React —
// the service layer (services/alerts.ts) feeds it plain rows.

import { STALE_CONTACT_ALERT_DAYS } from "./comm-timeline";

/** Engagement statuses that represent an in-flight conversation worth chasing. */
export const CHASEABLE_ENGAGEMENT_STATUSES = ["Contacted", "InConversation", "Interested"] as const;

/** Days without contact before an in-flight engagement is alerted (shares the
 * workspace chip's red threshold so the two surfaces agree). */
export const STALLED_ENGAGEMENT_DAYS = STALE_CONTACT_ALERT_DAYS;

/** Days sitting in the same stage before an open deal is alerted. */
export const STUCK_DEAL_DAYS = 30;

/** Suppress a repeat alert for the same (kind, href) within this window. */
export const ALERT_REPEAT_WINDOW_DAYS = 7;

export interface AlertCandidate {
  kind: "stalled_engagement" | "deal_stuck" | "task_overdue";
  title: string;
  body?: string;
  href: string;
  recipientIds: string[];
}

const DAY_MS = 86_400_000;
const daysBetween = (from: Date, to: Date) => Math.floor((to.getTime() - from.getTime()) / DAY_MS);

export function stalledEngagementAlert(
  e: {
    id: string;
    status: string;
    lastContact: Date | null;
    investorName: string;
    transactionName: string;
    ownerId: string | null;
    transactionOwnerId: string | null;
  },
  now: Date,
): AlertCandidate | null {
  if (!(CHASEABLE_ENGAGEMENT_STATUSES as readonly string[]).includes(e.status)) return null;
  const idle = e.lastContact ? daysBetween(e.lastContact, now) : null;
  if (idle !== null && idle < STALLED_ENGAGEMENT_DAYS) return null;
  const recipient = e.ownerId ?? e.transactionOwnerId;
  if (!recipient) return null;
  return {
    kind: "stalled_engagement",
    title: `${e.investorName} × ${e.transactionName}: ${idle === null ? "never contacted" : `${idle} days since last contact`}`,
    href: `/engagement/${e.id}`,
    recipientIds: [recipient],
  };
}

export function stuckDealAlert(
  d: {
    id: string;
    kind: "mandate" | "transaction" | "advisory";
    name: string;
    stageLabel: string;
    stageEnteredAt: Date;
    leadId: string | null;
    assistIds: string[];
  },
  now: Date,
): AlertCandidate | null {
  const days = daysBetween(d.stageEnteredAt, now);
  if (days < STUCK_DEAL_DAYS) return null;
  const recipients = [d.leadId, ...d.assistIds].filter((x): x is string => Boolean(x));
  if (recipients.length === 0) return null;
  const path = d.kind === "mandate" ? "mandates" : d.kind === "transaction" ? "transactions" : "advisory";
  return {
    kind: "deal_stuck",
    title: `${d.name}: ${days} days in ${d.stageLabel}`,
    href: `/${path}/${d.id}`,
    recipientIds: recipients,
  };
}

export function overdueTaskAlert(
  t: { id: string; title: string; dueAt: Date | null; assigneeId: string | null },
  now: Date,
): AlertCandidate | null {
  if (!t.assigneeId || !t.dueAt || t.dueAt >= now) return null;
  return {
    kind: "task_overdue",
    title: `Overdue: ${t.title}`,
    href: `/tasks`,
    recipientIds: [t.assigneeId],
  };
}

/**
 * Drop candidates already notified recently: a candidate is suppressed when a
 * prior notification with the same (kind, href) is still unread OR was created
 * inside the repeat window. `recent` is the pre-fetched notification set.
 */
export function dedupeAlerts(
  candidates: AlertCandidate[],
  recent: { kind: string; href: string | null; readAt: Date | null; createdAt: Date }[],
  now: Date,
): AlertCandidate[] {
  const suppressed = new Set(
    recent
      .filter((n) => n.href != null && (n.readAt === null || daysBetween(n.createdAt, now) < ALERT_REPEAT_WINDOW_DAYS))
      .map((n) => `${n.kind}:${n.href}`),
  );
  return candidates.filter((c) => !suppressed.has(`${c.kind}:${c.href}`));
}
