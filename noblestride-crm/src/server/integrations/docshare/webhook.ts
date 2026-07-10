// src/server/integrations/docshare/webhook.ts
// Pure helpers for the Box event-notification webhook: HMAC verification and
// event parsing. No network/DB access here so these are cheap to unit test;
// the route (src/app/api/integrations/box/webhook/route.ts) wires them to
// prisma.documentShareEvent.
import { createHmac, timingSafeEqual } from "node:crypto";

// Box signs with HMAC-SHA256 over (body + timestamp) using primary/secondary
// keys — either key matching is a valid signature (Box rotates keys without
// downtime by accepting both during rotation).
export function verifyBoxSignature(
  rawBody: string,
  headers: { signaturePrimary: string | null; signatureSecondary: string | null; timestamp: string | null },
  primary: string,
  secondary: string,
): boolean {
  const check = (key: string, sig: string | null) => {
    if (!key || !sig) return false;
    const mac = createHmac("sha256", key).update(rawBody + (headers.timestamp ?? ""), "utf8").digest("base64");
    const a = Buffer.from(mac);
    const b = Buffer.from(sig);
    return a.length === b.length && timingSafeEqual(a, b);
  };
  return check(primary, headers.signaturePrimary) || check(secondary, headers.signatureSecondary);
}

export function parseBoxEvent(json: unknown): { trigger: string; boxFileId: string } | null {
  const j = json as { trigger?: string; source?: { id?: string; type?: string } } | null;
  if (!j?.trigger || j.source?.type !== "file" || !j.source.id) return null;
  if (j.trigger !== "FILE.PREVIEWED" && j.trigger !== "FILE.DOWNLOADED") return null;
  return { trigger: j.trigger, boxFileId: j.source.id };
}
