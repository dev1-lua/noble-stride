# Spec-Gap Quick Wins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the spec-explicit gaps identified in `docs/CRM-VS-BUILD-SPEC-COMPARATIVE-ANALYSIS-2026-07-06.md` §16 that need **no client sign-off**: correct/complete the controlled vocabularies (§4), add the missing Company (§3.1), Deal (§3.2) and Task (§3.8) fields, give Tasks full CRUD + overdue escalation (§12.2 trigger 1), add stage-history audit rows (§7.1's tractable slice), generalize communication logging (§3.10), surface Service Providers (§3.7 UI), and add the missing §13 dashboard groupings.

**Architecture:** All schema changes are **additive** (new enums, new nullable/defaulted fields, one new `StageChange` model) — nothing renamed or removed, so existing data, tests and the demo stay intact. The spec's "Deal type" (Debt/Equity/Equity & Debt) is added as a new `financingType` field (the existing `DealType` round-name enum stays as legacy). Stage-history rows are written inside the existing service-layer write paths — services remain the only Prisma write access. UI follows existing patterns exactly (form drawers + zod schemas + Pothos mutations + urql).

**Tech Stack:** Next.js 16 App Router (RSC + server actions), Prisma 6 (Postgres via docker-compose on port 5544), Pothos GraphQL + urql, Zod v4, Tailwind v4, Vitest.

## Global Constraints

- App root is `noblestride-crm/` inside the repo. All paths relative to `noblestride-crm/` unless prefixed `repo:`.
- Additive schema changes only — never rename/remove existing fields, enums, or models.
- Follow existing conventions exactly: PascalCase enum values, display labels in `src/lib/vocab.ts` (never render raw enum values), zod schemas in `src/lib/schemas/*.ts` (**fields not declared there are silently stripped — every new form field MUST be added to the zod schema**), services under `src/server/services/` are the only Prisma write access, GraphQL inputs in `src/graphql/inputs.ts`, mutations in `src/graphql/mutations.ts`.
- Dev environment quirks: dev server on :3000 holds the Prisma query-engine DLL — `prisma migrate/generate` fails with EPERM while it runs. Stop it first (`Get-NetTCPConnection -LocalPort 3000 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -Confirm:$false }`), migrate, then restart `npm run dev` in background and `rm -rf .next/dev` if the client is stale. `tsx` scripts can't use the `@/` alias.
- Pre-existing lint failures in `clients-table.tsx`, `count-up.tsx`, `prisma/seed.ts`, `investors-crud.smoke.test.ts` are NOT ours — do not fix, do not worry.
- Tests: `npx vitest run <file>` for one file, `npm run test` for the suite (docker Postgres must be up; vitest runs with `fileParallelism: false`; DB smoke tests must create their own rows).
- Commit after every task. Message style: `feat(spec-gaps): …` / `test(spec-gaps): …`.

---

### Task 1: Schema foundation — enums, fields, StageChange model, migration, vocab, zod, GraphQL inputs

**Files:**
- Modify: `prisma/schema.prisma`, `src/lib/vocab.ts`, `src/lib/schemas/{client,mandate,transaction,task (new),engagement}.ts`, `src/graphql/inputs.ts`, `src/graphql/types.ts` (or wherever Pothos object types expose fields — check `src/graphql/`)
- Test: extend `src/lib/__tests__/schemas.test.ts`

**New enums (exact spec values — do not improvise):**

```prisma
enum DealFinancingType { Debt Equity EquityAndDebt }                       // spec §4.1 "Deal type"
enum DealStatus { Open OnHold Closed ClosedReopened ClosedOnHold Dropped } // spec §4.5
enum DealMilestone { TermSheet NonBindingOffer LoanAgreement SpaSha DueDiligence IC TA Closed } // spec §4.3
enum MaxSellingStake { Minority Majority FullSale NA }                     // spec §4.7
enum TaskSource { MondayMeeting WhatsApp Email Verbal Other }              // spec §4.12
enum CommChannel { WhatsApp Email Slack WebChat Call Meeting }             // spec §3.10 Channel
enum CommDirection { Inbound Outbound }                                    // spec §3.10 Direction
enum ClientStatus { Active Prospect Archived }                             // spec §3.1 Status
enum ImpactFlag { WomenLed YouthLed }                                      // spec §3.1 Impact flags
```

**Extend existing enums (additive):** `Instrument` + `Hybrid`; `TaskStatus` + `Dropped`; `Sector` + `Energy`; `Source` + `DirectEnquiry Consultant Investor Partner SocialMedia InternalBusinessDev Other`.

**New fields:**
- `Client`: `codename String?` (spec: project codename, kept separate from legal name), `registrationNo String?`, `hqCountry String?`, `businessModel String?`, `foundersNationality String?`, `ownershipStructure String?`, `directorsManagement String?`, `targetClients String?`, `staffCount Int?`, `branchCount Int?`, `ebitda Decimal? @db.Decimal(20,2)`, `netProfit Decimal? @db.Decimal(20,2)`, `existingDebt Decimal? @db.Decimal(20,2)`, `loanBook Decimal? @db.Decimal(20,2)`, `totalAssets Decimal? @db.Decimal(20,2)`, `impactFlags ImpactFlag[] @default([])`, `status ClientStatus @default(Prospect)` + `@@index([status])`
- `Mandate`: `dealStatus DealStatus @default(Open)`
- `Transaction`: `dealStatus DealStatus @default(Open)`, `dealMilestone DealMilestone?`, `financingType DealFinancingType?`, `maxSellingStake MaxSellingStake?`, `targetProfile String?`, `useOfFunds String?`, `vdrLink String?`, `probability Int?`, `notes String?`, `assistantId String?` + relation `assistant User? @relation("TransactionAssistant", …, onDelete: SetNull)` (add back-relation on User)
- `Task`: `source TaskSource?`, `escalated Boolean @default(false)`, `assistantId String?` + relation `assistant User? @relation("TaskAssistant", …)` (back-relation on User), `activityId String?` + relation `activity Activity? @relation("ActivityTasks", …)` — this is spec §3.10 "extracted action items"
- `Activity`: `channel CommChannel?`, `direction CommDirection?`, `clientId String?` + relation `client Client? @relation(…, onDelete: SetNull)` (back-relation `activities Activity[]` on Client), back-relation `tasks Task[] @relation("ActivityTasks")`

**New model:**

```prisma
// Spec §7.1: append-only stage/status change history (timestamp + actor). Never updated or deleted.
model StageChange {
  id            String       @id @default(cuid())
  field         String       // "stage" | "dealStatus" | "engagementStage" | "dealMilestone"
  fromValue     String?
  toValue       String
  changedAt     DateTime     @default(now())
  changedById   String?
  changedBy     User?        @relation("StageChangeActor", fields: [changedById], references: [id], onDelete: SetNull)
  createdSource ActorSource  @default(HUMAN)
  mandateId     String?
  mandate       Mandate?     @relation(fields: [mandateId], references: [id], onDelete: Cascade)
  transactionId String?
  transaction   Transaction? @relation(fields: [transactionId], references: [id], onDelete: Cascade)
  engagementId  String?
  engagement    Engagement?  @relation(fields: [engagementId], references: [id], onDelete: Cascade)

  @@index([mandateId])
  @@index([transactionId])
  @@index([engagementId])
}
```

- [ ] **Step 1:** Add everything above to `prisma/schema.prisma`. Stop the dev server, `npx prisma migrate dev --name spec_gap_quick_wins`, restart dev server. Check the `src/generated/pothos-types.ts` diff (commit content changes, expect machine-path churn).
- [ ] **Step 2:** `src/lib/vocab.ts` — add label groups for every new enum with the spec's display labels exactly: e.g. `EquityAndDebt: "Equity & Debt"`, `ClosedReopened: "Closed & Reopened"`, `ClosedOnHold: "Closed & On Hold"`, `SpaSha: "SPA / SHA"`, `NA: "N/A"`, `WebChat: "Web chat"`, `WomenLed: "Women-led"`, `YouthLed: "Youth-led"`, `MondayMeeting: "Monday Meeting"`, `DirectEnquiry: "Direct enquiry"`, `SocialMedia: "Social media (LinkedIn / WhatsApp)"`, `InternalBusinessDev: "Internal business development"`, `Event: "Networking event"` (fix existing label), `FMCG: "Retail & FMCG"` (fix existing label), `Energy: "Energy"`.
- [ ] **Step 3:** zod schemas — extend `client.ts`, `mandate.ts`, `transaction.ts` with every new field; create `src/lib/schemas/task.ts` (`taskCreateSchema`/`taskUpdateSchema`: title required, status, source, dueAt, body, assigneeId, assistantId, one-of mandate/transaction/investor/client link ids all optional). Extend schemas test file to cover new-field acceptance + stripping behavior.
- [ ] **Step 4:** GraphQL — extend `ClientInput`/`MandateInput`/`TransactionInput` in `src/graphql/inputs.ts`; expose new fields on the Pothos object types; ensure new enums are registered (Pothos prisma plugin usually picks them up — verify with a schema build, `npx vitest run` any graphql test or `npm run dev` page load).
- [ ] **Verify:** `npm run test` green (except pre-existing known failures — there should be none in the suite); dashboard + mandates + transactions pages render.

### Task 2: Stage-history write path + display (§7.1)

**Files:**
- Modify: `src/server/services/` mandate/transaction stage-update services (find via `updateMandateStage`/`updateTransactionStage` call sites in `src/graphql/mutations.ts`) and `src/server/services/engagements-crud.ts` (`updateEngagement`)
- New: `src/components/crm/stage-history.tsx`
- Modify: `src/app/(crm)/mandates/[id]/page.tsx`, `src/app/(crm)/transactions/[id]/page.tsx`, `src/app/(crm)/engagement/[id]/page.tsx`
- Test: new `src/server/services/__tests__/stage-history.smoke.test.ts` (DB test — create own rows)

- [ ] Wrap each stage/dealStatus/engagementStage write in a `prisma.$transaction` that also `create`s a `StageChange` row with `fromValue` (fetched current), `toValue`, `createdSource` from ctx actor, `changedById` when the resolver has a userId (pass `ctx.actor` into the service — mutations currently don't forward it for restage; add the parameter with a default so existing calls compile).
- [ ] `StageHistory` panel component: reverse-chronological list "<from> → <to> · <relative date> · <actor or source>"; render on all three detail pages (empty state: "No stage changes recorded yet").
- [ ] Smoke test: create mandate → restage → expect one StageChange row with correct from/to.
- [ ] **Verify:** restage a transaction in the UI, see the history row appear.

### Task 3: Task CRUD + overdue escalation (§3.8, §12.2)

**Files:**
- New: `src/server/services/tasks.ts`, `src/components/crm/task-form-drawer.tsx`
- Modify: `src/graphql/inputs.ts` (TaskInput), `src/graphql/mutations.ts` (createTask/updateTask/deleteTask), `src/app/(crm)/tasks/page.tsx`, dashboard stats service (`src/server/services/dashboard.ts`) for an overdue count
- Test: `src/server/services/__tests__/tasks-crud.smoke.test.ts`

- [ ] Service: `createTask`/`updateTask`/`deleteTask` (zod-validated), plus `flagOverdueTasks()` — sets `escalated = true` where `dueAt < now` AND status in NotStarted/Pending/Ongoing; called from the tasks page loader (spec: escalation flag is Auto).
- [ ] Mutations + TaskInput wired to the service; actor → `createdSource` pattern as elsewhere.
- [ ] Task form drawer following `mandate-form-drawer.tsx` pattern: title (required), status (incl. Dropped), source (§4.12 picklist), linked record (mandate/transaction/investor/client selects — at least one encouraged), owner, assistant, deadline, notes.
- [ ] Tasks page: "New Task" button + row click → edit drawer; delete; **Overdue** red chip when `escalated`; overdue count tile added to the existing status tiles; source column.
- [ ] Dashboard: "Overdue actions" stat in the team/tasks area (Task 7 will build the full section — here just export the count from the service).
- [ ] **Verify:** create/edit/delete a task in the UI; a task with yesterday's deadline shows Overdue after reload; smoke test green.

### Task 4: Company + Deal + Investor/Partner form & detail exposure

**Files:**
- Modify: `src/components/crm/client-form-drawer.tsx`, `transaction-form-drawer.tsx`, `mandate-form-drawer.tsx`, `investor-form-drawer.tsx`, `partner-form-drawer.tsx`
- Modify: `src/app/(crm)/clients/[id]/page.tsx`, `transactions/[id]/page.tsx`, `mandates/[id]/page.tsx`, `clients/page.tsx` (status column)

- [ ] Client drawer + detail: codename, status, registrationNo, hqCountry, businessModel, foundersNationality, ownershipStructure, directorsManagement, targetClients, staffCount, branchCount, ebitda, netProfit, existingDebt, loanBook, totalAssets, impactFlags (multi-chip select). Group sensibly (Identity / Financials / Governance sections) matching existing drawer style. Detail page shows them in the profile card(s); status chip in header; clients list gets a status column.
- [ ] Transaction drawer + detail: financingType (label "Deal type"), dealStatus, dealMilestone, maxSellingStake, targetProfile, useOfFunds, vdrLink (render as link), probability (0–100), assistant, notes. Mandate drawer + detail: dealStatus.
- [ ] Investor drawer: add nextActionDate, feedback, shareholdingPreference (if absent). Partner drawer: add organization, email, phone.
- [ ] **Verify:** create a client with all new fields via UI → values persist (zod not stripping); edit a transaction's deal status/milestone → persists and displays.

### Task 5: Service Provider UI (§3.7)

**Files:**
- New: `src/app/(crm)/service-providers/page.tsx`, `src/components/crm/service-provider-form-drawer.tsx`
- Modify: `src/components/shell/sidebar.tsx` (nav entry), `src/app/(crm)/transactions/[id]/page.tsx` (engaged-providers section if absent)

- [ ] List page following `partners/page.tsx` pattern: table (name, type, contact, email/phone, fee, engaged-on count, status) + type stat tiles; create/edit drawer using the existing `createServiceProvider`/`updateServiceProvider` mutations (they exist with zero call sites); delete if a mutation exists (add if trivial, else omit).
- [ ] Sidebar: "Service Providers" under MAIN_NAV after Partners.
- [ ] Transaction detail: "Service Providers" card listing engaged providers (relation exists) with add/remove via `engagedOn` connect/disconnect if the input supports it (check `TransactionInput`/service; if not, read-only list is acceptable this pass — note it in the report).
- [ ] **Verify:** create a provider in the UI, see it listed; nav entry works.

### Task 6: Communication logging generalization (§3.10)

**Files:**
- Modify: `src/server/services/engagements.ts` (`logEngagement` → keep, add generalized `logActivity`), `src/graphql/inputs.ts`, `src/graphql/mutations.ts`, `src/components/crm/log-engagement-dialog.tsx`, `src/components/crm/activity-timeline.tsx`
- Modify: `src/app/(crm)/clients/[id]/page.tsx` (timeline + log button now that Activity has clientId)
- Test: extend the engagements service test (or new smoke test) for client-only logging

- [ ] `logActivity` service: requires `type`, accepts optional channel, direction, subject, body, occurredAt, and ANY one-or-more of clientId/mandateId/transactionId/investorId/engagementId (validate at least one link — spec: Linked record required); populates `createdById` from ctx actor userId when present (fixes the never-set gap).
- [ ] Dialog: generalize to allow logging against a client or mandate alone (relax the both-required validation); add Channel + Direction selects.
- [ ] Timeline: show channel/direction chips when present. Client detail page: add ActivityTimeline (query by clientId) + "Log Communication" button — remove the "no data path" comment.
- [ ] **Verify:** log a WhatsApp inbound note against a bare client in the UI → appears in the client timeline; existing engagement logging still works.

### Task 7: Dashboard groupings (§13)

**Files:**
- Modify: `src/server/services/dashboard.ts`, `src/app/(crm)/dashboard/page.tsx`, `src/app/(crm)/engagement/page.tsx` (or `disbursement-table.tsx`), `src/app/(crm)/tasks/page.tsx`
- Test: extend dashboard service test if one exists (Glob first), else `src/server/services/__tests__/dashboard-groupings.smoke.test.ts`

- [ ] Pipeline overview (dashboard): breakdown cards — active transactions **by deal lead**, **by sector**, **by financing type**, **by ticket-size band** (reuse `src/lib/ticket-bands.ts`). Simple count lists/bars in the existing card style (no new chart lib).
- [ ] Investor engagement: "Declined" (deals rejected) count added to the engagement page stat row.
- [ ] Disbursement **by year and quarter**: grouped summary (year/quarter → total/disbursed/pending) above or beside the existing table — fields already stored on Engagement.
- [ ] Team & tasks: on dashboard or tasks page — deal load by team member (open mandates+transactions per lead/owner), task-status-by-owner cross-tab, overdue actions list (uses Task 3's `escalated`).
- [ ] **Verify:** dashboard renders all new groupings against seeded data; no N+1 explosions (use groupBy queries).

---

**Final acceptance (whole plan):** `npm run test` fully green · `npm run lint` no NEW failures (pre-existing 4 files exempt) · manual pass: create client → mandate → transaction → engagement restage (history rows) → task with deadline yesterday (overdue) → log client communication → service provider create → dashboard groupings render. Update `docs/BUILD-STATUS` notes or tracker files only if asked.
