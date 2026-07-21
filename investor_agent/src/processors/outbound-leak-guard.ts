import { PostProcessor } from "lua-cli";
import { scanOutbound } from "../lib/guardrails/outbound-scan";
import { recordFlagEvent } from "../lib/flagging";
import { senderFromRequest } from "../lib/request-sender";

export const SAFE_ACK =
  "Thank you for your message. I've made sure the Noblestride team has it, and your usual contact will follow up with you directly.\n\nNoblestride Investor Relations";

interface EnforceDeps {
  recordFlag?: (sender: string, reasons: string[]) => Promise<boolean>;
}

/**
 * Fail-closed enforcement core (spec §4.6). If the pure scanner flags a leak, the reply is
 * ALWAYS replaced with SAFE_ACK — the replacement never depends on the flag I/O. Flagging is
 * best-effort and swallowed so a Data outage can never let a leaked reply through.
 */
export async function enforceOutbound(response: string, sender: string | undefined, deps: EnforceDeps = {}): Promise<string> {
  const scan = scanOutbound(response);
  if (!scan.leaked) return response;
  const recordFlag = deps.recordFlag ?? recordFlagEvent;
  try {
    if (sender) await recordFlag(sender, scan.reasons.map((r) => `outbound:${r}`));
  } catch {
    /* fail-open on flag I/O ONLY — enforcement below is unconditional */
  }
  return SAFE_ACK;
}

export const outboundLeakGuard = new PostProcessor({
  name: "outbound-leak-guard",
  description: "Fail-closed scan of every outbound reply; replaces anything that could leak confidential data with a safe acknowledgment and flags it.",
  execute: async (_user, _message, response, _channel) => {
    const modifiedResponse = await enforceOutbound(response, senderFromRequest());
    return { modifiedResponse };
  },
});

export default outboundLeakGuard;
