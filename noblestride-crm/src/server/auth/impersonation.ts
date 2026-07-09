// Admin-only "view as" lens (real-auth spec §7): the old ns_viewpoint cookie,
// now a signed 8h JWT. Only honored when the REAL session belongs to an Admin
// (enforced by the reader in server/viewpoint.ts, not here).

import { SignJWT, jwtVerify } from "jose";
import { parseViewpoint, serializeViewpoint, type Viewpoint } from "@/lib/viewpoint";

export const IMPERSONATION_COOKIE = "ns_viewpoint";
const MAX_AGE_S = 8 * 60 * 60;

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(s);
}

export async function signImpersonation(vp: Viewpoint): Promise<string> {
  return new SignJWT({ vp: serializeViewpoint(vp) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_S}s`)
    .sign(secret());
}

export async function verifyImpersonation(jwt: string | undefined): Promise<Viewpoint | null> {
  if (!jwt) return null;
  try {
    const { payload } = await jwtVerify(jwt, secret());
    return parseViewpoint(typeof payload.vp === "string" ? payload.vp : null);
  } catch {
    return null;
  }
}
