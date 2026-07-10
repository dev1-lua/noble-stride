// src/server/integrations/esign/webhook.ts
// Pure helpers for the DocuSign Connect webhook: HMAC verification and event
// parsing. No network/DB access here so these are cheap to unit test; the
// route (src/app/api/integrations/docusign/connect/route.ts) wires them to
// resolveEnvelopeCompletion.
import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyDocusignHmac(rawBody: string, signatureHeader: string, key: string): boolean {
  if (!key || !signatureHeader) return false;
  const expected = createHmac("sha256", key).update(rawBody, "utf8").digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function parseConnectEvent(
  json: unknown,
): { event: string; envelopeId: string; completedAt?: Date } | null {
  const j = json as { event?: string; data?: { envelopeId?: string; envelopeSummary?: { completedDateTime?: string } } };
  if (!j?.event || !j.data?.envelopeId) return null;
  const completed = j.data.envelopeSummary?.completedDateTime;
  return { event: j.event, envelopeId: j.data.envelopeId, completedAt: completed ? new Date(completed) : undefined };
}
