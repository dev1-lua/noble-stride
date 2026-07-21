import { PostProcessor } from "lua-cli";
import { scanOutbound } from "../lib/guardrails/outbound-scan";
import { recordFlagEvent } from "../lib/flagging";
import { senderFromRequest } from "../lib/request-sender";

// 2026-07-21 QA fix: must not claim the message was filed/forwarded — no log tool ran on
// this path, so the old "I've made sure the team has it" wording asserted an action that
// never happened.
export const SAFE_ACK =
  "Thank you for your message. I'm not able to go into that in an automated reply — your usual Noblestride contact is the right person for anything specific, and they'll be glad to help.\n\nNoblestride Investor Relations";

export const SIGN_OFF = "Noblestride Investor Relations";

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

/**
 * Deterministic sign-off (2026-07-21 QA: the persona's "always sign off" rule was honored in
 * 0/14 organic replies). Appended here so it can never be dropped; the contains-check keeps
 * an already-signed reply (including SAFE_ACK) from being doubled.
 */
export function withSignOff(response: string): string {
  if (response.toLowerCase().includes(SIGN_OFF.toLowerCase())) return response;
  return `${response.replace(/\s+$/, "")}\n\n${SIGN_OFF}`;
}

export const outboundLeakGuard = new PostProcessor({
  name: "outbound-leak-guard",
  description: "Fail-closed scan of every outbound reply; replaces anything that could leak confidential data with a safe acknowledgment and flags it. Also guarantees the Investor Relations sign-off.",
  priority: 100, // run BEFORE format-normalizer (priority 200), which normalizes the final text last
  execute: async (_user, _message, response, _channel) => {
    const modifiedResponse = withSignOff(await enforceOutbound(response, senderFromRequest()));
    return { modifiedResponse };
  },
});

export default outboundLeakGuard;
