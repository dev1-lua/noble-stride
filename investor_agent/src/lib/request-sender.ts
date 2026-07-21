import { Lua } from "lua-cli";

/**
 * Normalize any `From` value to a bare, comparable email address.
 *
 * Inbound webhook `from` is almost always the full RFC-5322 header
 * ("Display Name <email@host>"), NOT a bare address — the same shape the
 * auto-reply-guard already strips `<…>` off. Every identity match in this
 * agent (self-view guard + CRM lookup key) needs the bare, lower-cased address,
 * so this is the single source of truth for that extraction. Returns undefined
 * when there is no parseable address.
 */
export function parseEmailAddress(raw: string | undefined | null): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  // Prefer the angle-bracketed address when a display name is present.
  const bracketed = trimmed.match(/<([^>]+)>/);
  const candidate = (bracketed ? bracketed[1] : trimmed).trim().toLowerCase();
  // Must look like an address — a bare display name ("Jane Doe") is not a sender.
  return /^[^\s@]+@[^\s@]+$/.test(candidate) ? candidate : undefined;
}

/**
 * The transport-verified From address of the inbound email, read from the webhook
 * payload the platform delivers, normalized to a bare email via parseEmailAddress.
 * This is the ONLY trustworthy sender identity — anything the model passes as an
 * argument can be steered by a prompt-injected inbound message, so security-sensitive
 * reads (e.g. the investor self-view) must bind to THIS, not to a tool argument.
 * Returns undefined outside an email webhook (dev / other channels). Callers that
 * gate identity must use verifiedSender() below — payload parsing alone does not
 * prove the email channel.
 */
export function senderFromRequest(): string | undefined {
  try {
    const payload = (Lua.request.webhook?.payload ?? {}) as Record<string, unknown>;
    const from = payload["from"];
    if (typeof from === "string") return parseEmailAddress(from);
    const nested =
      (from as Record<string, unknown> | undefined)?.["address"] ??
      (from as Record<string, unknown> | undefined)?.["email"];
    return typeof nested === "string" ? parseEmailAddress(nested) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The transport-verified sender, available ONLY on the email channel.
 *
 * A parseable `payload.from` alone is NOT proof of email transport: webchat
 * payloads can carry a visitor-typed from/email field, which would let any
 * anonymous webchat sender assert an arbitrary investor's address. So the
 * channel is checked first, and everything that is not the email channel —
 * including unknown channels and any error reading the request — resolves to
 * undefined (fail closed). Identity-sensitive tools must refuse on undefined,
 * never fall back to a model-supplied address.
 */
export function verifiedSender(): string | undefined {
  try {
    if (Lua.request.channel !== "email") return undefined;
  } catch {
    return undefined;
  }
  return senderFromRequest();
}

/**
 * Typed refusal returned by identity-sensitive tools when there is no
 * transport-verified sender (any non-email channel). The message is
 * model-facing steering; the correspondence skill tells the persona how to
 * phrase this to the visitor.
 */
export const CHANNEL_UNVERIFIED = {
  matched: false as const,
  refusal: "channel_unverified" as const,
  message:
    "Sender identity can't be verified on this channel, so no profile or record can be looked up, confirmed, or updated here. " +
    "Ask the sender to email Noblestride Investor Relations from their registered address; do not retry this tool in this conversation.",
};
