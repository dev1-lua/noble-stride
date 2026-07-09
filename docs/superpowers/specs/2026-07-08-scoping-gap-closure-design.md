# Scoping-Document Gap Closure — Design Spec

**Date:** 2026-07-08
**Branch:** `integration/all-features`
**App:** `noblestride-crm/`
**Sources:** `decrypted/NobleStride_Full_Scoping_Document.docx` (Marko, read end-to-end 2026-07-08),
full schema + route inventory (this session), `playwright assessment/{00-SUMMARY,02-BLOCKERS}.md`,
user-approved direction 2026-07-08 ("continue" = recommended order: guardrail fixes → simplification
Wave 1 → intake agent → remaining phases).

## 1. Goal & scope

Close the in-app gaps between the CRM and Marko's Full Scoping Document (§01, §02, §05, §06, §07).
Five phases, each independently shippable. Everything here is pure code/schema work with **no
external dependency** (WhatsApp/M365/file-storage/auth are explicitly out — see §8).

- **Phase 0 — Matching guardrails & dimensions** (scoping §02, §09) — highest priority; ships first.
- **Phase 1 — Schema additions** for intake/compliance/fee fields (scoping §01, §06, §07).
- **Phase 2 — UI for the new fields** (drawers, detail cards, queue column/filter).
- **Phase 3 — Investor-portal filter additions** (scoping §05).
- **Phase 4 — In-app notifications** (scoping §03 escalation triggers, in-app subset only).

Related but separate specs (same date): client intake & qualification agent
(`2026-07-08-client-intake-qualification-design.md`), CRM simplification
(`2026-07-08-crm-simplification-design.md`).

**Non-negotiable guardrails (scoping §01 "never automatically", unchanged):** nothing in this spec
auto-converts, auto-approves, auto-shares, or auto-communicates externally. All new logic is
internal triage/scoring surfaced to humans.

## 2. Decisions made (do not re-open)

- BUG-01 (document-title leak) is **already fixed** (`src/server/visibility/project.ts:225` +
  tests) — not re-scoped here.
- Matching exclusions are **hard filters**, not score penalties: non-`Active` engagement
  classification and non-`Approved` onboarding status never appear in match results.
- Instrument incompatibility (both sides defined, disjoint) is also a **hard filter**; if either
  side is empty/undefined the investor stays in results with no instrument contribution.
- Financial thresholds are **score penalties with visible reason chips**, not filters (client
  financials are still sparsely populated — a filter would empty the results; chips keep humans
  informed, which is what §09 asks for: "flag restricted investors … prevent unsuitable matches").
- Advisory-type engagements (valuation/restructuring/merger/JV/divestiture), post-transaction
  monitoring module, and the WhatsApp/M365/file-storage/auth work are **out of scope** — they are
  on the "raise with Marko" SOW list.
- No commits without explicit user go-ahead (standing working agreement).

## 3. Phase 0 — Matching engine (`src/server/domain/ranking.ts`, `src/server/services/ai.ts`)

### 3.1 Hard filters (new, in `aiMatchInvestors`)

`prisma.investor.findMany` gains a `where` clause and extra selected fields:

- `engagementClassification: "Active"` — Excluded / Greylisted / OnHold / Inactive investors can
  never be recommended (today the query has **no** filter; verified this session).
- `onboardingStatus: "Approved"`.
- Select additionally: `instruments`, `minRevenue`, `minEbitda`, `minLoanBook`,
  `criteriaVerifiedAt`, and the primary/SSA contact (for §3.3).

In `rankInvestorMatches` (pure, testable): drop candidates whose `instruments` and the
transaction's `instrument` are both non-empty and disjoint.

### 3.2 Scoring dimensions (rebalanced weights, cap 1.0)

| Dimension | Weight | Source | Notes |
|---|---|---|---|
| Sector overlap | 0.35 | existing | unchanged logic |
| Geography overlap | 0.25 | existing | unchanged logic |
| Ticket fit | 0.15 | existing | unchanged logic |
| Instrument overlap | 0.15 | **new** | fraction of txn instruments covered; hard filter when disjoint (§3.1) |
| Threshold fit | 0.10 | **new** | client `revenueLastYear/ebitda/loanBook` vs investor `minRevenue/minEbitda/minLoanBook`; each defined-and-met adds proportionally; defined-and-missed adds 0 **and** emits a warning chip ("Below revenue threshold ($X < $Y)") |
| ActivelyDeploying bonus | +0.10 | existing | Dormant/FullyDeployed now emit an info chip ("Not currently deploying") — still listed if classification is Active |

Reason chips (`reasons: string[]`) extend to cover the new dimensions, including negative chips.
`MatchInvestor`/`InvestorMatch` types extend accordingly.

### 3.3 Point person & criteria freshness (scoping §02 "Relationship Management", "Outdated Data")

- Match results include `contactName` — the investor's `isSSAContact` Person if present, else
  `isPrimaryContact`, else first contact, else null. `MatchInvestorsButton` popover renders it
  under the investor name ("via <name>").
- New Investor field `criteriaVerifiedAt DateTime?` (migration in Phase 1). Set to `now()` by
  `updateInvestor` whenever any criteria field changes (sectorFocus, geographicFocus, ticketMin/Max,
  instruments, minRevenue/minEbitda/minLoanBook, status, investmentStages). Investor detail Key
  Facts shows "Criteria verified <date>"; match popover shows an amber "criteria >6 months old"
  chip when stale or never verified.

### 3.4 Tests

Extend `ranking` unit tests: exclusion filtering, instrument disjoint filter, threshold chips,
weight cap, contact resolution order, staleness chip. `aiMatchInvestors` integration covered by
existing service-level test seam if present; otherwise unit-test the where-clause builder.

## 4. Phase 1 — Schema additions (one Prisma migration)

```prisma
// Client — compliance + intake (scoping §01 intake checklist, §04 screens)
pepExposure         Boolean  @default(false)   // PEP or politically-connected persons
governmentOwned     Boolean  @default(false)
complianceNotes     String?                    // context for either flag
auditedFinancialsYears Int?                    // count of audited FY statements available
groupStructure      String?
suppliers           String?
competitors         String?
capacityUtilization String?
repaymentAbilityNotes String?
pricingExpectations String?
proposedTimeline    String?

// Mandate — retainer (lifecycle step 6) + screening outcome home (see intake spec) + priority
retainerAmount       Decimal?
retainerInvoicedDate DateTime?
retainerPaidDate     DateTime?
priority             Priority?
referralQualified    Boolean?   // scoping §06 "referral quality tracking"

// Transaction — priority + partner fee payment (scoping §06 "fee-sharing and payment status")
priority         Priority?
partnerFeeStatus PartnerFeeStatus?   // meaningful only when referredById is set
partnerFeeAmount Decimal?

// Investor — criteria freshness (Phase 0 §3.3)
criteriaVerifiedAt DateTime?

// Partner — engagement insights (scoping §06)
feedbackNotes String?

enum Priority { High Medium Low }
enum PartnerFeeStatus { NotDue Due Invoiced Paid }

// Sector enum — add restricted industries so intake/screening can name them (scoping §01/§04)
// append: OilAndGas, Mining, Gambling, Alcohol, Tobacco
```

New domain constant `RESTRICTED_SECTORS: Sector[]` = `{OilAndGas, Mining, Gambling, Alcohol,
Tobacco, RealEstate}` in `src/server/domain/qualification.ts` (shared with the intake spec).
Note: `RealEstate` stays in the enum (existing records use it) — restriction is a screen, not a
data prohibition.

`vocab.ts` labels for every new enum value/field. Seed data untouched (new fields nullable/default).

## 5. Phase 2 — UI for new fields

- **Client form drawer + detail:** new "Compliance" card (PEP flag, government-owned, notes,
  audited-years) with a rose "Restricted sector" banner on detail when `sector ∩ RESTRICTED_SECTORS`;
  "Operations" card (suppliers, competitors, capacity utilization, group structure); funding-context
  fields (repayment ability, pricing expectations, proposed timeline) join the existing financial
  card. All plain optional inputs — no validation gates.
- **Mandate drawer + detail:** retainer amount/invoiced/paid (renders beside the existing NDA/EA
  date pairs in Deal Summary); priority select; "Referral qualified?" tri-state (only when
  `referredById` set).
- **Transaction drawer + detail:** priority select; partner-fee status + amount (only when
  `referredById` set; renders in Deal Facts and on the partner detail page's referred-deals table).
- **Deals queue (`/deals`):** `priority` column (chooser-toggleable) + filter; priority chip on
  board cards when set.
- **Investor drawer/detail:** criteriaVerifiedAt display + "Mark criteria verified today" button
  (sets timestamp without other edits).
- **Partner detail + partner portal:** fee payment status column on referred deals;
  `feedbackNotes` editable internally on partner detail (never shown in the portal).

## 6. Phase 3 — Investor-portal filters (scoping §05)

`opportunity-filters.tsx` + the portal query: add `ebitdaMin/ebitdaMax` and
`netProfitMin/netProfitMax` range inputs beside the existing revenue pair. Server-side filtering on
real values (same pattern as revenue — filters may consult real financials even where display is
masked to ranges; this matches current revenue-filter behaviour and the doc's §05 filter list).

## 7. Phase 4 — In-app notifications (scoping §03 triggers, in-app subset)

New model:

```prisma
model Notification {
  id        String   @id @default(cuid())
  userId    String   // recipient (User)
  kind      String   // "stage_change" | "task_overdue" | "new_registration" | "new_intake" | "interest_expressed"
  title     String
  body      String?
  href      String?  // deep link
  readAt    DateTime?
  createdAt DateTime @default(now())
}
```

Emission points (server-side, inside existing mutations/actions — no polling):

- Mandate/transaction/engagement stage change → notify deal lead/owner (skip the actor themself).
- Task escalation sweep (existing auto-escalate on `/tasks` load) → notify assignee once per task.
- New investor registration → notify Admins.
- Investor `expressInterest` → notify engagement owner, else transaction owner.
- (Intake submissions wire in via the intake spec.)

Topbar bell becomes real: unread count badge, dropdown listing latest 15, mark-all-read, per-item
mark-read on click-through. The static "3" badge dies. RSC-friendly: server component fetch +
small client dropdown with a `markNotificationsRead` mutation.

Explicitly **not** here: email/WhatsApp delivery, digesting, per-user preferences (YAGNI until a
channel exists).

## 8. Out of scope (SOW conversation list — for Marko)

1. WhatsApp integration — Business API cannot read the existing internal group; needs a workflow
   decision (bot number / forwarding convention) before any build.
2. Email/Outlook + SharePoint/Teams — blocked on M365 tenant admin consent + named coordinator.
3. Real file upload / VDR — needs storage decision (SharePoint vs blob).
4. Real authentication + Kenya DPA 2019 posture (BLOCKER-A) — prerequisite for go-live, separate
   workstream.
5. Advisory-type engagements (valuation/restructuring/merger/JV/divestiture) — data-model question.
6. Post-transaction monitoring module (lifecycle step 17).
7. BUG-06 dashboard KPI reconciliation — existing QA bug, separate bug pass.

## 9. Verification

Per working agreement: implement per-phase with unit tests (`npx vitest run`), `npx tsc --noEmit`,
lint-touched-files; one consolidated Playwright pass at the end of the multi-spec build covering:
match popover exclusion/chips, new client/mandate/transaction fields round-trip, priority
column/filter, portal EBITDA/net-profit filters, live notification bell. Update
`playwright assessment/` docs afterwards.
