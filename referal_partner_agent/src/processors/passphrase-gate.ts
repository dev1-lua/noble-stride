import { PreProcessor, Data, env } from "lua-cli";

export const STAFF_COLLECTION = "staff_users";

// Dual-audience gate (SOW §7.2). Staff unlock the full staff toolset with the
// team passphrase; everyone else proceeds in PARTNER mode so referral partners can
// reach the token-scoped partner-self-service tools on the same channel. Security
// is not weakened: every STAFF tool is wrapped with withStaffGuard (lib/staff-mode)
// and refuses a non-staff caller, and partner tools are scoped by a verified token.
export type GateOutcome = "proceed" | "verify" | "partner";

export function gateDecision(
  verified: boolean,
  lastText: string | undefined,
  passphrase: string | undefined,
): GateOutcome {
  if (verified) return "proceed";
  if (passphrase && lastText !== undefined && lastText.trim() === passphrase) return "verify";
  return "partner";
}

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
      case "proceed":
      case "partner":
      default:
        // Staff (proceed) get the full toolset; partner-mode visitors get a warm
        // reply and only the token-scoped partner-self-service tools succeed —
        // every staff tool self-authorizes via withStaffGuard.
        return { action: "proceed" };
    }
  },
});
