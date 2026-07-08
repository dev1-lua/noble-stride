import { cookies } from "next/headers";
import { ADMIN_VIEWPOINT, parseViewpoint, type Viewpoint, VIEWPOINT_COOKIE } from "@/lib/viewpoint";

/** Read the active demo viewpoint from the request cookie (RSC/server only). */
export async function getViewpoint(): Promise<Viewpoint> {
  const jar = await cookies();
  // TEMPORARY (Task 8 rewrites this to derive the viewpoint from the real
  // session, honoring the impersonation lens only for Admins): until then,
  // fall back to ADMIN_VIEWPOINT so existing call sites keep compiling.
  return parseViewpoint(jar.get(VIEWPOINT_COOKIE)?.value) ?? ADMIN_VIEWPOINT;
}
