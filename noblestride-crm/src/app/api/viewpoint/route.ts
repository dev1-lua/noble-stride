import { NextRequest, NextResponse } from "next/server";
import { parseViewpoint, serializeViewpoint, VIEWPOINT_COOKIE } from "@/lib/viewpoint";

// Demo viewpoint switcher: sets the viewpoint cookie then redirects.
// GET so the switcher can be plain links; this is a demo lens, not auth.
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const vp = parseViewpoint(
    JSON.stringify({ role: params.get("role"), recordId: params.get("recordId") ?? undefined }),
  );
  const dest =
    vp.role === "investor" ? "/portal/investor" : vp.role === "partner" ? "/portal/partner" : "/dashboard";
  const res = NextResponse.redirect(new URL(params.get("next") ?? dest, req.url));
  res.cookies.set(VIEWPOINT_COOKIE, serializeViewpoint(vp), { path: "/", sameSite: "lax" });
  return res;
}
