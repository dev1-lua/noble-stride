import { Lua } from "lua-cli";

/**
 * The transport-verified From address of the inbound email, read from the webhook
 * payload the platform delivers. This is the ONLY trustworthy sender identity —
 * anything the model passes as an argument can be steered by a prompt-injected
 * inbound message, so security-sensitive reads (e.g. the investor self-view) must
 * bind to THIS, not to a tool argument. Returns undefined outside an email webhook
 * (dev / other channels), where callers fall back to their best-effort input.
 */
export function senderFromRequest(): string | undefined {
  try {
    const payload = (Lua.request.webhook?.payload ?? {}) as Record<string, unknown>;
    const from = payload["from"];
    if (typeof from === "string") return from.trim() || undefined;
    const nested =
      (from as Record<string, unknown> | undefined)?.["address"] ??
      (from as Record<string, unknown> | undefined)?.["email"];
    return typeof nested === "string" ? nested.trim() || undefined : undefined;
  } catch {
    return undefined;
  }
}
