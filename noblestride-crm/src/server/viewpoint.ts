import type { Viewpoint } from "@/lib/viewpoint";
import { getCurrentAuth, resolveViewpointFor } from "@/server/auth/current";

/** Derive the active viewpoint from the REAL session (null = signed out). */
export async function getViewpoint(): Promise<Viewpoint | null> {
  const auth = await getCurrentAuth();
  return resolveViewpointFor(auth);
}
