// require-real-admin.ts — the single server-side gate for admin Settings
// actions. Checks the REAL account (never the impersonation lens): an admin
// impersonating TeamMember still administers; a real TeamMember never can.
// Previously duplicated in settings/users/actions.ts and
// investors/[id]/account-actions.ts; both import this now.

import { getCurrentAuth } from "@/server/auth/current";

export async function requireRealAdmin() {
  const auth = await getCurrentAuth();
  if (!auth || auth.account.kind !== "INTERNAL" || auth.user?.role !== "Admin" || !auth.user?.isActive) {
    throw new Error("Not authorized");
  }
  return auth;
}
