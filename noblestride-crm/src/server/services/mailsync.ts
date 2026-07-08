// src/server/services/mailsync.ts
// Thin service: match an incoming/outgoing tracked message to a known
// investor contact and upsert an EmailMessage row. No provider I/O here —
// that lives in src/server/integrations/mailsync/*.
import { prisma } from "@/lib/db";
import type { TrackedMessage } from "@/server/integrations/mailsync/provider";
import { matchMessageToRecord } from "@/server/integrations/mailsync/match";

async function knownInvestorEmails(): Promise<{ investorId: string; emails: string[] }[]> {
  const investors = await prisma.investor.findMany({ select: { id: true, contacts: { select: { email: true } } } });
  return investors.map((i) => ({ investorId: i.id, emails: i.contacts.map((c) => c.email).filter((e): e is string => Boolean(e)) }));
}

export async function ingestMessage(mailbox: string, msg: TrackedMessage): Promise<void> {
  const match = matchMessageToRecord(msg, await knownInvestorEmails());
  const direction = msg.fromAddress && msg.fromAddress.toLowerCase() === mailbox.toLowerCase() ? "outbound" : "inbound";
  await prisma.emailMessage.upsert({
    where: { provider_externalId: { provider: "outlook", externalId: msg.externalId } },
    create: {
      provider: "outlook", externalId: msg.externalId, conversationId: msg.conversationId, subject: msg.subject,
      fromAddress: msg.fromAddress, toAddresses: msg.toAddresses, direction, bodyPreview: msg.bodyPreview,
      receivedAt: msg.receivedAt, sentAt: msg.sentAt, matchedBy: match.matchedBy, investorId: match.investorId,
    },
    update: { investorId: match.investorId, matchedBy: match.matchedBy },
  });
}
