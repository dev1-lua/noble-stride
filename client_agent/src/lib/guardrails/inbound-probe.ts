export interface ProbeResult {
  isProbe: boolean;
  reasons: string[];
}

// Targeted prompt-injection / data-fishing patterns for a public chat surface. Deliberately
// narrow to keep false positives off benign enquiries — this is a non-blocking flag backstop,
// not a gate, so precision matters more than recall. Kept in lockstep with
// investor_agent/src/lib/guardrails/inbound-probe.ts (the source of truth).
const PATTERNS: Array<{ re: RegExp; reason: string }> = [
  { re: /ignore\s+(all\s+|any\s+|the\s+|your\s+)?(previous|above|prior|earlier)\s+(instructions?|prompts?|messages?|rules?)/i, reason: "instruction-override" },
  { re: /disregard\s+(your|the|all|any|these)\s+(rules?|instructions?|guidelines?)/i, reason: "instruction-override" },
  { re: /\byou are now\b|\bnew instructions?\b|\bdeveloper mode\b|\bpretend to be\b|\bact as\b/i, reason: "role-override" },
  { re: /(reveal|show|print|repeat|share|tell me)\s+(me\s+)?(your\s+)?(system\s+)?(prompt|instructions?|rules?|persona|configuration)/i, reason: "prompt-extraction" },
  { re: /\b(is|are|was)\b[^.?!]{0,60}\b(in your (system|records?|crm|database|books|portfolio)|one of your (clients?|investors?|deals?|companies))/i, reason: "existence-fishing" },
  { re: /\b(do you (have|know|work with|represent)|are you (advising|working with|representing)|confirm (whether|if)|tell me if)\b[^.?!]{0,60}\b(deals?|companies|company|clients?|investors?|funds?|firms?)\b/i, reason: "existence-fishing" },
  { re: /\b(list|name|show me|tell me|what are)\b[^.?!]{0,40}\b(all\s+)?(your\s+|the\s+)?(deals?|companies|clients?|investors?|mandates?|transactions?)\b/i, reason: "enumeration" },
  { re: /\b(export|dump|full (details|list)|internal (notes?|data|documents?)|other investors?|everyone else)\b/i, reason: "data-exfil" },
];

/**
 * Pure, deterministic classification of inbound visitor text. Never performs I/O and never
 * blocks — it labels a message so the preprocessor can raise a flag while the visitor still
 * receives a warm, safe reply.
 */
export function classifyInboundProbe(text: string): ProbeResult {
  const reasons = new Set<string>();
  for (const { re, reason } of PATTERNS) {
    if (re.test(text)) reasons.add(reason);
  }
  return { isProbe: reasons.size > 0, reasons: [...reasons] };
}
