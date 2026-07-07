import { NextRequest, NextResponse } from "next/server";
import { parseViewpoint, serializeViewpoint, viewpointHome, VIEWPOINT_COOKIE } from "@/lib/viewpoint";

// Demo viewpoint switcher: sets the viewpoint cookie then redirects.
// GET so the switcher can be plain links; this is a demo lens, not auth.
// role=signout clears the cookie (back to the anonymous landing page); demo-only, see repo:memory/remaining-tasks.md.
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;

  if (params.get("role") === "signout") {
    const res = NextResponse.redirect(new URL("/", req.url));
    res.cookies.delete(VIEWPOINT_COOKIE);
    return res;
  }

  const vp = parseViewpoint(
    JSON.stringify({
      role: params.get("role"),
      recordId: params.get("recordId") ?? undefined,
      orgRole: params.get("orgRole") ?? undefined,
      userId: params.get("userId") ?? undefined,
    }),
  );
  const res = NextResponse.redirect(new URL(params.get("next") ?? viewpointHome(vp), req.url));
  res.cookies.set(VIEWPOINT_COOKIE, serializeViewpoint(vp), { path: "/", sameSite: "lax" });
  return res;
}
