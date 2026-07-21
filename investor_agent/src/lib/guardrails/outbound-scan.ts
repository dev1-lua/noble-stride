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
// High-confidence: the agent affirming a record/relationship exists.
// M1 fix: bare "we are (advising|working with|representing)" with no object over-triggers on
// benign warm replies like "we are working with our deal team to get you an answer." — require
// a deal/entity object (that/the/this/them/a/an + up to 30 chars + company|investor|deal|fund|
// client) after the verb so only an actual existence-confirmation trips this branch.
// 2026-07-21 QA fix: these phrases also appear inside the agent's own REFUSALS ("I can't
// confirm whether Acme is a client of ours") — existence/echo matches are therefore suppressed
// when a refusal cue precedes the match within the same clause (see refusedBefore below).
// The "our records show" branch carries a `(?<!what\s)` lookbehind: "what our records
// show for your status" is an offer/reference ("I can share what our system shows once
// verified"), not a disclosure — only "our records show <fact>" is.
const EXISTENCE =
  /\b(yes,?\s+(they|it|that|this|the (company|investor|deal|fund))\s+(is|are)\b[^.?!]{0,40}\b(in our|one of our|a client|an investor|registered)|we are (currently )?(advising|working with|representing)\s+(that|the|this|them|a|an)\b[^.?!]{0,30}\b(company|investor|deal|fund|client)|the record shows|(?<!what\s)our (system|crm|records?) (shows?|indicates?|confirms?|has)|is (indeed )?(in our (system|records?)|a client of|registered with))/i;
// High-confidence: the reply DISCLOSING the system prompt / its own instructions.
// M4 fix: dropped the bare "are" branch of "my instructions? (are|say|is)" — "my instructions
// are clear" is a benign closing remark, not an echo.
// 2026-07-21 QA fix: dropped the bare "system prompt" alternative — "I can't share my system
// prompt" is a correct refusal, not an echo. Each remaining branch requires disclosure framing
// ("here is my…", "my system prompt says…", "system prompt:" introducing content). No trailing
// \b after the colon branch: a space after ":" would make \b fail, and the colon already ends
// the phrase.
const INJECTION_ECHO =
  /\b(?:here (?:is|are) my (?:system prompt|rules|instructions|persona)\b|my system prompt (?:is|says|reads)\b|system prompt\s*:|my instructions? (?:say|is)\b|i (?:was|am) (?:instructed|told|configured) to\b)/i;
// Heuristic: the agent should never quote a currency figure in a reply (the persona
// acknowledges updates without restating values), so a figure is a red flag.
const FINANCIAL =
  /(\$\s?\d[\d,]*(\.\d+)?\s?(k|m|mn|bn|million|billion)?\b|\b(usd|kes|ngn|zar|eur|gbp)\s?\d[\d,]*)/i;

// ── Refusal-context suppression (2026-07-21 QA fix) ─────────────────────────
// EXISTENCE and INJECTION_ECHO phrases occur verbatim inside correct refusals, and the
// guard was clobbering those refusals with SAFE_ACK. A match is suppressed only when a
// refusal cue appears BEFORE it within the same clause — clause-level, not sentence-level,
// because "I can't share details, but yes, they are one of our clients" packs a refusal cue
// and a real leak into one sentence; the contrastive "but" starts a new clause, so the leak
// still fires. Only preceding text matters: a cue after the match can't be excusing it.
// Boundaries are sentence enders, semicolons, and contrastive conjunctions ONLY — commas,
// colons, parens, and dashes are NOT boundaries, because refusals routinely carry
// parenthetical asides ("…whether Acme Corp — or any company — is in our records") that
// must not sever the cue from the match (found live in the 2026-07-21 sandbox re-test).
const REFUSAL_CUE =
  /\b(can(?:'|no)?t|can not|won'?t|unable to|not able to|not (?:going|permitted|allowed|at liberty) to|whether|don'?t (?:share|disclose|confirm|discuss)|never (?:confirm|share|disclose|discuss)|without confirming)\b/i;

const CLAUSE_BOUNDARY = /[.!?;\n]|\b(?:but|however|although|though|yet)\b/gi;

function refusedBefore(text: string, matchIndex: number): boolean {
  let clauseStart = 0;
  for (const b of text.slice(0, matchIndex).matchAll(CLAUSE_BOUNDARY)) {
    clauseStart = (b.index ?? 0) + b[0].length;
  }
  return REFUSAL_CUE.test(text.slice(clauseStart, matchIndex));
}

/** True when at least one match of `re` is NOT inside a refusal clause — a refused first
 *  match must never shield a genuine second one later in the reply. */
function firesOutsideRefusal(re: RegExp, text: string): boolean {
  const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  for (const m of text.matchAll(g)) {
    if (!refusedBefore(text, m.index ?? 0)) return true;
  }
  return false;
}

/**
 * Pure, deterministic scan of an outbound reply for content the external agent must never
 * emit (spec §4.3). Honest scope: reliably catches record-id tokens, existence-confirmation
 * phrasing, and prompt/instruction echoes; financial figures are a heuristic signal. It
 * cannot know arbitrary secret values it was never given — acceptable because the inbound
 * agent never fetches deal data, so record-ids and existence confirmation are the real risks.
 * Known residual: a leak actively phrased AS a negation in one clause ("I cannot deny that
 * Acme is a client of ours") is suppressed by the refusal exclusion — the scanner is a
 * heuristic backstop behind the persona rules, not a proof.
 */
export function scanOutbound(reply: string): ScanResult {
  const reasons: string[] = [];
  if (CUID.test(reply) || UUID.test(reply)) reasons.push("record-id");
  if (firesOutsideRefusal(EXISTENCE, reply)) reasons.push("existence-confirmation");
  if (firesOutsideRefusal(INJECTION_ECHO, reply)) reasons.push("prompt-echo");
  if (FINANCIAL.test(reply)) reasons.push("financial-figure");
  return { leaked: reasons.length > 0, reasons };
}
