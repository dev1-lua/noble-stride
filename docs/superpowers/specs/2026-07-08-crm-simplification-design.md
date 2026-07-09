# CRM Simplification — Design Spec (Waves 1–3)

**Date:** 2026-07-08
**Branch:** `integration/all-features`
**App:** `noblestride-crm/`
**Sources:** `decrypted/NobleStride_Full_Scoping_Document.docx` §01 (17-step lifecycle), §09
(success = "easy to use… smooth and transparent workflow"), full route/vocab inventory (this
session), `walkthrough CRM/` (existing prose explanations to be productized), user-approved
direction 2026-07-08 (Option C: staged, no schema rewrite).

## 1. Goal & scope

Make the CRM understandable end-to-end by a first-time client user. Diagnosis (verified this
session): the app speaks schema, not Marko — 7 stage/status vocabularies (~40 values) across three
disconnected pipeline surfaces; flat 11-item nav with demo cruft; dashboards-first home; no
teaching layer. The fix is presentation-level — **the data model does not change** (Wave 2 is a
read-only derivation; the only migration anywhere is `Notification` in the gap-closure spec).

- **Wave 1 — Speak Marko's language:** labels, page-purpose headers, nav consolidation, cruft
  removal, glossary/stage tooltips.
- **Wave 2 — One deal, one journey:** a 17-step journey spine stitched from existing relations.
- **Wave 3 — Guided start:** role-based "Today" home, first-run welcome checklist, help panel.

Each wave ships independently, in order.

## 2. Decisions made (do not re-open)

- **Keep "Mandate"** — it is Marko's own word ("active mandates", §01.6). Do not invent a synonym.
- **Rename "Engagement" (investor×deal) → "Investor Outreach"** in all user-facing copy — "we
  engage clients via engagement contracts under a mandate while engaging investors through
  engagements" is the single worst vocabulary collision in the app. DB/GraphQL names unchanged;
  this is a `vocab.ts` + copy sweep.
- "Activity" timeline headers → **"Communications & notes"** (matches §01.6 mental model).
- All renames flow through `src/lib/vocab.ts` so they are one-file reversible if Marko objects.
- Demo cruft is **removed**, not hidden: fake Agents card grid, static bell count (real bell
  arrives in gap-closure Phase 4), cosmetic Settings button, cosmetic collapse chevron. The
  ViewpointSwitcher **stays** (it is the demo's auth stand-in; already tracked in BLOCKER-A).
- No product-tour library. Wave 3's first-run guidance is a dismissible checklist card, not a
  spotlight tour (fits RSC architecture; no new dependency).
- Journey spine is **display-only** — no journey state is stored; every step derives from data
  that already exists. A step with no derivable signal shows as "not started" rather than being
  hidden, with step 17 (post-transaction monitoring) marked "manual — outside the system for now".

## 3. Wave 1 — Speak Marko's language

### 3.1 Navigation (11+cruft → 8)

| After | Route | Change |
|---|---|---|
| Dashboard | `/dashboard` | unchanged (Wave 3 adds Today above it) |
| Deals | `/deals` | unchanged |
| Investor Outreach | `/engagement/*` | renamed nav group (By Deal / By Investor sub-items keep working) |
| Clients | `/clients` | unchanged |
| Investors | `/investors` | unchanged |
| Partners & Advisors | `/partners` | Service Providers becomes a **tab** on this page; `/service-providers` redirects (`/partners?tab=providers`) |
| Documents | `/documents` | unchanged |
| Tasks | `/tasks` | unchanged |

Removed from nav: **Access Matrix** (page stays at its URL; now linked from the lens banner — its
only real audience — and the Wave 3 help panel). Removed entirely: Agents card grid + green badge
(the AskBar in the topbar stays — it works), Settings button, collapse chevron, static bell "3".

### 3.2 Page-purpose headers

Every CRM page + portal page gets a consistent one-sentence subtitle in plain Marko-vocabulary
(pattern exists on some pages; make it universal and rewrite the jargon ones). Examples of tone:

- `/deals`: "Every assignment we've been hired for (mandates) and every live raise we're running
  (transactions), in one queue."
- `/engagement/deals`: "Which investors have seen each deal, and how far each conversation has
  gone — from first share to term sheet."
- `/documents`: "The register of teasers, IMs, NDAs and models — and who is allowed to see each."

Full copy list is authored at implementation time and reviewed in the plan's checkpoints (each
page's line is a one-line diff — low risk, human-reviewed).

### 3.3 Glossary + stage tooltips

- `src/lib/glossary.ts` — single source of truth: term → 1–2 sentence plain definition, seeded
  from `walkthrough CRM/` chapters (mandate, transaction, investor outreach, milestone, NDA
  open/closed, VDR, teaser, IM, term sheet, DD, disbursement, codename/masking, lens…).
- `<HelpHint term="…"/>` — a small "?" popover component; attached to section headers and the
  stage-board column headers.
- Stage definitions: every stage value in every picker/board column gets a `title`/popover
  one-liner (added to `vocab.ts` alongside the label, e.g. `IMShared: "The investor has received
  the Information Memorandum"`). One vocabulary file feeds selects, boards, and chips.

## 4. Wave 2 — One deal, one journey

### 4.1 Derivation (`src/server/domain/journey.ts`, pure + unit-tested)

`dealJourney(mandate, { client, transactions, engagements, documents, activities })` returns 17
steps, each `{ index, title, state: "done"|"current"|"pending"|"manual", evidence?: {label, href} }`,
mapped from Marko's §01 lifecycle:

| # | Step (Marko's words) | Derived from |
|---|---|---|
| 1 | Sourcing & origination | mandate exists — `source`, `referredBy` as evidence |
| 2 | Introductory engagement | first meeting/call Activity on client/mandate |
| 3 | NDA | `mandate.ndaSignedDate` |
| 4 | Data collection & screening | stage ≥ Qualification, or qualification verdict present |
| 5 | Internal review & approval | stage ≥ PitchPresentation/Proposal |
| 6 | Engagement contract & retainer | `eaSignedDate`; retainer dates as evidence |
| 7 | VDR setup | any linked transaction `vdrLink` |
| 8 | Financial analysis | FinancialModel/Valuation document linked |
| 9 | Investor documentation | Teaser + IM documents linked |
| 10 | Investor shortlisting | ≥1 investor outreach row (engagement) exists |
| 11 | Outreach & engagement | any outreach ≥ TeaserSent |
| 12 | Offers & negotiation | any outreach at TermSheet/Offer |
| 13 | Due diligence | transaction stage DueDiligence or any ddTrack in progress |
| 14 | Structuring & documentation | SPA/SHA/LoanAgreement document linked |
| 15 | Financial close & disbursement | transaction ClosedWon / disbursement rows |
| 16 | Success fee & closure | `successFeeInvoicedDate` / `successFeePaidDate` |
| 17 | Post-transaction monitoring | always `manual` (informational) |

"Current" = first non-done step. Steps can be done out of order (evidence-based, not gated) — the
spine reports reality, it never blocks writes.

### 4.2 Rendering

`<DealJourney/>` — a compact horizontal spine (wraps on small screens) with done/current/pending
states, each step popover showing the evidence link. Placement: top of **mandate detail** and
**client detail** (client with multiple mandates shows one spine per mandate, collapsed to the
active one); **transaction detail** shows the same spine scoped to its mandate with steps 7–16
emphasized. Boards and queues are untouched — power views over the same truth.

## 5. Wave 3 — Guided start

### 5.1 "Today" home (`/home`)

Post-login landing for team lenses (portals keep their own homes; `/dashboard` stays in nav one
click away). Sections, each a link-through list scoped to the current lens (Admin sees org-wide,
DealLead sees own-scope — reuse existing lens scoping):

1. **Needs a decision** — pending investor registrations; unassigned website intakes (when intake
   spec ships).
2. **Overdue** — escalated/overdue tasks assigned to me.
3. **Going quiet** — active transactions with no activity in 14 days (reuse the
   `aiOverviewInsights` query logic).
4. **Due next** — investor `nextActionDate` hits + tasks due in 7 days.

Each row: what it is, why it surfaced, one click to the record. Empty sections collapse; the
all-clear state says so ("Nothing waiting on you").

### 5.2 First-run welcome checklist

Dismissible card at the top of `/home` per persona (localStorage `ns_welcome_dismissed`):
3–5 links — "See your deal queue", "How a deal flows end to end" (opens a journey example), "Where
investor conversations live", "Your task list". No spotlight overlay, no library.

### 5.3 Help panel

Topbar "?" → slide-over drawer: the glossary (§3.3), a static journey diagram ("how a deal flows"
— the 17 steps with one-liners), and links (Access Matrix, walkthrough docs). Content compiled from
`glossary.ts` — no CMS.

## 6. Out of scope

- Any schema/GraphQL rename (vocab layer only).
- Collapsing Mandate/Transaction into one record (Option A — explicitly rejected for risk).
- Portal-side redesign beyond inherited label fixes (portals already test well with users).
- Real notifications UI (gap-closure Phase 4 owns the bell).

## 7. Verification

Wave 1: snapshot the nav + retitled pages; verify redirects (`/service-providers`), glossary
popovers, no dead controls remain. Wave 2: `journey.ts` table-driven unit tests (each step's
trigger + current-step logic); spine renders on the three detail pages with evidence links.
Wave 3: `/home` sections populate against seed data per lens; checklist dismisses; help drawer.
All in the single consolidated Playwright pass at the end of the build, with
`playwright assessment/` updated.
