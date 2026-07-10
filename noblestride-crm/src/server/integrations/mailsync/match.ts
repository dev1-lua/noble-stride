// src/server/integrations/mailsync/match.ts
import type { TrackedMessage } from "./provider";

export function matchMessageToRecord(
  msg: TrackedMessage,
  known: { investorId: string; emails: string[] }[],
): { investorId?: string; matchedBy?: string } {
  const participants = new Set([msg.fromAddress, ...msg.toAddresses].filter(Boolean).map((e) => e!.toLowerCase()));
  for (const k of known) {
    if (k.emails.some((e) => participants.has(e.toLowerCase()))) {
      return { investorId: k.investorId, matchedBy: "participant" };
    }
  }
  return {};
}
