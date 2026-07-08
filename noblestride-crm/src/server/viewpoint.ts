import { cookies } from "next/headers";
import type { Viewpoint } from "@/lib/viewpoint";
import { getCurrentAuth, resolveViewpointFor } from "@/server/auth/current";
import { IMPERSONATION_COOKIE } from "@/server/auth/impersonation";

/** Derive the active viewpoint from the REAL session (null = signed out).
 *  Admins may overlay a signed "view as" lens (ns_viewpoint cookie). */
export async function getViewpoint(): Promise<Viewpoint | null> {
  const auth = await getCurrentAuth();
  const lens = (await cookies()).get(IMPERSONATION_COOKIE)?.value;
  return resolveViewpointFor(auth, lens);
}
