# WS-A close-out report — CRM workflow engine, deals, advisory, retainer, clients, AppSettings, Playwright

**Date:** 2026-08-27 · **Branch:** `feedback/2026-08` · **Plan:** `docs/superpowers/plans/2026-08-27-wsa.md` (13 tasks) · **Master plan:** `~/.claude/plans/wise-hatching-sprout.md` §1 WS-A (A0–A13), §2b G2/G4/G7/G8

**Scope delivered:** feedback items F4.1.1–F4.1.4, F4.2.1, F4.3.1, F2.2/F6.1, image29/image30 (AppSettings), gaps G2, G7, G8 — plus the Playwright scaffold that WS-B shares.

WS-A also rebuilt the application code lost with the dead machine (the DB dump was 6 migrations ahead of the repo; the Jul 31 – Aug 25 source existed nowhere). The five dump-parity migrations and the Prisma models were reconstructed from the dump's DDL so the restored production database validates against the repo unchanged.

---

## 1. What shipped, per feedback item

### F4.1.1 / F4.1.2 — "the workflow from opportunity to sign-off is not defined and cannot be configured"

The hard-coded, display-only 17-step "journey" is gone. In its place is a **configurable workflow engine** with three database tables (`WorkflowTemplate`, `WorkflowStep`, `DealStageState`), a pure domain engine, a service layer, a GraphQL surface and an interactive card on every deal page.

- **Data model** — `WorkflowTemplate` (name, `isDefault`, partial unique index so exactly one template can be default), `WorkflowStep` (key, title, `phase ∈ Qualify|Prepare|Execute`, description, order, `appliesTo DealKind[]` where `[]` = all kinds), `DealStageState` (`dealKind`/`dealId`/`stepKey` unique triple, `manualStatus ∈ complete|incomplete`, note, `completedAt`, `completedById`).
- **Engine** — `src/server/domain/workflow.ts` (pure, no Prisma): `applicableSteps()`, `evaluateEvidence()`, `resolveWorkflow()`. A step is done either because **evidence** in the CRM says so (13 rules, table below) or because a person **marked it done**. A manual `incomplete` row is an explicit re-open and beats evidence, shown as "Reopened by <name>".
- **Evidence rules** (the reason the card is not just another checklist): `newOpportunity` always · `initialEvaluation` qualification verdict / pipeline status moved · `ndaSigned` NDA status Signed, signed date, or an executed NDA document · `assignmentScoping` (Advisory) proposal-or-later / engagement contract · `dealAnalysis` (Mandate, Transaction) financial model or valuation document · `dealApproved` deal lead assigned · `opportunityPreparation` VDR link or Teaser + IM · `internalReview` a reviewed document · `investorOutreach` an engagement or outreach draft exists · `investorInterest` an engagement reached Interested / NDA signed / later · `threePartyDiscussions` a meeting or call logged · `termSheet` term sheet issued, term-sheet document, or pipeline status TermSheet/Closing/ClosedWon · `successFee` success fee paid (label "Invoiced <date>" when only invoiced).
- **Every step links to its evidence** (feedback image15: "when I click on VDR it should open the VDR") — `opportunityPreparation` opens the actual VDR URL in a new tab when one is set, otherwise the documents-by-stage section; the other steps deep-link to `#pipeline-status`, `#key-facts`, `#documents`, `#documents-by-stage`, `#engagements`, `#activity`, `#deal-facts`, `#success-fee`, or to the engagement / outreach pages. Those anchors were added to the mandate, transaction, advisory and client detail pages.
- **Coverage** — mandates, transactions **and advisory engagements** each resolve their own workflow (advisory had none before; transactions used to borrow their mandate's). Client pages show one read-only card per mandate.
- **Files:** `src/server/domain/workflow.ts`, `workflow-default.ts`, `deal-kind.ts`, `src/server/services/workflow.ts`, `src/components/crm/deal-workflow.tsx`, the four detail pages. **Deleted:** `src/server/domain/journey.ts`, `src/server/services/journey.ts`, `src/components/crm/deal-journey.tsx` and their tests.

### F4.1.2b / G7 — "Stage" clashed with the journey; "an opportunity is a deal after it is signed"

The enum control is now labelled **"Pipeline status"** everywhere — the detail-page control (`restage-select.tsx`), all three drawers, and the deals-list column header — with help text: *"Where this record sits in the sales/execution pipeline (a short status list). Progress through the deal itself is tracked in the Deal Workflow above."* The `MandateStage.Signed` glossary entry now reads: *"Signed — engagement agreement executed; from here the opportunity is a deal. Progress through the deal is tracked in the Deal Workflow."* The help panel's "17-step journey" copy became "13 default workflow steps (Qualify → Prepare → Execute); admins edit templates under Settings → Workflows".

### F4.1.3 — "stages should be customisable, new templates per deal type"

- **`/settings/workflows`** (real-Admin only): list with Name · Steps · Used by · Default badge, and actions **Duplicate / Set default / Delete** (Delete refused while a template is default or in use, with a tooltip).
- **`/settings/workflows/[id]`** editor: rename; add / remove steps; reorder within and across the three phases; edit title, phase, description and **applies-to** (Mandate / Transaction / Advisory); step keys are derived from the title for new rows and locked once saved, with a hint listing the 13 keys that carry evidence rules ("other keys are manual-only").
- **Per-deal selection**: all three deal drawers gained a **"Workflow template"** selector (blank = default template), so an advisory assignment can run a short template while transactions run the full one.
- **Files:** `src/lib/schemas/workflow.ts`, `src/server/services/workflow-templates.ts`, `src/app/(crm)/settings/workflows/{page,[id]/page,workflow-template-editor,template-actions,actions}.tsx`.

### G2 — "how can you move this deal to investor shortlisting?" (image13)

Every not-done step carries a **"Move deal here"** action: it marks every earlier applicable step complete in one transaction (note "Moved to <title>"), leaving the target step as current. One `StageChange` row per step plus a single Activity "Workflow moved to <title>". GraphQL `moveDealToWorkflowStep(dealKind, dealId, stepKey, note)`.

### G8 — the 12-step / 3-phase diagram (image32) is the default template

The seeded default template **"Default Transaction Advisory Workflow"** (id `cmt439xcg000895nche9zeaz1`) reproduces the diagram exactly — 13 steps because the diagram's step 4 forks: `assignmentScoping` applies to Advisory only, `dealAnalysis` to Mandate/Transaction only, so every deal kind sees 12 steps. Diagram → key mapping: 1 `newOpportunity` · 2 `initialEvaluation` · 3 `ndaSigned` · 4A `assignmentScoping` · 4B `dealAnalysis` · 5 `dealApproved` · 6 `opportunityPreparation` · 7 `internalReview` · 8 `investorOutreach` · 9 `investorInterest` · 10 `threePartyDiscussions` · 11 `termSheet` · 12 `successFee`. Phases QUALIFY / PREPARE / EXECUTE are the card's section headers. The diagram's source list ("client directly, partner/referral, cold outreach, desk research, existing network") is quoted in step 1's description; the two missing `Source` enum values (`DeskResearch`, `ExistingNetwork`) land in WS-B's migration 7 (G4). "No NDA → no confidential information" is enforced by `ndaSigned` sitting ahead of `dealAnalysis`, and by the portal tier gate in WS-B.

Seeding is idempotent and safe against the production data: `npm run seed:workflow` upserts the template and the 13 steps **create-only** (never rewrites an admin's edits) and creates the AppSetting rows only if absent. `npm run seed` / `db:reset` still wipe — flagged red in the script and in the runbook.

### F4.1.4 — "filters are crowded, needs a simple clean UI" (image16)

The deals filter bar went from 11 side-by-side multi-selects to:

- **Row 1:** search box (300 ms debounce) + **Type** + **Status** + **Deal lead** + a **"More filters (n)"** popover holding the eight secondary filters (Sector, Ticket, Country, Assist, Financing, Priority, Source, **Classification**) and Group-by.
- **Row 2:** one removable **chip per active filter value** plus "Clear all" (which keeps the chosen view and columns).
- Saved views moved into a **"Views"** popover; the Columns chooser was refactored onto the same new `Popover` primitive (`src/components/ui/popover.tsx`) rather than keeping its bespoke implementation.
- New columns **Classification** (off by default), **Paid** (off) and **Balance** (on, red when > 0), a new `balance` sort key, and three new CSV headers.

### F4.2.1 — advisory classification (image17)

`AdvisoryEngagement.classification` (`Valuation`, `Due Diligence`, `Business Plan / Pitch Deck`, `Financial Model`, `Advisory Support`, `Other`) is on the drawer, the detail-page header chip, Key Facts, the kanban card sub-label, the deals list column, the deals filter and the CSV export.

### F4.3.1 — retainer paid amount + pending balance (image18)

`Mandate.retainerPaidAmount` plus a computed balance (`src/lib/money.ts::balanceDue`, never negative, null when no total). Shown in the mandate drawer (Amount · Paid · Invoiced date · Paid date · live "Balance due"), on the deal summary panel ("Paid <amt> · Balance <amt>"), and as the deals-list Paid/Balance columns and CSV. Advisory got the same treatment (`feePaidAmount` + `feeBalance`); transactions derive paid/balance from the success fee.

### F2.2 / F6.1 — clients list (image3, image26)

- Ordered **newest first** with a **Created** column, and a **Country** column.
- Four filters: **Status**, **Country** (matches HQ country *or* any operating geography), **Sector**, **Revenue band** (`< $1M`, `$1M – $5M`, `$5M – $20M`, `$20M+`, "Not recorded"), all combinable with the search box.
- The generic table filter gained `getAll` so one filter can match any of several row values; revenue banding lives in `src/server/domain/revenue-bands.ts`.
- The client form now writes **Project Codename** to the dump's `Client.projectCodename` (mirrored to the legacy `codename` for API back-compat) and replaces the "Impact Flags" multiselect with **Women-led / Youth-led** checkboxes (still mirrored to `impactFlags` in both directions, so existing data and the investor portal filters keep working). The investor portal prefers `projectCodename` over the generated codename when masking a deal.

### image29 / image30 — AppSettings (admin-controlled portal switches)

`AppSetting` service (`src/server/services/app-settings.ts`, 30 s TTL cache, `revalidatePath` on write) with an admin UI at **`/settings/app`** and three switches:

| Key | Default | Effect |
|---|---|---|
| `portal.dashboard.financeTiles` | `false` | Investor-portal finance KPI tiles and "Disbursements by Quarter" hidden (image30: "remove by default, let the admin show them") |
| `agent.client.enabled` | `true` | Off ⇒ `/talk-to-us` falls back to the intake form |
| `portal.deal.milestones` | `false` | The 14-milestone checklist on portal deal pages (image29 asked for it to be hidden) — consumed by WS-B |

The sidebar gained an **Admin** section (Users · App settings · Workflows). The duplicated `requireRealAdmin()` gate was extracted to `src/server/auth/require-real-admin.ts` and is now shared by all three settings action modules.

### Database parity (the rebuild)

Five migration folders reproduce the dump's DDL byte-for-byte in intent — `20260731000001_add_app_setting`, `20260731000002_document_investor_index`, `20260822120000_august_feedback_workflow`, `20260822130000_partner_login`, `20260822140000_workflow_default_unique` — so the restored production database is "up to date" without a reset. `scripts/fix-prisma-migration-checksums.ts` (npm `db:fix-checksums`) re-stamps `_prisma_migrations` checksums: dry-run by default, refuses non-localhost without `--allow-remote`, and prints `prisma migrate resolve --applied` fallbacks. **This must be run against production (dry-run, then `--execute`) before any `prisma migrate deploy`**, otherwise Prisma raises P3018 — 24 local rows needed re-stamping, 19 of them from CRLF drift introduced by the Windows-side dump.

---

## 2. Verification — commands and outputs

Run from `noblestride-crm/`, against the restored dump in Docker (`noblestride-postgres` on :5544).

```
$ npx tsc --noEmit
(clean, no output)

$ npx vitest run
Test Files  178 passed (178)
Tests       1239 passed (1239)

$ npx eslint .
21 errors, 12 warnings   # identical to the pre-work baseline; all 21 are in files WS-A did not touch

$ npx playwright test
31 passed (7 spec files)   # run twice: once with teardown, once with E2E_KEEP=1

$ npx prisma migrate status
41 migrations found in prisma/migrations
Database schema is up to date!

$ npx prisma migrate diff --from-url "$DATABASE_URL" \
    --to-schema-datamodel prisma/schema.prisma --script
9 × DROP INDEX "…_trgm_idx";   -- and nothing else
```

**About that diff:** the nine `DROP INDEX` lines are the expected, accepted output. The pg_trgm GIN search indexes cannot be expressed in the Prisma schema, so they live in raw SQL only and Prisma reports them as drift in this direction. There is **no column, table or enum drift**. This diff must never be applied — doing so would drop the global-search indexes. The strict parity check that *is* expected to be empty is `--from-migrations prisma/migrations --to-url "$DATABASE_URL"`, and it is.

**Unit-test baseline correction:** two suites (`investor-agent.test.ts`, `outreach.test.ts`) used to fail on `ZZTest` rows left in the dump by the dead machine. Those rows were removed with the new `scripts/cleanup-prefixed-test-data.ts` and both suites now pass, so the whole vitest run is green. Any failure from here on is a regression, not inherited noise.

**E2E coverage** (31 tests, all against the real restored data plus `zz-`-prefixed fixtures that the teardown removes):

| Spec | Tests | Covers |
|---|---|---|
| `deal-workflow.spec.ts` | 6 | F4.1.1/2, G2, G7 — card, phases, evidence-derived done steps, VDR link, Mark done + note → Stage History, Reopen, Move deal here, advisory step set |
| `workflow-settings.spec.ts` | 5 | F4.1.3 — create/edit/reorder/save a template, assign it to a deal, default flip-flop keeps exactly one default, delete refusals, non-admin redirect |
| `deals-filters.spec.ts` | 7 | F4.1.4 — primary-only bar, More-filters popover, chips, Clear all, Views, Columns, Board, Group by |
| `advisory-classification.spec.ts` | 3 | F4.2.1 — chip, fee/balance, edit, filter by classification, CSV |
| `retainer.spec.ts` | 3 | F4.3.1 — $50,000 · Paid $20,000 · Balance $30,000, edit to zero balance, deals column + sort |
| `clients-filters.spec.ts` | 4 | F2.2/F6.1 — newest-first, Created column, country/sector/revenue filters, codename + flags |
| `app-settings.spec.ts` | 3 | image29/30 — three toggles, persistence, `/talk-to-us` fallback |

Teardown was verified to leave **0 `zz-` rows**, exactly **1** default workflow template, and the AppSetting rows back at their seeded values.

---

## 3. Deliberate deviations from the task plan

1. **`scripts/cleanup-test-data.ts` was not given `--only-prefix`.** That script's safety model is a human reading a preview and typing `DELETE TEST DATA`, and it aborts on non-TTY stdin by design; bolting a non-interactive flag onto it would have undermined that. A separate `scripts/cleanup-prefixed-test-data.ts` (npm `db:cleanup-prefixed`) was added instead: allow-listed prefixes (`ZZTest`, `zz-` only), refuses SQL-LIKE wildcards, re-checks every candidate against `prisma/real-data.json` inside the transaction, dry-run by default, refuses non-localhost without `--allow-remote`.
2. **Spec named `e2e/deal-workflow.spec.ts`**, not `deal-journey.spec.ts` — the journey no longer exists.
3. **Playwright resolved to 1.62.1**, which requires Chromium build 1234; `npx playwright install chromium chromium-headless-shell` was run (the 1228 build cached from the Aika reference pass is not sufficient).
4. **`e2e/fixtures/{seed,cleanup}.ts` CLI guards use `process.argv[1].endsWith(…)`**, not `import.meta.url`: Playwright loads `globalSetup`/`globalTeardown` as CJS, where `import.meta` is a syntax error.
5. **The G2 spec targets the last step (`successFee`)** rather than `investorOutreach`: on the seeded mandate the evidence rules already complete `investorOutreach`, so no "Move deal here" button renders there.

## 4. Three real bugs the e2e run exposed (fixed in `d75da4c`)

These were pre-existing defects in shared UI primitives, found only because the specs drove the real browser:

- **Duplicate DOM id.** `Select` derives its `id` from its label, so relabelling to "Pipeline status" produced `id="pipeline-status"` — colliding with the section anchor that the workflow step links target, which broke the deep links. `RestageSelect` now passes an explicit `id="pipeline-status-select"`.
- **`MultiSelect` had no accessible name.** Its visible label rendered as a `<span>` and its `aria-label` was applied *only* when no visible label existed, so the trigger was unreachable by screen readers and by `getByLabel`. It now always exposes an accessible name.
- **Clearable fields could not be cleared.** `Select`'s placeholder option was unconditionally `disabled`, so any field the drawers list in `clearableFields` could never actually be set back to empty through the UI. Added an opt-in `clearable` prop, used by Workflow template and Advisory classification.

**Still open (pre-existing, deliberately out of WS-A's diff):** `priority`, `referralQualified` and `partnerFeeStatus` are declared in the drawers' `clearableFields` but do not pass the new `clearable` prop, so they still cannot be cleared from the UI. Queued for the branch-review sweep.

---

## 5. Commits

| Commit | Task | Subject |
|---|---|---|
| `8ec01e5` | 1 | `feat(db): add the 5 dump-parity migrations, workflow/app-setting models and checksum fix script` |
| `f7d2a7c` | 2 | `feat(workflow): default template constants, deal-kind helpers, idempotent seed:workflow` |
| `5dc920d` | 2b | `fix(seed): workflow steps are create-only` |
| `10ce777` | 3 | `feat(settings): AppSetting service, /settings/app toggles, portal/talk-to-us consumers` |
| `11ddb83` | 4 | `feat(workflow): pure workflow engine with evidence rules and manual overrides` |
| `9337d10` | 5 | `feat(workflow): evidence loader, stage-state mutations, GraphQL surface` |
| `9c72287` | 6 | `feat(workflow): DealWorkflowCard on deal pages, pipeline-status relabel, template selector; remove 17-step journey` |
| `3e41830` | 7 | `feat(settings): workflow template CRUD under /settings/workflows` |
| `99084e3` | 8 | `feat(advisory): classification, fee paid and balance due` |
| `1f8bf8b` | 9 | `feat(mandate): retainer paid amount and balance due` |
| `b4b1aad` | 10 | `feat(deals): simplified filter bar with More-filters popover, chips, classification/paid/balance columns` |
| `b0e6c4a` | 11 | `feat(clients): newest-first list with country/sector/revenue filters, project codename + women/youth-led flags` |
| `d75da4c` | 12 | `test(e2e): Playwright scaffold, zz- fixtures and 31 WS-A specs` |

## 6. Handover to WS-B

- Migration 7 (`…_auth_onboarding_portal_ws`) is WS-B's; it must be applied with `prisma migrate deploy` only after its SQL has been read back and confirmed additive.
- The `portal.deal.milestones` setting and its `/settings/app` toggle exist and are wired; WS-B F6b.3 consumes them.
- `Client.projectCodename` / `womenLed` / `youthLed` and the portal's preference for `projectCodename` are in place; WS-B F6b.2 builds on them.
- The Playwright scaffold, `zz-` fixtures, login helper and teardown are shared — WS-B specs add to `e2e/` and reuse `adminStorageState`.
- Still owed by later phases: G4 `Source` enum values, G1 `/apply/status`, G3 milestone chip + comments, G5/G6/D6.
