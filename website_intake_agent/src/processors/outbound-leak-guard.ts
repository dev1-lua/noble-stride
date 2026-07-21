import { PostProcessor, Lua } from "lua-cli";
import { scanOutbound } from "../lib/guardrails/outbound-scan";
import { recordFlagEvent } from "../lib/flagging";

export const SAFE_ACK =
  "Thanks for that — I've made sure the Noblestride team has your message, and someone will follow up with you directly. Is there anything else I can help you with?";

// The intake agent legitimately restates a visitor's OWN figures during the application, so a
// currency figure is NOT a leak here. Only record ids, existence confirmations and prompt/
// instruction echoes are hard vetoes — the things that would expose CRM state or the agent's
// own configuration.
export const HARD_VETO = new Set(["record-id", "existence-confirmation", "prompt-echo"]);

interface EnforceDeps {
  recordFlag?: (sender: string, reasons: string[]) => Promise<boolean>;
}

/**
 * Fail-closed enforcement core. If the scanner reports any HARD_VETO reason, the reply is
 * ALWAYS replaced with SAFE_ACK — the replacement never depends on the flag I/O. Flagging is
 * best-effort and swallowed so a Data outage can never let a leaked reply through.
 */
export async function enforceOutbound(
  response: string,
  sender: string | undefined,
  deps: EnforceDeps = {},
): Promise<string> {
  const scan = scanOutbound(response);
  const vetoed = scan.reasons.filter((r) => HARD_VETO.has(r));
  if (vetoed.length === 0) return response;
  const recordFlag = deps.recordFlag ?? recordFlagEvent;
  try {
    if (sender) await recordFlag(sender, vetoed.map((r) => `outbound:${r}`));
  } catch {
    /* fail-open on flag I/O ONLY — enforcement below is unconditional */
  }
  return SAFE_ACK;
}

/** Best-effort visitor identifier for flag keying on a public web-chat surface. */
export function senderKey(user: unknown): string | undefined {
  const s = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  try {
    const payload = (Lua.request.webhook?.payload ?? {}) as Record<string, unknown>;
    const fromPayload =
      s(payload["from"]) ??
      s((payload["from"] as Record<string, unknown> | undefined)?.["email"]) ??
      s(payload["email"]) ??
      s(payload["sessionId"]);
    if (fromPayload) return fromPayload;
  } catch {
    /* ignore — fall back to the user object */
  }
  const u = (user ?? {}) as Record<string, unknown>;
  return s(u["email"]) ?? s(u["uid"]);
}

export const outboundLeakGuard = new PostProcessor({
  name: "outbound-leak-guard",
  description:
    "Fail-closed scan of every outbound reply; replaces anything that could leak CRM record ids, confirm a record exists, or echo the agent's own instructions with a safe acknowledgment, and flags it.",
  execute: async (user, _message, response, _channel) => {
    const modifiedResponse = await enforceOutbound(response, senderKey(user));
    return { modifiedResponse };
  },
});

export default outboundLeakGuard;
