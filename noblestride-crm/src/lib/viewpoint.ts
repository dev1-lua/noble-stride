// Viewpoint = which lens the CRM is being viewed through (design spec §6).
// Demo construct: carried in a cookie, not real authentication.

export type ViewpointRole = "admin" | "investor" | "partner";

export type Viewpoint = {
  role: ViewpointRole;
  /** Impersonated Investor/Partner id when role is investor/partner. */
  recordId?: string;
};

export const VIEWPOINT_COOKIE = "ns_viewpoint";

export const ADMIN_VIEWPOINT: Viewpoint = { role: "admin" };

export function parseViewpoint(raw: string | undefined | null): Viewpoint {
  if (!raw) return ADMIN_VIEWPOINT;
  try {
    const parsed = JSON.parse(raw) as { role?: string; recordId?: string };
    if (parsed.role === "investor" || parsed.role === "partner") {
      if (!parsed.recordId) return ADMIN_VIEWPOINT;
      return { role: parsed.role, recordId: parsed.recordId };
    }
    return ADMIN_VIEWPOINT;
  } catch {
    return ADMIN_VIEWPOINT;
  }
}

export function serializeViewpoint(vp: Viewpoint): string {
  return JSON.stringify(vp.role === "admin" ? { role: "admin" } : vp);
}
