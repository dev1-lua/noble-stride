# §4. Controlled-value (picklist) library

**Spec (Build Specification §4):** Sixteen controlled-value lists (§4.1–§4.16) taken from NobleStride's existing tracker tabs: deal type, investment instrument, deal milestone, deal stage, deal status, origination source, max selling stake, two advisory lists, engagement/disbursement status, task status and source, investor deployment status, engagement classification, NDA type, and document access level. These are the starting configuration; the team can extend them, and the user (team-member) list is set at kickoff.

## Build status

Mostly built: **11 of 16 lists are exact or complete**, 3 are partial, 2 are not applicable (advisory — optional scope). Source: comparative analysis §4.

| § | Picklist | Status |
|---|---|---|
| 4.1 | Deal type (Debt / Equity / Equity & Debt) | Exact |
| 4.2 | Instrument | Complete — all 5 spec values incl. Hybrid (extra `Convertible` retained) |
| 4.3 | Deal milestone | Exact (on Transaction) |
| 4.4 | Deal stage | Partial — kanban stages use an internal vocabulary; alignment is a client question |
| 4.5 | Deal status (6 values) | Exact |
| 4.6 | Origination source (9 values) | Complete — all 9 present |
| 4.7 | Max selling stake | Exact |
| 4.8 / 4.9 | Advisory type / milestone | Not applicable — advisory out of scope |
| 4.10 | Engagement status (Disbursed / Ongoing / Fell off / Dropped) | Exact |
| 4.11 | Task status (5 values) | Exact |
| 4.12 | Task source (5 values) | Exact |
| 4.13 | Investor deployment status | Partial — reworked to a fund-lifecycle vocabulary; spec's 3 values pending client confirmation |
| 4.14 | Engagement classification (5 values) | Exact — and drives portal visibility |
| 4.15 | NDA type (Open / Closed) | Exact |
| 4.16 | Document access level (4 values) | Exact — enforced by the visibility engine |

## See it in the app

Picklists live in the form drawers, so the walkthrough is: open an entity's edit drawer and inspect the selects.

1. Sign in at `/login` as `jane@noblestride.co` (any password).
2. **Deal picklists (§4.1–4.7):** go to `/transactions`, open a transaction, click Edit. The drawer shows Deal type, Instrument, Deal status, Deal milestone and Max selling stake. Origination source is on the mandate drawer (`/mandates/[id]` → Edit). The kanban columns on `/mandates` are the §4.4 stage vocabulary — note these are the internal stage names, not yet the spec's nine values.
3. **Engagement picklists (§4.10, 4.15):** go to `/engagement`, open an engagement, click Edit — Engagement status, Interest level and NDA type. The 12-value engagement stage is the guarded restage control on the detail page.
4. **Task picklists (§4.11, 4.12):** `/tasks` → New task — Status (including Dropped) and Source (Monday Meeting / WhatsApp / Email / Verbal / Other).
5. **Investor picklists (§4.13, 4.14):** `/investors` → open one → Edit — Deployment status (note the fund-lifecycle wording) and Engagement classification. Set classification to Excluded or Greylisted, then switch "Viewing as" to that investor: the portal shows no opportunities, because the classification drives visibility.
6. **Document access level (§4.16):** `/documents` → New/Edit document — Internal / Client-shared / Investor-shared / VDR.

## Key source files

- `prisma/schema.prisma` — all picklists are Prisma enums (`DealFinancingType`, `DealStatus`, `DealMilestone`, `MaxSellingStake`, `Instrument`, `Source`, `TaskStatus`, `TaskSource`, `EngagementStatus`, `NdaType`, `Classification`, `AccessLevel`, `CommChannel`, `CommDirection`).
- `src/lib/vocab.ts` — the human-readable labels for every enum value shown in the UI.
- `src/lib/schemas/` — zod schemas validating picklist inputs per entity.
- `src/components/crm/*-form-drawer.tsx` — the selects that render each list.
