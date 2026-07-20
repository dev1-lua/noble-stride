export interface ScanResult {
  leaked: boolean;
  reasons: string[];
}

// High-confidence: a prisma cuid (starts c, >=25 chars) or a uuid. Note: brief's original
// {24} (exactly 25 chars total) fails to match the brief's own 28-char test token, because
// \b never lands after exactly 25 word-chars when the token continues for 3 more — widened
// to {24,} (25+ chars) so any cuid-length-or-longer alphanumeric token starting with "c" is
// caught, while staying anchored to word boundaries to avoid matching ordinary short words.
const CUID = /\bc[a-z0-9]{24,}\b/;
const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;
// High-confidence: the agent affirming a record/relationship exists.
const EXISTENCE =
  /\b(yes,?\s+(they|it|that|this|the (company|investor|deal|fund))\s+(is|are)\b[^.?!]{0,40}\b(in our|one of our|a client|an investor|registered)|we are (currently )?(advising|working with|representing)|the record shows|our (system|crm|records?) (shows?|indicates?|confirms?|has)|is (indeed )?(in our (system|records?)|a client of|registered with))/i;
// High-confidence: the reply echoing the system prompt / its own instructions.
const INJECTION_ECHO =
  /\b(system prompt|my instructions? (are|say|is)|i (was|am) (instructed|told|configured) to|here (is|are) my (rules|instructions|persona))\b/i;
// Heuristic: the agent should never quote a currency figure in a reply (the persona
// acknowledges updates without restating values), so a figure is a red flag.
const FINANCIAL =
  /(\$\s?\d[\d,]*(\.\d+)?\s?(k|m|mn|bn|million|billion)?\b|\b(usd|kes|ngn|zar|eur|gbp)\s?\d[\d,]*)/i;

/**
 * Pure, deterministic scan of an outbound reply for content the external agent must never
 * emit (spec §4.3). Honest scope: reliably catches record-id tokens, existence-confirmation
 * phrasing, and prompt/instruction echoes; financial figures are a heuristic signal. It
 * cannot know arbitrary secret values it was never given — acceptable because the inbound
 * agent never fetches deal data, so record-ids and existence confirmation are the real risks.
 */
export function scanOutbound(reply: string): ScanResult {
  const reasons: string[] = [];
  if (CUID.test(reply) || UUID.test(reply)) reasons.push("record-id");
  if (EXISTENCE.test(reply)) reasons.push("existence-confirmation");
  if (INJECTION_ECHO.test(reply)) reasons.push("prompt-echo");
  if (FINANCIAL.test(reply)) reasons.push("financial-figure");
  return { leaked: reasons.length > 0, reasons };
}
