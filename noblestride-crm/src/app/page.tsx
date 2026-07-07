// page.tsx — public landing page (landing spec §5 / queue-rework Task 15).
// Internal-first front door: the NobleStride deal team signs in to the
// workspace; investors get secondary "Login as an investor" / "Sign up as
// an investor" entry points into the existing registration/NDA-gated flow.
// A visitor with a viewpoint cookie is forwarded home (§3): the cookie's
// PRESENCE is the signed-in signal (a missing cookie parses as admin, so we
// check the raw cookie, not the parsed role).

import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import {
  ArrowRight,
  Briefcase,
  FileCheck2,
  Handshake,
  LayoutDashboard,
  MessageSquare,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { parseViewpoint, viewpointHome, VIEWPOINT_COOKIE } from "@/lib/viewpoint";

export const dynamic = "force-dynamic";

const CAPABILITIES = [
  {
    icon: Briefcase,
    title: "Deal queue & pipeline",
    body: "One unified queue for mandates and transactions — search, filter, group, and track every stage from onboarding to close.",
  },
  {
    icon: FileCheck2,
    title: "NDA-gated document workflow",
    body: "Teasers, IMs, and data rooms stay masked until the right NDA is recorded, with every document tracked by stage.",
  },
  {
    icon: MessageSquare,
    title: "Investor engagement tracking",
    body: "See who's reviewing what, log outreach, and keep every fund relationship moving toward commitment.",
  },
  {
    icon: LayoutDashboard,
    title: "Dashboards & reporting",
    body: "Live pipeline health, document readiness, and team activity — all in one view.",
  },
];

const INVESTOR_STEPS = [
  { icon: UserPlus, title: "Register your fund" },
  { icon: ShieldCheck, title: "NobleStride review" },
  { icon: FileCheck2, title: "Sign an NDA" },
  { icon: Handshake, title: "Access curated deals" },
];

export default async function LandingPage() {
  const raw = (await cookies()).get(VIEWPOINT_COOKIE)?.value;
  if (raw) redirect(viewpointHome(parseViewpoint(raw)));

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <span className="text-sm font-semibold tracking-tight text-emerald-950">
          NobleStride Capital
        </span>
        <nav className="flex items-center gap-4">
          <Link
            href="/login?as=investor"
            className="text-xs font-medium text-zinc-500 hover:text-emerald-950"
          >
            Login as an investor
          </Link>
          <Link
            href="/register"
            className="text-xs font-medium text-zinc-500 hover:text-emerald-950"
          >
            Sign up as an investor
          </Link>
          <Link
            href="/login"
            className="rounded-full bg-emerald-950 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900"
          >
            Sign in
          </Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto max-w-5xl px-6 pb-16 pt-14 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">
            NobleStride Capital · Deal Platform
          </p>
          <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl">
            Your pipeline, documents, and investor engagement in one place
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-zinc-600">
            The NobleStride deal team&apos;s workspace — mandates and transactions in one queue,
            NDA-gated documents tracked by stage, and every investor relationship in view from
            teaser to close.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-full bg-emerald-950 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-900"
            >
              Sign in to your workspace <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-4 flex items-center justify-center gap-4 text-xs text-zinc-500">
            <Link
              href="/login?as=investor"
              className="font-medium hover:text-emerald-950 hover:underline"
            >
              Login as an investor
            </Link>
            <span className="text-zinc-300">·</span>
            <Link href="/register" className="font-medium hover:text-emerald-950 hover:underline">
              Sign up as an investor
            </Link>
          </div>
        </section>

        <section className="border-y border-zinc-200 bg-white">
          <div className="mx-auto max-w-5xl px-6 py-14">
            <h2 className="text-center text-2xl font-bold text-zinc-900">Built for the deal team</h2>
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {CAPABILITIES.map((c) => (
                <div key={c.title} className="rounded-xl border border-zinc-200 bg-zinc-50 p-5">
                  <c.icon className="h-5 w-5 text-emerald-700" />
                  <h3 className="mt-3 text-sm font-semibold text-zinc-900">{c.title}</h3>
                  <p className="mt-1 text-sm text-zinc-600">{c.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-6 py-14">
          <div className="rounded-xl border border-zinc-200 bg-white p-6 sm:flex sm:items-center sm:justify-between sm:gap-8">
            <div>
              <h2 className="text-lg font-bold text-zinc-900">Are you an investor?</h2>
              <p className="mt-1 max-w-xl text-sm text-zinc-600">
                Register your fund, pass NobleStride review, sign an NDA, and get access to curated
                deals matched to your mandate.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
                {INVESTOR_STEPS.map((s, i) => (
                  <span key={s.title} className="inline-flex items-center gap-1.5">
                    <s.icon className="h-3.5 w-3.5 text-emerald-700" />
                    {s.title}
                    {i < INVESTOR_STEPS.length - 1 && (
                      <ArrowRight className="h-3 w-3 text-zinc-300" />
                    )}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-4 flex shrink-0 items-center gap-3 sm:mt-0">
              <Link
                href="/login?as=investor"
                className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:border-emerald-700 hover:text-emerald-950"
              >
                Login as an investor
              </Link>
              <Link
                href="/register"
                className="rounded-full bg-emerald-950 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900"
              >
                Sign up as an investor
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-6 py-6 text-xs text-zinc-500">
          <span className="font-semibold text-emerald-950">NobleStride Capital</span>
          <span>Nairobi, Kenya · investors@noblestride.co</span>
        </div>
      </footer>
    </div>
  );
}
