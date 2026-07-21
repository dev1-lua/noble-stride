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
// 2026-07-21 QA fix: these phrases also appear inside the agent's own REFUSALS ("I can't
// confirm whether Acme is a client of ours") — existence/echo matches are therefore suppressed
// when a refusal cue precedes the match within the same clause (see refusedBefore below).
// The "our records show" branch carries a `(?<!what\s)` lookbehind: "what our records
// show for your status" is an offer/reference ("I can share what our system shows once
// verified"), not a disclosure — only "our records show <fact>" is.
const EXISTENCE =
  /\b(yes,?\s+(they|it|that|this|the (company|investor|deal|fund))\s+(is|are)\b[^.?!]{0,40}\b(in our|one of our|a client|an investor|registered)|we are (currently )?(advising|working with|representing)\s+(that|the|this|them|a|an)\b[^.?!]{0,30}\b(company|investor|deal|fund|client)|the record shows|(?<!what\s)our (system|crm|records?) (shows?|indicates?|confirms?|has)|is (indeed )?(in our (system|records?)|a client of|registered with))/i;
// High-confidence: the reply DISCLOSING the system prompt / its own instructions.
// 2026-07-21 QA fix: dropped the bare "system prompt" alternative — "I can't share my system
// prompt" is a correct refusal, not an echo. Each remaining branch requires disclosure framing
// ("here is my…", "my system prompt says…", "system prompt:" introducing content). No trailing
// \b after the colon branch: a space after ":" would make \b fail, and the colon already ends
// the phrase.
const INJECTION_ECHO =
  /\b(?:here (?:is|are) my (?:system prompt|rules|instructions|persona)\b|my system prompt (?:is|says|reads)\b|system prompt\s*:|my instructions? (?:say|is)\b|i (?:was|am) (?:instructed|told|configured) to\b)/i;
// Heuristic only. Unlike the investor email desk, the intake agents legitimately restate a
// visitor's OWN figures ("got it — a $2M equity raise"), so callers here treat this as a
// non-vetoing signal (see the leak-guard's HARD_VETO set), not a hard leak.
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
 * Pure, deterministic scan of an outbound reply for content the public agent must never emit:
 * record-id tokens, existence-confirmation phrasing, prompt/instruction echoes, and (as a soft
 * signal) currency figures. Which reasons actually VETO a reply is the caller's policy.
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
