import { NextRequest, NextResponse } from "next/server";
import { parseViewpoint, viewpointHome } from "@/lib/viewpoint";
import { getCurrentAuth } from "@/server/auth/current";
import { IMPERSONATION_COOKIE, signImpersonation } from "@/server/auth/impersonation";
import { logAuthEvent } from "@/server/auth/audit";
import { safeNext } from "@/app/login/safe-next";

// Admin "view as" switcher (real-auth spec §7). GET so the switcher stays
// plain links. Requires a real Admin session; the lens cookie is a signed JWT.
// role=signout clears ONLY the lens ("Return to Admin") — real logout is a
// server action in the topbar.
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;

  if (params.get("role") === "signout") {
    const res = NextResponse.redirect(new URL("/dashboard", req.url));
    res.cookies.delete(IMPERSONATION_COOKIE);
    return res;
  }

  const auth = await getCurrentAuth();
  if (!auth || auth.account.kind !== "INTERNAL" || auth.user?.role !== "Admin") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const roleParam = params.get("role");
  const vp = parseViewpoint(
    JSON.stringify({
      role: roleParam,
      recordId: params.get("recordId") ?? undefined,
      orgRole: params.get("orgRole") ?? undefined,
      userId: params.get("userId") ?? undefined,
      impersonating: roleParam === "investor" || roleParam === "partner" ? true : undefined,
    }),
  );
  if (!vp) return NextResponse.redirect(new URL("/dashboard", req.url));

  await logAuthEvent(`Auth: admin ${auth.account.email} switched lens to ${JSON.stringify(vp)}`);
  // safeNext rejects absolute/off-origin values (e.g. ?next=https://evil.com)
  // so an admin can't be bounced off-site post-lens-switch; fall back to the
  // existing viewpoint-derived home, same default as before.
  const res = NextResponse.redirect(new URL(safeNext(params.get("next") ?? undefined) ?? viewpointHome(vp), req.url));
  res.cookies.set(IMPERSONATION_COOKIE, await signImpersonation(vp), {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 8 * 60 * 60,
  });
  return res;
}
