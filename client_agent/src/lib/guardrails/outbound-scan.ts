export interface ScanResult {
  leaked: boolean;
  reasons: string[];
}

// High-confidence: a prisma cuid (starts c, >=25 chars) or a uuid. Base36 cuids always carry
// at least one digit, so a lookahead requires one — an all-letters word never matches, while a
// real record id does. Kept identical to investor_agent/src/lib/guardrails/outbound-scan.ts,
// the source of truth for this scanner (replicated because each Lua agent bundles/deploys on
// its own; keep the two in lockstep).
const CUID = /\bc(?=[a-z0-9]*\d)[a-z0-9]{24,}\b/;
const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;
// High-confidence: the agent affirming a record/relationship exists.
const EXISTENCE =
  /\b(yes,?\s+(they|it|that|this|the (company|investor|deal|fund))\s+(is|are)\b[^.?!]{0,40}\b(in our|one of our|a client|an investor|registered)|we are (currently )?(advising|working with|representing)\s+(that|the|this|them|a|an)\b[^.?!]{0,30}\b(company|investor|deal|fund|client)|the record shows|our (system|crm|records?) (shows?|indicates?|confirms?|has)|is (indeed )?(in our (system|records?)|a client of|registered with))/i;
// High-confidence: the reply echoing the system prompt / its own instructions.
const INJECTION_ECHO =
  /\b(system prompt|my instructions? (say|is)\b|i (was|am) (instructed|told|configured) to|here (is|are) my (rules|instructions|persona))\b/i;
// Heuristic only. Unlike the investor email desk, the intake agents legitimately restate a
// visitor's OWN figures ("got it — a $2M equity raise"), so callers here treat this as a
// non-vetoing signal (see the leak-guard's HARD_VETO set), not a hard leak.
const FINANCIAL =
  /(\$\s?\d[\d,]*(\.\d+)?\s?(k|m|mn|bn|million|billion)?\b|\b(usd|kes|ngn|zar|eur|gbp)\s?\d[\d,]*)/i;

/**
 * Pure, deterministic scan of an outbound reply for content the public agent must never emit:
 * record-id tokens, existence-confirmation phrasing, prompt/instruction echoes, and (as a soft
 * signal) currency figures. Which reasons actually VETO a reply is the caller's policy.
 */
export function scanOutbound(reply: string): ScanResult {
  const reasons: string[] = [];
  if (CUID.test(reply) || UUID.test(reply)) reasons.push("record-id");
  if (EXISTENCE.test(reply)) reasons.push("existence-confirmation");
  if (INJECTION_ECHO.test(reply)) reasons.push("prompt-echo");
  if (FINANCIAL.test(reply)) reasons.push("financial-figure");
  return { leaked: reasons.length > 0, reasons };
}
