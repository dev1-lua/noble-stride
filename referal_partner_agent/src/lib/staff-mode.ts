import { User, type LuaTool } from "lua-cli";

// Staff-mode authorization for the referral agent's DUAL-AUDIENCE surface.
//
// The passphrase-gate no longer hard-blocks non-staff (partners must be able to
// reach the token-scoped partner self-service tools on the same channel). Staff
// tools therefore self-authorize here: each is wrapped with `withStaffGuard`, so
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

/**
 * Wraps a staff tool so its execute refuses unless the current user is a verified
 * staff member. Applied at the skill definition (see referral.skill.ts).
 *
 * Returns a NEW delegating LuaTool object rather than mutating the passed
 * instance's `execute` (review MED-2): a fresh object exposes `execute` as its own
 * property with no reliance on instance-vs-prototype method shadowing, so the
 * runtime always dispatches through the guard regardless of how lua-cli captures
 * the tool. The delegate calls `tool.execute(input)` as a method, preserving the
 * original tool's `this` (and its injected `deps`). `isStaff` is injectable for
 * deterministic tests; in production it defaults to the ambient-user check
 * (`currentUserIsStaff`, which reads the `verified` flag the passphrase-gate
 * stamps on the user).
 */
export function withStaffGuard<T extends LuaTool>(
  tool: T,
  isStaff: () => Promise<boolean> = currentUserIsStaff,
): LuaTool {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    execute: async (input: unknown) => {
      if (!(await isStaff())) return STAFF_ONLY_REFUSAL;
      return tool.execute(input);
    },
  } as LuaTool;
}
