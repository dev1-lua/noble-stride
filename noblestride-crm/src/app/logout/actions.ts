"use server";
// Real sign-out: revoke the DB session, clear both auth cookies.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { validateSessionToken, invalidateSession } from "@/server/auth/session";
import { SESSION_COOKIE, clearSessionCookie } from "@/server/auth/session-cookie";
import { IMPERSONATION_COOKIE } from "@/server/auth/impersonation";

export async function logoutAction(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const validated = await validateSessionToken(token);
    if (validated) await invalidateSession(validated.session.id);
  }
  await clearSessionCookie();
  jar.delete(IMPERSONATION_COOKIE);
  redirect("/login");
}
