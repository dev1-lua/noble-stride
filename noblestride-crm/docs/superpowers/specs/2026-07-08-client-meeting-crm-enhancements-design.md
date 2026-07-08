# Client-Meeting CRM Enhancements — Design

**Date:** 2026-07-08
**Status:** Approved (design), pending spec review
**Scope:** Four independent UI/behaviour changes requested ahead of a client demo. Each is self-contained and can be implemented and verified on its own.

---

## Task 1 — Engagement: "By Deal" and "By Investor" focal views

### Goal
The current `/engagement` page shows every investor×deal interaction on one flat 12-stage board. The client wants that flat "all-together" board **replaced** by two **focal** views, reachable from a sidebar dropdown under "Engagement":

- **By Deal** — the deal is the focal point: per deal, how many investors are involved and how they spread across the pipeline.
- **By Investor** — the investor is the focal point: per investor, how many deals they're in and how those spread across the pipeline.

### Constraint (per client — updated)
- **Replace the old Engagement page.** The flat 12-stage all-together board is removed and no longer shown anywhere. The Engagement experience is now exactly the two focal views.
- **Preserve the other built features:** the counters strip stays on **both** views; the Disbursements table and Activity Timeline move under the **By Deal** view (deal is the default focal point). Nothing built is lost except the flat board.

### Navigation / routing
- Sidebar "Engagement" item becomes **expandable**. Clicking the label navigates to `/engagement`, which **redirects to `/engagement/deals`** (the default focal view). A chevron toggles a nested sub-menu with exactly two items:
  - **By Deal** → `/engagement/deals`
  - **By Investor** → `/engagement/investors`
- The sub-menu auto-expands whenever the current path is under `/engagement`. `sidebar.tsx` is already `"use client"`, so it holds the open/closed state locally (default open when active). The "Engagement" parent is highlighted-active for any `/engagement*` path; the active child is highlighted by exact path.
- Route changes:
  - `src/app/(crm)/engagement/page.tsx` → becomes a server redirect to `/engagement/deals` (old board markup deleted).
  - Create `src/app/(crm)/engagement/deals/page.tsx` and `src/app/(crm)/engagement/investors/page.tsx`.
  - `engagement-stage-board.tsx` is no longer referenced by any page after this change; leave the file in place (harmless) — do not spend time deleting it.

### View composition
- **By Deal** (`/engagement/deals`): counters strip (top) → `FocalPipelineBoard` grouped by deal → Disbursements table + "By Year & Quarter" summary → Activity Timeline. This is where the preserved features live. Reuses the exact data fetches the old page used (`engagementCounters`, `listDisbursements`, `disbursementByPeriod`, `activityTimeline`, `relationOptions`) plus `engagementsByDeal()`.
- **By Investor** (`/engagement/investors`): counters strip (top) → `FocalPipelineBoard` grouped by investor. Uses `engagementCounters` + the new `engagementsByInvestor()`.
- The `LogEngagement` dialog trigger (create action, RBAC-gated) stays in the header of both views.

### Data layer
`src/server/services/engagements.ts`:
- Reuse existing `engagementsByDeal()` (returns each transaction with `client` + `engagements[investor]`).
- Add sibling `engagementsByInvestor()`: groups engagements by investor, each with `transaction` included, ordered by investor name. Single `findMany` + in-process bucketing (same N+1-avoidance pattern as `engagementsByStage`). Only investors that have ≥1 engagement appear.
- A small shared helper computes a per-stage count map from a list of engagements (`engagementStage` → count), preserving `LABELS.EngagementStage` order.

### Presentation — shared `FocalPipelineBoard` component
New `src/components/crm/focal-pipeline-board.tsx` (server-compatible, no Prisma types cross the boundary — page maps to plain DTOs).

Props: a list of **groups**, where each group is:
```
{ id, name, href, countLabel, stageCounts: {stage,label,count}[], items: FocalEngagementDTO[] }
```
`FocalEngagementDTO = { id, counterpartName, counterpartHref, stage, stageLabel, interestLevel? }`
- In By-Deal, `name` = deal name, `countLabel` = "N investors", `counterpartName` = investor name.
- In By-Investor, `name` = investor name, `countLabel` = "N deals", `counterpartName` = deal name.

Each group renders as **one expandable row**:
- **Collapsed:** focal name · count · a compact **stacked stage-distribution bar** (segments proportional to per-stage counts, colored from the board's existing stage palette) followed by small stage pills (`NDA·2 Teaser·1 …`), only for stages with count > 0.
- **Expanded** (`<details>`/`<summary>` — no JS needed, keeps it a server component): the individual engagements — counterpart name (linked), a stage `Chip`, and an "Open engagement →" link to `/engagement/{id}`.

Stage colors: reuse the palette rhythm already in `engagement-stage-board.tsx` (extract the stage→color mapping to a tiny shared module `src/lib/engagement-stage-colors.ts` so both the board and the new bar share one source of truth).

### Pages
Both are Server Components with a shared header pattern:
- Header: `<h1>` "Engagement — By Deal" / "Engagement — By Investor" + one-line subheading, and the RBAC-gated `LogEngagementDialog` trigger on the right.
- A small stage-color legend row above the board.
- `<FocalPipelineBoard groups={…} />` (mapped to plain DTOs).
- Empty state when no engagements exist.
- **By Deal only:** additionally renders the Disbursements table + period summary + Activity Timeline below the board (ported verbatim from the old page's markup and data fetches).

### Testing
- Unit test for `engagementsByInvestor()` grouping + the stage-count helper (vitest, mirroring existing service/domain tests).
- Manual/visual verification in the running app: both routes render, bars/pills reflect seeded data, expand works, links resolve.

---

## Task 2 — Dashboard onboarding alert + instant-notice reinforcement

### Goal
Whoever opens the dashboard must **immediately** see that investors are trying to onboard, and be able to Approve / Decline / Greylist them right there — the same actions available from the investor flow today. A "View list" affordance leads to the exact page the Investors-page "Review queue →" link targets.

### Placement & behaviour
- **New alert card pinned at the very top of `/dashboard`**, above the Overview Agent card. Rendered only when ≥1 investor has `onboardingStatus = PendingReview`.
- Card contents (amber, attention-grabbing, matching the existing amber review-queue callout style):
  - Heading: "N investor registration(s) awaiting review".
  - One row per pending investor (cap at a sensible number, e.g. 5, with "+K more — view list"): fund name · primary-contact email · inline **Approve / Decline / Greylist** buttons.
  - **View list →** link to `/investors?onboarding=PendingReview` (identical target to the Investors page callout — single source of truth for the queue page).
- Inline actions reuse the existing `OnboardingActions` client component (Approve = `setInvestorOnboardingStatus Approved`, Decline = `Rejected`, Greylist = `greylistInvestor`). On success it `router.refresh()`es, so the card updates in place.

### "Notified instantly" reinforcement
- **Sidebar badge:** the "Investors" nav item shows a small count badge when registrations are pending. The `(crm)` layout (already a Server Component that fetches data) fetches the pending count and passes it to `<Sidebar pendingReview={n} />`. `NavItem` gains an optional `badge?: number` prop rendered as an emerald pill (reusing the existing "Agents 3" badge styling).
- Bell (topbar) wiring is **out of scope** for this task (decorative today); the dashboard card + sidebar badge deliver the instant-notice requirement.

### Data layer
- New `src/server/services/dashboard.ts` (or investors service) helper `pendingOnboardingInvestors()`: returns `PendingReview` investors with their primary contact (name + email), newest registration first. Reuse the existing `onboardingStats()` (already returns `pendingReview` count) for the badge/count.

### "Works from any side"
Greylist from the dashboard card, the investors list, or the investor detail page all call the single `greylistInvestor` mutation. The Task-3 domain block is added *inside* that mutation, so it fires regardless of entry point.

### Testing
- Verify in the running app: seed leaves ≥1 `PendingReview` investor → dashboard shows the card at top; Approve/Decline/Greylist each work and the card/count update; "View list" lands on `/investors?onboarding=PendingReview`; sidebar badge shows the count and clears when the queue empties.

---

## Task 3 — Greylisting blocks the domain from re-registering

### Rationale (confirmed from spec docs)
Concept Note: *"we will diligence and approve the investors to avoid brokers onboarding our platform to steal our deals."* Greylisted/Excluded investors get zero deal visibility (SOW §06; Build Spec §11.2). Investors are expected to register with an **official company email (no Gmail/Yahoo)** — so blocking the **domain** is the correct lever against a broker firm, with free-email addresses handled as the exception.

### Data model
New Prisma model:
```prisma
enum BlockedRegistrationKind {
  Domain
  Email
}

model BlockedRegistration {
  id         String                  @id @default(cuid())
  kind       BlockedRegistrationKind
  value      String                  // normalized lower-case: domain ("acme.com") or full email
  reason     String?
  investorId String?                 // the greylisted investor that triggered the block, if any
  investor   Investor?               @relation(fields: [investorId], references: [id], onDelete: SetNull)
  createdAt  DateTime                @default(now())

  @@unique([kind, value])
}
```
Add the back-relation `blockedRegistrations BlockedRegistration[]` to `Investor`. Requires a Prisma migration + `prisma generate`.

> **Dev quirk (memory):** the Prisma query-engine DLL can be locked on Windows if `next dev` is running. Stop the dev server before `prisma migrate` / `generate`, then restart.

### Free-provider denylist
`src/lib/free-email-domains.ts` — a `Set` of common consumer providers: `gmail.com, googlemail.com, yahoo.com, ymail.com, outlook.com, hotmail.com, live.com, msn.com, icloud.com, me.com, proton.me, protonmail.com, aol.com, gmx.com, mail.com, yandex.com, zoho.com`. Helper `emailDomain(email)` → lower-cased domain; `isFreeEmailDomain(domain)` → boolean.

### Write path — inside `greylistInvestor` (`src/server/services/investors.ts`)
Within the existing transaction, after updating classification/status:
1. Load the investor's **primary contact** email (fallback: any contact email).
2. If an email exists: compute the domain. If the domain is a free provider → block **kind=Email, value=<full email>**; else → block **kind=Domain, value=<domain>**.
3. `upsert` the `BlockedRegistration` (idempotent on `(kind, value)`), with `reason = "Greylisted: <investor name>"` and `investorId`.
4. If no email on record, skip silently (nothing to block) — greylist still succeeds.
The existing greylist Activity note is extended to mention what was blocked (e.g. "Domain acme.com blocked from re-registration.").

### Read path — inside `registerInvestor` (`src/server/onboarding/register-investor.ts`)
Before the existing duplicate-email check, add a block check:
- Compute the email's domain.
- Query `BlockedRegistration` for a match: `kind=Email value=<full email>` OR `kind=Domain value=<domain>`.
- If matched, throw `RegistrationError("This email domain is not eligible to register. Contact NobleStride if you believe this is an error.")` (generic wording — does not reveal it was greylisted).

New helper `isRegistrationBlocked(email): Promise<boolean>` in the onboarding module keeps the check testable.

### Testing
- Smoke test (extends `register-investor.smoke.test.ts`): a corporate email whose domain is blocked → `RegistrationError`; a free-provider email blocked exactly → `RegistrationError`; a different free-provider address on the same provider → **allowed**.
- Service test (extends onboarding-decisions smoke): greylisting an investor with a corporate contact email creates a `Domain` block; with a Gmail contact creates an `Email` block.

---

## Task 4 — Landing / cover page rewrite

### Goal
`src/app/page.tsx` currently reads as a marketing page "Built for the deal team". The CRM is for **NobleStride's internal team (admins + internal members)**. The client wants: less content, a simple heading + subheading, the same small investor Sign-up / Log-in entry points, and a page that fills the screen cleanly.

### Design
- Keep the existing signed-in redirect logic (viewpoint cookie → `viewpointHome`).
- Replace the body with a **single full-height, vertically-centered hero**. Remove the `CAPABILITIES` grid ("Built for the deal team"), the `INVESTOR_STEPS` data, and the "Are you an investor?" section entirely.
- Layout:
  - **Header** (top): "NobleStride Capital" wordmark on the left; on the right the small links **Login as an investor · Sign up as an investor · [Sign in]** (Sign in as the filled pill), matching today's header controls.
  - **Centered hero** (fills remaining viewport via `min-h-screen` flex column + centered main):
    - Small eyebrow: "NOBLESTRIDE CAPITAL · INTERNAL WORKSPACE".
    - **Heading:** "NobleStride's internal deal workspace".
    - **Subheading (one line):** "One place for the NobleStride team to run mandates, track NDA-gated documents, and move every investor relationship from teaser to close."
    - Primary button: **Sign in to your workspace →** (`/login`).
    - Beneath, small muted links: **Login as an investor** (`/login?as=investor`) · **Sign up as an investor** (`/register`).
- **Drop the footer** — the single centered hero fills the page on its own; no marketing footer.
- Copy must not call the audience "the deal team"; frame it as NobleStride's internal team.

### Testing
- Visual verification in the running app at `/` (signed-out): full-height centered hero, no feature grid / investor-steps section, investor links + Sign in present and routing correctly; signed-in cookie still redirects home.

---

## Cross-cutting notes
- **Stack:** Next.js (App Router, RSC), Prisma/Postgres, urql GraphQL, Tailwind v4, vitest. Follow existing service-layer / DTO-at-RSC-boundary / vocab-`Chip` conventions.
- **RBAC:** onboarding actions and engagement views follow the existing `can`/`canUpdateRecord` gating already used on those surfaces.
- **No direct commits:** implement + verify, leave the tree dirty; commit only on explicit go-ahead (per user preference).
- **Order of work:** Tasks are independent; recommended sequence for the demo is 4 (fastest, front door) → 2 → 3 (2+3 share the greylist seam) → 1 (largest). Final plan will confirm sequencing.
