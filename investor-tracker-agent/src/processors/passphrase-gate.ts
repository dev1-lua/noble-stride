import { PreProcessor, Data, env } from "lua-cli";

export const STAFF_COLLECTION = "staff_users";

export type GateOutcome = "proceed" | "verify" | "challenge" | "unconfigured" | "logout";

// 2026-07-21 QA (cross-cutting): verification used to be permanent — no expiry, no logout.
// Deliberately strict: the WHOLE message must be a logout phrase, so "how do I log out of
// the CRM?" never de-verifies anyone.
export const LOGOUT_INTENT = /^\s*(log\s?out|sign\s?out|exit staff mode|end staff (mode|session)|reset (my )?verification)\s*[.!]?\s*$/i;

// Strips everything that isn't a letter, digit, or whitespace, replacing each run
// with a single space so word boundaries survive (e.g. "Passphrase:" -> "passphrase ").
const PUNCT_RUN = /[^\p{L}\p{N}\s]+/gu;

/**
 * Lowercase, strip punctuation (boundary-preserving), collapse whitespace. Applied
 * identically to both the configured passphrase and the incoming message so that
 * any punctuation embedded in either side cancels out rather than causing a
 * false mismatch.
 */
export function normalizeForMatch(input: string): string {
  return input
    .toLowerCase()
    .replace(PUNCT_RUN, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * True when the normalized passphrase appears anywhere in the normalized message as a
 * contiguous, word-boundary-aligned run — tolerant of greetings, labels, quotes,
 * punctuation, and case, but NOT of partial or fuzzy matches of the passphrase itself:
 * "secrets" does not match "secret", and only half of a multi-word passphrase does not
 * match either. Both sides go through the same normalization, so the comparison is
 * always apples-to-apples.
 */
export function containsPassphrase(message: string, passphrase: string): boolean {
  const normPass = normalizeForMatch(passphrase);
  if (!normPass) return false;
  const normMsg = normalizeForMatch(message);
  return ` ${normMsg} `.includes(` ${normPass} `);
}

// B4: a TEAM_PASSPHRASE that normalizes to empty (all punctuation/whitespace, e.g. "!!!"
// or "   ") must fail closed exactly like an unset passphrase, not sit in an
// unguessable-forever "challenge" that looks like a live (just very hard) passphrase. A
// real passphrase needs at least one alphanumeric token to survive normalization.
function isConfiguredPassphrase(passphrase: string | undefined): passphrase is string {
  return !!passphrase && normalizeForMatch(passphrase).length > 0;
}

export function gateDecision(
  verified: boolean,
  lastText: string | undefined,
  passphrase: string | undefined,
): GateOutcome {
  if (verified) {
    if (lastText && LOGOUT_INTENT.test(lastText)) return "logout";
    return "proceed";
  }
  if (!isConfiguredPassphrase(passphrase)) return "unconfigured";
  if (lastText !== undefined && containsPassphrase(lastText, passphrase)) return "verify";
  return "challenge";
}

const CHALLENGE =
  "This assistant is for Noblestride staff only. Reply with the team passphrase to continue — you can send it in a full sentence (e.g. \"the passphrase is ...\").";
const WELCOME =
  "✅ You're verified. Ask me where any investor stands on any deal, what's stalled and needs chasing, or which investors fit a live mandate — I can also record confirmed stage, term-sheet, DD and disbursement updates, and create follow-up tasks.";
const UNCONFIGURED = "The assistant isn't fully configured yet (missing team passphrase). Please contact the Noblestride admin.";
const LOGGED_OUT =
  "✅ You've been signed out of staff mode. To use the assistant again, send the team passphrase.";

export const passphraseGate = new PreProcessor({
  name: "passphrase-gate",
  description: "Blocks all messages until the user proves staff membership with the team passphrase.",
  priority: 10,
  execute: async (user, messages, _channel) => {
    const verified = (user.data as Record<string, unknown> | undefined)?.verified === true;
    const lastText = [...messages].reverse().find((m) => m.type === "text") as { text: string } | undefined;
    const outcome = gateDecision(verified, lastText?.text, env("TEAM_PASSPHRASE"));

    switch (outcome) {
      case "proceed":
        return { action: "proceed" };
      case "verify": {
        await user.update({ verified: true });
        const userId = user._luaProfile?.userId;
        if (userId) {
          const existing = await Data.get(STAFF_COLLECTION, { userId: { $eq: userId } }, 1, 1);
          if (existing.data.length === 0) await Data.create(STAFF_COLLECTION, { userId });
        }
        return { action: "block", response: WELCOME };
      }
      case "logout": {
        await user.update({ verified: false });
        return { action: "block", response: LOGGED_OUT };
      }
      case "unconfigured":
        return { action: "block", response: UNCONFIGURED };
      case "challenge":
      default:
        return { action: "block", response: CHALLENGE };
    }
  },
});
