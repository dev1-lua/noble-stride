// Viewpoint = which lens the CRM is being viewed through (design spec §6).
// Demo construct: carried in a cookie, not real authentication.

export type ViewpointRole = "admin" | "investor" | "partner";

/** In-org demo roles (§7.2) — string mirror of Prisma's OrgRole (kept dependency-free). */
export type OrgRoleLens = "Admin" | "DealLead" | "TeamMember";
const ORG_ROLES: readonly OrgRoleLens[] = ["Admin", "DealLead", "TeamMember"];

export type Viewpoint = {
  role: ViewpointRole;
  /** Impersonated Investor/Partner id when role is investor/partner. */
  recordId?: string;
  /** In-org role lens — only meaningful when role is "admin". */
  orgRole?: OrgRoleLens;
  /** Impersonated User id for DealLead/TeamMember lenses. */
  userId?: string;
};

export const VIEWPOINT_COOKIE = "ns_viewpoint";

export const ADMIN_VIEWPOINT: Viewpoint = { role: "admin", orgRole: "Admin" };

export function parseViewpoint(raw: string | undefined | null): Viewpoint {
  if (!raw) return ADMIN_VIEWPOINT;
  try {
    const parsed = JSON.parse(raw) as {
      role?: string;
      recordId?: string;
      orgRole?: string;
      userId?: string;
    };
    if (parsed.role === "investor" || parsed.role === "partner") {
      if (!parsed.recordId) return ADMIN_VIEWPOINT;
      return { role: parsed.role, recordId: parsed.recordId };
    }
    const orgRole = ORG_ROLES.includes(parsed.orgRole as OrgRoleLens)
      ? (parsed.orgRole as OrgRoleLens)
      : "Admin";
    if (orgRole === "Admin") return ADMIN_VIEWPOINT;
    return { role: "admin", orgRole, userId: parsed.userId };
  } catch {
    return ADMIN_VIEWPOINT;
  }
}

export function serializeViewpoint(vp: Viewpoint): string {
  if (vp.role !== "admin") return JSON.stringify({ role: vp.role, recordId: vp.recordId });
  if (!vp.orgRole || vp.orgRole === "Admin") return JSON.stringify({ role: "admin" });
  return JSON.stringify({ role: "admin", orgRole: vp.orgRole, userId: vp.userId });
}

/** Home route for a viewpoint — where "/" forwards a signed-in lens (landing spec §3). */
export function viewpointHome(vp: Viewpoint): string {
  return vp.role === "investor"
    ? "/portal/investor"
    : vp.role === "partner"
      ? "/portal/partner"
      : "/dashboard";
}
