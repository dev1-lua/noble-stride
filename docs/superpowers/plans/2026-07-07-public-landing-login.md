# Public Landing Page + Dummy Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the investor-onboarding flow reachable the way a real investor would reach it: public landing page at `/`, dummy login at `/login` (email lookup, any password), sign-out — so landing → register → review → sign in → portal is clickable end to end.

**Architecture:** Follows the `/register` pattern exactly: RSC page → thin `"use server"` action → plain testable core module (`resolve-login.ts`). The existing viewpoint cookie stays the single "session" mechanism; login just resolves an email to a viewpoint and redirects through the existing `/api/viewpoint` cookie authority. `/` decides on cookie **presence** (missing cookie parses as admin, so presence is the only anonymous/signed-in signal).

**Tech Stack:** Next.js App Router (RSC + server actions), Prisma, Zod, Vitest, Tailwind, lucide-react.

**Spec:** `docs/superpowers/specs/2026-07-07-public-landing-login-design.md`

## Global Constraints

- **This is demo glue, not auth.** Every demo-only surface gets a visible label (amber note, like the register OTP banner) and a code comment pointing at `memory/remaining-tasks.md`.
- Working directory for all commands: `noblestride-crm/` inside the repo.
- Additive only — do not rename/remove existing exports, routes, or cookie semantics. `/api/viewpoint`'s existing behavior must not change for existing callers.
- Match existing styles: `inputClass`/`labelClass` conventions from `src/app/register/page.tsx`, emerald-950 primary buttons, `rounded-xl border border-zinc-200 bg-white` cards, amber demo banners.
- DB-gated smoke tests must skip cleanly when the DB is unreachable (copy the `withDb` helper pattern from `src/server/onboarding/__tests__/register-investor.smoke.test.ts`).
- Dev quirks (memory): dev server usually already running on :3000 — do NOT restart it; `prisma generate` EPERM while dev server runs (no schema changes in this plan, so irrelevant); pre-existing lint failures in `clients-table.tsx`, `count-up.tsx`, `prisma/seed.ts`, `investors-crud.smoke.test.ts` are NOT ours — ignore them.
- Test runner: `npx vitest run <path>` from `noblestride-crm/`.

---

### Task 1: `viewpointHome` helper + sign-out + banner link

**Files:**
- Modify: `src/lib/viewpoint.ts` (append helper)
- Modify: `src/app/api/viewpoint/route.ts` (signout branch + DRY refactor)
- Modify: `src/components/portal/viewing-banner.tsx:59-64` (add Sign out link)
- Test: `src/lib/__tests__/viewpoint-home.test.ts` (create)

**Interfaces:**
- Consumes: `Viewpoint`, `VIEWPOINT_COOKIE` from `src/lib/viewpoint.ts` (existing).
- Produces: `viewpointHome(vp: Viewpoint): string` — `"admin" → "/dashboard"`, `"investor" → "/portal/investor"`, `"partner" → "/portal/partner"`. `GET /api/viewpoint?role=signout` — clears `ns_viewpoint`, redirects `/`. Tasks 3 and 4 rely on both.

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/viewpoint-home.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { viewpointHome, parseViewpoint } from "@/lib/viewpoint";

describe("viewpointHome", () => {
  it("routes admin to the CRM dashboard", () => {
    expect(viewpointHome({ role: "admin" })).toBe("/dashboard");
  });

  it("routes investor and partner to their portals", () => {
    expect(viewpointHome({ role: "investor", recordId: "x" })).toBe("/portal/investor");
    expect(viewpointHome({ role: "partner", recordId: "y" })).toBe("/portal/partner");
  });

  it("composes with parseViewpoint: missing cookie parses as admin → dashboard", () => {
    expect(viewpointHome(parseViewpoint(undefined))).toBe("/dashboard");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/viewpoint-home.test.ts`
Expected: FAIL — `viewpointHome` is not exported.

- [ ] **Step 3: Implement `viewpointHome`**

Append to `src/lib/viewpoint.ts`:

```ts
/** Home route for a viewpoint — where "/" forwards a signed-in lens (landing spec §3). */
export function viewpointHome(vp: Viewpoint): string {
  return vp.role === "investor"
    ? "/portal/investor"
    : vp.role === "partner"
      ? "/portal/partner"
      : "/dashboard";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/viewpoint-home.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Add signout branch + DRY the route**

Replace the body of `src/app/api/viewpoint/route.ts` with:

```ts
import { NextRequest, NextResponse } from "next/server";
import { parseViewpoint, serializeViewpoint, viewpointHome, VIEWPOINT_COOKIE } from "@/lib/viewpoint";

// Demo viewpoint switcher: sets the viewpoint cookie then redirects.
// GET so the switcher can be plain links; this is a demo lens, not auth.
// role=signout clears the cookie (back to the anonymous landing page).
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;

  if (params.get("role") === "signout") {
    const res = NextResponse.redirect(new URL("/", req.url));
    res.cookies.delete(VIEWPOINT_COOKIE);
    return res;
  }

  const vp = parseViewpoint(
    JSON.stringify({ role: params.get("role"), recordId: params.get("recordId") ?? undefined }),
  );
  const res = NextResponse.redirect(new URL(params.get("next") ?? viewpointHome(vp), req.url));
  res.cookies.set(VIEWPOINT_COOKIE, serializeViewpoint(vp), { path: "/", sameSite: "lax" });
  return res;
}
```

(Only changes: the `signout` branch, and `viewpointHome(vp)` replacing the inline ternary — same mapping.)

- [ ] **Step 6: Add "Sign out" to the ViewingBanner**

In `src/components/portal/viewing-banner.tsx`, wrap the existing "Return to Admin" `<Link>` (lines 59–64) and a new sign-out link in a flex group — replace the single `<Link>` with:

```tsx
      <span className="inline-flex items-center gap-2">
        <Link
          href="/api/viewpoint?role=admin"
          className="rounded-md border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
        >
          Return to Admin
        </Link>
        <Link
          href="/api/viewpoint?role=signout"
          className="rounded-md border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
        >
          Sign out
        </Link>
      </span>
```

- [ ] **Step 7: Typecheck + run the lib test suite**

Run: `npx tsc --noEmit` — expected: no NEW errors (pre-existing failures listed in Global Constraints are not ours; if unsure, run on main comparison is overkill — just confirm no errors mention viewpoint/landing/login files).
Run: `npx vitest run src/lib` — expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add src/lib/viewpoint.ts src/lib/__tests__/viewpoint-home.test.ts src/app/api/viewpoint/route.ts src/components/portal/viewing-banner.tsx
git commit -m "feat(landing): viewpointHome helper, signout route, banner sign-out link"
```

---

### Task 2: Login resolver core (`resolve-login.ts`)

**Files:**
- Create: `src/server/onboarding/resolve-login.ts`
- Test: `src/server/onboarding/__tests__/resolve-login.smoke.test.ts`

**Interfaces:**
- Consumes: `prisma` from `@/lib/db`; `Person.email/investorId/partnerId/createdAt` (schema.prisma:449-475).
- Produces (Task 3 relies on these exact names):

```ts
export type LoginResolution =
  | { kind: "investor"; recordId: string }
  | { kind: "partner"; recordId: string }
  | { kind: "admin" }
  | { kind: "unknown" };
export function isTeamEmail(email: string): boolean;
export async function resolveLogin(email: string): Promise<LoginResolution>;
```

- [ ] **Step 1: Write the failing tests**

Create `src/server/onboarding/__tests__/resolve-login.smoke.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { resolveLogin, isTeamEmail } from "@/server/onboarding/resolve-login";

async function withDb<T>(fn: () => Promise<T>): Promise<T | null> {
  if (!process.env.DATABASE_URL) return null;
  try { return await fn(); }
  catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    if (/ECONNREFUSED|ENOTFOUND|connect|Can't reach database|P1001|P1002/.test(m)) return null;
    throw err;
  }
}

const UNIQ = `login-smoke-${Date.now()}`;
const INVESTOR_EMAIL = `contact@${UNIQ}-fund.example.com`;
const PARTNER_EMAIL = `contact@${UNIQ}-advisory.example.com`;
const BOTH_EMAIL = `both@${UNIQ}.example.com`;

let investorId: string | undefined;
let partnerId: string | undefined;

beforeAll(async () => {
  await withDb(async () => {
    const investor = await prisma.investor.create({
      data: { name: `Login Smoke Fund ${UNIQ}`, onboardingStatus: "PendingReview" },
    });
    const partner = await prisma.partner.create({ data: { name: `Login Smoke Advisory ${UNIQ}` } });
    investorId = investor.id;
    partnerId = partner.id;
    await prisma.person.createMany({
      data: [
        { firstName: "Inge", email: INVESTOR_EMAIL, investorId: investor.id },
        { firstName: "Pat", email: PARTNER_EMAIL, partnerId: partner.id },
        // Same email on both an investor and a partner contact — investor must win.
        { firstName: "Bo", email: BOTH_EMAIL, investorId: investor.id },
        { firstName: "Bo", email: BOTH_EMAIL, partnerId: partner.id },
      ],
    });
    return true;
  });
});

afterAll(async () => {
  await withDb(async () => {
    await prisma.person.deleteMany({ where: { email: { contains: UNIQ } } });
    await prisma.investor.deleteMany({ where: { name: { contains: UNIQ } } });
    await prisma.partner.deleteMany({ where: { name: { contains: UNIQ } } });
    return true;
  });
});

describe("isTeamEmail (pure)", () => {
  it("accepts noblestride domains, case-insensitively", () => {
    expect(isTeamEmail("jane@noblestride.co")).toBe(true);
    expect(isTeamEmail("Jane@NobleStride.com")).toBe(true);
    expect(isTeamEmail("ops@noblestride.co.ke")).toBe(true);
  });

  it("rejects everything else, including lookalikes", () => {
    expect(isTeamEmail("jane@gmail.com")).toBe(false);
    expect(isTeamEmail("jane@noblestride-capital.com")).toBe(false);
    expect(isTeamEmail("jane@notnoblestride.co")).toBe(false);
    expect(isTeamEmail("")).toBe(false);
  });
});

describe("resolveLogin (smoke)", () => {
  it("resolves an investor contact email to the investor viewpoint (case-insensitive)", async () => {
    const out = await withDb(async () => {
      const res = await resolveLogin(INVESTOR_EMAIL.toUpperCase());
      expect(res).toEqual({ kind: "investor", recordId: investorId });
      return true;
    });
    if (out === null) return; // DB down — skip
  });

  it("resolves a partner contact email to the partner viewpoint", async () => {
    const out = await withDb(async () => {
      const res = await resolveLogin(PARTNER_EMAIL);
      expect(res).toEqual({ kind: "partner", recordId: partnerId });
      return true;
    });
    if (out === null) return;
  });

  it("prefers investor over partner when the email matches both", async () => {
    const out = await withDb(async () => {
      const res = await resolveLogin(BOTH_EMAIL);
      expect(res).toEqual({ kind: "investor", recordId: investorId });
      return true;
    });
    if (out === null) return;
  });

  it("resolves a team-domain email to admin, and unknown emails to unknown", async () => {
    const out = await withDb(async () => {
      expect(await resolveLogin("jane@noblestride.co")).toEqual({ kind: "admin" });
      expect(await resolveLogin(`nobody@${UNIQ}.example.com`)).toEqual({ kind: "unknown" });
      expect(await resolveLogin("   ")).toEqual({ kind: "unknown" });
      return true;
    });
    if (out === null) return;
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/server/onboarding/__tests__/resolve-login.smoke.test.ts`
Expected: FAIL — cannot resolve `@/server/onboarding/resolve-login`.

- [ ] **Step 3: Implement the resolver**

Create `src/server/onboarding/resolve-login.ts`:

```ts
// resolve-login.ts — testable core of the dummy /login flow.
// DEMO ONLY: this maps an email to a viewpoint lens; there are no credentials
// and no sessions (see repo:memory/remaining-tasks.md — real auth pending).
// Lookup order (landing spec §6): investor contact → partner contact →
// noblestride.* team domain → unknown.

import { prisma } from "@/lib/db";

export type LoginResolution =
  | { kind: "investor"; recordId: string }
  | { kind: "partner"; recordId: string }
  | { kind: "admin" }
  | { kind: "unknown" };

/** DEMO ONLY — team membership by corporate domain, not a directory. */
export function isTeamEmail(email: string): boolean {
  return /@noblestride\.[a-z]{2,}(\.[a-z]{2,})?$/i.test(email.trim());
}

export async function resolveLogin(email: string): Promise<LoginResolution> {
  const norm = email.trim();
  if (!norm) return { kind: "unknown" };

  const investorContact = await prisma.person.findFirst({
    where: { email: { equals: norm, mode: "insensitive" }, investorId: { not: null } },
    orderBy: { createdAt: "desc" },
  });
  if (investorContact?.investorId) return { kind: "investor", recordId: investorContact.investorId };

  const partnerContact = await prisma.person.findFirst({
    where: { email: { equals: norm, mode: "insensitive" }, partnerId: { not: null } },
    orderBy: { createdAt: "desc" },
  });
  if (partnerContact?.partnerId) return { kind: "partner", recordId: partnerContact.partnerId };

  if (isTeamEmail(norm)) return { kind: "admin" };
  return { kind: "unknown" };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/server/onboarding/__tests__/resolve-login.smoke.test.ts`
Expected: PASS — 2 pure tests always; 4 smoke tests pass with DB up, silently skip if down. (Prefer running with the dev DB up so the smoke paths actually execute.)

- [ ] **Step 5: Commit**

```bash
git add src/server/onboarding/resolve-login.ts src/server/onboarding/__tests__/resolve-login.smoke.test.ts
git commit -m "feat(landing): resolve-login core - email -> viewpoint resolution with tests"
```

---

### Task 3: `/login` page + server action

**Files:**
- Create: `src/app/login/page.tsx`
- Create: `src/app/login/actions.ts`

**Interfaces:**
- Consumes: `resolveLogin`, `LoginResolution` from Task 2; `/api/viewpoint` redirect contract from Task 1.
- Produces: public route `/login`; `loginAction(formData: FormData): Promise<void>` (form action only — nothing else imports it).

- [ ] **Step 1: Write the server action**

Create `src/app/login/actions.ts`:

```ts
"use server";
// Server action for the dummy /login flow. Thin wrapper over the testable
// core in src/server/onboarding/resolve-login.ts. Errors round-trip via
// query params (same convention as /register).

import { redirect } from "next/navigation";
import { z } from "zod";
import { resolveLogin } from "@/server/onboarding/resolve-login";

const emailSchema = z.string().trim().email("Enter a valid email address.");

export async function loginAction(formData: FormData): Promise<void> {
  const parsed = emailSchema.safeParse(String(formData.get("email") ?? ""));
  if (!parsed.success) {
    redirect(`/login?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Enter a valid email address.")}`);
  }
  const email = parsed.data;

  const res = await resolveLogin(email);
  if (res.kind === "unknown") {
    redirect(
      `/login?email=${encodeURIComponent(email)}&error=${encodeURIComponent(
        "No account found for this email.",
      )}`,
    );
  }
  if (res.kind === "admin") redirect("/api/viewpoint?role=admin");
  redirect(`/api/viewpoint?role=${res.kind}&recordId=${encodeURIComponent(res.recordId)}`);
}
```

- [ ] **Step 2: Write the login page**

Create `src/app/login/page.tsx`:

```tsx
// login/page.tsx — dummy sign-in (landing spec §6). DEMO ONLY: the email is
// looked up against contacts; the password is cosmetic. No credentials, no
// sessions — the viewpoint cookie is the "session" (memory/remaining-tasks.md).

import Link from "next/link";
import { loginAction } from "./actions";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ error?: string; email?: string }>;
}

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 " +
  "placeholder:text-zinc-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600";

const labelClass = "block text-xs font-medium uppercase tracking-wide text-zinc-500";

export default async function LoginPage({ searchParams }: PageProps) {
  const sp = await searchParams;

  return (
    <div className="flex min-h-screen items-start justify-center bg-zinc-50 px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Link href="/" className="text-sm font-semibold tracking-tight text-emerald-950">
            NobleStride Capital
          </Link>
          <h1 className="mt-3 text-2xl font-bold text-zinc-900">Sign in</h1>
          <p className="mt-1 text-sm text-zinc-500">Investor &amp; partner portal access</p>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Demo mode — any password works. Your email decides where you land: investor and partner
          contacts go to their portal, NobleStride team emails go to the CRM.
        </div>

        {sp.error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {sp.error}{" "}
            {sp.error.startsWith("No account") && (
              <Link href="/register" className="font-semibold underline">
                Register your fund →
              </Link>
            )}
          </div>
        )}

        <section className="rounded-xl border border-zinc-200 bg-white p-5">
          <form action={loginAction} className="space-y-4">
            <div>
              <label htmlFor="email" className={labelClass}>
                Email <span className="text-rose-500">*</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                defaultValue={sp.email ?? ""}
                placeholder="name@fund.com"
                className={"mt-1 " + inputClass}
              />
            </div>
            <div>
              <label htmlFor="password" className={labelClass}>
                Password <span className="text-rose-500">*</span>
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                placeholder="Any password (demo)"
                className={"mt-1 " + inputClass}
              />
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-zinc-100 pt-4">
              <Link href="/register" className="text-xs font-medium text-emerald-800 hover:underline">
                New here? Register your fund
              </Link>
              <button
                type="submit"
                className="rounded-full bg-emerald-950 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-900"
              >
                Sign in
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify against the running dev server**

The dev server is normally already running on :3000 (do not restart it). Verify:

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/login          # expect 200
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/login  # sanity only
```

Then exercise the action end to end with the planted pending investor's contact email (from `scripts/plant-onboarding-data.ts` — the "Meridian Frontier Capital" contact; find it with `npx tsx -e "..."` or by checking the script's constants) and confirm the redirect chain: POST form → `/api/viewpoint?role=investor&recordId=…` → `/portal/investor` shows "Registration under review". A quick manual browser check or headless-chrome screenshot is fine; the full click-through is Task 5.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit` — expected: no errors mentioning `login`.

- [ ] **Step 5: Commit**

```bash
git add src/app/login
git commit -m "feat(landing): dummy /login - email lookup, any password, viewpoint redirect"
```

---

### Task 4: Public landing page at `/`

**Files:**
- Modify: `src/app/page.tsx` (replace the bare redirect entirely)

**Interfaces:**
- Consumes: `viewpointHome`, `parseViewpoint`, `VIEWPOINT_COOKIE` (Task 1); routes `/login`, `/register`.
- Produces: the public landing page; cookie-present visitors are forwarded to `viewpointHome`.

- [ ] **Step 1: Replace `src/app/page.tsx`**

```tsx
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
```

- [ ] **Step 2: Verify both branches against the dev server**

```bash
# Anonymous (no cookie): landing renders
curl -s http://localhost:3000/ | grep -o "Become an Investor" | head -1   # expect a match

# Cookie present: forwards home (admin → /dashboard)
curl -s -o /dev/null -w "%{http_code} %{redirect_url}" \
  -H 'Cookie: ns_viewpoint={"role":"admin"}' http://localhost:3000/
# expect 307/308 with redirect_url ending in /dashboard
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit` — expected: no errors mentioning `src/app/page.tsx`.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(landing): public landing page at / with cookie-aware forward"
```

---

### Task 5: Register cross-links, trackers, end-to-end verification

**Files:**
- Modify: `src/app/register/page.tsx` (form-step subtitle ~line 38; done-step section ~lines 269-277)
- Modify: `../memory/remaining-tasks.md` (repo-root memory folder — append)
- Modify: `../memory/client-meeting-questions.md` (append)

**Interfaces:**
- Consumes: routes `/`, `/login` (Tasks 3–4).
- Produces: nothing consumed downstream — closes the loop + records trackers.

- [ ] **Step 1: Add cross-links to /register**

In `src/app/register/page.tsx`, replace the form-step subtitle block (currently lines 37–41):

```tsx
          {step === "form" && (
            <p className="mt-1 text-sm text-zinc-500">
              NobleStride Capital — investor access request ·{" "}
              <a href="/login" className="font-medium text-emerald-800 hover:underline">
                Already registered? Sign in
              </a>
            </p>
          )}
```

Replace the done-step section (currently lines 269–277):

```tsx
        {step === "done" && (
          <section className="rounded-xl border border-zinc-200 bg-white p-8 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
            <p className="mt-4 text-sm text-zinc-600">
              Your registration is under review by the NobleStride team. You will be contacted at
              your corporate email once approved. No deal information is visible before approval.
            </p>
            <div className="mt-6 flex items-center justify-center gap-4 text-sm font-medium">
              <a href="/" className="text-zinc-600 hover:text-emerald-950">
                ← Back to home
              </a>
              <a href="/login" className="text-emerald-800 hover:underline">
                Sign in
              </a>
            </div>
          </section>
        )}
```

(Plain `<a>` vs `Link` — either works; match the file, which currently imports no `Link`. If you use `Link`, add the import.)

- [ ] **Step 2: Update trackers**

Append to `../memory/remaining-tasks.md` (match the file's existing bullet style):

```markdown
- **Landing + login are demo glue.** `/` landing page and `/login` (email lookup, any
  password) ride the viewpoint cookie — no credentials, no sessions, no rate limiting.
  Replace both with real auth (registration/login/sessions/RBAC). Sign-out
  (`/api/viewpoint?role=signout`) just clears the demo cookie.
```

Append to `../memory/client-meeting-questions.md` (match existing numbering):

```markdown
- Landing-page copy & branding: confirm the public value proposition wording, the
  "how onboarding works" step descriptions, footer contact (investors@noblestride.co),
  and whether the team-login rule (any noblestride.* email) matches reality.
```

- [ ] **Step 3: Full click-through verification (running dev server)**

With the dev server on :3000 and demo data planted (`npx tsx scripts/plant-onboarding-data.ts` if needed):

1. `/api/viewpoint?role=signout` → lands on `/` showing the landing page.
2. Landing → "Become an Investor" → `/register`; complete Step A with a fresh corporate email, Step B with `000000`, Step C shows the confirmation **with the new Sign in link**.
3. Step C → "Sign in" → log in with that same email + any password → "Registration under review" portal screen (pending investor).
4. ViewingBanner → "Sign out" → back to `/` landing.
5. Log in with a `jane@noblestride.co` + any password → `/dashboard`.
6. Log in with `nobody@nowhere-fund.example.com` → inline "No account found" error with the Register link, email field preserved.

Capture headless-Chrome screenshots of the landing page, `/login`, the error state, and the pending-portal screen (per dev quirks: `chrome.exe --headless=new --screenshot=<file> --window-size=1440,900 <url>`; for cookie-dependent shots chain through `/api/viewpoint?...&next=<path>` — note `--screenshot` can't carry cookies, so for step 3's portal shot use the viewpoint URL with `next=/portal/investor`).

- [ ] **Step 4: Run the full test suite + typecheck**

Run: `npx vitest run` — expected: all pass (pre-existing `investors-crud.smoke.test.ts` lint issue is lint, not vitest).
Run: `npx tsc --noEmit` — expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/register/page.tsx ../memory/remaining-tasks.md ../memory/client-meeting-questions.md
git commit -m "feat(landing): register cross-links, demo-glue trackers, e2e click-through verified"
```
