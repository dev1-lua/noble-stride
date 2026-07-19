// Pure badge derivation for the portal Team page (spec 2026-07-19 §7).
// "Invited" = has a seat but never signed in (covers both ACTIVE seats
// awaiting redemption and PENDING seats awaiting org approval).

export type MemberBadge = "Active" | "Invited" | "Suspended" | "No account";

export function deriveMemberStatus(
  account: { status: "PENDING" | "ACTIVE" | "SUSPENDED"; lastLoginAt: Date | null } | null,
): MemberBadge {
  if (!account) return "No account";
  if (account.status === "SUSPENDED") return "Suspended";
  if (!account.lastLoginAt) return "Invited";
  return "Active";
}
