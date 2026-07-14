// client-intake.ts — server core for the public Client Agent (SOW §8.1).
// The web-chat visitor is ANONYMOUS: every function here returns minimal,
// non-record payloads (existence enums / acks) so no CRM data can flow back
// into an LLM conversation with an outsider. Writes reuse the tested intake
// pipeline (submit-intake.ts) plus Communication/Task records.

import { prisma } from "@/lib/db";
import { submitIntake } from "@/server/onboarding/submit-intake";
import { notify, adminUserIds } from "@/server/services/notifications";

export type CheckCompanyStatus = "new" | "known_verified" | "known_unverified";

export function matchClients(companyName: string) {
  return prisma.client.findMany({
    where: { name: { contains: companyName.trim(), mode: "insensitive" } },
    select: { id: true, name: true },
    take: 25,
  });
}

export function emailMatchesContact(clientIds: string[], contactEmail: string) {
  if (clientIds.length === 0) return Promise.resolve(null);
  return prisma.person.findFirst({
    where: {
      clientId: { in: clientIds },
      email: { equals: contactEmail.trim(), mode: "insensitive" },
    },
    select: { id: true, clientId: true },
  });
}

export async function checkCompany(
  companyName: string,
  contactEmail?: string | null,
): Promise<{ status: CheckCompanyStatus }> {
  // Guard: an empty/whitespace companyName would make matchClients' `contains: ""`
  // match every client, turning this into a match-all/email-existence oracle for
  // an anonymous public caller. Bail out to "new" before querying.
  if (!companyName.trim()) return { status: "new" };
  const clients = await matchClients(companyName);
  if (clients.length === 0) return { status: "new" };
  if (!contactEmail) return { status: "known_unverified" };
  const match = await emailMatchesContact(clients.map((c) => c.id), contactEmail);
  return { status: match ? "known_verified" : "known_unverified" };
}

export interface ClientIntakeExtras {
  conversationSummary: string;
  qualificationNotes?: string | null;
  attachmentUrls?: string[] | null;
}

/**
 * Web-chat intake: soft-dedupe (same company + contact email within 24h —
 * double tool-calls / retried conversations must not create twins), then the
 * standard intake pipeline with web-chat extras. Returns a bare ack: the
 * caller is an anonymous prospect's LLM loop and must never see the verdict.
 */
export async function submitClientIntake(raw: unknown, extras: ClientIntakeExtras): Promise<{ ok: true }> {
  const probe = raw as { legalName?: string; email?: string };
  if (probe?.legalName && probe?.email) {
    const dup = await prisma.mandate.findFirst({
      where: {
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        client: {
          name: { equals: probe.legalName.trim(), mode: "insensitive" },
          contacts: { some: { email: { equals: probe.email.trim(), mode: "insensitive" } } },
        },
      },
      select: { id: true },
    });
    if (dup) return { ok: true };
  }
  await submitIntake(raw, {
    via: "webchat",
    conversationSummary: extras.conversationSummary,
    qualificationNotes: extras.qualificationNotes ?? undefined,
    attachmentUrls: extras.attachmentUrls ?? undefined,
  });
  return { ok: true };
}

export type ClientMessageRequestType = "status_update" | "question" | "document" | "other";

export interface LogClientMessageInput {
  companyName: string;
  contactEmail: string;
  messageSummary: string;
  requestType: ClientMessageRequestType;
}

const REQUEST_TYPES: ReadonlySet<string> = new Set(["status_update", "question", "document", "other"]);

/**
 * Inbound message from someone claiming an existing relationship. Email-vs-
 * registered-contact match decides whether the message is logged AGAINST the
 * record (verified) or parked as an unverified-claim Task (anyone can type
 * any company name into a public chat). Nothing about the record is returned.
 */
export async function logInboundClientMessage(
  input: LogClientMessageInput,
): Promise<{ ok: true; verified: boolean }> {
  const requestType = REQUEST_TYPES.has(input.requestType) ? input.requestType : "other";
  // Guard: an empty/whitespace companyName would make matchClients' `contains: ""`
  // match every client, turning this into a match-all/email-existence oracle for
  // an anonymous public caller. Skip the lookup entirely and fall into the
  // existing unverified/client-less branch below.
  const hasCompanyName = !!input.companyName.trim();
  const clients = hasCompanyName ? await matchClients(input.companyName) : [];
  const match = hasCompanyName ? await emailMatchesContact(clients.map((c) => c.id), input.contactEmail) : null;
  const client = match?.clientId ? clients.find((c) => c.id === match.clientId) : undefined;

  if (!client) {
    await prisma.task.create({
      data: {
        title: `Unverified web-chat claim: ${input.companyName.trim()}`,
        body: `Someone claiming to represent "${input.companyName.trim()}" (${input.contactEmail.trim()}) sent a ${requestType} message via web chat. The email did not match any registered contact.\n\n${input.messageSummary}`,
        source: "Other",
      },
    });
    return { ok: true, verified: false };
  }

  await prisma.$transaction(async (tx) => {
    const activity = await tx.activity.create({
      data: {
        type: "Note",
        subject: `Inbound web chat — ${requestType}`,
        body: input.messageSummary,
        channel: "WebChat",
        direction: "Inbound",
        clientId: client.id,
        createdSource: "AGENT",
      },
    });
    await tx.task.create({
      data: {
        title: `Follow up web-chat message from ${client.name}`,
        body: input.messageSummary,
        source: "Other",
        clientId: client.id,
        activityId: activity.id,
      },
    });
  });

  // Post-commit, best-effort — same guard rationale as submitIntake's notify.
  try {
    await notify(await adminUserIds(), {
      kind: "new_intake",
      title: `Web-chat message from ${client.name}`,
      href: "/tasks",
    });
  } catch (err) {
    console.error("logInboundClientMessage: post-commit notification failed", err);
  }
  return { ok: true, verified: true };
}
