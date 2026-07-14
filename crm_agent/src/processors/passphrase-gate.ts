import { PreProcessor, Data, env } from "lua-cli";
import { crmClientFromEnv } from "../lib/crm-client";
import { RESOLVE_STAFF_USER } from "../lib/queries";

export const STAFF_COLLECTION = "staff_users";

export type GateOutcome =
  | "proceed"
  | "verify"
  | "challenge"
  | "unconfigured"
  | "ask_email"
  | "try_identify";

export interface GateState {
  verified: boolean;
  staffEmail?: string;
}

const EMAIL_LIKE = /^\S+@\S+\.\S+$/;

/**
 * Pure decision function — no CRM calls, no side effects.
 *
 * Two gates in sequence:
 *  1. passphrase (verified) — unchanged from v1.
 *  2. staff-identify (staffEmail) — new in v2. Once verified, we need the
 *     user's CRM email once before they can act on the CRM's behalf.
 */
export function gateDecision(
  state: GateState,
  lastText: string | undefined,
  passphrase: string | undefined,
): GateOutcome {
  if (!state.verified) {
    if (!passphrase) return "unconfigured";
    if (lastText !== undefined && lastText.trim() === passphrase) return "verify";
    return "challenge";
  }
  if (state.staffEmail) return "proceed";
  const trimmed = lastText?.trim();
  if (trimmed && EMAIL_LIKE.test(trimmed)) return "try_identify";
  return "ask_email";
}

const CHALLENGE =
  "This assistant is for NobleStride staff only. Please reply with the team passphrase to continue.";
const WELCOME =
  "✅ You're verified. Ask me to summarize any client, investor, mandate, transaction, engagement, or partner — or ask \"what moved this week?\" for a pipeline digest.";
const UNCONFIGURED = "The assistant isn't fully configured yet (missing team passphrase). Please contact the NobleStride admin.";
const ASK_EMAIL =
  "✅ Passphrase accepted. To act on your behalf in the CRM I need your CRM email — what is it?";
const IDENTIFY_FAIL =
  "That email doesn't match an active CRM user — please check the spelling (it must be your CRM login email).";
const IDENTIFY_ERROR = "I can't verify your email right now — please try again shortly.";
const identifyOk = (firstName: string) => {
  const name = firstName.trim();
  return name
    ? `✅ Thanks ${name} — you're set. Ask me for summaries, digests, or tell me what to update in the CRM.`
    : `✅ You're set. Ask me for summaries, digests, or tell me what to update in the CRM.`;
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

/**
 * Side-effecting core, DI'd for testing (mirrors weekly-digest.job's runWeeklyDigest).
 * The CRM call only ever happens on the "try_identify" branch.
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
      await deps.updateUser({ verified: true });
      if (userId) {
        const existing = await deps.data.get(STAFF_COLLECTION, { userId: { $eq: userId } }, 1, 1);
        if (existing.data.length === 0) await deps.data.create(STAFF_COLLECTION, { userId });
      }
      return { action: "block", response: WELCOME };
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
