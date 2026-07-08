# Website Client Intake & Qualification Agent — Design Spec

**Date:** 2026-07-08
**Branch:** `integration/all-features`
**App:** `noblestride-crm/`
**Sources:** `decrypted/NobleStride_Full_Scoping_Document.docx` §04 (+ §01 qualification/rejection
rules), Build Spec §10 (BLOCKER-D: built for the wrong actor), investor register wizard
(`src/app/register/register-wizard.tsx`) as the pattern to reuse, user-approved direction
2026-07-08.

## 1. Goal & scope

Build the missing **company-side** intake: a public wizard where a fundraising company applies,
an internal **qualification engine** that triages the application against Marko's now-explicit
rules, and a **manual review queue** — closing BLOCKER-D. The investor `/register` flow is
untouched.

Three parts: **A** public intake wizard (`/intake`), **B** qualification engine (pure domain
function), **C** internal intake queue + review actions.

**Non-negotiable guardrails (scoping §01 + §04.3):**
- A submission never auto-becomes an active deal; it lands in an **open queue until a human
  assigns a deal lead** (§04.3.8).
- The applicant **never sees a verdict** — confirmation copy is always neutral ("under review,
  we'll be in touch"). Rejection/deprioritization is internal triage; outbound communication stays
  human.
- No confidential documents are collected pre-NDA; no file upload exists (no storage) — the wizard
  collects structured data + optional URLs only, and says documents will be requested after NDA.

## 2. Decisions made (do not re-open)

- Route is **`/intake`** ("Raise capital"), linked from the landing page as a secondary CTA
  alongside the investor links. Investor `/register` untouched.
- Wizard architecture copies the register wizard: **client-state component, one final submit,
  per-step zod validation** (the structural fix that prevented BUG-08 there).
- Qualification verdict lives on **Mandate** (`qualificationVerdict/Reasons/qualifiedAt`) — it is
  per-assignment triage, not a permanent property of the company.
- Verdicts: `Qualified | NeedsReview | Deprioritized`. "Rejected" is deliberately not a verdict —
  rejection is a human decision recorded by dropping the mandate (`dealStatus: Dropped`), matching
  the never-auto-reject rule.
- Depends on the gap-closure spec's Phase 1 migration (PEP/government flags, auditedFinancialsYears,
  restricted Sector enum values, `RESTRICTED_SECTORS`, Priority). Build order: gap-closure Phase 1
  → this spec.

## 3. A — Public intake wizard (`/intake`)

### 3.1 File layout

- `src/app/intake/page.tsx` — server component; renders `<IntakeWizard />`; `?step=done` renders
  the neutral confirmation screen.
- `src/app/intake/intake-wizard.tsx` — `"use client"`, all form state, one step at a time,
  progress bar (same visual grammar as the register wizard).
- `src/app/intake/actions.ts` — `submitIntakeAction` (server action).
- `src/lib/schemas/intake.ts` — `intakeSchema` (zod), step subsets via `.pick()`.

### 3.2 Steps (6 input steps → review → done) — fields from scoping §04.1

| # | Step | Fields |
|---|------|--------|
| 1 | Company basics | legal name, registration no (CR10/CR12 ref), country (Geography options), sector (Sector options incl. restricted values), year founded, website? |
| 2 | Contact person | name, role/position, corporate email, phone |
| 3 | Financial snapshot | revenue last FY (USD), EBITDA (USD), net profit (USD), total assets (USD), audited-statement years (0–5+ select); **conditional:** loan book value if sector = FinancialServices/Banking |
| 4 | Funding need | amount sought (USD), instrument (Debt / Equity / Both), use of funds (textarea), proposed timeline |
| 5 | Ownership & compliance | shareholding summary (textarea), PEP involvement (yes/no), government ownership (yes/no), existing debt (USD, optional) |
| 6 | Review & submit | read-only summary, per-field Edit jumps |

Copy note under step 3: "Audited financial statements and registration documents will be requested
securely after an NDA is in place — do not paste confidential figures you are not comfortable
sharing." Pitch-deck/company-profile URL is one optional field on step 1 (`pitchDeckUrl` exists on
Client).

### 3.3 Submission — `submitIntakeAction`

In one transaction:

1. Create **Client**: `status: Prospect`, `source: Website`, `createdSource: API` — mapping name,
   registrationNo, hqCountry/countries, sector, yearFounded, website, revenueLastYear, ebitda,
   netProfit, totalAssets, loanBook, existingDebt, ownershipStructure, pepExposure,
   governmentOwned, auditedFinancialsYears, pitchDeckUrl + a `Person` contact (isPrimaryContact).
2. Create **Mandate**: `name: "<company> — Fundraising"`, `stage: NewLead`, `source: Website`,
   `dealSize` = amount sought, sector mirror, notes = use of funds + timeline, plus the
   qualification outcome (§4).
3. Run the qualification engine; store verdict/reasons/timestamp on the mandate.
4. Log an `Activity` ("Website intake received", channel WebChat, direction Inbound) on the
   client+mandate.
5. Notify Admins (gap-closure Phase 4 `new_intake` kind if built; otherwise skipped — the queue
   callout in §5 is the primary surface either way).
6. Redirect `?step=done` — neutral confirmation, no verdict shown.

Duplicate handling: exact-name match on existing Client → still create (the team merges manually);
the queue row shows a "possible duplicate of <name>" hint. No auto-merge.

## 4. B — Qualification engine (`src/server/domain/qualification.ts`)

Pure, unit-tested function; also exported for internal re-runs:

```ts
qualifyIntake(input): { verdict: "Qualified"|"NeedsReview"|"Deprioritized", reasons: string[] }
```

Rules (scoping §04.2 qualify / §04.4 deprioritize, §01 criteria):

| Check | Pass | Deprioritize |
|---|---|---|
| Revenue | ≥ $1M | < $1M |
| Raise amount | ≥ $1M | < $500K (between → NeedsReview) |
| Audited years | ≥ 3 | < 3 |
| Geography | SSA geographies | outside SSA |
| Sector | not in `RESTRICTED_SECTORS` | restricted |
| PEP / government | both false | either true |
| EBITDA / profitability | EBITDA > 0 | EBITDA ≤ 0 |
| Operating history | yearFounded ≤ now−3y | younger |

Verdict logic: any deprioritize-condition → `Deprioritized`; all pass → `Qualified`; otherwise
(only soft/missing data, e.g. raise $500K–1M, EBITDA blank) → `NeedsReview`. Every failed/soft
check contributes a human-readable reason string. Missing numeric data never deprioritizes — it
produces a "not provided" reason and at most `NeedsReview` (bad data ≠ bad company).

Mandate fields (this spec's own migration, applied after gap-closure Phase 1):
`qualificationVerdict String?`, `qualificationReasons String[]`, `qualifiedAt DateTime?`.

## 5. C — Internal intake queue + review

- **Dashboard callout** (mirrors the investor onboarding-queue card): "N website applications
  awaiting review" → links to `/deals?type=mandate&stage=NewLead&source=Website` (existing queue
  filters do the work; add a `source` filter param to `/deals` if not already present).
- **Mandate detail — Intake Review panel** (renders when `source: Website` and no lead assigned):
  verdict badge (emerald/amber/rose), reason list, submitted data snapshot link (the client
  record), and actions:
  - **Accept & assign** — required deal-lead select (User picker); sets `leadId`, logs a stage-feed
    entry. This is the §04.3 manual gate; until it happens the mandate simply stays in NewLead.
  - **Deprioritize** — sets `dealStatus: Dropped` with a required reason (stored to notes + stage
    feed). No outbound email — outreach stays human.
  - **Re-run qualification** — recomputes after the team edits client data.
- RBAC: Accept/Deprioritize gated to Admin + DealLead lenses (existing `can` helpers).

## 6. Out of scope

- File uploads (no storage — SOW conversation).
- Automated applicant emails (acknowledgement/rejection) — no email channel exists; also
  never-automate adjacent. Confirmation screen is the only applicant-facing feedback.
- NDA e-signing (never-automate rule; NDA date-tracking already exists on Mandate).
- Spam/abuse protection beyond the register flow's existing patterns (demo-grade, pre-auth).

## 7. Verification

Unit: `qualifyIntake` table-driven tests (each rule, verdict precedence, missing-data behaviour);
intake schema validation. E2E (consolidated pass): submit a qualified + a deprioritized application
via `/intake`, confirm neutral confirmation both times, queue callout increments, review panel
shows correct verdict/reasons, Accept & assign requires a lead, Deprioritize drops with reason,
applicant-side never leaks verdict. Clean up test records per the QA-log convention.
