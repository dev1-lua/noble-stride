import { PreProcessor, Data, env } from "lua-cli";
import { crmClientFromEnv } from "../lib/crm-client";
import { RESOLVE_STAFF_USER } from "../lib/queries";
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
  | "verify_and_identify"
  | "challenge"
  // F5.1: the two shapes that used to get the identical staff-only challenge.
  | "help"
  | "hint_missing_passphrase"
  | "unconfigured"
  | "ask_email"
  | "try_identify"
  | "logout";

export interface GateState {
  verified: boolean;
  staffEmail?: string;
  /** G5: which generation of TEAM_PASSPHRASE this verification was granted under. */
  passphraseVersion?: string;
}

const EMAIL_LIKE = /^\S+@\S+\.\S+$/;
const EMAIL_TOKEN = /\S+@\S+\.\S+/; // first email-like token anywhere in the message

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

// 2026-07-21 QA (cross-cutting): verification used to be permanent — no expiry, no logout.
// A verified user can now end their staff session explicitly. Deliberately strict: the
// WHOLE message must be a logout phrase, so "how do I log out of the CRM?" never
// de-verifies anyone.
export const LOGOUT_INTENT = /^\s*(log\s?out|sign\s?out|exit staff mode|end staff (mode|session)|reset (my )?verification)\s*[.!]?\s*$/i;

// Split a reply into its email token (if any) and the remaining text, so a
// single message can carry both the passphrase and the CRM email.
//
// B5: the configured TEAM_PASSPHRASE itself must never contain an email-like
// token. extractCredentials pulls the FIRST email-shaped substring out of
// whatever text it's given — if the passphrase were, say, "verify jane@x.co",
// checking a reply against it would let extractCredentials capture
// "jane@x.co" as though the SENDER had supplied it, silently identifying the
// message as coming from an arbitrary staff email. Passphrases are an
// operator-configured secret (env var), not user input, so this is enforced
// by convention/comment rather than a runtime check.
export function extractCredentials(text: string): { email: string | null; rest: string } {
  const match = text.match(EMAIL_TOKEN);
  if (!match || match.index === undefined) return { email: null, rest: text.trim() };
  const email = match[0].replace(/[.,;:!?]+$/, "");
  const rest = (text.slice(0, match.index) + " " + text.slice(match.index + match[0].length))
    .replace(/\s+/g, " ")
    .trim();
  return { email, rest };
}

/**
 * Pure decision function — no CRM calls, no side effects.
 *
 * Two gates, but the first one now accepts both credentials at once:
 *  1. passphrase (verified) — a reply may carry just the passphrase, or the
 *     passphrase plus a CRM email in either order, in one message.
 *  2. staff-identify (staffEmail) — once verified (without an email already
 *     supplied), we need the user's CRM email once before they can act on
 *     the CRM's behalf.
 */
// B4: a TEAM_PASSPHRASE that normalizes to empty (all punctuation/whitespace, e.g.
// "!!!" or "   ") must fail closed exactly like an unset passphrase — normalizeForMatch
// would otherwise reduce it to "", which containsPassphrase already refuses to match
// against, but gateDecision must ALSO route it to "unconfigured" (not an endless
// "challenge") so the misconfiguration is surfaced honestly instead of looking like a
// live, just-never-guessable passphrase. A real passphrase needs at least one
// alphanumeric token to survive normalization.
function isConfiguredPassphrase(passphrase: string | undefined): passphrase is string {
  return !!passphrase && normalizeForMatch(passphrase).length > 0;
}

export function gateDecision(
  state: GateState,
  lastText: string | undefined,
  passphrase: string | undefined,
  passphraseVersion?: string,
): GateOutcome {
  const version = currentPassphraseVersion(passphraseVersion);
  // G5: a rotated passphrase must re-challenge sessions verified under the old
  // one. Without this, rotating TEAM_PASSPHRASE protected nobody who had
  // already verified.
  const stillVerified = isVerifiedForVersion(state.verified, state.passphraseVersion, version);

  if (!stillVerified) {
    if (!isConfiguredPassphrase(passphrase)) return "unconfigured";
    if (lastText === undefined) return "challenge";
    if (containsPassphrase(lastText, passphrase)) {
      const { email } = extractCredentials(lastText);
      return email ? "verify_and_identify" : "verify";
    }
    // F5.1: answer the question before enforcing the gate. Someone asking how
    // this works has not failed a security check; they have asked a fair
    // question, and repeating the challenge at them is what the client's
    // screenshots show going wrong five times in a row.
    if (isHelpRequest(lastText)) return "help";
    // An email with no passphrase is a near-miss, not a stranger. Acknowledge
    // the address so the person can see it was read, and say what is missing.
    const { email } = extractCredentials(lastText);
    if (email) return "hint_missing_passphrase";
    return "challenge";
  }
  if (lastText && LOGOUT_INTENT.test(lastText)) return "logout";
  if (state.staffEmail) return "proceed";
  const trimmed = lastText?.trim();
  if (trimmed && EMAIL_LIKE.test(trimmed)) return "try_identify";
  return "ask_email";
}

const CHALLENGE =
  `This assistant is for Noblestride staff only.
Reply with the team passphrase and your CRM login email in one message, for example: openSesame you@noblestride.capital
Reply "help" if you would like to know what this assistant does and where the passphrase comes from.`;
// B3: passphrase-only verification (no email in the same message) used to invite the
// user straight into CRM questions ("Ask me to summarize...") even though the very next
// turn demands a work email before anything actually proceeds (see the "ask_email"
// outcome below) — a dead-end that reads as a broken bot. Ask for the email here
// instead; the fully-verified welcomes (identifyOk / verifyAndIdentifyOk below, used
// once staffEmail is also known) are unchanged.
const WELCOME =
  "Passphrase verified. To finish signing in I also need your CRM login email. What is it?";
const UNCONFIGURED = "The assistant isn't fully configured yet (missing team passphrase). Please contact the Noblestride admin.";
const ASK_EMAIL =
  "Passphrase accepted. To act on your behalf in the CRM I also need your CRM login email. What is it?";
const IDENTIFY_FAIL =
  "I could not match that email. Please check it for typos: it has to be the email you log in to the CRM with.";
const IDENTIFY_ERROR = "I cannot check your email right now. Please try again shortly.";
const LOGGED_OUT =
  "You have been signed out of staff mode. To use the assistant again, send the team passphrase and your CRM login email together in one message.";

export interface StaffResolution {
  ok: boolean;
  firstName: string | null;
}

export type ResolveStaffFn = (email: string) => Promise<StaffResolution>;

export type GateResult = { action: "proceed" } | { action: "block"; response: string };

export interface GateDeps {
  data: { get: typeof Data.get; create: typeof Data.create };
  passphrase: string | undefined;
  /** G5: PASSPHRASE_VERSION; absent or blank means generation "1". */
  passphraseVersion?: string;
  resolveStaff: ResolveStaffFn;
  updateUser: (patch: Record<string, unknown>) => Promise<unknown>;
}

/** Marks the user verified and registers them in staff_users once (shared by "verify" and "verify_and_identify"). */
async function markVerified(deps: GateDeps, userId: string | undefined): Promise<void> {
  // The generation is stamped alongside the flag, so a later rotation can tell
  // this session apart from one granted under the new phrase.
  await deps.updateUser({ verified: true, passphraseVersion: currentPassphraseVersion(deps.passphraseVersion) });
  if (userId) {
    const existing = await deps.data.get(STAFF_COLLECTION, { userId: { $eq: userId } }, 1, 1);
    if (existing.data.length === 0) await deps.data.create(STAFF_COLLECTION, { userId });
  }
}

/**
 * Side-effecting core, DI'd for testing (mirrors weekly-digest.job's runWeeklyDigest).
 * The CRM call happens on the "try_identify" and "verify_and_identify" branches.
 */
export async function runGate(
  deps: GateDeps,
  state: GateState,
  lastText: string | undefined,
  userId: string | undefined,
): Promise<GateResult> {
  const outcome = gateDecision(state, lastText, deps.passphrase, deps.passphraseVersion);

  switch (outcome) {
    case "proceed":
      return { action: "proceed" };
    case "verify": {
      await markVerified(deps, userId);
      return { action: "block", response: WELCOME };
    }
    case "help":
      // Nothing is written: asking for help neither verifies nor penalises.
      return { action: "block", response: HELP_REPLY };
    case "hint_missing_passphrase": {
      const { email } = extractCredentials(lastText!);
      return { action: "block", response: HINT_EMAIL_NO_PASSPHRASE(email!.trim()) };
    }
    case "verify_and_identify": {
      await markVerified(deps, userId);
      const { email } = extractCredentials(lastText!);
      const resolvedEmail = email!.trim();
      try {
        const result = await deps.resolveStaff(resolvedEmail);
        if (!result.ok) {
          return { action: "block", response: IDENTIFY_FAIL };
        }
        await deps.updateUser({ staffEmail: resolvedEmail, staffName: result.firstName });
        return { action: "block", response: WELCOME_GUIDE(result.firstName ?? "") };
      } catch {
        return { action: "block", response: IDENTIFY_ERROR };
      }
    }
    case "logout": {
      await deps.updateUser({ verified: false, staffEmail: null, staffName: null, passphraseVersion: null });
      return { action: "block", response: LOGGED_OUT };
    }
    case "unconfigured":
      return { action: "block", response: UNCONFIGURED };
    case "ask_email":
      return { action: "block", response: ASK_EMAIL };
    case "try_identify": {
      const email = lastText!.trim();
      try {
        const result = await deps.resolveStaff(email);
        if (!result.ok) {
          return { action: "block", response: IDENTIFY_FAIL };
        }
        await deps.updateUser({ staffEmail: email, staffName: result.firstName });
        return { action: "block", response: WELCOME_GUIDE(result.firstName ?? "") };
      } catch {
        return { action: "block", response: IDENTIFY_ERROR };
      }
    }
    case "challenge":
    default:
      return { action: "block", response: CHALLENGE };
  }
}

async function defaultResolveStaff(email: string): Promise<StaffResolution> {
  const crm = crmClientFromEnv();
  const data = await crm.query<{ resolveStaffUser: StaffResolution }>(RESOLVE_STAFF_USER, { email });
  return data.resolveStaffUser;
}

export const passphraseGate = new PreProcessor({
  name: "passphrase-gate",
  description: "Blocks all messages until the user proves staff membership with the team passphrase, then identifies them by CRM email.",
  priority: 10,
  execute: async (user, messages, _channel) => {
    const userData = (user.data as Record<string, unknown> | undefined) ?? {};
    const state: GateState = {
      verified: userData.verified === true,
      staffEmail: typeof userData.staffEmail === "string" ? userData.staffEmail : undefined,
      passphraseVersion:
        typeof userData.passphraseVersion === "string" ? userData.passphraseVersion : undefined,
    };
    const lastText = [...messages].reverse().find((m) => m.type === "text") as { text: string } | undefined;
    const userId = user._luaProfile?.userId;

    return runGate(
      {
        data: { get: Data.get, create: Data.create },
        passphrase: env("TEAM_PASSPHRASE"),
        passphraseVersion: env("PASSPHRASE_VERSION"),
        resolveStaff: defaultResolveStaff,
        updateUser: (patch) => user.update(patch),
      },
      state,
      lastText?.text,
      userId,
    );
  },
});
