# Bugs — NobleStride CRM (E2E, 2026-07-07)

Severity: **P1** = correctness/confidentiality, must fix before external use · **P2** = functional/consistency defect · **P3** = low / cosmetic.

Repro steps assume the seeded dev DB at `localhost:3000`. Persona is set via the top-bar viewpoint switcher or `/api/viewpoint?role=…`.

---

## P1 — Confidentiality

### BUG-01 — Pre-interest document titles leak the real client identity (defeats codename masking)
**Where:** Investor portal → deal detail, Documents section.
**Spec:** SOW §07 ("Company identities … stay masked"), Build Spec §11 (Pre-interest: *company identity hidden, codename only*).

**Repro:**
1. Sign in / impersonate an approved investor at the **pre-interest** tier for a deal — e.g. view as **IFC**, open **"Project Amber Harrier"** (`/portal/investor/deals/cmr4hci4o009p95ek4mynlet3`).
2. The deal name shows the codename `Project Amber Harrier`, company profile is masked, financials show `—`. ✅ Correct.
3. **But** the Documents section lists: **`Teaser — Chipori Ltd (Sabor A' Mexico)`**.

The real company name (`Chipori Ltd (Sabor A' Mexico)`) is exposed to an investor who has not signed an NDA and is only supposed to see the codename. Confirmed the same company appears un-codenamed in the partner portal referral table and CRM, so this is a genuine identity leak, not a coincidence.

**Root cause (confirmed in code):** `src/server/visibility/project.ts`
- Line ~262: `const displayName = masked ? dealCodename(deal.id) : deal.name;` — deal name masked ✅
- Line ~269: `clientName: masked ? displayName : (client?.name ?? deal.name)` — client name masked ✅
- Line ~219 (`projectDocuments`): `name: doc.name` — **document title passed through verbatim, never masked**, and Teaser docs are explicitly shown at `PRE_INTEREST` (line ~214).

**Suggested fix:** When `tier === "PRE_INTEREST"`, replace/sanitize the document label with a generic form (e.g. `"Teaser"` or `"Teaser — Project Amber Harrier"`) instead of `doc.name`. Same care for any other field that might embed the real name (versions, notes).

---

## P2 — Functional / consistency

### BUG-02 — Same engagement shows two different stage labels across pages
**Where:** Investor portal (Opportunities list, deal detail, Pipeline) + CRM Engagement.
**Repro:** As **IFC**, look at **City Health Hospital (Prodigy) – Growth**:
- Opportunities card badge → **"NDA Signed"**
- Deal-detail header badge → **"NDA Signed"**
- Pipeline page badge → **"Offer"**, milestone progress **"12 of 15"** (Binding offer reached)
- Investor dashboard "Pipeline by Stage" → counts it under **"Offer"**

The stage badge (`engagement.stage`) and the milestone-derived stage disagree for the same record. A user sees "NDA Signed" in one place and "Offer" in another. Pick one source of truth (or reconcile the two) and render it consistently.

### BUG-03 — "Matching opportunities" count disagrees between dashboard and opportunities page
**Where:** Investor portal.
**Repro:** As **IFC**:
- `/portal/investor` (Opportunities) → **"2 opportunities match"**
- `/portal/investor/dashboard` → **"Matching opportunities: 0"**

Same investor, same moment, two different counts. Likely two different definitions ("new/undiscovered" vs "shown in list incl. engaged"), but as presented it reads as a bug. Align the definitions or relabel the dashboard tile (e.g. "New matches").

### BUG-04 — Org-role lens switcher displays the wrong active lens
**Where:** CRM top bar, "Choose organisation role lens" dropdown (Spec §7.2).
**Repro:**
1. Switch to **Team Member** lens: `/api/viewpoint?role=admin&orgRole=TeamMember&next=/investors`.
2. RBAC is applied correctly — the **"+ New Investor"** button is hidden. ✅
3. But the lens dropdown in the top bar still shows **"Admin"**. Cookie is `{"role":"admin","orgRole":"TeamMember"}` (verified), so the *enforcement* is right; the *displayed selection* is stale.

Effect: a user can't tell which lens is active, and the dropdown appears to have "snapped back" to Admin. The `<select>`'s value isn't bound to the active viewpoint.

### BUG-05 — Mojibake (`�`) in deal names — corruption on the edit/save path
**Where:** Dashboard (Recent Changes, Overview Agent), Engagement Tracker, Task dialog dropdowns, anywhere the full deal name renders.
**Symptoms:** `Ewaka � Growth`, `Bid Apartments � Capital Raise` render a U+FFFD replacement char where an en-dash (`–`) should be.
**Evidence it's a write-path bug, not seed/render:**
- `prisma/seed-data.json` contains a **clean** en-dash for these records (`"Ewaka – Capital Raise"`, `"Bid Apartments – Capital Raise"`).
- Source code uses clean en-dashes throughout (e.g. `investors/[id]/page.tsx`).
- Other en-dash names (`Akili Kids – Growth`, `City Health Hospital (Prodigy) – Growth`) render **fine**.
- The two affected records are exactly the ones showing recent status edits in the dashboard "Recent Changes" feed (`On Hold → Open`, `Dropped → Open`, done "1d ago").

**Conclusion:** editing/re-saving a record whose name contains a non-ASCII char mangles it to `�` (an encoding boundary on the update path), or a prior automated test corrupted it. Worth reproducing by editing a record with an en-dash and checking the stored value.

### BUG-06 — Dashboard KPI headline numbers don't reconcile with their own breakdowns; delta badges look like placeholders
**Where:** CRM `/dashboard`.
**Observations:**
- "Active Mandates: **14**" but the Mandates pipeline sums to **21** (4+2+3+2+3+5+2) and "Active Pipeline" says "**21** mandates".
- "Active Transactions: **7**" but transaction stages sum to **12**, and "Active Pipeline" says "**12** transactions".
- Delta badges are nonsensical for counts: **+21** on a base of 14, **+12** on 7, **+42** on 17.
- Three different capital figures on one page: "Capital Raised YTD **$16.0M**", "Invested/Completed **$37.3M** disbursed", "Disbursements by Quarter … **$31.8M** disbursed".

The headline metrics and the deltas appear to be static/placeholder values rather than derived from the same query as the breakdowns. Reconcile them or label the deltas' basis.

> Note: several stat-card headline numbers momentarily read **0** in automated snapshots because they are `motion` count-up animations captured at frame 0 (e.g. "Pending Review" animates 0→4). Those are **not** bugs — verified the real values are correct. BUG-06 is about numbers that are wrong *after* the animation settles.

---

## P3 — Low / cosmetic / data hygiene

### BUG-07 — Partner "Advisor type" inconsistent between CRM and portal
- CRM `/partners` table → African Legal Network **TYPE = "Law Firm"**.
- Partner portal `/portal/partner/details` → same partner **Advisor type = "Investor"**.

Same field, two values. Separately: the whole Partners list is law firms, which Spec §3.7 models as **Service Providers**, not Partners (§3.6 = deal originators/introducers). Worth confirming the entity mapping.

### BUG-08 — Register form wipes all fields on validation error
`/register`: submit with a free-provider email (correctly rejected). The error shows, but **every field is cleared** — the user must re-enter fund name, contact, phone, type, sectors, etc. (Login preserves the email on error; register preserves nothing.)

### BUG-09 — Picklist drift vs Spec §5 / §4
Sector picklist (register, filters, forms) adds **"Renewable Energy"** and **"Banking"** on top of the spec's 18 sectors (which already include "Energy" and "Financial Services"). Deal-type/instrument adds **"Convertible"** (spec §4.2: Debt/Equity/Mezzanine/Grant/Hybrid). Picklists are explicitly extensible per Spec §4, so low severity — but "Renewable Energy" + "Energy" and "Banking" + "Financial Services" read as duplicates.

### BUG-10 — Task can be saved with no linked record
`/tasks` → "+ New Task": saving with Title only (no Mandate/Transaction/Investor/Client) succeeds and shows "Related to: —". Spec §3.8 marks **Linked record required (Y)**. Add validation.

### BUG-11 — Pluralization: "1 action points"
`/tasks` header reads "1 action**s** across the team" (also seen elsewhere). Singularize when count === 1.

### BUG-12 — Portal footer implies an NDA that may not exist
Every investor-portal page footer reads *"Confidential — shared under the terms of your NDA with NobleStride Capital."* This shows even for a just-approved investor with **no NDA on record** (e.g. QA Test Capital). Condition the copy on NDA status.

### BUG-13 — Duplicate `<h1>` on investor Opportunities page
The page has two level-1 headings: "Opportunities" (banner) and "Investment Opportunities" (main). Accessibility/semantics — should be one `<h1>`.

### BUG-14 — Express-interest confirmation destroys the request form
Deal detail → "Send request": the confirmation ("Thank you — your request has been sent…") **replaces** the entire "Request More Information" form. The investor can't send a second/different request without a full page reload.

### BUG-15 — Test/junk data visible in production-like lists
Investor lists and the demo persona-switcher expose obvious test records: `asd`, `abc23`, `test2`, `Test1`, `E2E Probe Capital`, `Gate Check Capital`, `Meridian Frontier Capital`, plus my `QA Test Capital`. Also several real records carry status suffixes baked into the **name** (`Abraaj Group (Inactive)`, `Afrexim (Greylisted)`, `IncoFin (Excluded)`) and one looks import-corrupted: `BlueOrchard Finance S.A. lueOrchard Finance Ltd…` (leading "B" dropped). Clean before any demo. (See also the demo-switcher note in BLOCKERS.)

### BUG-16 — Client/company records are almost empty (blocks §11 reveal + §10 qualification)
Most Client records (e.g. City Health Hospital) have **no** revenue, EBITDA, HQ, year founded, founders, or contacts — only sector + geography. Consequences:
- The post-NDA "reveal financials" half of the visibility gate (§11) can't actually be exercised — approved/DD-stage investors see `—` because there's nothing to reveal (this is why it *looked* like a masking bug but isn't).
- The first-pass qualification logic (§10.2, which keys off revenue ≥ $1M, audited accounts, EBITDA) has no data to run on.

Spec §3.1 marks many of these fields required (Sector, Sub-sector, Founders gender, Years of operation, etc.). Treat as a data-completeness gap (see BLOCKERS).

### BUG-17 — ✅ FIXED (2026-07-08) — GraphQL masked all domain errors to "Unexpected error." (made the NDA guard look like a crash)
**Where:** Every GraphQL mutation; most visibly the Engagement kanban restage select.
**Repro (pre-fix):** Move any engagement whose investor lacks an Open NDA (and whose engagement has no `ndaType`) into an NDA-gated stage (NDA Signed … Invested) → console + inline error showed only `[GraphQL] Unexpected error.` The deliberate SOW §06 guard (`nda-guard.ts`) was throwing a plain `Error`, and `graphql-yoga`'s default `maskedErrors` replaced its message server-side. 40/60 seeded engagements lacked an NDA (the seed bypassed the guard), so most forward moves hit an unexplained wall — this was mistaken for a broken app on 2026-07-08. Commit `3f5c145`'s client-side "surface guard errors" fix was inert for the same reason.
**Fix:** `src/graphql/mask-error.ts` (+ unit test) wired into `createYoga` — passes `NdaGuardError`/`CrudError`/`RegistrationError`/Zod/P2025 messages through as `GraphQLError`s, masks everything else as before. Also: seed now records a Closed NDA for engagements seeded into NDA-gated stages (takes effect on next reseed), and `/investors` shows the onboarding review-queue link even at 0 pending (it was invisible, which read as "the investor queue disappeared").
**Verified (Playwright):** blocked move now shows `Stage "NDASigned" requires a signed NDA. Record an Open NDA on the investor, or a Closed NDA on this engagement, first.` inline (`verify-R1-restage-real-error.png`); same move on an Open-NDA investor (Norfund) succeeds and appears in the dashboard "Recent Changes" feed (`verify-R2-recent-changes-populated.png`); zero-state review-queue link (`verify-R3-review-queue-zero-state.png`).

### BUG-18 — ✅ FIXED (2026-07-08) — No UI path to restage an engagement (orphaned by the focal-views rework)
**Where:** Engagement tracker (By Deal / By Investor) and `/engagement/[id]` detail page.
**Repro (pre-fix):** The 2026-07-08 focal-views rework replaced the 12-column `EngagementStageBoard` with the read-only `FocalPipelineBoard`, orphaning the per-card `EngagementRestageSelect` — the only UI that fired `updateEngagement` with an `engagementStage`. The edit drawer deliberately excludes stage ("restage control owns it"), so after an investor expressed interest (engagement created at Shared/Interested) no admin surface could move it through the pipeline — only a raw GraphQL call.
**Fix:** Spec/plan `2026-07-08-engagement-restage-restore-design.md` (commits `33eced7..0c5d86e`): remounted `EngagementRestageSelect` on every expanded focal-board row (both views) and as the first Details entry on `/engagement/[id]` (which previously never displayed the current stage outside history); per-row RBAC via `canUpdateRecord` (own-scope aware); edit drawer now RBAC-gated like every other detail page; shared `engagementStageOptions()` helper (+ unit test).
**Verified (Playwright):** see "Engagement restage restore" section in `03-COVERAGE-MAP.md` (`verify-RS1-board-inline-restage.png`).

### BUG-19 (P2) — CRM admin sidebar does not collapse at mobile width; main content becomes unreadable
**Where:** Every `(crm)/*` route (shared shell layout).
**Repro:**
1. Sign in as Admin, load `/dashboard`.
2. Resize the viewport to 390×844 (iPhone-class mobile breakpoint).
3. The full ~255px desktop sidebar (all 10 nav items) stays rendered inline, unchanged from desktop — no hamburger/menu-toggle control exists anywhere in the DOM at this width (confirmed via accessibility snapshot).
4. The main content column is squeezed into the remaining ~135px: headings/text wrap into unreadable fragments — e.g. "Dashboard" renders as "Dashboa", "Approve" as "Ap", the onboarding-queue banner text wraps to a ~5-character-wide column.
5. `document.body.scrollWidth === document.documentElement.clientWidth === 390` — no page-level horizontal scrollbar (that specific anti-pattern is avoided), but the CRM is effectively unusable at this width regardless.

**Expected (per `test-scripts/06-cross-cutting.md` §2):** sidebar collapses to a drawer/hamburger pattern at mobile widths rather than squeezing content.
**Note:** the command palette (Ctrl/Cmd-K) modal itself DOES render correctly at this same width (fits viewport, no clipping) — so this is specifically a sidebar/shell-layout gap, not a global mobile-breakage issue.
**Evidence:** `verify-responsive-dashboard-mobile.png`, `verify-responsive-search-mobile.png` (2026-07-10 pass, see `2026-07-10-crm-polish-search-2fa-verification.md`).

### BUG-20 (P3) — ✅ FIXED (2026-07-11) — GraphQL masked integration "not configured" gate errors to generic "Unexpected error."
**Where:** GraphQL `sendEsignEnvelope`, `scheduleMeeting`, `shareDocumentViaBox` mutations when their integration flag is OFF (DocuSign / Teams / Box unconfigured).
**Found during:** external-integrations merge verification (`2026-07-11-integrations-merge-verification.md`).
**Repro (pre-fix):** with all `*_ENABLED` flags off, call any of the three integration mutations via `/api/graphql`. Response is HTTP 200 / `data: null` (never 500 — so dormant-safety was fine), but the error message was the generic **`Unexpected error.`** instead of the intended user-facing **"E-signature not configured"** / **"Teams meetings not configured"** / **"Document sharing (Box) not configured"**.
**Root cause:** same class as BUG-17. The Null/Manual providers throw `IntegrationError(msg, 503)` as defense-in-depth (`src/server/integrations/{esign/manual,meetings/manual,docshare/null}.ts`), but `src/graphql/mask-error.ts`'s `userFacingMessage()` allowlist (NdaGuardError/CrudError/RegistrationError/ZodError/P2025) did **not** include `IntegrationError`, so graphql-yoga masked it. RBAC errors were unaffected (thrown as `GraphQLError` with `FORBIDDEN`).
**Fix (fix-forward, this branch):** `mask-error.ts` now surfaces `IntegrationError` **only when `status === 503`** (the "not configured" gate — fixed, user-safe messages). Real upstream provider failures use **status 502** (`msgraph/auth`, `box`, `docusign`, `teams`, `outlook` clients) and **stay masked**, so provider/API detail never leaks to clients. Added 2 unit tests (503 passthrough + 502 still-masked).
**Verified:** `tsc` clean; vitest 834/834 (was 832; +2). Live: `sendEsignEnvelope` → "E-signature not configured", `scheduleMeeting` → "Teams meetings not configured" now surface cleanly through the real endpoint. (`shareDocumentViaBox` couldn't be driven to the Box gate E2E — the only seeded doc with a `fileUrl` has junk data `"http://x"` and the resolver fetches the file before the gate; the Box 503 → clean-message path is covered by the unit test.)
