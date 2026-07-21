export interface ScanResult {
  leaked: boolean;
  reasons: string[];
}

// High-confidence: a prisma cuid (starts c, >=25 chars) or a uuid. Note: brief's original
// {24} (exactly 25 chars total) fails to match the brief's own 28-char test token, because
// \b never lands after exactly 25 word-chars when the token continues for 3 more — widened
// to {24,} (25+ chars) so any cuid-length-or-longer alphanumeric token starting with "c" is
// caught, while staying anchored to word boundaries to avoid matching ordinary short words.
// M2 fix: an unbounded lowercase-only class over-matches long ordinary words that happen to
// start with "c" (e.g. a concatenated name like "christopherandersonassociates"). Real cuids
// are base36 and always contain at least one digit, so a lookahead requires one — a token of
// all letters never matches, while the digit-bearing test token still does.
const CUID = /\bc(?=[a-z0-9]*\d)[a-z0-9]{24,}\b/;
const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;
// A legitimate portal deep link (login?next=/portal/investor/deals/<id>) embeds a
// deal cuid BY DESIGN — the interested-reply flow is supposed to send it, the id
// is not sensitive (access is re-gated by login + investor viewpoint), and it is
// the one URL the agent may share. Strip that deals-path segment (encoded OR
// decoded, whichever way the model formats the URL) before the record-id scan so
// the agent's own link can't self-trip the cuid guard. A cuid appearing anywhere
// else in the reply is still caught.
const PORTAL_DEAL_LINK = /(%2f|\/)portal(%2f|\/)investor(%2f|\/)deals(%2f|\/)[a-z0-9]+/gi;
// High-confidence: the agent affirming a record/relationship exists.
// M1 fix: bare "we are (advising|working with|representing)" with no object over-triggers on
// benign warm replies like "we are working with our deal team to get you an answer." — require
// a deal/entity object (that/the/this/them/a/an + up to 30 chars + company|investor|deal|fund|
// client) after the verb so only an actual existence-confirmation trips this branch.
const EXISTENCE =
  /\b(yes,?\s+(they|it|that|this|the (company|investor|deal|fund))\s+(is|are)\b[^.?!]{0,40}\b(in our|one of our|a client|an investor|registered)|we are (currently )?(advising|working with|representing)\s+(that|the|this|them|a|an)\b[^.?!]{0,30}\b(company|investor|deal|fund|client)|the record shows|our (system|crm|records?) (shows?|indicates?|confirms?|has)|is (indeed )?(in our (system|records?)|a client of|registered with))/i;
// High-confidence: the reply echoing the system prompt / its own instructions.
// M4 fix: dropped the bare "are" branch of "my instructions? (are|say|is)" — "my instructions
// are clear" is a benign closing remark, not an echo, and neither required leaked test case
// relies on "are" (they trip "system prompt" and "here (is|are) my instructions" instead).
const INJECTION_ECHO =
  /\b(system prompt|my instructions? (say|is)\b|i (was|am) (instructed|told|configured) to|here (is|are) my (rules|instructions|persona))\b/i;
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
  // Record-id scan runs on the reply with any legitimate portal deep-link removed
  // (see PORTAL_DEAL_LINK) so the agent's own login link never counts as a leak.
  const withoutPortalLink = reply.replace(PORTAL_DEAL_LINK, "");
  if (CUID.test(withoutPortalLink) || UUID.test(withoutPortalLink)) reasons.push("record-id");
  if (EXISTENCE.test(reply)) reasons.push("existence-confirmation");
  if (INJECTION_ECHO.test(reply)) reasons.push("prompt-echo");
  if (FINANCIAL.test(reply)) reasons.push("financial-figure");
  return { leaked: reasons.length > 0, reasons };
}
