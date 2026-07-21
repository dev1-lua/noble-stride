import { User } from "lua-cli";

// Staff-mode authorization for the referral agent's DUAL-AUDIENCE surface.
//
// The passphrase-gate no longer hard-blocks non-staff (partners must be able to
// reach the token-scoped partner self-service tools on the same channel). Staff
// tools therefore self-authorize here: each calls `staffRefusal` first thing, so
// even though the model can see every tool, a non-staff visitor invoking a staff
// tool gets a refusal instead of partner/other-partner data. This mirrors the
// crm_agent write tools re-checking the verified staff identity in `execute`.

export function isStaffVerified(userData: unknown): boolean {
  return (userData as Record<string, unknown> | undefined)?.verified === true;
}

/** FAIL-CLOSED: any error / no ambient user → treated as NOT staff. */
export async function currentUserIsStaff(): Promise<boolean> {
  try {
    const user = await User.get();
    return isStaffVerified(user?.data);
  } catch {
    return false;
  }
}

export const STAFF_ONLY_REFUSAL = {
  status: "staff_only" as const,
  message:
    "That's a staff-only action. If you're a Noblestride partner, I can verify your identity and then show or update your own details. If you're staff, send the team passphrase first to unlock staff tools.",
};

export type StaffCheck = () => Promise<boolean>;

/**
 * Staff gate called at the TOP of every staff tool's execute (first statement,
 * before any CRM access). Returns the refusal to relay, or null to proceed.
 *
 * The guard lives INSIDE each tool rather than in a wrapper: lua-cli resolves a
 * skill's tools STATICALLY from the `tools:` array, and a wrapper call like
 * `withStaffGuard(new Tool())` is an unresolvable CallExpression — the compiler
 * then pushes the skill with ZERO tools (this silently stripped every staff
 * tool from prod on 2026-07-21). Array elements must stay plain `new Tool()`.
 *
 * `isStaff` is injectable for deterministic tests; in production it defaults to
 * the ambient-user check (`currentUserIsStaff`, which reads the `verified` flag
 * the passphrase-gate stamps on the user) and FAILS CLOSED.
 */
export async function staffRefusal(
  isStaff: StaffCheck = currentUserIsStaff,
): Promise<typeof STAFF_ONLY_REFUSAL | null> {
  return (await isStaff()) ? null : STAFF_ONLY_REFUSAL;
}
