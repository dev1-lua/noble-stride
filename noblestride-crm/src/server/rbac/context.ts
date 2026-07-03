// getOrgLens — resolve the active in-org demo lens from the viewpoint cookie.
// External viewpoints (investor/partner) never reach the internal shell, so
// they resolve to Admin here only as a type-safe fallback.

import type { OrgRole } from "@prisma/client";
import { getViewpoint } from "@/server/viewpoint";

export interface OrgLens {
  orgRole: OrgRole;
  userId?: string;
}

export async function getOrgLens(): Promise<OrgLens> {
  const vp = await getViewpoint();
  if (vp.role !== "admin") return { orgRole: "Admin" };
  return { orgRole: (vp.orgRole ?? "Admin") as OrgRole, userId: vp.userId };
}
