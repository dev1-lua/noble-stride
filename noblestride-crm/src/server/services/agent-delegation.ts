// Delegation for the crmAgent write surface: the agent key authenticates the
// TRANSPORT; this resolves the human the agent acts for. RBAC then runs with
// that user's real role (spec §5.1).
import { prisma } from "@/lib/db";
import type { Actor } from "@/graphql/context";
import { CrudError } from "./crud";

export async function resolveDelegatedActor(email: string): Promise<Actor> {
  const normalized = email.trim();
  if (!normalized) throw new CrudError("actorEmail is required.");
  const user = await prisma.user.findFirst({
    where: { email: { equals: normalized, mode: "insensitive" }, isActive: true },
    select: { id: true, role: true, email: true },
  });
  if (!user) throw new CrudError("No active CRM user matches this email.");
  return {
    type: "AGENT",
    authenticated: true,
    delegated: true,
    userId: user.id,
    orgRole: user.role,
    accountKind: "INTERNAL",
    label: `crm-agent:${user.email}`,
  };
}

// Automation-gated staff lookup for the Lua agent's front-desk gate. Returns
// an identical shape for unknown vs. inactive users — no enumeration.
export async function resolveStaffUserSummary(email: string): Promise<{ ok: boolean; firstName: string | null }> {
  try {
    const actor = await resolveDelegatedActor(email);
    const user = await prisma.user.findUnique({ where: { id: actor.userId! }, select: { name: true } });
    return { ok: true, firstName: user?.name?.split(/\s+/)[0] ?? null };
  } catch {
    return { ok: false, firstName: null };
  }
}
