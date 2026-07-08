// page.tsx — public landing page.
// Internal-first front door: NobleStride's internal team (admins + internal
// members) signs in to the workspace; investors get small secondary
// "Login as an investor" / "Sign up as an investor" entry points.
// A visitor with a viewpoint cookie is forwarded home (the cookie's PRESENCE
// is the signed-in signal — a missing cookie parses as admin, so we check the
// raw cookie, not the parsed role).

import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { ArrowRight } from "lucide-react";
import { parseViewpoint, viewpointHome, VIEWPOINT_COOKIE } from "@/lib/viewpoint";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const raw = (await cookies()).get(VIEWPOINT_COOKIE)?.value;
  if (raw) redirect(viewpointHome(parseViewpoint(raw)));

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg-secondary)]">
      {/* Header */}
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <span className="text-sm font-semibold tracking-tight text-emerald-950">
          NobleStride Capital
        </span>
        <nav className="flex items-center gap-4">
          <Link
            href="/login?as=investor"
            className="text-xs font-medium text-[var(--text-tertiary)] hover:text-[var(--accent)]"
          >
            Login as an investor
          </Link>
          <Link
            href="/register"
            className="text-xs font-medium text-[var(--text-tertiary)] hover:text-[var(--accent)]"
          >
            Sign up as an investor
          </Link>
          <Link
            href="/login"
            className="rounded bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]"
          >
            Sign in
          </Link>
        </nav>
      </header>

      {/* Centred hero fills the remaining viewport */}
      <main className="flex flex-1 items-center justify-center px-6">
        <div className="w-full max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--accent)]">
            NobleStride Capital · Internal Workspace
          </p>
          <h1 className="mx-auto mt-4 max-w-2xl text-4xl font-bold tracking-tight text-[var(--text-primary)] sm:text-5xl">
            NobleStride&apos;s internal deal workspace
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-[var(--text-secondary)]">
            One place for the NobleStride team to run mandates, track NDA-gated
            documents, and move every investor relationship from teaser to close.
          </p>
          <div className="mt-8 flex items-center justify-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]"
            >
              Sign in to your workspace <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-4 flex items-center justify-center gap-4 text-xs text-[var(--text-tertiary)]">
            <Link
              href="/login?as=investor"
              className="font-medium hover:text-[var(--accent)] hover:underline"
            >
              Login as an investor
            </Link>
            <span className="text-[var(--border-strong)]">·</span>
            <Link href="/register" className="font-medium hover:text-[var(--accent)] hover:underline">
              Sign up as an investor
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
