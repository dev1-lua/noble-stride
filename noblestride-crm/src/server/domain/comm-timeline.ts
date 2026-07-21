// Pure merger for the investor workspace "Communications" tab: folds logged
// Activities, Outlook-synced EmailMessages and Teams Meetings into one
// newest-first list shaped as ActivityTimelineItem DTOs (the shared timeline
// component renders Email/Meeting InteractionType values natively; `context`
// carries the provenance label). No DB, no React.

export interface CommTimelineItem {
  id: string;
  type: string; // InteractionType value
  subject?: string | null;
  body?: string | null;
  occurredAt: Date;
  context?: string | null;
  channel?: string | null;
  direction?: string | null;
  /** ActorSource of the backing Activity (e.g. "AGENT") — drives the provenance pill. */
  source?: string | null;
  /** Agent-raised review flag — drives the ⚑ timeline badge. */
  flagged?: boolean;
}

export interface CommActivityInput {
  id: string;
  type: string;
  subject?: string | null;
  body?: string | null;
  occurredAt: Date;
  channel?: string | null;
  direction?: string | null;
  createdSource?: string | null;
  flagged?: boolean;
}

export interface CommEmailInput {
  id: string;
  subject?: string | null;
  bodyPreview?: string | null;
  fromAddress?: string | null;
  direction?: string | null; // "inbound" | "outbound"
  receivedAt?: Date | null;
  sentAt?: Date | null;
  createdAt: Date;
  transactionName?: string | null;
}

export interface CommMeetingInput {
  id: string;
  subject: string;
  startAt: Date;
  transactionName?: string | null;
}

/** Communication status thresholds (shared with the staff-alert sweep):
 * days since last contact before an in-flight engagement reads as stale. */
export const STALE_CONTACT_WARN_DAYS = 7;
export const STALE_CONTACT_ALERT_DAYS = 14;

export type ContactFreshness = "fresh" | "warn" | "stale" | "never";

export function contactFreshness(lastContact: Date | null | undefined, now: Date): ContactFreshness {
  if (!lastContact) return "never";
  const days = Math.floor((now.getTime() - lastContact.getTime()) / 86_400_000);
  if (days >= STALE_CONTACT_ALERT_DAYS) return "stale";
  if (days >= STALE_CONTACT_WARN_DAYS) return "warn";
  return "fresh";
}

export function mergeCommTimeline(
  activities: CommActivityInput[],
  emails: CommEmailInput[],
  meetings: CommMeetingInput[],
): CommTimelineItem[] {
  const items: CommTimelineItem[] = [
    ...activities.map((a) => ({
      id: `act-${a.id}`,
      type: a.type,
      subject: a.subject,
      body: a.body,
      occurredAt: a.occurredAt,
      context: null,
      channel: a.channel,
      direction: a.direction,
      source: a.createdSource ?? null,
      flagged: a.flagged ?? false,
    })),
    ...emails.map((e) => ({
      id: `mail-${e.id}`,
      type: "Email",
      subject: e.subject ?? "(no subject)",
      body: e.bodyPreview ?? null,
      occurredAt: e.receivedAt ?? e.sentAt ?? e.createdAt,
      context: ["Synced from Outlook", e.fromAddress ? `from ${e.fromAddress}` : null, e.transactionName]
        .filter(Boolean)
        .join(" · "),
      channel: "Email",
      direction: e.direction === "inbound" ? "Inbound" : e.direction === "outbound" ? "Outbound" : null,
    })),
    ...meetings.map((m) => ({
      id: `meet-${m.id}`,
      type: "Meeting",
      subject: m.subject,
      body: null,
      occurredAt: m.startAt,
      context: ["Teams meeting", m.transactionName].filter(Boolean).join(" · "),
      channel: "Meeting",
      direction: null,
    })),
  ];

  return items.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
}
