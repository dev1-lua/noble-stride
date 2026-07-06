# Spec-Gap Pass 2 — "Convert the Remaining Yellows" — Design

**Date:** 2026-07-06 · **Branch:** `test/comparisionAgainstTheBuildSpecs` · **Status:** approved by user 2026-07-06

## 1. Goal

Every remaining 🟡/❌ item in `docs/CRM-VS-BUILD-SPEC-COMPARATIVE-ANALYSIS-2026-07-06.md` that needs **no client decision** becomes ✅, implemented in the real stack (Prisma → zod → Pothos GraphQL → service → drawer/RSC), verified live against `localhost:3000` with Playwright, and the analysis doc updated afterwards.

**Context:** a first spec-gap pass (`ae1f53e..f3419a0`) already closed the bulk of the original audit's gaps (Company/Deal fields, picklists, Task CRUD, Service Provider UI, communication generalization, stage-change audit, dashboard groupings). This pass targets what that pass left open.

## 2. Explicitly out of scope

| Item | Why |
|---|---|
| File upload / storage (§3.9 File field) | User decision 2026-07-06: "leave file upload and storage for now" — stays 🟡 with an infra-decision note |
| Deal-stage vocabulary (§4.4), deployment-status vocabulary (§4.13), sub-sector taxonomy (§5), single-vs-multi sector, countries-vs-regions, teaser/IM/model derived-vs-stored, Advisory (§3.3) | Client questions 7–14 (`memory/client-meeting-questions.md`) — must stay 🟡/➖ until the client answers |
| 4 Lua agents (§8), WhatsApp/email/Slack/SharePoint (§9/§14), §10 company intake, real auth + enforced RBAC (§7.2) | Roadmap-scale builds, listed separately in §16 of the analysis |

## 3. Approaches considered

- **A. Single comprehensive pass; extend `StageChange` into the general field-audit table** ← **chosen.** One plan (~9 tasks), each following the proven ServiceProvider CRUD pattern (`src/lib/schemas/service-provider.ts` → `inputs.ts` → `mutations.ts` → `src/server/services/service-providers.ts` → `service-provider-form-drawer.tsx` → list/detail wiring). §7.1 audit reuses the existing `StageChange` model + `recordStageChange` helper + `stage-history.tsx` renderer by adding `clientId`/`investorId`/`partnerId` FKs and widening the `field` union. One audit mechanism, one renderer.
- **B. New generic `AuditLog` model** — cleaner separation, but duplicates writer/renderer/tests for the same concept; two audit tables to reconcile later. Rejected.
- **C. Two sequential passes (data layer, then UI)** — safer checkpoints but most remaining gaps ARE UI-surface gaps; splitting delays the measured outcome. Rejected.

## 4. Workstreams

### A — Contact (Person) CRUD (§3.5; §3.1 "Primary contact")

Currently `Person` is complete at the model layer (`schema.prisma:444-470`) but read-only everywhere — no zod schema, no input, no mutations, no drawer.

- New `src/lib/schemas/person.ts` (`personCreateSchema` / `personUpdateSchema = .partial()`): firstName (required), lastName, email, phone, jobTitle, linkedinUrl, isPrimaryContact, isSSAContact, investorId/clientId/partnerId.
- `PersonInput` in `src/graphql/inputs.ts`; `createPerson`/`updatePerson`/`deletePerson` in `mutations.ts`; `src/server/services/persons.ts` following the ServiceProvider pattern (zod re-parse, `actorSource`, `CrudError` on missing row).
- **Rule:** a Person must link to ≥1 parent (client/investor/partner) — enforced in the service like `logActivity` does.
- **Rule:** one primary contact per parent — setting `isPrimaryContact: true` unsets siblings of the same parent in a `$transaction`.
- `src/components/crm/person-form-drawer.tsx` (useEntityForm; parent FK preset via prop, not user-editable when preset). Mounted on client, investor, and partner detail pages: "Add contact" button + click-to-edit on the existing contact cards; delete inside the drawer.

### B — Engagement edit surface (§3.11)

`updateEngagement` (`engagements-crud.ts:31-66`) already accepts everything; the UI only exposes stage + NDA today.

- New `src/components/crm/engagement-form-drawer.tsx` editing: interestLevel, ndaType, termSheetIssued + termSheetDate, totalAmount, amountDisbursed, disbursementStatus, dateReceived, probability, feedback, notes. **Not** editable: engagementStage (stays in the restage control with its NDA guard), amountPending/year/quarter (server-derived).
- Mounted: Edit button on `engagement/[id]/page.tsx`; row edit from the `/engagement` disbursement table.

### C — §6.2 milestone write path (14 investor-side milestones individually recordable/dateable)

`EngagementMilestone` (`schema.prisma:746-757`, `@@unique([engagementId,key])`) currently has **zero** write paths; display is derived stage-implied ∪ recorded (`src/lib/milestones.ts`, `visibility/project.ts:320-356`).

- New service `src/server/services/milestones-crud.ts`: `recordMilestone(engagementId, key, completedAt?, notes?)` (upsert; completedAt defaults now, editable) and `unrecordMilestone(engagementId, key)` (delete recorded row; stage-implied display unaffected).
- Mutations `recordMilestone` / `unrecordMilestone`; small input type.
- New `src/components/crm/milestone-checklist.tsx` on the **internal** engagement detail page: all 14 §6.2 milestones in `MILESTONE_ORDER`, each showing state (recorded + date / implied-by-stage / open) with record/edit-date/unrecord controls. Portal steppers benefit automatically (read path unchanged).

### D — Remaining §13 dashboards

All as `src/server/services/dashboard.ts` functions returning plain DTOs, rendered with the existing `BreakdownBarList` / panel components, following the pass-1 pattern.

| §13 cell (current status) | Build |
|---|---|
| Pipeline: active vs inactive (🟡) | Count by `dealStatus`: Open + ClosedAndReopened = active; OnHold/Closed/ClosedAndOnHold/Dropped = inactive; shown as a split stat |
| Deal status: stage history roll-up (🟡) | Recent `StageChange` feed (entity, field, from→to, actor, time) + transition counts, dashboard panel |
| Investor engagement: per-investor rollup (🟡) | Table: per investor — deals under review (active stages), rejected (Declined), invested (Invested) |
| Invested/completed summary (🟡) | Stat: count + total disbursed where stage=Invested or disbursementStatus=Disbursed |
| Historical engagement summary (❌) | Engagements grouped by year/quarter (already-derived fields) × outcome counts |
| Referrals: conversion funnel (🟡) | Per-partner + overall: introduced (referred mandates) → progressed (stage beyond NewLead) → closed/rejected (Won / Lost), replacing the single aggregate % |

### E — §7.1 core-identifier audit + immutability

- **Audit** (prior value + timestamp + user): extend `StageChange` with nullable `clientId`/`investorId`/`partnerId` FKs; widen the `StageChangeField` TS union with `name`, `registrationNo`, `primaryContact`. Write from `updateClient` (name, registrationNo), `updateInvestor` (name), `updatePartner` (name), and the person service's primary-contact reassignment (logged against the parent, value = contact display name). Render `stage-history.tsx` panels on client/investor/partner detail pages (new vocab-group entries).
- **Immutability** (creation date, originating source): once set, `Mandate.dateOpened`, `Mandate.source`, `Transaction.dateOpened` reject changes server-side (`CrudError` with a clear message); the corresponding drawer fields render disabled in edit mode. Setting a currently-null value remains allowed (legacy imports have nulls).
- IDs are cuids never exposed for edit — already immutable in practice.

### F — Small-field sweep

| Item | Change |
|---|---|
| Years of operation (§3.1, derived) | Compute `currentYear − yearFounded` on client detail (display only, per spec "derived from year founded") |
| Profitability picklist (§3.1: Profitable / Loss-making) | New enum `Profitability { Profitable, LossMaking }`; migrate `profitable` boolean (true→Profitable, false→LossMaking, null→null), drop the boolean, update readers (client detail, drawer, any projection/tests referencing `profitable`) |
| Founders' gender multi (§3.1: Multi) | `founderGender FounderGender?` → `founderGenders FounderGender[]` (migration wraps existing value); drawer becomes multi-select |
| Document→Mandate link (§3.9 linked record = Deal) | `Document.mandateId` FK + drawer RelationSelect + documents card on mandate detail |
| Create-task-from-communication (§3.10 extracted action items) | "Create task" action per timeline activity: opens task drawer prefilled (title from subject, copies links, sets `activityId`); linked tasks listed under the activity in timelines |
| SSA-region contact (§3.4) | `ssaRegionContact` RelationSelect (investor's own contacts) in investor drawer + shown on detail |
| Transaction consultant/referrer (§3.2) | `Transaction.referredById → Partner` (new FK, mirroring Mandate) + drawer select + detail display |
| Transaction↔ServiceProvider linking (§3.7 "Engaged on") | `serviceProviderIds` in TransactionInput/zod → `set` connect in service; multi-select in transaction drawer; detail card becomes live |
| §6.1 valuation conditionality | `PrepMilestones` receives `financingType`; Valuation row hidden when financingType=Debt (shown for Equity/EquityAndDebt/null); Business plan stays labeled optional |
| §3.10 Summary required | `logActivity` zod requires non-empty subject |

## 5. Cross-cutting

- **Migrations:** `prisma migrate dev` (existing convention, 12 prior migrations). Respect the Windows quirk: no `npm run build` while the dev server holds the query-engine DLL; use `npx next build` if schema unchanged, and coordinate `prisma generate` with the running server.
- **Tests:** vitest, existing patterns — `*.smoke.test.ts` for DB-backed services (persons CRUD, primary-contact uniqueness, milestone upsert/unrecord, immutability rejection, identifier-audit rows, dashboard aggregations), pure tests for schema parsing and milestone/prep-list logic. `pnpm test` must stay green (363+ baseline).
- **Execution model (user rule 1):** superpowers subagent-driven development — **Sonnet (xhigh)** implements each plan task; **Opus (xhigh)** reviews each task's diff; fix-loop until the review is clean; **Fable** performs the final whole-branch review.
- **Verification (user rule 3):** Playwright (installed in the session scratchpad, driving the running `localhost:3000` via the `ns_viewpoint` demo lens) exercises every new surface end-to-end: create/edit/delete a contact from each parent page, edit an engagement's §3.11 fields, record/unrecord a milestone and see the portal stepper move, confirm every new dashboard panel renders real data, create a task from a communication and see the link both ways, verify immutability (disabled fields + server rejection), verify audit rows render after a rename. Plus `npx tsc --noEmit`, full `pnpm test`, `pnpm lint` (no new errors vs the pre-existing 3+2 baseline), production build.
- **Doc update (user rule 4):** flip statuses in `docs/CRM-VS-BUILD-SPEC-COMPARATIVE-ANALYSIS-2026-07-06.md` with file:line evidence, extend the implementation-log banner, rewrite §16.

## 6. Estimated shape

~9 plan tasks · 2 migrations (audit FKs + field changes; milestone path needs none) · ~25–30 files touched · all on the current branch.
