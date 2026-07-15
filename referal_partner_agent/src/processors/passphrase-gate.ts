import { PreProcessor, Data, env } from "lua-cli";

export const STAFF_COLLECTION = "staff_users";

export type GateOutcome = "proceed" | "verify" | "challenge" | "unconfigured";

export function gateDecision(
  verified: boolean,
  lastText: string | undefined,
  passphrase: string | undefined,
): GateOutcome {
  if (verified) return "proceed";
  if (!passphrase) return "unconfigured";
  if (lastText !== undefined && lastText.trim() === passphrase) return "verify";
  return "challenge";
}

const CHALLENGE =
  "This assistant is for Noblestride staff only. Please reply with the team passphrase to continue.";
const WELCOME =
  "✅ You're verified. Ask me about any referral partner — who introduced which deal, where each referred deal stands, which introductions converted, and what fees are due. I can also record confirmed introductions, partner updates, partner-to-deal links, and fee statuses.";
const UNCONFIGURED = "The assistant isn't fully configured yet (missing team passphrase). Please contact the Noblestride admin.";

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
      case "unconfigured":
        return { action: "block", response: UNCONFIGURED };
      case "challenge":
      default:
        return { action: "block", response: CHALLENGE };
    }
  },
});
