// getOrgLens — resolve the active in-org lens from the real session-derived
// viewpoint. Signed out → /login. External viewpoints resolve to Admin only
// as a type-safe fallback (they never reach the internal shell).

import { redirect } from "next/navigation";
import type { OrgRole } from "@prisma/client";
import { getViewpoint } from "@/server/viewpoint";

export interface OrgLens {
  orgRole: OrgRole;
  userId?: string;
}

export async function getOrgLens(): Promise<OrgLens> {
  const vp = await getViewpoint();
  if (!vp) redirect("/login");
  if (vp.role !== "admin") return { orgRole: "Admin" };
  return { orgRole: (vp.orgRole ?? "Admin") as OrgRole, userId: vp.userId };
}
