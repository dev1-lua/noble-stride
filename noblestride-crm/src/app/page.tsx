// page.tsx — public landing page (landing spec §5). Anonymous front door for
// the investor-onboarding flow: Become an Investor → /register, Sign in → /login.
// A visitor with a viewpoint cookie is forwarded home (§3): the cookie's
// PRESENCE is the signed-in signal (a missing cookie parses as admin, so we
// check the raw cookie, not the parsed role).

import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { ArrowRight, FileCheck2, Handshake, ShieldCheck, UserPlus } from "lucide-react";
import { parseViewpoint, viewpointHome, VIEWPOINT_COOKIE } from "@/lib/viewpoint";

export const dynamic = "force-dynamic";

const STEPS = [
  {
    icon: UserPlus,
    title: "Register your fund",
    body: "Tell us who you are — sectors, instruments, and ticket size. Corporate email required.",
  },
  {
    icon: ShieldCheck,
    title: "NobleStride review",
    body: "Our team reviews every registration. Nothing is visible until you are approved.",
  },
  {
    icon: FileCheck2,
    title: "Sign an NDA",
    body: "An open or per-deal NDA unlocks company identities and data-room access.",
  },
  {
    icon: Handshake,
    title: "Access curated deals",
    body: "Teasers matched to your mandate, structured engagement, and tracked milestones.",
  },
];

const VALUE_PROPS = [
  {
    title: "Curated mandates",
    body: "Every opportunity is a vetted NobleStride engagement — no marketplace noise.",
  },
  {
    title: "NDA-gated data rooms",
    body: "Company identities and financials stay masked until the right NDA is recorded.",
  },
  {
    title: "Structured engagement",
    body: "From teaser to term sheet, every stage is tracked with your deal team.",
  },
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
        <nav className="flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-full px-4 py-2 text-sm font-medium text-zinc-700 hover:text-emerald-950"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="rounded-full bg-emerald-950 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900"
          >
            Become an Investor
          </Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto max-w-5xl px-6 pb-16 pt-14 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">
            SME growth capital · East Africa
          </p>
          <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl">
            Curated deal flow for investors backing East African growth
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-zinc-600">
            NobleStride connects vetted SMEs raising growth capital with the funds that back them —
            with NDA-gated data rooms and a structured path from teaser to term sheet.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-full bg-emerald-950 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-900"
            >
              Become an Investor <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="rounded-full border border-zinc-300 bg-white px-6 py-3 text-sm font-semibold text-zinc-800 hover:border-emerald-700 hover:text-emerald-950"
            >
              Sign in
            </Link>
          </div>
        </section>

        <section className="border-y border-zinc-200 bg-white">
          <div className="mx-auto max-w-5xl px-6 py-14">
            <h2 className="text-center text-2xl font-bold text-zinc-900">How onboarding works</h2>
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s, i) => (
                <div key={s.title} className="rounded-xl border border-zinc-200 bg-zinc-50 p-5">
                  <div className="flex items-center gap-2">
                    <s.icon className="h-5 w-5 text-emerald-700" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                      Step {i + 1}
                    </span>
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-zinc-900">{s.title}</h3>
                  <p className="mt-1 text-sm text-zinc-600">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-6 py-14">
          <div className="grid gap-6 sm:grid-cols-3">
            {VALUE_PROPS.map((v) => (
              <div key={v.title} className="rounded-xl border border-zinc-200 bg-white p-5">
                <h3 className="text-sm font-semibold text-zinc-900">{v.title}</h3>
                <p className="mt-1 text-sm text-zinc-600">{v.body}</p>
              </div>
            ))}
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
