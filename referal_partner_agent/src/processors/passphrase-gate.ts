import { PreProcessor, Data, env } from "lua-cli";
import {
  HELP_REPLY,
  HINT_EMAIL_NO_PASSPHRASE,
  WELCOME_GUIDE,
  currentPassphraseVersion,
  isHelpRequest,
  isVerifiedForVersion,
} from "../lib/onboarding";

export const STAFF_COLLECTION = "staff_users";

// STAFF-ONLY gate (F5.6 / image23: "drop the partner usage; partners log in to
// the portal for deal status"). This used to be a dual-audience gate that passed
// every unverified visitor through in "partner mode" so they could reach
// token-scoped self-service tools. That surface is gone, so the gate is now a
// hard block — and, because a block is only fair if it is explicable, it also
// answers help questions and tells a partner where they should actually go.
//
// `staffRefusal` (lib/staff-mode) stays on every staff tool as defence in depth:
// the gate is the door, not the only lock.
export type GateOutcome =
  | "proceed"
  | "verify"
  | "challenge"
  | "help"
  | "hint_missing_passphrase"
  | "unconfigured"
  | "logout";

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

const EMAIL_TOKEN = /\S+@\S+\.\S+/;

export function gateDecision(
  verified: boolean,
  lastText: string | undefined,
  passphrase: string | undefined,
  passphraseVersion?: string,
  storedVersion?: string,
): GateOutcome {
  const version = currentPassphraseVersion(passphraseVersion);
  // G5: rotating TEAM_PASSPHRASE re-challenges sessions verified under the old one.
  if (isVerifiedForVersion(verified, storedVersion, version)) {
    if (lastText && LOGOUT_INTENT.test(lastText)) return "logout";
    return "proceed";
  }
  if (!isConfiguredPassphrase(passphrase)) return "unconfigured";
  if (lastText !== undefined && containsPassphrase(lastText, passphrase)) return "verify";
  if (isHelpRequest(lastText)) return "help";
  if (lastText !== undefined && EMAIL_TOKEN.test(lastText)) return "hint_missing_passphrase";
  return "challenge";
}

// Emoji- and dash-free: a block reply short-circuits the pipeline, so
// format-normalizer never runs on any of these strings.
const LOGGED_OUT =
  "You are signed out of staff mode. To use the assistant again, send the team passphrase.";

const CHALLENGE = `This assistant is for Noblestride staff only. Send the team passphrase as your next message to continue.
If you are a Noblestride referral partner, this assistant is not the right place: log in to the Noblestride partner portal to see the status of the deals you introduced, or contact your Noblestride representative.
Reply "help" and I will explain what I do and what a passphrase is.`;

const UNCONFIGURED =
  "This assistant is not fully configured yet: no team passphrase has been set. Please contact the Noblestride admin.";

export const passphraseGate = new PreProcessor({
  name: "passphrase-gate",
  description:
    "Blocks every message until the user proves staff membership with the team passphrase. Referral partners are directed to the Noblestride partner portal instead (F5.6).",
  priority: 10,
  execute: async (user, messages, _channel) => {
    const userData = (user.data as Record<string, unknown> | undefined) ?? {};
    const verified = userData.verified === true;
    const storedVersion =
      typeof userData.passphraseVersion === "string" ? userData.passphraseVersion : undefined;
    const staffName = typeof userData.staffName === "string" ? userData.staffName : "";
    const lastText = [...messages].reverse().find((m) => m.type === "text") as { text: string } | undefined;
    const version = currentPassphraseVersion(env("PASSPHRASE_VERSION"));
    const outcome = gateDecision(
      verified,
      lastText?.text,
      env("TEAM_PASSPHRASE"),
      env("PASSPHRASE_VERSION"),
      storedVersion,
    );

    switch (outcome) {
      case "proceed":
        return { action: "proceed" };
      case "verify": {
        await user.update({ verified: true, passphraseVersion: version });
        const userId = user._luaProfile?.userId;
        if (userId) {
          const existing = await Data.get(STAFF_COLLECTION, { userId: { $eq: userId } }, 1, 1);
          if (existing.data.length === 0) await Data.create(STAFF_COLLECTION, { userId });
        }
        return { action: "block", response: WELCOME_GUIDE(staffName) };
      }
      case "help":
        return { action: "block", response: HELP_REPLY };
      case "hint_missing_passphrase": {
        const email = lastText!.text.match(EMAIL_TOKEN)![0];
        return { action: "block", response: HINT_EMAIL_NO_PASSPHRASE(email) };
      }
      case "logout": {
        await user.update({ verified: false, passphraseVersion: null });
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
