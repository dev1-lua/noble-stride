// Cookie half of the session layer — separated so session.ts stays Next-free.
// MUST be called from a server action or route handler (cookie mutation).

import { cookies } from "next/headers";

export const SESSION_COOKIE = "ns_session";

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
