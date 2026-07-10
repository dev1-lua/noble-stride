// src/server/integrations/mailsync/off.ts
// Disabled provider: no capture. Email remains a manual comm channel.
import type { MailSyncProvider, TrackedMessage } from "./provider";

export class OffMailProvider implements MailSyncProvider {
  async listMessages(): Promise<TrackedMessage[]> { return []; }
  async ensureSubscription(): Promise<{ subscriptionId: string; expiresAt: Date }> {
    return { subscriptionId: "", expiresAt: new Date(0) };
  }
  async renewSubscription(): Promise<{ expiresAt: Date }> { return { expiresAt: new Date(0) }; }
}
