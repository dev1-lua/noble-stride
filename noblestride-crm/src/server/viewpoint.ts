import { cookies } from "next/headers";
import { parseViewpoint, type Viewpoint, VIEWPOINT_COOKIE } from "@/lib/viewpoint";

/** Read the active demo viewpoint from the request cookie (RSC/server only). */
export async function getViewpoint(): Promise<Viewpoint> {
  const jar = await cookies();
  return parseViewpoint(jar.get(VIEWPOINT_COOKIE)?.value);
}
