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

export type GateOutcome =
  | "proceed"
  | "verify"
  | "challenge"
  // F5.1: the two shapes that used to get the identical staff-only refusal.
  | "help"
  | "hint_missing_passphrase"
  | "unconfigured"
  | "logout";

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
  passphraseVersion?: string,
  storedVersion?: string,
): GateOutcome {
  const version = currentPassphraseVersion(passphraseVersion);
  // G5: rotating TEAM_PASSPHRASE must re-challenge anyone verified under the old
  // one, which stored verification alone could not do.
  if (isVerifiedForVersion(verified, storedVersion, version)) {
    if (lastText && LOGOUT_INTENT.test(lastText)) return "logout";
    return "proceed";
  }
  if (!isConfiguredPassphrase(passphrase)) return "unconfigured";
  if (lastText !== undefined && containsPassphrase(lastText, passphrase)) return "verify";
  // F5.1 (image24): the client asked this desk what a passphrase is and how it
  // is set, and got the refusal. Answer the question; it reveals nothing.
  if (isHelpRequest(lastText)) return "help";
  // An email arriving here is a reasonable guess at how to identify yourself.
  // Say what this desk actually needs instead of repeating the refusal.
  if (lastText !== undefined && EMAIL_TOKEN.test(lastText)) return "hint_missing_passphrase";
  return "challenge";
}

const EMAIL_TOKEN = /\S+@\S+\.\S+/;

// Emoji- and dash-free: a block reply short-circuits the pipeline, so
// format-normalizer never runs on any of these strings.
const CHALLENGE = `This assistant is for Noblestride staff only.
Reply with the team passphrase to continue. You can send it in a sentence, for example: the passphrase is openSesame
Reply "help" if you would like to know what this assistant does and where the passphrase comes from.`;
const UNCONFIGURED =
  "This assistant is not fully configured yet: no team passphrase has been set. Please contact the Noblestride admin.";
const LOGGED_OUT =
  "You have been signed out of staff mode. To use the assistant again, send the team passphrase.";

export const passphraseGate = new PreProcessor({
  name: "passphrase-gate",
  description: "Blocks all messages until the user proves staff membership with the team passphrase.",
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
        // The generation is stamped with the flag so a later rotation can tell
        // this session from one granted under the new phrase.
        await user.update({ verified: true, passphraseVersion: version });
        const userId = user._luaProfile?.userId;
        if (userId) {
          const existing = await Data.get(STAFF_COLLECTION, { userId: { $eq: userId } }, 1, 1);
          if (existing.data.length === 0) await Data.create(STAFF_COLLECTION, { userId });
        }
        return { action: "block", response: WELCOME_GUIDE(staffName) };
      }
      case "help":
        // Nothing written: asking for help neither verifies nor penalises.
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
