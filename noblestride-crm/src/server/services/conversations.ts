// Conversation service — the two-way investor↔staff thread per engagement
// (action points 2026-07: Solomon's "queue for managing an investor").
// Thin layer: Prisma calls + domain helpers only. No GraphQL, no React.
//
// Exactly ONE conversation per engagement (investor × deal). The status
// lifecycle (Pending/Open/InProgress/Closed) is the staff triage queue and is
// deliberately distinct from the deal-interest EngagementStatus.
//
// Every message also writes an Activity (channel Portal) so the existing
// Communications timeline, engagement freshness, and staff-alert sweep keep
// working unchanged — the thread is the conversation surface, the timeline
// stays the audit surface.

import { prisma } from "@/lib/db";
import type { ConversationStatus, Prisma } from "@prisma/client";
import { CrudError } from "./crud";
import { adminUserIds, notify, notifyInvestors } from "./notifications";

export interface ThreadMessage {
  id: string;
  senderKind: "INVESTOR" | "STAFF";
  /** Display name: the investor member, or the staff user ("Noblestride team" fallback). */
  senderName: string;
  body: string;
  createdAt: Date;
}

export interface Thread {
  id: string;
  engagementId: string;
  status: ConversationStatus;
  lastMessageAt: Date;
  messages: ThreadMessage[];
}

const MESSAGE_MAX = 5000;

function cleanBody(raw: string): string {
  const body = raw.trim();
  if (!body) throw new CrudError("Message cannot be empty");
  if (body.length > MESSAGE_MAX) throw new CrudError(`Message is too long (max ${MESSAGE_MAX} characters)`);
  return body;
}

const THREAD_INCLUDE = {
  messages: {
    orderBy: { createdAt: "asc" as const },
    include: {
      senderUser: { select: { name: true } },
      senderPerson: { select: { firstName: true, lastName: true } },
    },
  },
} satisfies Prisma.ConversationInclude;

type ThreadRow = Prisma.ConversationGetPayload<{ include: typeof THREAD_INCLUDE }>;

function toThread(row: ThreadRow): Thread {
  return {
    id: row.id,
    engagementId: row.engagementId,
    status: row.status,
    lastMessageAt: row.lastMessageAt,
    messages: row.messages.map((m) => ({
      id: m.id,
      senderKind: m.senderKind,
      senderName:
        m.senderKind === "STAFF"
          ? (m.senderUser?.name ?? "Noblestride team")
          : ([m.senderPerson?.firstName, m.senderPerson?.lastName].filter(Boolean).join(" ") || "Investor"),
      body: m.body,
      createdAt: m.createdAt,
    })),
  };
}

/** The engagement's thread with sender names, oldest message first. Null = no thread yet. */
export async function getThreadForEngagement(engagementId: string): Promise<Thread | null> {
  const row = await prisma.conversation.findUnique({
    where: { engagementId },
    include: THREAD_INCLUDE,
  });
  return row ? toThread(row) : null;
}

/**
 * Staff recipients for investor portal activity on an engagement (action
 * points 2026-07 item 2): every admin + the deal lead (transaction owner) +
 * deal assists + the engagement owner. notify() dedupes and drops nulls.
 */
async function staffRecipientsFor(engagement: {
  ownerId: string | null;
  transaction: { ownerId: string | null; assists: { id: string }[] };
}): Promise<(string | null)[]> {
  const admins = await adminUserIds();
  return [
    ...admins,
    engagement.transaction.ownerId,
    ...engagement.transaction.assists.map((a) => a.id),
    engagement.ownerId,
  ];
}

/** Same routing, loaded by engagement id — for callers outside this service. */
export async function staffRecipientsForEngagementId(engagementId: string): Promise<(string | null)[]> {
  const engagement = await prisma.engagement.findUnique({
    where: { id: engagementId },
    select: { ownerId: true, transaction: { select: { ownerId: true, assists: { select: { id: true } } } } },
  });
  if (!engagement) return adminUserIds();
  return staffRecipientsFor(engagement);
}

/**
 * Append a message to the engagement's thread WITHOUT the timeline Activity
 * or notification fan-out — for callers (expressInterest, requestNextStep)
 * that already write their own Activity + notification. Conversation status
 * rules match postInvestorMessage (create → Pending, Closed → Pending).
 */
export async function seedInvestorThreadMessage(engagementId: string, personId: string, body: string): Promise<void> {
  const cleaned = cleanBody(body);
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const existing = await tx.conversation.findUnique({ where: { engagementId } });
    const convo = existing
      ? await tx.conversation.update({
          where: { id: existing.id },
          data: { lastMessageAt: now, ...(existing.status === "Closed" ? { status: "Pending" as const } : {}) },
        })
      : await tx.conversation.create({ data: { engagementId, lastMessageAt: now } });
    await tx.conversationMessage.create({
      data: { conversationId: convo.id, senderKind: "INVESTOR", senderPersonId: personId, body: cleaned },
    });
  });
}

const ENGAGEMENT_SELECT = {
  id: true,
  ownerId: true,
  transactionId: true,
  investorId: true,
  investor: { select: { name: true } },
  transaction: { select: { name: true, ownerId: true, assists: { select: { id: true } } } },
} satisfies Prisma.EngagementSelect;

/**
 * Append an investor-side message to the engagement's thread, creating the
 * conversation (status Pending) when absent and reopening a Closed one back
 * to Pending. Also stamps engagement.lastContact, writes the timeline
 * Activity, and fans out bell + email notifications to staff.
 */
export async function postInvestorMessage(input: {
  engagementId: string;
  personId: string;
  body: string;
  /** Timeline/notification subject override (e.g. "requested next step: …"). */
  subject?: string;
}): Promise<Thread> {
  const body = cleanBody(input.body);
  const engagement = await prisma.engagement.findUnique({
    where: { id: input.engagementId },
    select: ENGAGEMENT_SELECT,
  });
  if (!engagement) throw new CrudError("Engagement not found");

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const existing = await tx.conversation.findUnique({ where: { engagementId: engagement.id } });
    const convo = existing
      ? await tx.conversation.update({
          where: { id: existing.id },
          // A new investor message re-enters the triage queue: Closed → Pending.
          data: { lastMessageAt: now, ...(existing.status === "Closed" ? { status: "Pending" as const } : {}) },
        })
      : await tx.conversation.create({ data: { engagementId: engagement.id, lastMessageAt: now } });
    await tx.conversationMessage.create({
      data: { conversationId: convo.id, senderKind: "INVESTOR", senderPersonId: input.personId, body },
    });
    await tx.engagement.update({ where: { id: engagement.id }, data: { lastContact: now } });
    await tx.activity.create({
      data: {
        type: "Note",
        channel: "Portal",
        direction: "Inbound",
        subject: input.subject ?? "Portal message from investor",
        body,
        engagementId: engagement.id,
        transactionId: engagement.transactionId,
        investorId: engagement.investorId,
        createdSource: "API",
      },
    });
    return convo;
  });

  // Post-commit, best-effort (notify never throws).
  await notify(await staffRecipientsFor(engagement), {
    kind: "investor_message",
    title: `${engagement.investor.name} — ${input.subject ?? "new message"} on ${engagement.transaction.name}`,
    body: body.length > 300 ? `${body.slice(0, 300)}…` : body,
    href: `/engagement/${engagement.id}#conversation`,
    email: true,
  });

  return (await getThreadForEngagement(engagement.id))!;
}

/**
 * Append a staff reply to the engagement's thread (creating the conversation
 * if staff start it proactively). Any reply moves Pending/Closed → Open;
 * InProgress is left alone. Notifies the investor org's portal bell.
 */
export async function postStaffReply(input: {
  engagementId: string;
  userId: string;
  body: string;
}): Promise<Thread> {
  const body = cleanBody(input.body);
  const engagement = await prisma.engagement.findUnique({
    where: { id: input.engagementId },
    select: ENGAGEMENT_SELECT,
  });
  if (!engagement) throw new CrudError("Engagement not found");

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const existing = await tx.conversation.findUnique({ where: { engagementId: engagement.id } });
    const reopen = existing && (existing.status === "Pending" || existing.status === "Closed");
    const convo = existing
      ? await tx.conversation.update({
          where: { id: existing.id },
          data: { lastMessageAt: now, ...(reopen ? { status: "Open" as const } : {}) },
        })
      : await tx.conversation.create({ data: { engagementId: engagement.id, lastMessageAt: now, status: "Open" } });
    await tx.conversationMessage.create({
      data: { conversationId: convo.id, senderKind: "STAFF", senderUserId: input.userId, body },
    });
    await tx.engagement.update({ where: { id: engagement.id }, data: { lastContact: now } });
    await tx.activity.create({
      data: {
        type: "Note",
        channel: "Portal",
        direction: "Outbound",
        subject: "Reply sent to investor via portal",
        body,
        engagementId: engagement.id,
        transactionId: engagement.transactionId,
        investorId: engagement.investorId,
        createdById: input.userId,
        createdSource: "HUMAN",
      },
    });
  });

  await notifyInvestors([engagement.investorId], {
    kind: "message_reply",
    title: `New reply from the Noblestride team on ${engagement.transaction.name}`,
    body: body.length > 300 ? `${body.slice(0, 300)}…` : body,
    href: `/portal/investor/deals/${engagement.transactionId}`,
  });

  return (await getThreadForEngagement(engagement.id))!;
}

/** Staff-only queue move across the full lifecycle. Returns the updated thread. */
export async function setConversationStatus(conversationId: string, status: ConversationStatus): Promise<Thread> {
  const row = await prisma.conversation.update({
    where: { id: conversationId },
    data: { status },
    include: THREAD_INCLUDE,
  });
  return toThread(row);
}
