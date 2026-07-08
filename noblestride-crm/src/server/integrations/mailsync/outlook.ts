// src/server/integrations/mailsync/outlook.ts
import { getGraphToken } from "../msgraph/auth";
import { IntegrationError } from "../errors";
import type { MailSyncProvider, TrackedMessage } from "./provider";

const SELECT = "subject,from,toRecipients,ccRecipients,receivedDateTime,sentDateTime,conversationId,bodyPreview,isRead";

export function mapGraphMessage(m: unknown): TrackedMessage {
  const g = m as {
    id: string; conversationId?: string; subject?: string;
    from?: { emailAddress?: { address?: string } };
    toRecipients?: { emailAddress?: { address?: string } }[];
    receivedDateTime?: string; sentDateTime?: string; bodyPreview?: string;
  };
  return {
    externalId: g.id, conversationId: g.conversationId, subject: g.subject,
    fromAddress: g.from?.emailAddress?.address,
    toAddresses: (g.toRecipients ?? []).map((r) => r.emailAddress?.address).filter((a): a is string => Boolean(a)),
    receivedAt: g.receivedDateTime ? new Date(g.receivedDateTime) : undefined,
    sentAt: g.sentDateTime ? new Date(g.sentDateTime) : undefined,
    bodyPreview: g.bodyPreview,
  };
}

export class OutlookMailProvider implements MailSyncProvider {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async listMessages(mailbox: string, since?: Date): Promise<TrackedMessage[]> {
    const token = await getGraphToken(this.fetchImpl);
    const params = new URLSearchParams({ $select: SELECT, $top: "50" });
    if (since) params.set("$filter", `receivedDateTime ge ${since.toISOString()}`);
    const res = await this.fetchImpl(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/messages?${params.toString()}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) throw new IntegrationError(`Graph mail list failed (${res.status})`, 502);
    const j = (await res.json()) as { value: unknown[] };
    return j.value.map(mapGraphMessage);
  }

  async ensureSubscription(mailbox: string, notificationUrl: string): Promise<{ subscriptionId: string; expiresAt: Date }> {
    const token = await getGraphToken(this.fetchImpl);
    const expiresAt = new Date(Date.now() + 4230 * 60 * 1000); // ~max for message subscriptions
    const res = await this.fetchImpl("https://graph.microsoft.com/v1.0/subscriptions", {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        changeType: "created", notificationUrl, resource: `/users/${mailbox}/messages`,
        expirationDateTime: expiresAt.toISOString(), clientState: "ns-crm",
      }),
    });
    if (!res.ok) throw new IntegrationError(`Graph subscription failed (${res.status})`, 502);
    const j = (await res.json()) as { id: string; expirationDateTime: string };
    return { subscriptionId: j.id, expiresAt: new Date(j.expirationDateTime) };
  }

  async renewSubscription(subscriptionId: string): Promise<{ expiresAt: Date }> {
    const token = await getGraphToken(this.fetchImpl);
    const expiresAt = new Date(Date.now() + 4230 * 60 * 1000);
    const res = await this.fetchImpl(`https://graph.microsoft.com/v1.0/subscriptions/${subscriptionId}`, {
      method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ expirationDateTime: expiresAt.toISOString() }),
    });
    if (!res.ok) throw new IntegrationError(`Graph subscription renew failed (${res.status})`, 502);
    return { expiresAt };
  }
}
