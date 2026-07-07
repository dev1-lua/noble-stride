# Investor Onboarding Wizard + Wave-1 QA Fixes — Design Spec

**Date:** 2026-07-07
**Branch:** `integration/all-features`
**App:** `noblestride-crm/`
**Sources:** `playwright assessment/{00-SUMMARY,01-BUGS,02-BLOCKERS}.md` (E2E QA, 2026-07-07),
`docs/superpowers/specs/2026-07-05-investor-onboarding-design.md`, the two signed specs in
`decrypted/`, and user-confirmed decisions (2026-07-07: scope A+B; wizard = light-grouping 6 steps).

## 1. Goal & scope

Two deliverables, both left **uncommitted** for user review:

- **A — Rebuild `/register` as a multi-step wizard.** Replace the single crammed form with a
  typeform-style, light-grouped 6-step wizard. Keep the existing server core, OTP verify, and
  "under review" confirmation intact.
- **B — Fix the nine Wave-1 bugs** (BUG-01, 04, 08, 10, 11, 12, 13, 14, 15) — all pure code /
  seed changes with no external dependency.

**Out of scope this session:** D (real client-data import) is the agreed *next* session. C (Wave-2)
and E (integrations / real auth) are untouched. No commits.

**Non-negotiable guardrails (SOW §06, unchanged):** registration lands in `PendingReview`; no deal
visibility before a team member approves; the anti-broker gate stays intact; nothing confidential is
shared automatically.

## 2. Decisions made (do not re-open)

- Session scope = **A + B only**, then full Playwright verification. D deferred.
- Wizard granularity = **light grouping → 6 input steps** (contact fields grouped; deal type + size
  grouped).
- Wizard architecture = **client-state component, single final submit** (Approach A) — the only
  option that structurally prevents field-wipe (BUG-08).
- BUG-01 masking form = **`"Teaser — <dealCodename>"`** (codename-suffixed type label), not a bare
  `"Teaser"`.
- Server core is **untouched**: `register-investor.ts` (`registerInvestor`,
  `confirmRegistrationOtp`, `DEMO_OTP`, free-provider rejection) and the existing `registerAction` /
  `verifyOtpAction` in `register/actions.ts` stay as-is. New work is **additive**.
- Reuse `src/lib/vocab` (`options()`), `src/lib/ticket-bands` (`TICKET_BANDS`), and
  `src/lib/schemas/registration` (`registrationSchema`, `isCorporateEmail`).

## 3. A — Onboarding wizard

### 3.1 File layout

- `src/app/register/page.tsx` — stays a **server component**. Reads `searchParams.step`:
  - default → renders the new `<RegisterWizard demoOtp={DEMO_OTP} />` client component.
  - `step=verify` (with `rid`) → existing OTP form (kept; lightly restyled to match the wizard).
  - `step=done` → existing "registration under review" screen (kept; lightly restyled).
- `src/app/register/register-wizard.tsx` — **new** `"use client"` component holding all form state
  and rendering one step at a time.
- `src/app/register/actions.ts` — **add** `registerWizardAction` (see §3.4). Existing actions
  unchanged.
- Optional: extract per-step field lists / `stepSchemas` into a small module colocated with the
  wizard if it keeps the component readable.

### 3.2 Steps (6 input steps → OTP → done)

| # | Step | Fields | Source |
|---|------|--------|--------|
| 1 | Fund / entity name | `fundName` | text |
| 2 | Contact details | `contactPerson`, `email`, `phone` | text/email/tel (grouped) |
| 3 | Investor type | `investorType` | `options("InvestorType")` |
| 4 | Sector preference | `sectorPreference` (≥1) | `options("Sector")` multi-select chips |
| 5 | Deal preferences | `dealType`, `dealSizeBand` | `options("Instrument")` + `TICKET_BANDS` (grouped) |
| 6 | Review & submit | read-only summary; per-field "Edit" jumps to that step | — |

After step 6 submits successfully → redirect to `?step=verify&rid=…` (existing OTP screen) →
`?step=done` (existing confirmation). Field mapping into `Investor`/`Person` is unchanged (handled by
`registerInvestor`).

### 3.3 State & per-step validation

- All answers live in one client state object; `sectorPreference` is a string array. Back/Next and
  Review "Edit" jumps never mutate/clear other fields — this is the structural BUG-08 fix.
- Each step validates its own fields on **Next** using `registrationSchema.pick({...})` subsets, so
  client validation is byte-identical to server validation, including the `isCorporateEmail`
  free-provider rejection on the email field. Next is disabled/blocked until the step is valid;
  errors render inline beneath the offending field.
- Keep the existing helper copy: "Corporate email only — free providers are not accepted" and the
  "Used for OTP verification" phone hint.

### 3.4 Final submit & inline server errors

- The Review step renders a `<form>` wired to `registerWizardAction` via **`useActionState`**, with
  hidden inputs populated from state (one hidden input per selected sector, `name="sectorPreference"`,
  so `formData.getAll("sectorPreference")` works exactly as today).
- `registerWizardAction(prevState, formData)`:
  - parses with `registrationSchema` + calls `registerInvestor` (unchanged core);
  - on **success** → `redirect('/register?step=verify&rid=<id>')` (redirect throws; `useActionState`
    lets it navigate);
  - on **failure** (`ZodError` or `RegistrationError`, e.g. duplicate email) → **returns
    `{ error: message }`**. The wizard shows the error inline on the Review step with all state
    intact. No full-page redirect, so nothing is wiped.

### 3.5 Look, feel, accessibility

- Calm centered card; top **progress bar + "Step X of 6"**; `motion` slide transitions between
  steps (repo already depends on `motion`); emerald/zinc palette matching the current page
  (`emerald-950` buttons, `zinc` neutrals, existing `inputClass`/`labelClass` styles).
- **Enter advances** on single-input steps; Back/Next fully keyboard-reachable.
- Each step is a `<fieldset>` with a legend; on step change, focus moves to the step heading; the
  step counter is announced via `aria-live`; field errors linked with `aria-describedby`.
- Mobile: single column, full-width inputs, sticky bottom nav (Back / Next).

## 4. B — Wave-1 bug fixes

### BUG-01 (P1, confidentiality) — pre-interest document titles leak client identity
- **File:** `src/server/visibility/project.ts` (`projectDocuments`, ~line 200–225; call site in
  `projectDealForInvestor`).
- **Fix:** thread the masked display name (deal codename) into `projectDocuments`. When
  `tier === "PRE_INTEREST"`, set each doc's `name` to a codename-safe label —
  `"Teaser — <codename>"` / `"Pitch Deck — <codename>"` (derive from `doc.type`), never `doc.name`.
  Also null (or sanitize) `fileUrl` at PRE_INTEREST so the real name can't leak through a file path.
- **Test:** add a visibility unit test asserting that at PRE_INTEREST no projected document `name`
  or `fileUrl` contains the real client/deal name, and that names past PRE_INTEREST are unmasked.

### BUG-04 — org-role lens `<select>` shows stale "Admin"
- **Where:** CRM top bar, "Choose organisation role lens" dropdown (grep the string / `orgRole`).
- **Fix:** bind the `<select>` value to the active viewpoint's `orgRole` (cookie is already correct;
  this is display-only). Make it controlled or set `defaultValue`/`value` from the current viewpoint.

### BUG-08 — register field-wipe on error
- **Resolved structurally by §3** (client-held state + inline error via `registerWizardAction`).
  No single-page register path remains. Nothing else needed.

### BUG-10 — task can be saved with no linked record
- **File:** `src/components/crm/task-form-drawer.tsx` (+ its create action/service).
- **Fix:** require **≥1** of mandate / transaction / investor / client (spec §3.8). Validate
  client-side (block save + inline message) and server-side (defense in depth).

### BUG-11 — "1 actions" pluralization
- **Where:** `/tasks` header (grep "actions across"). Singularize when `count === 1` (and any
  sibling occurrence).

### BUG-12 — portal footer implies a non-existent NDA
- **Where:** investor-portal footer component (grep "terms of your NDA").
- **Fix:** condition the "under the terms of your NDA" copy on the investor actually having an NDA
  (`ndaStatus`/engagement NDA); otherwise render a neutral "Confidential" line.

### BUG-13 — duplicate `<h1>` on investor Opportunities
- **Where:** investor Opportunities page (grep "Investment Opportunities" / "Opportunities").
- **Fix:** keep one `<h1>`; demote the other heading to `<h2>`.

### BUG-14 — express-interest confirmation destroys the request form
- **File:** `src/app/portal/investor/deals/[id]/page.tsx`.
- **Fix:** keep the "Request More Information" form mounted after a successful send; show a success
  **banner** near it instead of replacing it, so a second/different request needs no reload.

### BUG-15 — test junk in lists + un-gated impersonation switcher
- **Seed:** remove these seven test records from `prisma/seed-data.json` (and any generator that
  emits them): `asd`, `abc23`, `test2`, `Test1`, `E2E Probe Capital`, `Gate Check Capital`,
  `Meridian Frontier Capital`. Requires a reseed to verify.
- **Switcher:** `src/components/portal/portal-switcher.tsx` — gate the "view as anyone"
  impersonation to **admin viewpoint only** (hide entirely for investor/partner). Also part of
  BLOCKER-A.
- Note (flag, do not fix now): the status-suffixed real names (`… (Inactive/Greylisted/Excluded)`)
  and the corrupted `BlueOrchard …` record are data-quality issues outside this session's agreed
  seven-record cleanup.

## 5. Testing & verification

- **Vitest (colocated under `src/server/**/__tests__` or beside components):**
  - BUG-01 masking (no real name in projected doc `name`/`fileUrl` at PRE_INTEREST; unmasked after).
  - Wizard per-step validation subsets (each `pick()` accepts/rejects the right inputs; corporate
    email rejected on step 2).
  - Task linked-record rule (rejects zero links, accepts ≥1).
  - Pluralization helper (1 → "action", n → "actions").
- **Playwright (live, at the end, against `http://localhost:3000`):**
  1. Complete the wizard with a corporate email → OTP `000000` → "under review".
  2. Corporate-email inline rejection mid-wizard with **state preserved** (BUG-08 proof).
  3. Approve the new investor in CRM (`/investors/<id>` → Approve) → confirm portal access.
  4. Spot-check BUG-01 (IFC on "Project Amber Harrier" → doc title masked), 04, 10, 11, 12, 13, 14.
  5. Reseed (`pnpm db:reset && pnpm seed`) → confirm junk investors gone (BUG-15) + switcher hidden
     for a non-admin viewpoint.
- **Dev quirks:** dev server usually already on :3000 (don't restart); if `prisma generate` throws
  EPERM, stop the dev server first. Pre-existing lint failures (clients-table.tsx, count-up.tsx,
  seed.ts, investors-crud.smoke.test.ts) are not ours.

## 6. Delivery process

Subagent-driven development: implementer subagents at **xhigh effort** for best-quality code, each
task independently reviewed, looping on fixes until it matches this spec. Then a single live
Playwright verification pass covering every change. Working tree stays **dirty**; commit only on the
user's explicit go-ahead.
