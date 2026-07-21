import { PreProcessor, Data, env } from "lua-cli";
import { crmClientFromEnv } from "../lib/crm-client";
import { RESOLVE_STAFF_USER } from "../lib/queries";

export const STAFF_COLLECTION = "staff_users";

export type GateOutcome =
  | "proceed"
  | "verify"
  | "verify_and_identify"
  | "challenge"
  | "unconfigured"
  | "ask_email"
  | "try_identify"
  | "logout";

export interface GateState {
  verified: boolean;
  staffEmail?: string;
}

const EMAIL_LIKE = /^\S+@\S+\.\S+$/;
const EMAIL_TOKEN = /\S+@\S+\.\S+/; // first email-like token anywhere in the message

// 2026-07-21 QA (cross-cutting): verification used to be permanent — no expiry, no logout.
// A verified user can now end their staff session explicitly. Deliberately strict: the
// WHOLE message must be a logout phrase, so "how do I log out of the CRM?" never
// de-verifies anyone.
export const LOGOUT_INTENT = /^\s*(log\s?out|sign\s?out|exit staff mode|end staff (mode|session)|reset (my )?verification)\s*[.!]?\s*$/i;

// Split a reply into its email token (if any) and the remaining text, so a
// single message can carry both the passphrase and the CRM email.
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
export function gateDecision(
  state: GateState,
  lastText: string | undefined,
  passphrase: string | undefined,
): GateOutcome {
  if (!state.verified) {
    if (!passphrase) return "unconfigured";
    if (lastText === undefined) return "challenge";
    const { email, rest } = extractCredentials(lastText);
    const normalized = passphrase.trim();
    if (rest === normalized || lastText.trim() === normalized) {
      return email ? "verify_and_identify" : "verify";
    }
    return "challenge";
  }
  if (lastText && LOGOUT_INTENT.test(lastText)) return "logout";
  if (state.staffEmail) return "proceed";
  const trimmed = lastText?.trim();
  if (trimmed && EMAIL_LIKE.test(trimmed)) return "try_identify";
  return "ask_email";
}

const CHALLENGE =
  "This assistant is for Noblestride staff only. Please reply with the team passphrase AND your CRM email together in one message (e.g. `<passphrase> you@noblestride.capital`).";
const WELCOME =
  "✅ You're verified. Ask me to summarize any client, investor, mandate, transaction, engagement, or partner — or ask \"what moved this week?\" for a pipeline digest.";
const UNCONFIGURED = "The assistant isn't fully configured yet (missing team passphrase). Please contact the Noblestride admin.";
const ASK_EMAIL =
  "✅ Passphrase accepted. To act on your behalf in the CRM I also need your CRM email — what is it?";
const IDENTIFY_FAIL =
  "That email doesn't match an active CRM user — please check the spelling (it must be your CRM login email).";
const IDENTIFY_ERROR = "I can't verify your email right now — please try again shortly.";
const LOGGED_OUT =
  "✅ You've been signed out of staff mode. To use the assistant again, send the team passphrase and your CRM email together in one message.";
const identifyOk = (firstName: string) => {
  const name = firstName.trim();
  return name
    ? `✅ Thanks ${name} — you're set. Ask me for summaries, digests, or tell me what to update in the CRM.`
    : `✅ You're set. Ask me for summaries, digests, or tell me what to update in the CRM.`;
};
const verifyAndIdentifyOk = (firstName: string) => {
  const name = firstName.trim();
  return name
    ? `✅ Verified! Welcome, ${name} — ask me for summaries, digests, or tell me what to update in the CRM.`
    : `✅ Verified! Ask me for summaries, digests, or tell me what to update in the CRM.`;
};

export interface StaffResolution {
  ok: boolean;
  firstName: string | null;
}

export type ResolveStaffFn = (email: string) => Promise<StaffResolution>;

export type GateResult = { action: "proceed" } | { action: "block"; response: string };

export interface GateDeps {
  data: { get: typeof Data.get; create: typeof Data.create };
  passphrase: string | undefined;
  resolveStaff: ResolveStaffFn;
  updateUser: (patch: Record<string, unknown>) => Promise<unknown>;
}

/** Marks the user verified and registers them in staff_users once (shared by "verify" and "verify_and_identify"). */
async function markVerified(deps: GateDeps, userId: string | undefined): Promise<void> {
  await deps.updateUser({ verified: true });
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
  const outcome = gateDecision(state, lastText, deps.passphrase);

  switch (outcome) {
    case "proceed":
      return { action: "proceed" };
    case "verify": {
      await markVerified(deps, userId);
      return { action: "block", response: WELCOME };
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
        return { action: "block", response: verifyAndIdentifyOk(result.firstName ?? "") };
      } catch {
        return { action: "block", response: IDENTIFY_ERROR };
      }
    }
    case "logout": {
      await deps.updateUser({ verified: false, staffEmail: null, staffName: null });
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
        return { action: "block", response: identifyOk(result.firstName ?? "") };
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
    };
    const lastText = [...messages].reverse().find((m) => m.type === "text") as { text: string } | undefined;
    const userId = user._luaProfile?.userId;

    return runGate(
      {
        data: { get: Data.get, create: Data.create },
        passphrase: env("TEAM_PASSPHRASE"),
        resolveStaff: defaultResolveStaff,
        updateUser: (patch) => user.update(patch),
      },
      state,
      lastText?.text,
      userId,
    );
  },
});
