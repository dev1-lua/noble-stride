import { PreProcessor } from "lua-cli";
import { classifyInboundProbe } from "../lib/guardrails/inbound-probe";
import { recordFlagEvent } from "../lib/flagging";
import { senderKey } from "./outbound-leak-guard";

/** Best-effort extraction of the inbound text body from a preprocessor `messages` array. */
export function textFromMessages(messages: unknown): string {
  if (!Array.isArray(messages)) return "";
  return messages
    .filter(
      (m): m is { type: string; text: string } =>
        !!m &&
        typeof m === "object" &&
        (m as { type?: unknown }).type === "text" &&
        typeof (m as { text?: unknown }).text === "string",
    )
    .map((m) => m.text)
    .join("\n");
}

export interface ProbeGuardDeps {
  classifyProbe?: typeof classifyInboundProbe;
  recordFlag?: typeof recordFlagEvent;
}

/**
 * NON-BLOCKING backstop: classify the inbound message and, if it looks like a prompt-injection
 * or data-fishing probe, raise a deduped security flag for humans. The visitor ALWAYS proceeds
 * to a warm, safe reply (the prose hard-rules + the fail-closed outbound leak guard do the
 * actual protecting). Fail-open: any flag I/O error is swallowed.
 */
export async function flagProbe(
  text: string,
  sender: string | undefined,
  deps: ProbeGuardDeps = {},
): Promise<void> {
  const classifyProbe = deps.classifyProbe ?? classifyInboundProbe;
  const recordFlag = deps.recordFlag ?? recordFlagEvent;
  const probe = classifyProbe(text);
  if (probe.isProbe && sender) {
    try {
      await recordFlag(sender, probe.reasons);
    } catch {
      /* fail-open on flag I/O only */
    }
  }
}

export const probeGuard = new PreProcessor({
  name: "probe-guard",
  description:
    "Flags prompt-injection and data-fishing attempts on the public chat surface for human review; never blocks — the visitor always gets a safe reply.",
  priority: 5,
  execute: async (user, messages, _channel) => {
    await flagProbe(textFromMessages(messages), senderKey(user));
    return { action: "proceed" as const };
  },
});

export default probeGuard;
