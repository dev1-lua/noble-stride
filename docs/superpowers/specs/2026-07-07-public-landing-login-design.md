# Public Landing Page + Dummy Login — Design Spec

**Date:** 2026-07-07
**Sources:** user-confirmed decisions (2026-07-07 brainstorm), investor-onboarding design spec (`2026-07-05-investor-onboarding-design.md`), existing viewpoint mechanism (`src/lib/viewpoint.ts`, `src/app/api/viewpoint/route.ts`).

## 1. Goal

The `/register` investor-onboarding flow is currently reachable only by typing the route. Build the demo-grade connective tissue a real investor would use: a public landing page at `/`, a dummy login screen at `/login`, and a sign-out — so the full flow (landing → register → review → sign in → portal) is clickable end to end without manual URL editing.

**This is demo glue, not auth.** The viewpoint cookie remains a lens; direct URLs keep working exactly as today. Real auth stays on `memory/remaining-tasks.md`.

## 2. Decisions already made (do not re-open)

- Landing page **takes over `/`** (currently a bare redirect to `/dashboard`).
- Login = **email lookup, any password** (password field cosmetic, visibly labeled demo).
- Landing is a **proper marketing page** (hero + sections), not a minimal placeholder.
- Follow the register-flow pattern: RSC form → thin `"use server"` action → plain testable core module.
- Same design system / frontend patterns as the rest of the app. Additive only.

## 3. Key mechanical fact

`parseViewpoint` treats a **missing cookie as admin** (`viewpoint.ts:17`). Therefore:

- `/` decides on cookie **presence**, not role: cookie set → forward by role (admin → `/dashboard`, investor → `/portal/investor`, partner → `/portal/partner`); no cookie → render the landing page.
- A **sign-out** is required to return to the anonymous state: extend `GET /api/viewpoint` with `role=signout` → delete `ns_viewpoint` cookie → redirect to `/`.

## 4. Routes

| Route | Change |
|---|---|
| `/` | Replace redirect with landing page (RSC, cookie-aware forward per §3). |
| `/login` | New. Dummy sign-in page (§6). |
| `/api/viewpoint` | Add `role=signout` branch (clear cookie, redirect `/`). Existing behavior untouched. |
| `/register` | Unchanged flow; step C confirmation gains "Back to home" + "Sign in" links. |

## 5. Landing page content (static copy, one page component)

- **Header:** NobleStride logo/wordmark; "Sign in" → `/login`; primary CTA "Become an Investor" → `/register`. When a viewpoint cookie is set the header instead shows "Go to app" + "Sign out" (edge case: forward in §3 normally prevents this from rendering; harmless fallback).
- **Hero:** one-line value proposition (SME growth capital in East Africa, curated deal flow) + the two CTAs.
- **How it works:** 4 steps mirroring the real onboarding flow — Register your fund → NobleStride team review → Sign NDA → Access curated deals. Doubles as demo narration.
- **Value props / stats strip:** 2–3 short cards (curated mandates, NDA-gated data rooms, structured engagement tracking). Static numbers acceptable.
- **Footer:** minimal — wordmark, contact line, no dead links.

## 6. Dummy login — `/login`

Public route (no viewpoint required). Form: email + password. Password accepts anything; amber demo note "Demo mode — any password works", consistent with the register OTP banner.

**Core resolver** `src/server/onboarding/resolve-login.ts` — `resolveLogin(email)` returns a discriminated result, lookup in order:

1. `Person` with that email (case-insensitive) linked to an **Investor** → `{ kind: "investor", recordId }`.
2. `Person` linked to a **Partner** → `{ kind: "partner", recordId }`.
3. Email domain is `noblestride.*` → `{ kind: "admin" }`.
4. Otherwise → `{ kind: "unknown" }`.

If a Person matches multiple records, prefer investor, then partner; deterministic (latest-created first) when several of the same kind match.

**Server action** validates email shape (Zod), calls the resolver, then redirects through the existing cookie authority — `/api/viewpoint?role=<role>&recordId=<id>` — landing on the role home (investor → `/portal/investor`, partner → `/portal/partner`, admin → `/dashboard`). `unknown` → re-render with inline error "No account found for this email" + "Register your fund →" link.

A **PendingReview** investor signing in lands on the existing "Registration under review" portal screen — expected and desirable.

Cross-links: `/login` ↔ `/register` ("New here? Register your fund" / "Already registered? Sign in").

## 7. Testing & verification

- **Vitest (colocated):** resolver — investor email → investor result; partner email → partner; `@noblestride.*` → admin; unknown → unknown; case-insensitivity; investor-over-partner precedence. DB-gated smoke like `register-investor.smoke.test.ts` (skip cleanly when DB unreachable).
- **Route behavior:** `/` forward-by-cookie logic factored into a small pure helper (`viewpointHome(vp | null)`), unit-tested.
- **Visual verification:** headless-Chrome screenshots (per dev quirks) of: landing `/`, `/login`, error state, full click-through landing → register → sign in as the planted pending investor ("Meridian Frontier Capital" contact email) → under-review screen; sign-out returns to landing.
- Dev quirks apply: dev server usually already on :3000; pre-existing lint failures are not ours.

## 8. Trackers

- `memory/remaining-tasks.md`: add "Landing + login are demo glue — no real credentials; replace both with real auth (registration/login/sessions/RBAC)."
- `memory/client-meeting-questions.md`: add landing-page copy/branding sign-off (value prop wording, stats) as a client item.

## 9. Delivery process

Subagent-driven development: **Sonnet** implements each task → **Fable** reviews (per SDD model preference), looping on fixes until the result matches this spec.
