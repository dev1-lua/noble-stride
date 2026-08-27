import { PreProcessor, Data, env } from "lua-cli";

export const STAFF_COLLECTION = "staff_users";

// Dual-audience gate (SOW §7.2). Staff unlock the full staff toolset with the
// team passphrase; everyone else proceeds in PARTNER mode so referral partners can
// reach the token-scoped partner-self-service tools on the same channel. Security
// is not weakened: every STAFF tool self-authorizes via staffRefusal (lib/staff-mode)
// and refuses a non-staff caller, and partner tools are scoped by a verified token.
export type GateOutcome = "proceed" | "verify" | "partner" | "logout";

// 2026-07-21 QA (cross-cutting): staff verification used to be permanent — no way back to
// partner mode after an accidental verification. Deliberately strict: the WHOLE message must
// be a logout phrase, so "how do I log out?" never de-verifies anyone.
export const LOGOUT_INTENT =
  /^\s*(log\s?out|sign\s?out|exit staff mode|end staff (mode|session)|reset to partner mode|reset (my )?verification)\s*[.!]?\s*$/i;

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
// or "   ") must be treated the same as an unset passphrase — this dual-audience gate has
// no separate "unconfigured" outcome, so its existing missing-passphrase behaviour is to
// fall through to "partner" mode, and an empty-normalizing passphrase must fail closed to
// that same "partner" outcome rather than ever verifying anyone as staff. A real passphrase
// needs at least one alphanumeric token to survive normalization; containsPassphrase
// already refuses to match an empty-normalized passphrase, but the explicit check here
// keeps that guarantee visible and consistent with the other two gated packages.
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
  if (isConfiguredPassphrase(passphrase) && lastText !== undefined && containsPassphrase(lastText, passphrase)) return "verify";
  return "partner";
}

const LOGGED_OUT =
  "✅ You've been signed out of staff mode and are back in partner self-service mode. To unlock staff tools again, send the team passphrase.";

const WELCOME =
  "✅ You're verified as staff. Ask me about any referral partner — who introduced which deal, where each referred deal stands, which introductions converted, and what fees are due. I can also record confirmed introductions, partner updates, partner-to-deal links, and fee statuses, and issue a partner an access code for self-service.";

export const passphraseGate = new PreProcessor({
  name: "passphrase-gate",
  description:
    "Verifies Noblestride staff via the team passphrase (unlocking staff tools); everyone else proceeds in partner self-service mode, where only token-scoped own-record tools work.",
  priority: 10,
  execute: async (user, messages, _channel) => {
    const verified = (user.data as Record<string, unknown> | undefined)?.verified === true;
    const lastText = [...messages].reverse().find((m) => m.type === "text") as { text: string } | undefined;
    const outcome = gateDecision(verified, lastText?.text, env("TEAM_PASSPHRASE"));

    switch (outcome) {
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
      case "proceed":
      case "partner":
      default:
        // Staff (proceed) get the full toolset; partner-mode visitors get a warm
        // reply and only the token-scoped partner-self-service tools succeed —
        // every staff tool self-authorizes via staffRefusal inside its execute.
        return { action: "proceed" };
    }
  },
});
