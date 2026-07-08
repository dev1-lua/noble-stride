# Gap Closure + Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the in-app gaps vs Marko's Full Scoping Document (matching guardrails, missing fields, client intake & qualification, filters, notifications) and ship simplification Waves 1–3 (plain-language surface, deal-journey spine, Today home).

**Architecture:** Next.js 16 App Router (RSC-first) + Prisma/Postgres + Pothos GraphQL (server-side) + urql client mutations in drawers. Pure logic lives in `src/server/domain/*` (unit-tested), services in `src/server/services/*`, UI in `src/app` + `src/components`. All new pure logic (scoring, qualification, journey) is TDD'd; UI wiring follows existing drawer/panel patterns.

**Tech Stack:** TypeScript, Prisma 6, Pothos + graphql-yoga + urql, Tailwind 4, vitest, zod.

**Specs:** `docs/superpowers/specs/2026-07-08-{scoping-gap-closure,client-intake-qualification,crm-simplification}-design.md`

## Global Constraints

- **NO git commits.** Standing working agreement: leave the working tree dirty; the user commits after their own review. Wherever this plan's task template would say "commit", instead run the gates and stop.
- **Gates per task:** `npx tsc --noEmit` (0 errors) and `npx vitest run` (all pass) from `noblestride-crm/`. Lint only files you touched (`npx eslint <files>`); pre-existing errors elsewhere are not yours to fix.
- **Windows quirk:** stop any running dev server before `npx prisma migrate dev` / `prisma generate` (DLL lock on the query engine).
- **Skip boss-pending items** (`docs/naming-decisions-pending.md`): do NOT rename "Activity", do NOT rename stage values, do NOT merge Service Providers into Partners. "Investor Outreach" rename is already done.
- **Never-automate guardrails:** nothing added here may auto-convert leads, auto-approve, auto-share, or send external communications. Intake applicants never see a qualification verdict.
- App dir: `D:\LuaWork\NobleStride\noble-stride\noblestride-crm`. All paths below are relative to it.
- User-facing vocabulary: investor×deal records are called "Investor Outreach" / "outreach" in UI copy; internal identifiers (`Engagement`, `engagementStage`) stay unchanged.
- Money display: follow existing `formatMoney` usage. Dates: existing `formatDate`.

---

## Phase A — Matching engine guardrails & dimensions (gap spec §3)

### Task 1: Ranking engine upgrade (pure logic, TDD)

**Files:**
- Modify: `src/server/domain/ranking.ts`
- Create: `src/server/domain/__tests__/ranking.test.ts`

**Interfaces (produces — later tasks rely on these exact shapes):**

```ts
export interface MatchTxn {
  sector: string[];
  targetRaise: number;
  geography: string[];
  instrument: string[];                       // NEW — Transaction.instrument
  clientFinancials?: {                        // NEW — from txn.client
    revenue: number | null; ebitda: number | null; loanBook: number | null;
  };
}
export interface MatchInvestor {
  id: string; name: string;
  sectorFocus: string[]; geographicFocus: string[];
  ticketMin: number | null; ticketMax: number | null;
  status: string | null;
  instruments: string[];                      // NEW
  minRevenue: number | null; minEbitda: number | null; minLoanBook: number | null; // NEW
  contactName?: string | null;                // NEW (resolved by caller)
  criteriaVerifiedAt?: Date | null;           // NEW (wired in Task 9)
}
export interface InvestorMatch {
  id: string; name: string; score: number;
  reasons: string[];                          // positive chips
  warnings: string[];                         // NEW — negative/info chips
  contactName: string | null;
  criteriaStale: boolean;                     // true if verifiedAt null or >180 days old
}
```

**Scoring (replaces current weights):** sector overlap **0.35**, geography overlap **0.25**, ticket fit **0.15**, instrument overlap **0.15** (fraction of txn instruments the investor covers; if either side empty → 0 contribution, no warning), threshold fit **0.10** (of the investor thresholds that are defined AND have a non-null client value: fraction met; each miss adds warning `"Below revenue threshold"` / `"Below EBITDA threshold"` / `"Below loan-book threshold"`; defined threshold with null client value adds warning `"Revenue not on record"` etc., no credit), plus **+0.10** bonus if `status === "ActivelyDeploying"`; `status` of `Dormant`/`FullyDeployed` adds warning `"Not currently deploying"`. Cap at 1.0.

**Hard filter in `rankInvestorMatches`:** drop investors where both `txn.instrument` and `inv.instruments` are non-empty and share no element. Keep existing score>0 filter, sort desc, limit 8.

`criteriaStale`: `criteriaVerifiedAt == null || (now - criteriaVerifiedAt) > 180 days` — accept `now: Date` as an optional last param of `rankInvestorMatches` defaulting to `new Date()` so tests are deterministic.

- [ ] **Step 1:** Read current `src/server/domain/ranking.ts` fully. Write `__tests__/ranking.test.ts` covering: (a) disjoint instruments filtered out; (b) empty investor instruments NOT filtered; (c) instrument overlap scores 0.15 when fully covered; (d) threshold miss produces warning + no credit; (e) threshold with null client value produces "not on record" warning; (f) Dormant produces "Not currently deploying" warning and no bonus; (g) weights sum: perfect match (all dims + deploying) capped at 1.0; (h) criteriaStale true for null and for 200-day-old date, false for 30-day-old; (i) existing sector/geo/ticket behavior still holds (port any existing assertions). Run: expect FAIL (new fields don't exist).
- [ ] **Step 2:** Implement in `ranking.ts`. Keep the human-readable positive chips pattern (`"Sector match: …"`, `"Ticket fits (…)"`) and add `"Instrument match: Debt"` style chips. Run tests → PASS.
- [ ] **Step 3:** Gates (tsc + full vitest).

### Task 2: `aiMatchInvestors` exclusion filter + new data plumbing + UI chips

**Files:**
- Modify: `src/server/services/ai.ts` (lines 16–54)
- Modify: `src/graphql/queries.ts` (the `InvestorMatch`/aiMatchInvestors objectRef — add `warnings`, `contactName`, `criteriaStale` fields)
- Modify: the Match Investors popover component — locate with `Glob src/components/**/match-investors*` (expected `src/components/crm/match-investors-button.tsx`)

**Interfaces:** Consumes Task 1 shapes verbatim.

- [ ] **Step 1:** In `aiMatchInvestors`: add `where: { engagementClassification: "Active", onboardingStatus: "Approved" }` to the `investor.findMany`; extend `select` with `instruments, minRevenue, minEbitda, minLoanBook, criteriaVerifiedAt, contacts: { select: { firstName: true, lastName: true, isPrimaryContact: true, isSSAContact: true } }`. Build `contactName`: SSA contact first, else primary, else first contact, else null (`firstName + " " + (lastName ?? "")`.trim()). Extend `matchTxn` with `instrument: txn.instrument` and `clientFinancials: { revenue: num(txn.client?.revenueLastYear), ebitda: num(txn.client?.ebitda), loanBook: num(txn.client?.loanBook) }` (Decimal→Number helper as done for ticketMin).
- [ ] **Step 2:** Update the GraphQL objectRef for match results to expose `warnings: [String]`, `contactName: String (nullable)`, `criteriaStale: Boolean`; update the popover UI: render warning chips in amber/rose tone below the reason chips, `via <contactName>` under the investor name when present, and an amber `Criteria >6 months old` chip when `criteriaStale`.
- [ ] **Step 3:** Add a service-level unit test if a seam exists; otherwise rely on Task 1 units + typecheck. Gates.

---

## Phase B — Simplification Wave 1 (minus boss-pending items)

### Task 3: Navigation cleanup + demo-cruft removal

**Files:**
- Modify: `src/components/shell/sidebar.tsx` (MAIN_NAV line ~38, AGENT_CARDS section, bottom Settings/collapse)
- Modify: `src/components/shell/topbar.tsx` (notification bell)

- [ ] **Step 1:** Remove the `/access-matrix` entry from `MAIN_NAV` (route stays live; the amber lens banner already links to it). Remove the AGENT_CARDS grid, its "Agents" section header, and the green badge. Remove the cosmetic Settings button and collapse chevron from the sidebar bottom. KEEP `/service-providers` in nav (boss-pending).
- [ ] **Step 2:** In `topbar.tsx`, remove the notification bell button and its static "3" badge entirely (a real bell returns in Task 14).
- [ ] **Step 3:** Full vitest (snapshot/string tests may reference removed items — fix any). Gates.

### Task 4: Page-purpose subtitles (Marko-language)

**Files:**
- Modify: `src/components/shell/topbar.tsx` (ROUTE_META map)
- Modify: on-page `<p>` subtitles where pages render their own header (at minimum `src/app/(crm)/engagement/deals/page.tsx`, `src/app/(crm)/engagement/investors/page.tsx` already done — verify consistency)

- [ ] **Step 1:** Set these exact subtitles in ROUTE_META (title unchanged unless noted):
  - `/dashboard`: "Where the pipeline stands today — deals, investors, tasks, and money in motion"
  - `/deals`: "Every assignment we've been hired for (mandates) and every live raise (transactions), in one queue"
  - `/clients`: "The companies we raise capital for — profile, financials, and their documents"
  - `/investors`: "The investor database — who invests in what, and where each relationship stands"
  - `/engagement`: (already set) "Which investors have seen each deal, and how far each conversation has gone"
  - `/documents`: "The register of teasers, IMs, NDAs and models — and who is allowed to see each"
  - `/tasks`: "Action items and follow-ups — who owes what, by when"
  - `/partners`: "Referral partners and advisors — who introduced which deals, and what we owe them"
  - `/service-providers`: "Lawyers, auditors and DD firms engaged on transactions"
  - `/mandates`: "Client mandates — the assignments behind every raise"
  - `/transactions`: "Live fundraising transactions"
- [ ] **Step 2:** Gates.

### Task 5: Glossary + HelpHint + stage tooltips

**Files:**
- Create: `src/lib/glossary.ts`
- Create: `src/components/ui/help-hint.tsx` (`"use client"`)
- Modify: `src/lib/vocab.ts` (add `STAGE_HELP`)
- Modify: `src/components/ui/chip.tsx` (optional `title` pass-through if not present)
- Modify: stage-board column headers (`src/components/crm/engagement-stage-board.tsx`, the deals-queue board component) and 3–5 key section headers (engagement tracker pages, investor detail NDA panel, documents page header) to attach hints.

**Interfaces (produces):**
```ts
// src/lib/glossary.ts
export interface GlossaryEntry { term: string; definition: string }
export const GLOSSARY: GlossaryEntry[]; // ordered for display
export function define(term: string): string | undefined;
// src/lib/vocab.ts
export const STAGE_HELP: Record<string, string>; // enum value → one-liner
```

- [ ] **Step 1:** Write `glossary.ts` with these entries (exact copy): Mandate — "The assignment a client hires NobleStride for — one fundraising or advisory engagement, opened when the engagement contract is signed."; Transaction — "A live capital raise executed under a mandate — the deal investors are matched against."; Investor Outreach — "One investor's conversation on one deal — from first share to term sheet, NDA and investment."; Milestone — "One of 15 fixed checkpoints an investor passes on a deal, from teaser review to success-fee payment."; Open NDA — "An umbrella NDA with an investor that covers every deal we share with them."; Closed NDA — "A deal-specific NDA — covers only the named transaction."; Teaser — "A short, anonymised deal summary shared before an NDA — the company appears under a codename."; Information Memorandum (IM) — "The full confidential deal document shared after an NDA is signed."; VDR — "Virtual data room — the document set an investor can open once access is granted."; Term Sheet — "An investor's written, non-binding offer terms for the deal."; Due Diligence — "The investor's detailed verification of the business — financial, legal, tax, commercial and ESG."; Disbursement — "Money actually paid out by an investor after closing."; Codename — "The stand-in name (e.g. 'Project Amber Harrier') that hides a client's identity from investors before an NDA."; Lens — "The role you are viewing the CRM as — Admin, Deal Lead or Team Member — which controls what you can edit."; Retainer — "The commencement fee a client pays when the engagement contract is signed."; Success Fee — "The fee invoiced when a transaction closes."
- [ ] **Step 2:** `help-hint.tsx`: small `?` button (`aria-label="What is this?"`), click toggles an absolutely-positioned popover card with the definition; follow the columns-popover pattern in the deals queue for outside-click close. Props: `{ term: string }` (looks up via `define`) or `{ text: string }`.
- [ ] **Step 3:** Add `STAGE_HELP` one-liners for every MandateStage, TransactionStage, EngagementStage value (e.g. `IMShared: "The investor has received the Information Memorandum"`, `Proposal: "Our engagement proposal is with the client"`, `DealPreparation: "Analysis and investor documents are being prepared"` — write all 26). Wire `title={STAGE_HELP[value]}` onto stage chips (add optional `title` prop to Chip if missing) and board column headers.
- [ ] **Step 4:** Attach `<HelpHint term="…"/>` next to: engagement tracker page titles (both), the investor detail "NDA" panel header, the documents page header, and the deal-summary "Investor Outreach" dt. Gates.

---

## Phase C — Schema migration + field UIs (gap spec §4–§5)

### Task 6: Prisma migration (single migration for everything)

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/lib/vocab.ts` (labels for new enums/values)
- Create: `src/server/domain/qualification.ts` (constants only in this task: `RESTRICTED_SECTORS`)

- [ ] **Step 1:** Stop the dev server. Add to `schema.prisma` exactly:
  - `enum Priority { High Medium Low }`
  - `enum PartnerFeeStatus { NotDue Due Invoiced Paid }`
  - Append to `enum Sector`: `OilAndGas Mining Gambling Alcohol Tobacco`
  - Client: `pepExposure Boolean @default(false)`, `governmentOwned Boolean @default(false)`, `complianceNotes String?`, `auditedFinancialsYears Int?`, `groupStructure String?`, `suppliers String?`, `competitors String?`, `capacityUtilization String?`, `repaymentAbilityNotes String?`, `pricingExpectations String?`, `proposedTimeline String?`
  - Mandate: `retainerAmount Decimal?`, `retainerInvoicedDate DateTime?`, `retainerPaidDate DateTime?`, `priority Priority?`, `referralQualified Boolean?`, `qualificationVerdict String?`, `qualificationReasons String[]`, `qualifiedAt DateTime?`
  - Transaction: `priority Priority?`, `partnerFeeStatus PartnerFeeStatus?`, `partnerFeeAmount Decimal?`
  - Investor: `criteriaVerifiedAt DateTime?`
  - Partner: `feedbackNotes String?`
  - New model `Notification`: `id String @id @default(cuid())`, `userId String`, `user User @relation(fields: [userId], references: [id], onDelete: Cascade)`, `kind String`, `title String`, `body String?`, `href String?`, `readAt DateTime?`, `createdAt DateTime @default(now())`, plus `notifications Notification[]` back-relation on User and `@@index([userId, readAt])`.
- [ ] **Step 2:** `npx prisma migrate dev --name scoping_gap_fields` then `npx prisma generate`. Expected: migration applies cleanly (all fields nullable/defaulted).
- [ ] **Step 3:** vocab.ts: `Priority: { High: "High", Medium: "Medium", Low: "Low" }`, `PartnerFeeStatus: { NotDue: "Not Due", Due: "Due", Invoiced: "Invoiced", Paid: "Paid" }`, Sector additions (`OilAndGas: "Oil & Gas"`, `Mining: "Mining"`, `Gambling: "Gambling"`, `Alcohol: "Alcohol"`, `Tobacco: "Tobacco"`). Create `src/server/domain/qualification.ts` exporting `export const RESTRICTED_SECTORS = ["OilAndGas","Mining","Gambling","Alcohol","Tobacco","RealEstate"] as const;`
- [ ] **Step 4:** Gates (pothos types regenerate via prisma generate; fix any type fallout).

### Task 7: Client compliance & operations UI

**Files:**
- Modify: `src/lib/schemas/client.ts` (zod: new optional fields)
- Modify: `src/components/crm/client-form-drawer.tsx` (locate via Glob if name differs)
- Modify: `src/app/(crm)/clients/[id]/page.tsx`
- Modify: `src/graphql/types.ts` + `src/graphql/mutations.ts` + `src/server/services/clients.ts` (expose/accept new fields — follow how an existing optional Client field like `businessModel` flows through)

- [ ] **Step 1:** Thread the 11 new Client fields through schema→GraphQL→service→drawer following the existing optional-field pattern. Drawer grouping: a "Compliance" section (PEP involvement checkbox, Government-owned checkbox, Compliance notes textarea, Audited financial years number input 0–10) and an "Operations" section (Group structure, Suppliers, Competitors, Capacity utilization, plus Repayment ability, Pricing expectations, Proposed timeline).
- [ ] **Step 2:** Client detail page: new "Compliance" card (flags render as rose badges when true; audited years; notes) and "Operations" card; add a rose banner at the top of the profile when `client.sector` intersects `RESTRICTED_SECTORS`: exact copy `Restricted sector — this company operates in a sector NobleStride does not take to investors ({sector names}).`
- [ ] **Step 3:** Gates. (Round-trip is exercised in the final Playwright pass.)

### Task 8: Deal fields UI — retainer, priority, referral quality, partner fee

**Files:**
- Modify: `src/lib/schemas/mandate.ts`, `src/lib/schemas/transaction.ts`
- Modify: mandate + transaction form drawers (`src/components/crm/*form-drawer.tsx`)
- Modify: `src/app/(crm)/mandates/[id]/page.tsx`, `src/app/(crm)/transactions/[id]/page.tsx`, `src/components/crm/deal-summary-panel.tsx`
- Modify: `src/server/services/deals-queue.ts`, `src/server/domain/deals-queue.ts`, the deals queue table/filter components (priority column + filter)
- Modify: `src/app/(crm)/partners/[id]/page.tsx` + partner portal overview (`src/app/portal/partner/page.tsx`) for fee status; partner form drawer for `feedbackNotes`
- Modify: graphql types/mutations + `src/server/services/mandates.ts`, `transactions.ts`, `partners.ts`

- [ ] **Step 1:** Thread mandate fields (retainerAmount/InvoicedDate/PaidDate, priority, referralQualified) and transaction fields (priority, partnerFeeStatus, partnerFeeAmount) through schema→GraphQL→service→drawers. `referralQualified` renders in the mandate drawer only when the mandate has `referredBy` (tri-state select: Unset/Qualified/Not qualified). Partner fee fields render in the transaction drawer only when `referredBy` set.
- [ ] **Step 2:** Detail surfaces: Deal Summary panel shows "Retainer" cell (amount + invoiced/paid dates) beside the NDA/EA pairs and a "Priority" chip (`options("Priority")`, tone: High=rose, Medium=amber, Low=neutral). Transaction Deal Facts adds Partner fee row (status chip + amount) when referred.
- [ ] **Step 3:** Deals queue: add sortable `priority` column (chooser-toggleable, in `cols=` param), a priority filter dropdown, and priority chip on board cards when set. Follow the existing column/filter wiring in `deals-queue.ts` (both files) and the table component.
- [ ] **Step 4:** Partner detail: referred-deals table gains "Fee status" column; add editable `feedbackNotes` textarea to the partner drawer (internal only — do NOT render in the partner portal). Partner portal overview: show fee payment status chip per referred deal row (read-only).
- [ ] **Step 5:** Gates.

### Task 9: Investor criteria freshness

**Files:**
- Modify: `src/server/services/investors.ts` (update path), `src/graphql/mutations.ts`
- Modify: `src/components/crm/investor-form-drawer.tsx`, `src/app/(crm)/investors/[id]/page.tsx`
- Modify: `src/server/services/ai.ts` (select + pass `criteriaVerifiedAt` — completes Task 2's seam)

- [ ] **Step 1:** In the investor update service: when any of `sectorFocus, geographicFocus, ticketMin, ticketMax, instruments, minRevenue, minEbitda, minLoanBook, status, investmentStages` is present in the update input, set `criteriaVerifiedAt: new Date()`. Add mutation `markInvestorCriteriaVerified(id)` setting it without other edits.
- [ ] **Step 2:** Investor detail Key Facts: "Criteria verified — <date or Never>" + a small "Mark verified today" button (gated `can(orgRole, "Investors", "U")`). Wire `criteriaVerifiedAt` into `aiMatchInvestors` select so the Task 1/2 staleness chip goes live.
- [ ] **Step 3:** Gates.

---

## Phase D — Client intake & qualification agent (intake spec)

### Task 10: Qualification engine (pure, TDD)

**Files:**
- Modify: `src/server/domain/qualification.ts` (add engine beside RESTRICTED_SECTORS)
- Create: `src/server/domain/__tests__/qualification.test.ts`

**Interfaces (produces):**
```ts
export type QualificationVerdict = "Qualified" | "NeedsReview" | "Deprioritized";
export interface IntakeQualInput {
  revenueUsd: number | null; raiseUsd: number | null; auditedYears: number | null;
  countries: string[]; sectors: string[];
  pepExposure: boolean; governmentOwned: boolean;
  ebitdaUsd: number | null; yearFounded: number | null; currentYear: number;
}
export function qualifyIntake(input: IntakeQualInput): { verdict: QualificationVerdict; reasons: string[] };
export const SSA_GEOGRAPHIES: readonly string[]; // EastAfrica, WestAfrica, SouthernAfrica, SubSaharanAfrica, PanAfrica, FrancophoneAfrica
```

**Rules:** Deprioritize when: revenue defined < 1_000_000; raise defined < 500_000; auditedYears defined < 3; no country in SSA_GEOGRAPHIES; any sector in RESTRICTED_SECTORS; pepExposure or governmentOwned true; ebitda defined ≤ 0; yearFounded defined > currentYear−3. NeedsReview when no deprioritize hit but: raise in [500k, 1M); or any of revenue/raise/auditedYears/ebitda/yearFounded is null. Qualified otherwise. Every failed/soft check appends a plain-English reason (e.g. `"Revenue below USD 1M (USD 400,000 reported)"`, `"EBITDA not provided"`, `"Operating in a restricted sector: Mining"`). Missing data NEVER deprioritizes.

- [ ] **Step 1:** Table-driven tests: one per deprioritize rule; the 500k–1M review band; each missing-field → NeedsReview; all-pass → Qualified with empty reasons; precedence (deprioritize beats review); reason strings present. Run → FAIL.
- [ ] **Step 2:** Implement. Run → PASS. Gates.

### Task 11: Public intake wizard `/intake`

**Files:**
- Create: `src/lib/schemas/intake.ts` (zod `intakeSchema`; steps via `.pick()` — mirror `src/lib/schemas/registration.ts` conventions)
- Create: `src/app/intake/page.tsx` (server component; `?step=done` → confirmation)
- Create: `src/app/intake/intake-wizard.tsx` (`"use client"` — copy the architecture of `src/app/register/register-wizard.tsx`: one state object, per-step `.pick()` validation, review step with per-field Edit jumps, single final submit)
- Create: `src/app/intake/actions.ts` (`submitIntakeAction`)
- Modify: `src/app/page.tsx` (landing: add secondary CTA "Raise capital with NobleStride" → `/intake` beside the investor links)

**Steps/fields (intake spec §3.2):** 1 Company basics (legalName, registrationNo, country `options("Geography")`, sectors multi `options("Sector")`, yearFounded, website?, pitchDeckUrl?); 2 Contact (contactName, role, corporate email — reuse `isCorporateEmail`, phone); 3 Financial snapshot (revenueUsd, ebitdaUsd, netProfitUsd, totalAssetsUsd, auditedYears select 0|1|2|3|4|5; loanBookUsd shown only when sectors include FinancialServices or Banking); 4 Funding need (raiseUsd, instrument select Debt|Equity|Both, useOfFunds textarea, proposedTimeline); 5 Ownership & compliance (ownershipSummary textarea, pepExposure yes/no, governmentOwned yes/no, existingDebtUsd?); 6 Review & submit.

Step-3 helper copy (exact): "Audited financial statements and registration documents will be requested securely after an NDA is in place — do not paste confidential figures you are not comfortable sharing."

**`submitIntakeAction`** (one prisma `$transaction`):
1. Create Client: `status: "Prospect"`, `source: "Website"`, `createdSource: "API"`, map name/registrationNo/hqCountry+countries/sector/yearFounded/website/revenueLastYear/ebitda/netProfit/totalAssets/loanBook/existingDebt/ownershipStructure(=ownershipSummary)/pepExposure/governmentOwned/auditedFinancialsYears/pitchDeckUrl + a Person `{ firstName: contactName, jobTitle: role, email, phone, isPrimaryContact: true }`.
2. Create Mandate: `name: "<company> — Fundraising"`, `stage: "NewLead"`, `source: "Website"`, `dealSize: raiseUsd`, sector mirror, `notes: "Use of funds: " + useOfFunds + "\nTimeline: " + proposedTimeline`.
3. Run `qualifyIntake` (currentYear from `new Date().getFullYear()`); store verdict/reasons/`qualifiedAt: new Date()` on the mandate.
4. Create Activity `{ type: "Note", subject: "Website intake received", channel: "WebChat", direction: "Inbound" }` linked to client + mandate.
5. Redirect to `/intake?step=done`. Confirmation copy (exact): "Thank you — your application is under review. Our team will be in touch after an initial assessment." **No verdict shown, ever.**
Duplicate names: still create; no auto-merge.

- [ ] **Step 1:** intake schema + tests colocated if the repo pattern has them (see `task.test.ts`); wizard; action; landing CTA.
- [ ] **Step 2:** Manual smoke: `npx next build` compiles the new route. Gates.

### Task 12: Intake queue + review actions

**Files:**
- Modify: `src/app/(crm)/dashboard/page.tsx` (intake callout card, mirroring the onboarding-queue card)
- Create: `src/components/crm/intake-review-panel.tsx`
- Modify: `src/app/(crm)/mandates/[id]/page.tsx` (render panel when `source === "Website"` and `leadId == null`)
- Modify: `src/graphql/mutations.ts` + `src/server/services/mandates.ts` (3 mutations)
- Modify: `src/server/services/deals-queue.ts` + filter UI (add `source` filter param if absent)

**Interfaces (produces):** mutations `acceptIntakeMandate(id: ID!, leadId: ID!): Mandate` (sets leadId, logs StageChange-feed activity "Intake accepted"), `deprioritizeIntakeMandate(id: ID!, reason: String!): Mandate` (sets `dealStatus: "Dropped"`, appends reason to notes, logs activity), `rerunQualification(id: ID!): Mandate` (re-reads client + mandate fields, reruns `qualifyIntake`, updates verdict/reasons/qualifiedAt).

- [ ] **Step 1:** Dashboard callout: "N website applications awaiting review" (count = mandates where `source: "Website"`, `leadId: null`, `dealStatus: "Open"`), links to `/deals?type=mandate&stage=NewLead&source=Website`. Add `source` filter to the deals queue if missing (param + dropdown using `options("Source")`).
- [ ] **Step 2:** Review panel: verdict badge (Qualified=emerald, NeedsReview=amber, Deprioritized=rose), reason list, submitted `qualifiedAt` date, actions: "Accept & assign" (required User select from `relationOptions().users` — locate actual users list source; disabled until chosen), "Deprioritize" (required reason textarea), "Re-run qualification". Gate all three behind `can(orgRole, "Mandates", "U")` and Admin/DealLead lens only.
- [ ] **Step 3:** Service unit tests for the 3 mutations if a db-mock seam exists (see `engagements.smoke.test.ts` pattern); otherwise typecheck + final E2E. Gates.

---

## Phase E — Portal filters + notifications (gap spec §6–§7)

### Task 13: Portal EBITDA / net-profit filters

**Files:**
- Modify: `src/components/portal/opportunity-filters.tsx` (add to the RANGE list: `ebitdaMin`/`ebitdaMax` "EBITDA min/max (USD)", `netProfitMin`/`netProfitMax` "Net profit min/max (USD)")
- Modify: the server code that applies `revenueMin`/`revenueMax` (Grep `revenueMin` under `src/server` and `src/app/portal` — extend identically against `client.ebitda` and `client.netProfit`)

- [ ] **Step 1:** Implement both pairs end-to-end following the revenue pair exactly. Gates.

### Task 14: In-app notifications + live bell

**Files:**
- Create: `src/server/services/notifications.ts`
- Modify: `src/graphql/queries.ts` (unread list + count), `src/graphql/mutations.ts` (`markNotificationsRead(ids: [ID!])`, `markAllNotificationsRead`)
- Create: `src/components/shell/notification-bell.tsx` (`"use client"` dropdown)
- Modify: `src/components/shell/topbar.tsx` (render bell, server-fetched initial data)
- Modify emission points: `src/server/services/mandates.ts` + `transactions.ts` (stage-change paths), `engagements-crud.ts` (engagement stage change), `tasks.ts` (escalation sweep), `src/server/onboarding/register-investor.ts` (new registration → all Admins), the express-interest server action under `src/app/portal/investor/**/actions.ts` (notify engagement owner else transaction owner), `src/app/intake/actions.ts` (new intake → all Admins)

**Interfaces (produces):**
```ts
// src/server/services/notifications.ts
export type NotificationKind = "stage_change" | "task_overdue" | "new_registration" | "new_intake" | "interest_expressed";
export async function notify(userIds: string[], n: { kind: NotificationKind; title: string; body?: string; href?: string }): Promise<void>; // dedupes empty userIds, skips silently on none
export async function unreadFor(userId: string, limit?: number): Promise<Notification[]>;
export async function adminUserIds(): Promise<string[]>;
```

- [ ] **Step 1:** Service + emissions. Stage change title pattern: `"<record name>: <from> → <to>"`, href to the record, recipient = record owner/lead, skipping the acting user. Task escalation: on the existing overdue auto-escalate, `notify([assigneeId], { kind: "task_overdue", title: "Overdue: <task title>", href: "/tasks" })` — only on the escalation transition (escalated false→true), so it fires once per task.
- [ ] **Step 2:** Bell UI: unread count badge (server value), dropdown lists latest 15 with title/relative time, click-through marks read + navigates, "Mark all read". No polling — server-rendered count per request is fine.
- [ ] **Step 3:** Unit test `notify`/`unreadFor` with the repo's db-mock pattern if available. Gates.

---

## Phase F — Journey spine + Today home + help panel (Waves 2–3)

### Task 15: `dealJourney` derivation (pure, TDD)

**Files:**
- Create: `src/server/domain/journey.ts`
- Create: `src/server/domain/__tests__/journey.test.ts`

**Interfaces (produces):**
```ts
export type JourneyState = "done" | "current" | "pending" | "manual";
export interface JourneyStep { index: number; title: string; state: JourneyState; evidence?: { label: string; href: string } }
export interface JourneyInput {
  mandate: { id: string; source: string | null; ndaSignedDate: Date | null; eaSignedDate: Date | null;
    stage: string; retainerPaidDate?: Date | null; qualificationVerdict?: string | null; referredByName?: string | null };
  transactions: { id: string; stage: string; vdrLink: string | null;
    successFeeInvoicedDate: Date | null; successFeePaidDate: Date | null; hasDisbursements: boolean }[];
  engagementStages: string[];   // engagementStage of every outreach row across the mandate's transactions
  documentTypes: string[];      // Document.type of docs linked to mandate/transactions/client
  firstMeetingAt: Date | null;  // earliest Activity of type Meeting|Call on client/mandate
}
export function dealJourney(input: JourneyInput): JourneyStep[]; // always 17 steps
```

**Step mapping (titles verbatim from the simplification spec §4.1):** 1 done always (evidence: source label + referredByName); 2 done if firstMeetingAt; 3 done if ndaSignedDate; 4 done if stage past Qualification in MandateStage order OR qualificationVerdict non-null; 5 done if stage in Proposal/Negotiation/Signed; 6 done if eaSignedDate; 7 done if any txn vdrLink; 8 done if documentTypes has FinancialModel or Valuation; 9 done if has Teaser AND IM; 10 done if engagementStages.length > 0; 11 done if any engagementStage ≠ "Shared"; 12 done if any in {TermSheet, Offer}; 13 done if any txn stage DueDiligence+ (order: DealPreparation<InvestorOutreach<DueDiligence<TermSheet<Closing<ClosedWon) or any engagementStage DueDiligence; 14 done if documentTypes has SPA|SHA|LoanAgreement; 15 done if any txn ClosedWon or hasDisbursements; 16 done if any successFeeInvoicedDate/PaidDate; 17 always `"manual"`. `current` = first non-done among 1–16 (later done steps stay done — evidence-based, no gating).

- [ ] **Step 1:** Tests: fresh mandate → step 1 done, step 2 current; NDA+EA signed → 3 & 6 done even if 4–5 pending (out-of-order allowed); full ClosedWon fixture → 1–16 done, 17 manual; each step's specific trigger (17 focused cases); current-step logic. Run → FAIL.
- [ ] **Step 2:** Implement. PASS. Gates.

### Task 16: `<DealJourney/>` rendering

**Files:**
- Create: `src/components/crm/deal-journey.tsx` (server component: compact horizontal spine, wraps on small screens; done=emerald dot+line, current=accent ring, pending=neutral, manual=dashed; step label under dot; evidence rendered as `title=` tooltip + optional link)
- Create: `src/server/services/journey.ts` (`journeyForMandate(mandateId)` — loads JourneyInput with one query round; reuse existing service query patterns from `mandates.ts`)
- Modify: `src/app/(crm)/mandates/[id]/page.tsx` (spine at top, under header), `src/app/(crm)/clients/[id]/page.tsx` (one spine per mandate, most recent expanded, others behind a `<details>` collapse), `src/app/(crm)/transactions/[id]/page.tsx` (spine scoped to its mandate — skip when no mandate linked)

- [ ] **Step 1:** Service loader + component + placements. Empty/edge states: mandate with no transactions renders spine fine (steps 7+ pending). Gates.

### Task 17: "Today" home + first-run checklist

**Files:**
- Create: `src/app/(crm)/home/page.tsx`
- Create: `src/components/crm/welcome-checklist.tsx` (`"use client"`, localStorage key `ns_welcome_dismissed`)
- Modify: `src/components/shell/sidebar.tsx` (add `{ href: "/home", label: "Today", Icon: Sun }` as FIRST nav item)
- Modify: `src/server/onboarding/resolve-login.ts` or `src/app/login/actions.ts` (team destinations `/dashboard` → `/home`; investors/partners unchanged)
- Modify: `src/app/page.tsx` root redirect for team viewpoint if it targets `/dashboard`

**Sections (each a Card with link-through rows; empty sections render nothing; if ALL empty show "Nothing waiting on you — all clear."):**
1. "Needs a decision" — pending investor registrations (reuse the dashboard onboarding-queue query) + unassigned website intakes (Task 12 count query), Admin/DealLead lenses only.
2. "Overdue" — tasks `assigneeId = lens.userId`, escalated/overdue, with due date.
3. "Going quiet" — active transactions with no activity in 14 days (extract the query from `aiOverviewInsights` insight #2 into a shared service function `quietTransactions()` in `src/server/services/dashboard.ts` and reuse in both places).
4. "Due next" — investors with `nextActionDate` within 7 days + own tasks due within 7 days.
Scope rows by lens: Admin sees org-wide; DealLead/TeamMember see own-scope (follow the lens-scoping pattern used by the dashboard).

- [ ] **Step 1:** Page + queries + checklist card (items: "See your deal queue" → /deals, "How a deal flows end to end" → opens help panel anchor `/home?help=journey` [see Task 18], "Where investor conversations live" → /engagement/deals, "Your task list" → /tasks). Login redirect change. Gates.

### Task 18: Help panel

**Files:**
- Create: `src/components/shell/help-panel.tsx` (`"use client"` slide-over drawer; reuse the Drawer component used by form drawers)
- Modify: `src/components/shell/topbar.tsx` (add `?` button before the viewpoint switcher)

- [ ] **Step 1:** Drawer contents, three sections: (1) "How a deal flows" — the 17 step titles in order with one-line descriptions (import from a `JOURNEY_STEP_HELP` const you add to `src/lib/glossary.ts`); (2) "Glossary" — all `GLOSSARY` entries; (3) "More" — links to `/access-matrix` ("Who can see and edit what") and the walkthrough docs note ("Ask the team for the full CRM walkthrough"). Support `?help=journey` initial-open via a small client effect reading `useSearchParams`. Gates.

---

## Phase G — Verification & documentation

### Task 19: Consolidated verification pass

- [ ] **Step 1:** Full gates: `npx tsc --noEmit`, `npx vitest run`, `npx next build` (all clean), lint touched files only.
- [ ] **Step 2:** Seed a dev DB state (`npx prisma migrate reset --force` if needed — dev DB only) and run the single Playwright (browser MCP) pass: match popover (exclusions absent, warning chips, contact line), Wave-1 nav/subtitles/glossary hints, client compliance card round-trip, priority column + filter, `/intake` full submit (one Qualified, one Deprioritized profile) → neutral confirmation → dashboard callout increments → review panel verdicts → Accept & assign requires lead → Deprioritize drops, portal EBITDA/net-profit filters, live bell (stage change → notification appears, mark read), journey spine on mandate/client/transaction, `/home` sections per lens + checklist dismiss, help panel.
- [ ] **Step 3:** Update `playwright assessment/00-SUMMARY.md` + `03-COVERAGE-MAP.md` with a dated section; log any test artifacts created in `04-TEST-ARTIFACTS-LEFT-IN-DB.md`. Leave the tree dirty — NO commits.
