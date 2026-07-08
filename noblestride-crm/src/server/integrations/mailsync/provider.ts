// src/server/integrations/mailsync/provider.ts
import { outlookConfigured } from "../config";
import { OffMailProvider } from "./off";
import { OutlookMailProvider } from "./outlook";

export interface TrackedMessage {
  externalId: string;
  conversationId?: string;
  subject?: string;
  fromAddress?: string;
  toAddresses: string[];
  receivedAt?: Date;
  sentAt?: Date;
  bodyPreview?: string;
}

export interface MailSyncProvider {
  listMessages(mailbox: string, since?: Date): Promise<TrackedMessage[]>;
  ensureSubscription(mailbox: string, notificationUrl: string): Promise<{ subscriptionId: string; expiresAt: Date }>;
  renewSubscription(subscriptionId: string): Promise<{ expiresAt: Date }>;
}

export function getMailSyncProvider(): MailSyncProvider {
  if (outlookConfigured()) return new OutlookMailProvider();
  return new OffMailProvider();
}
