# Design: Investor/Partner dashboards, Company/Deal fields, DD tracks, in-org RBAC views

**Date:** 2026-07-03
**Status:** Approved (planning-mode session, carried via `docs/HANDOFF-crm-dashboards-rbac.md`)
**Grounding:** `docs/SOW.md` §3.1, §3.2, §6.2, §7.2, §11.1, §13 · `docs/CRM-COMPARATIVE-ANALYSIS-2026-07-03.md` §9 points 4–5

## Problem

Investors cannot see or explore the full set of relevant deals: an investor only sees deals that *silently* match their Fund Profile (`discoverableDealsForInvestor`) plus deals they're already engaged on. There is no filter/search UI, no summary/analytics dashboard for investors or partners, and `/access-matrix` is a static, unenforced picture of in-org roles. Additionally, company financial/impact fields (§3.1) and deal IC/CAK/DD fields (§3.2, §6.2) were never modeled.

## Scope decisions (confirmed)

1. **RBAC = demo-lens views**, not real auth. Extend the existing cookie viewpoint lens with in-org roles (Admin / Deal Lead / Team Member) that scope the internal CRM at the UI level. Real authentication is out of scope (separate priority #1).
2. **Dashboards = filters + KPIs + charts** for both investor and partner portals (largest option).
3. **DD workstream tracks included now** — full 5-track model: Financial / Tax / Commercial / ESG / Legal.

## Design

### 1. Data model (one Prisma migration `company_ic_cak_dd_rbac_fields`)

- **`Client`** adds: `projectCodename String?` (nullable for 104 imported rows; UI requires it on create), `ebitda Decimal? @db.Decimal(20,2)`, `existingDebt Decimal? @db.Decimal(20,2)`, `totalAssets Decimal? @db.Decimal(20,2)`, `womenLed Boolean @default(false)`, `youthLed Boolean @default(false)`.
- **`Transaction`** adds: `icFirstApprovalDate DateTime?`, `icSecondApprovalDate DateTime?`, `cakComesaStatus RegulatoryStatus @default(NotStarted)`, `cakComesaFiledDate DateTime?`, `cakComesaApprovedDate DateTime?`, relation `ddTracks DueDiligenceTrack[]`.
- **New enums:** `RegulatoryStatus { NotStarted Filed Approved NotRequired }`, `DDTrack { Financial Tax Commercial ESG Legal }`, `DDStatus { NotStarted InProgress Complete Flagged NotApplicable }`, `OrgRole { Admin DealLead TeamMember }`.
- **New model `DueDiligenceTrack`** (deal-level, internal-only): `id, transactionId FK, track DDTrack, status DDStatus @default(NotStarted), ownerId String? → User, serviceProviderId String? → ServiceProvider, startedAt DateTime?, completedAt DateTime?, notes String?, createdAt, updatedAt, @@unique([transactionId, track])`.
- **`User`** adds `role OrgRole @default(Admin)`.

### 2. GraphQL/Zod plumbing + internal field UI

- Register the four new enums in `src/graphql/builder.ts`.
- Expose new fields in `src/graphql/types.ts` (Decimal→Float pattern), add `DueDiligenceTrack` prismaObject + `ddTracks` relation on `TransactionRef`.
- Writable fields in `src/graphql/inputs.ts`; **mandatory** additions to `src/lib/schemas/client.ts` and `transaction.ts` Zod create schemas (undeclared keys are silently stripped).
- `upsertDueDiligenceTrack`/`deleteDueDiligenceTrack` mutations → new `src/server/services/due-diligence.ts`.
- Internal UI: new Client fields in the company create/edit drawer; IC/CAK fields plus a **DD Workstreams panel** (5 tracks × status/owner/service-provider/dates) on the transaction detail page, matching existing `src/components/crm/` patterns.

### 3. Investor filters + dashboard

- New client component `src/components/portal/opportunity-filters.tsx` (country, sector, ticket min/max, deal type/instrument, revenue/EBITDA band, women-led/youth-led) writing URL `searchParams`.
- `src/app/portal/investor/page.tsx` passes parsed filters to `loadInvestorPortalData(prisma, recordId, filters)`.
- Filters applied in the visibility engine (`load.ts`/`project.ts`) as a narrowing step **on top of** discovery/tier gating — filters can only reduce, never widen the discoverable set.
- `womenLed`/`youthLed` surfaced on `ProjectedDeal.companyProfile` (visible at all tiers) via `matrix.ts`/`project.ts`.
- New Dashboard tab (`/portal/investor/dashboard`, RSC, gated): KPI strip (matching opportunities, own engagements by stage, own disbursement total/pending) + charts, reusing the hand-rolled SVG/CSS chart pattern (`pipeline-chart.tsx`, `AnimatedStatCard`). Data via new `loadInvestorDashboard(prisma, recordId)` inside the visibility engine — own-data only, never other investors/feedback/probability/notes.

### 4. Partner dashboard

- Enhance `src/app/portal/partner/page.tsx`: keep funnel + KPI tiles, add referral-conversion and expected-fee-by-stage charts (SVG/CSS pattern); extend `src/server/partner-portal.ts` aggregation. Partner-identity rules unchanged.

### 5. Disbursement by year/quarter (§13)

- `disbursementByPeriod()` in `src/server/services/dashboard.ts` groups `Engagement` disbursement by year/quarter (and by deal/investor), reusing `deriveYearQuarter` from `src/server/domain/disbursement.ts`.
- Rendered on internal `/dashboard`; also feeds the investor dashboard's own-disbursement summary.

### 6. In-org RBAC views (demo-lens)

- `src/lib/viewpoint.ts`: `Viewpoint` gains `orgRole?: OrgRole` + `userId?` (meaningful when `role === "admin"`, default `Admin`); parse/serialize updated. `/api/viewpoint` accepts `orgRole`/`userId` params.
- Viewpoint switcher: when Admin is selected, show an org-role select and (for Deal Lead/Team Member) a user picker; `(crm)/layout.tsx` also loads users.
- New `src/server/rbac/matrix.ts`: the `DEFAULTS` grid promoted out of `access-matrix.tsx` into a shared table + `can(orgRole, entity, perm)` + own-scope helper (Deal Lead → own via `leadId`/`ownerId`; Team Member → read all, update own tasks/engagements). New `src/server/rbac/context.ts`: `getOrgLens()`.
- Enforcement is demo-grade and UI-level: hide/disable C/U/D controls per `can(...)`, scope Deal Lead lists to "own" where the matrix says CRU-own, Team Member read-only except own tasks/engagements, lens banner naming the active org-role + user.
- `access-matrix.tsx` imports the grid from `src/server/rbac/matrix.ts` (single source of truth); banner updated to "drives the in-org view lens (demo — not backed by real login)".
- `prisma/seed.ts` assigns roles (a couple Admins; Deal Leads matching real mandate leads; rest Team Member).

### 7. Testing

Vitest, mirroring `src/server/visibility/__tests__/`:

- `src/server/rbac/__tests__/matrix.test.ts`: role × entity × perm from the grid; own-scope cases.
- Extended visibility tests: filters narrow (never widen); impact filter honors flags; **DD-track + IC/CAK values never appear in any external projection** (sentinels added to `FORBIDDEN_STRINGS`).
- Disbursement year/quarter grouping totals test.
- Existing suite (270 tests) stays green.

### Error handling

- Filter params parsed defensively from `searchParams` (invalid values ignored → unfiltered-but-still-gated list).
- `upsertDueDiligenceTrack` validates via Zod; unique `(transactionId, track)` enforced at DB level.
- Unknown/invalid `orgRole` in cookie falls back to `Admin` (same pattern as existing `parseViewpoint`).

### Build order

WS1 (data model) → WS2 (plumbing/UI) → WS5 (disbursement) → WS3 (investor) → WS4 (partner) → WS6 (RBAC) → WS7 (tests, TDD where practical).

## Verification (end-to-end)

1. Run app (`docker compose up -d`, `npm run dev`).
2. Company drawer: set codename/EBITDA/debt/assets/impact → save → reload persists. Transaction: IC dates + CAK/COMESA + 5 DD tracks persist.
3. Investor (Lightrock): filters narrow the list and cannot reveal out-of-mandate deals; Dashboard tab renders own data only.
4. Greylisted fund still sees nothing; no DD/IC/CAK/other-investor/partner leaks in any payload.
5. Partner (DLA Piper): funnel + new charts.
6. RBAC lenses: Team Member read-only except own tasks; Deal Lead edits own, reads others, no delete; Admin full CRUD; `/access-matrix` reflects the live grid.
7. `npm run test` all green.
