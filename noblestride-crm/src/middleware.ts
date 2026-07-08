// Coarse edge gate (real-auth spec §8): cookie PRESENCE only — real session
// validation happens in layouts/actions/GraphQL (never trust middleware alone).

import { NextRequest, NextResponse } from "next/server";

const PROTECTED_PREFIXES = [
  "/dashboard", "/deals", "/mandates", "/transactions", "/investors",
  "/engagement", "/partners", "/clients", "/documents", "/tasks",
  "/access-matrix", "/service-providers", "/settings", "/portal",
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = req.cookies.has("ns_session");

  if (hasSession && (pathname === "/login" || pathname === "/register")) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  if (!hasSession && PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico|.*\\..*).*)"],
};
