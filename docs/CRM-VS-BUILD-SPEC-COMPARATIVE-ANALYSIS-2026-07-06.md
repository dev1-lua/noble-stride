# NobleStride CRM vs Build Specification — Full Comparative Analysis

**Date:** 2026-07-06 · **Updated:** 2026-07-06 (post-implementation — see banner below)
**Spec compared:** `decrypted/Lua x Noblestride - Build Specification (INTERNAL).pdf` — v2.0, 1 June 2026, 29 pages, read end-to-end (identical content to `docs/SOW.md`). Every table in the PDF is covered below: the entity catalogue (§2), all 11 data-dictionary tables (§3.1–3.11), all 16 picklists (§4.1–4.16), the sector taxonomy (§5), the milestone framework (§6, 3 tables), the access matrix (§7.2), the 4 agent specs (§8), the WhatsApp mapping (§9), intake + qualification (§10.1/10.2), the visibility matrix (§11), guardrails/escalation (§12), dashboards (§13), integrations (§14) and deliverables (§15).
**Build compared:** `noblestride-crm/` on branch `feat/InvestorOnboarding` (continued on `test/comparisionAgainstTheBuildSpecs`). Originally audited at HEAD `3f5c145`; updated after spec-gap pass 1 (commits `ae1f53e`..`f3419a0`); **statuses below now reflect HEAD `82b2006`** after spec-gap pass 2 (commits `260177e`..`82b2006` — see the second banner). All claims verified against code with `file:line` evidence, spot-checked against `prisma/schema.prisma` directly, and (pass 2) exercised live via Playwright against `localhost:3000` (14/14 flows).
**Supersedes** `docs/CRM-COMPARATIVE-ANALYSIS-2026-07-03.md` for spec-vs-build status (that doc's three-way concept-note comparison remains valid).

**Legend:** ✅ DONE · 🟡 PARTIAL (halfway — data or UI exists but incomplete/mismatched) · ❌ MISSING · ➖ Not committed scope (optional add-on per spec)

---

> ## ✳️ Implementation log — 2026-07-06 spec-gap pass (commits `ae1f53e`..`f3419a0`)
>
> After the initial audit, the spec-explicit gaps that needed **no client sign-off** were closed via subagent-driven development (Sonnet implemented, Opus reviewed each task, Fable did the final whole-branch review). Verification: `tsc` clean · **363/363** tests · zero new lint · clean production build · all CRM routes render live. What changed, and where it moved the needle below:
>
> 1. **Schema foundation** (`ae1f53e`) — 9 new enums with exact spec values (Deal type `Debt/Equity/EquityAndDebt`, Deal status, Deal milestone, Max selling stake, Task source, Comm channel/direction, Client status, Impact flags); enum extensions (Instrument `+Hybrid`, Sector `+Energy`, TaskStatus `+Dropped`, the missing §4.6 origination sources); 17 new Company fields; new Transaction/Task/Activity fields; and an append-only `StageChange` audit model. → moved **§3.1, §3.2, §4.1/4.2/4.3/4.5/4.6/4.7/4.11/4.12, §5**.
> 2. **Stage-history audit rows** (`1713507`, §7.1) — every mandate/transaction/engagement stage & status change now records from→to + timestamp + actor, shown on detail pages. → moved **§7.1, §13 (deal-stage history data)**.
> 3. **Task CRUD + overdue escalation** (`6b91929`, `0bf2329`, §3.8/§12.2) — full create/edit/delete, source picklist, `Dropped` status, assistant, and an auto overdue flag that self-clears. → moved **§2 (Task), §3.8, §4.11/4.12, §12.2, §13 (team & tasks)**.
> 4. **Company/Deal/Investor/Partner field exposure** (`0afc483`) — the new fields surfaced in form drawers + detail pages (codename, EBITDA/debt/assets, impact flags, use of funds, VDR link, deal status/milestone/type, probability, assistant, etc.). → moved **§3.1, §3.2, §3.4, §3.6**.
> 5. **Service Provider UI** (`121c66b`, §3.7) — list, form drawer, sidebar nav, and a transaction-detail card (backend existed with zero UI). → moved **§2 (Service Provider), §3.7**.
> 6. **Communication logging generalized** (`f1db74c`, §3.10) — `logActivity` logs against **any** linked record (client/mandate/transaction/investor/engagement, at-least-one enforced server-side), adds channel + direction, sets `createdById` from the trusted actor, and an Activity↔Task relation; client-detail timeline added. → moved **§2 (Communication), §3.10**.
> 7. **Dashboard groupings** (`f3419a0`, §13) — pipeline by lead/sector/financing-type/ticket-band, disbursement by year/quarter, team workload, task-status-by-owner, overdue actions, deals-rejected. → moved **§13**.
>
> **Still out of scope for this pass (unchanged below):** the 4 Lua agents (§8), WhatsApp/email/Slack/SharePoint integrations (§14), the §10 *company* intake+qualification form, real authentication + enforced in-org RBAC (§7.2), file upload/storage (§3.9), and items flagged for client confirmation in `memory/client-meeting-questions.md` (§16).

---

> ## ✳️ Implementation log — 2026-07-06 spec-gap pass 2 (commits `260177e`..`82b2006`)
>
> A second pass closed the remaining no-client-decision 🟡/❌ items (design: `docs/superpowers/specs/2026-07-06-spec-gap-pass-2-design.md`; plan: `docs/superpowers/plans/2026-07-06-spec-gap-pass-2.md`; same SDD process — Sonnet implemented, Opus reviewed each task, Fable whole-branch review). Verification: `tsc` clean · **387/387** tests (48 files) · zero new lint · `next build` clean · **Playwright end-to-end 14/14 flows** against the live app. What changed:
>
> 1. **Contact (Person) CRUD** (`260177e`, `dec5c89`, §3.5) — zod/service/mutations with ≥1-parent rule and one-primary-per-parent enforcement (`src/server/services/persons.ts`), plus a `ContactsCard` add/edit/delete drawer on client/investor/partner detail (`src/components/crm/contacts-card.tsx`). → moved **§2 (Investor Contact), §3.1 primary contact, §3.5**.
> 2. **App-wide edit-save fix** (`f9dad52`) — review caught that seeding `id` into drawer state leaked an unknown field into every `*Input!` variable, failing graphql v17 strict input coercion and breaking **every** edit-drawer Save; fixed once in `useEntityForm`/`buildMutationInput` (`src/components/ui/use-entity-form.ts:12`) with unit tests.
> 3. **Engagement edit surface** (`0fcdc99`, §3.11) — `engagement-form-drawer.tsx` edits all §3.11 fields (interest, NDA type, term sheet+date, amounts, disbursement status, date received, probability, feedback, notes) from engagement detail and per-row on the /engagement disbursement table; pending/year/quarter stay server-derived. → moved **§3.11 edit surface**.
> 4. **Milestone write path** (`1acd8e5`, §6.2) — `recordMilestone`/`unrecordMilestone` (upsert on `@@unique([engagementId,key])`, `src/server/services/milestones-crud.ts`) + an internal `MilestoneChecklist` on engagement detail (recorded/implied/open states, re-datable); portal steppers read the same merged data. → moved **§6.1 valuation conditionality, §6.2**.
> 5. **Core-identifier audit + immutability** (`d82f6e5`, `0ac20aa`, §7.1) — `StageChange` extended with client/investor/partner FKs (migration `20260706180000`); renames of client name/registration-no and investor/partner names plus primary-contact reassignment now write audit rows; Change History panels on all three detail pages; `Mandate.dateOpened`/`Mandate.source`/`Transaction.dateOpened` locked once set (calendar-date comparison, disabled edit fields). → moved **§7.1 (both rows), §3.2 date/source notes**.
> 6. **Field sweep** (`69c50b4`, §3.1/§3.2/§3.7/§3.9) — `Profitability` enum replaces the boolean (data-preserving migration `20260706190000`); `founderGenders` multi replaces single; `Document.mandateId` (+ drawer select, mandate-detail documents card); `Transaction.referredById → Partner`; Transaction↔ServiceProvider linking now writable (`serviceProviderIds` connect/set + drawer multi-select). → moved **§3.1 profitability/founders, §3.2 referrer, §3.7 linking, §3.9 mandate link**.
> 7. **Small-surface sweep** (`d078580`, §3.4/§3.10/§6.1) — communication **Summary now required** (zod + GraphQL + dialog); **create-task-from-communication** ("+ Task" per timeline activity, prefilled + linked-task display); §6.1 Valuation prep row hidden for Debt deals (`visiblePrepMilestones`); SSA-region contact select + display on investor; Years of Operation derived on client detail. → moved **§3.1 years-of-operation, §3.4 SSA contact, §3.10 summary/action-items**.
> 8. **Remaining §13 dashboards** (`82b2006`) — active-vs-inactive split, stage-change feed + transition counts, per-investor engagement rollup, invested/completed summary, historical year/quarter outcomes, per-partner referral conversion funnel (`src/server/services/dashboard.ts:454+`, `deal-analytics-panels.tsx`, dashboard page). → moved **§13 (all remaining rows)**.
>
> **Still out of scope (unchanged below):** the 4 Lua agents (§8), WhatsApp/email/Slack/SharePoint integrations (§14), §10 company intake, real auth + enforced RBAC (§7.2), **file upload/storage (§3.9 — explicit user decision to defer)**, and the client-question items (§16).

---

## 0. Executive summary — scorecard by spec section

| Spec section | Verdict | One-line status (post-implementation) |
|---|---|---|
| §2 Entity catalogue (11 entities) | 🟡→✅ | 10 of 11 now full CRM entities (Task + Service Provider gained UI); Advisory ➖ optional; Communication (`Activity`) now carries channel/direction/client-link |
| §3 Data dictionary | 🟡→✅ mostly | Engagement (§3.11) now exact incl. edit surface; Investor (§3.4) strong; **Company (§3.1) and Deal (§3.2) field gaps closed** (incl. contact CRUD, Profitability picklist, founders multi, referrer, years-of-operation); residual gaps are sub-sector and file upload |
| §4 Picklists (16 lists) | 🟡→✅ mostly | Now **11 exact/complete** (Deal type/status/milestone/max-stake/task-source added, Instrument+Hybrid, TaskStatus+Dropped); Deal stage (§4.4) + deployment status (§4.13) deferred to client (vocabulary questions) |
| §5 Sector taxonomy | 🟡 | 16/18 top-level now exact (Energy added, "Retail & FMCG" label fixed); extra `Banking` + sub-sectors still open (client questions 9, sub-sector depth) |
| §6 Milestones | 🟡→✅ mostly | **14 investor-side milestones now individually recordable/dateable** (write path + internal checklist, pass 2); §6.1 valuation conditionality enforced; post-transaction monitoring + success-fee invoicing still open |
| §7 Audit / access control | 🟡 | **§7.1 fully built**: stage/status history + **core-identifier audit** (names, registration no., primary contact) + **immutability** (dateOpened/source locked once set); enforced RBAC and real auth still ❌ |
| §8 Four agents | ❌ | Unchanged: 0 of 4 built; `ai.ts` holds read-only heuristic stubs |
| §9 WhatsApp integration | ❌ | Unchanged: nothing beyond a manual source tag (Comm channel field now exists to receive it later) |
| §10 Website intake & qualification | ❌ | Unchanged: `/register` is investor self-registration; the company intake form + qualification rules don't exist |
| §11 Investor deal visibility | ✅/🟡 | Unchanged (best-covered deliverable); investor-facing filter UI (§11.1) still missing; impact filter now unblocked at data layer (impact flags added) |
| §12 Guardrails / escalation | 🟡 | §12.1 structural guards intact; **§12.2 overdue-task escalation now built**; deal-status-change notifications and request/review workflows still ❌ |
| §13 Dashboards (7 views) | 🟡→✅ | **All non-advisory views built** — pass 2 added active-vs-inactive split, stage-change feed + transition counts, per-investor rollup, invested/completed summary, historical year/quarter outcomes, per-partner conversion funnel |
| §14 Integrations | ❌ | Unchanged: 0/5 (WhatsApp, Outlook, Slack, website, SharePoint/file storage) |
| §15 Deliverables | 🟡→✅ mostly | CRM, visibility, dashboards, access-audit slice delivered; agents/integrations/intake and full DPA/RBAC config not started |

**The shape of the gap now:** the *data core* is strong and the **spec's controlled vocabularies and Company/Deal field completeness — the biggest pre-implementation misses — are now largely closed**, along with an audit trail for stage changes, full Task management, generalized communication logging, Service Provider UI, and the missing dashboard groupings. After pass 2 (contacts CRUD, engagement/milestone edit surfaces, the full §7.1 audit+immutability slice, the field sweep, and the last §13 dashboards), what remains concentrates in (a) **everything channel-facing** (agents, WhatsApp, email, website intake, file storage — §8/§9/§10/§14), (b) **real authentication + enforced in-org RBAC** (§7.2), and (c) a handful of **client-decision** items (deal-stage vocabulary, deployment-status vocabulary, sub-sector depth, Advisory scope — see §16).

---

## 1. Scope at a glance (§1.2 — 9 components)

| # | Component | Status | Evidence / notes |
|---|---|---|---|
| 1 | CRM & Deal Management | 🟡→✅ | 11-entity Prisma schema + CRUD UI for all core entities (Task, Service Provider, and now **Contact** UI); stage-change + **identifier audit trail** and **dateOpened/source immutability** built; real auth + RBAC still pending (§7.2) |
| 2 | Client Agent | ❌ | Not built (`src/server/services/ai.ts` has no client-correspondence logic) |
| 3 | Investor Agent | ❌ | Not built; only heuristic `aiMatchInvestors` (ai.ts:16–54) overlaps its "surface fits" duty |
| 4 | Investor Tracker Agent | 🟡 | The *data + guard layer* it would drive exists (Engagement stages, NDA guard, disbursement, now stage history + overdue flags); no agent, no scheduled checks |
| 5 | Referral / Partner Tracking Agent | 🟡 | Manual equivalent: partner portal referral form creates real Mandates (`submit-referral.ts:39-92`); no agent/channel capture |
| 6 | WhatsApp Integration | ❌ | No webhook/API client anywhere (Comm channel field now present to receive it later) |
| 7 | Website Intake & Qualification Agent | ❌ | Company intake + qualification logic absent; `/register` serves investors instead |
| 8 | Investor Deal Visibility | ✅ | `src/server/visibility/` — tiers, field matrix, codenames, NDA-gated VDR docs, classification blocking |
| 9 | Reporting & Dashboards | 🟡→✅ mostly | See §13 breakdown — pipeline/disbursement/team-task groupings now built |

---

## 2. Entity catalogue (§2)

| Spec entity | Built as | Status | Notes |
|---|---|---|---|
| Company / Target | `Client` | 🟡→✅ | Central-anchor role holds; **§3.1 fields added and editable** (residual: sub-sector only) |
| Deal / Mandate | `Mandate` **+** `Transaction` | 🟡 | Spec's one entity split into client-acquisition + fundraising-execution pipelines; **deal type/status/milestone fields now added**; kanban stage vocab still diverges (§4.4 — client question 7) |
| Advisory Engagement | — | ➖ | Optional add-on, correctly not built pending discovery (spec §3.3, §19.2) |
| Investor | `Investor` | ✅ | Fullest entity; onboarding + NDA fields; nextActionDate/feedback/shareholding now exposed |
| Investor Contact | `Person` | 🟡→✅ | **Full CRUD added (pass 2)** — `ContactsCard` add/edit/delete drawer on client/investor/partner detail; ≥1-parent rule + one-primary-per-parent enforced server-side (`persons.ts`) |
| Referral / Partner | `Partner` | ✅ | Fee-sharing, advisor type, agreement status, internal-only; organization/email/phone now in the drawer |
| Service Provider | `ServiceProvider` | ✅ | List page, form drawer, sidebar nav, transaction-detail card; **transaction linking now writable** (pass 2 — `serviceProviderIds` multi-select in the transaction drawer) |
| Task | `Task` | 🟡→✅ | **Full CRUD added** — create/edit/delete, source, `Dropped` status, assistant, auto overdue escalation |
| Document | `Document` | 🟡 | Register + access levels + review chain; **Mandate link added (pass 2)**; File still an optional URL, no upload (§3.9 — deferred by decision) |
| Communication | `Activity` | ✅ | Channel + direction + any-record linking; **Summary now required and tasks creatable from a communication (pass 2)**; WhatsApp/Slack *ingestion* is still the §9 integration gap |
| Investor-Deal Engagement | `Engagement` | ✅ | Near-exact §3.11 match incl. derived year/quarter and amount-pending |

**Relationship rules (§2.1):** deal→company anchoring ✅; one-deal-one-communication-universe ✅ (Activity can now link to Client); investor-deal links via Engagement ✅; company holding both deal types ➖ (no advisory); partner internal-only ✅ (never projected to investors).

---

## 3. Data dictionary (§3.1–§3.11) — field-by-field

### 3.1 Company / Target → `Client` — was weakest entity, now largely complete

| Spec field (Req) | Status | Notes |
|---|---|---|
| Company ID (Y) | ✅ | cuid |
| **Project codename (Y)** | ✅ | `codename` added — now stored separately from legal name (`ae1f53e`, exposed `0afc483`) |
| Legal name (Y) | ✅ | `name` (required), now distinct from codename |
| Registration no. | ✅ | `registrationNo` added |
| Year founded | ✅ | `yearFounded` |
| **HQ city / country (Y)** | ✅ | `hqCity` + `hqCountry` added |
| Countries of operations | 🟡 | `countries Geography[]` — regional buckets (client question 8) |
| **Sector (Y)** | 🟡 | Multi-select array vs spec single-select (client question 11); optional |
| Sub-sector | ❌ | No taxonomy anywhere (client question — sub-sector depth) |
| **Core product / service (Y)** | 🟡 | Present, optional |
| **Description (Y)** | 🟡 | Present, optional |
| Business model | ✅ | `businessModel` added |
| Founders, gender | ✅ | `founderGenders FounderGender[]` multi (pass 2 migration wrapped the old single value) |
| Founders, nationality | ✅ | `foundersNationality` added |
| Ownership / shareholding | ✅ | `ownershipStructure` added |
| Directors / management | ✅ | `directorsManagement` added |
| Target clients | ✅ | `targetClients` added |
| Years of operation | ✅ | Derived on client detail (`currentYear − yearFounded`, per spec "derived") — pass 2 |
| Last year revenue (USD) | ✅ | `revenueLastYear` |
| Revenue forecast (USD) | ✅ | `revenueForecast` |
| EBITDA / net profit | ✅ | `ebitda` + `netProfit` added |
| Profitability | ✅ | `profitability Profitability?` picklist (Profitable / Loss-making) — pass 2, data-preserving migration from the old boolean |
| Existing debt | ✅ | `existingDebt` added |
| Loan book (FIs) | ✅ | `loanBook` added |
| Total assets | ✅ | `totalAssets` added |
| **Primary contact (Y)** | ✅ | Full contact CRUD (pass 2); one primary per parent enforced in a transaction; reassignment audited (§7.1) |
| Website / social | 🟡 | Website only |
| **Origination source (Y)** | 🟡 | `source Source?` optional; value set now complete (§4.6) |
| Impact flags (women-led / youth-led) | ✅ | `impactFlags ImpactFlag[]` added (also unblocks the §11.1 impact filter) |
| **Status (Y)** | ✅ | `status ClientStatus @default(Prospect)` added + list column |

**Count moved from 5 ✅ / 10 🟡 / 16 ❌ → ~19 ✅ / ~8 🟡 / 1 ❌ (sub-sector — client question).**

### 3.2 Deal / Mandate → `Mandate` + `Transaction`

| Spec field (Req) | Status | Notes |
|---|---|---|
| Deal ID (Y) | ✅ | cuid on both |
| Project (Y) | ✅ | `name` |
| Company (Y) | ✅ | Required `clientId` on both |
| **Deal type (Y)** — Debt/Equity/Equity & Debt | ✅ | New `financingType DealFinancingType` (exact 3 values), labeled "Deal type"; the legacy round-name `DealType` enum relabeled "Round" |
| Instrument | ✅ | `Instrument[]` now includes `Hybrid` (all spec values present; still multi-select + extra `Convertible`) |
| Target profile | ✅ | `targetProfile` added |
| Max selling stake (§4.7) | ✅ | `maxSellingStake MaxSellingStake` added |
| **Ticket size USD Mn (Y)** | 🟡 | `Mandate.dealSize` / `Transaction.targetRaise`, both optional |
| Use of funds | ✅ | `useOfFunds` added |
| **Sector (Y, inherited)** | 🟡 | Multi array, optional, no inherit-from-company logic |
| **Status (Y)** — Open/On Hold/Closed/Dropped/… | ✅ | New `dealStatus DealStatus` (exact §4.5 values) on Mandate + Transaction |
| **Deal stage (Y)** (§4.4) | 🟡 | Kanban `MandateStage`/`TransactionStage` still generic (client question 7) |
| Deal milestone (§4.3) | ✅ | New `dealMilestone DealMilestone` (exact §4.3 values) on Transaction |
| **Deal lead (Y)** | 🟡 | `Mandate.leadId` / `Transaction.ownerId`, optional |
| Deal assistant | ✅ | `assistantId` added on Transaction (Mandate uses lead only) |
| Consultant / referrer | ✅ | `Mandate.referredById` ✅; **`Transaction.referredById → Partner` added (pass 2)** with drawer select + detail link |
| **Date onboarded (Y, immutable)** | ✅ | `dateOpened` **now locked once set** (server `CrudError` at calendar-date granularity + disabled edit field) — pass 2; still optional at create (legacy imports have nulls) |
| **Source (Y)** | 🟡 | Mandate only, optional; **now locked once set** (pass 2) |
| Teaser / IM / Model (Not started/Draft/Done) | 🟡 | Derived live from the Document register (deal-prep checklist) — reasonable substitute (client question 13) |
| VDR (link) | ✅ | `vdrLink` added (rendered as a link on detail) |
| Probability of closure | ✅ | `probability` added at deal level on Transaction (also still per-investor on Engagement) |
| Comments | ✅ | `Mandate.notes` + `Transaction.notes` (added) |

### 3.3 Advisory Engagement — ➖ entirely unbuilt, **correctly** (spec optional; §17 item 1, §19.2). Client question 14.

### 3.4 Investor → `Investor` — strong (unchanged except UI exposure)

| Spec field (Req) | Status | Notes |
|---|---|---|
| Investor ID / Firm name (Y) | ✅ | |
| **Institution type (Y)** | 🟡 | All 7 spec values present + 3 extras (Angel, CorporateVC, GrantDonor) |
| Website / Country restrictions | ✅ | |
| **Sector / Geographic focus (Y)** | 🟡 | Present; required only in registration, optional in admin path; regional buckets |
| **Ticket min/max, Instruments (Y)** | 🟡 | Present, optional; Hybrid now available as an instrument value |
| **Deployment status (Y)** (§4.13) | 🟡 | Vocabulary reworked to fund lifecycle — spec's exact 3 values not present (client question 10) |
| Investment mandate / Stage pref / IRR / Shareholding / Pricing / ESG / AUM / Remaining period / DD / IC / Track record | ✅/🟡 | Mostly ✅ (several superset fields); stage-pref multi vs single, IRR numeric vs text, shareholding free-text |
| Min EBITDA / revenue / loan-book | ✅ | Three distinct currency fields |
| **NDA status (Y)** / **Engagement classification (Y)** | 🟡 | Exact enum values; defaulted, not required-at-entry; classification drives visibility ✅ |
| Next action date / Feedback / SSA-region contact | ✅ | nextActionDate + feedback in the drawer (`0afc483`); **SSA-region contact select (investor's own contacts) + detail display added (pass 2)** |

### 3.5 Investor Contact → `Person` — full CRUD added (pass 2)

Model complete (first/last name, jobTitle, email/phone nullable, isPrimaryContact/isSSAContact, corporate-email check in registration). **Create/edit/delete UI now on all three parent detail pages** (`contacts-card.tsx`): ≥1-parent rule and one-primary-per-parent enforced server-side (`src/server/services/persons.ts`), primary reassignment audited (§7.1), SSA flag editable on investor contacts — ✅.

### 3.6 Referral / Partner → `Partner`

All spec fields at data layer; advisor type / fee-sharing / agreement status / internal-only exact. **Organization + email + phone now added to the form drawer** (`0afc483`) — was 🟡, now ✅. Deals-introduced still settable only from the Mandate side (🟡); extra `Preferred` status value.

### 3.7 Service Provider → `ServiceProvider`

All 9 fields ✅ at data layer (type enum exact; status free-text 🟡). UI added in pass 1 (`121c66b`): list page, form drawer, sidebar nav, transaction-detail card. **Transaction↔provider linking now writable (pass 2)** — `serviceProviderIds` in TransactionInput (connect on create / set on update) + multi-select in the transaction drawer, smoke-tested — ✅.

### 3.8 Task → `Task` — was biggest small-entity gap, now full CRUD

| Spec field (Req) | Status | Notes |
|---|---|---|
| Task ID (Y) | ✅ | |
| **Linked record (Y)** | 🟡 | 4 optional FKs (mandate/transaction/investor/client); unlinked tasks possible |
| **Action point (Y)** | ✅ | `title` |
| **Source (Y)** (§4.12) | ✅ | `source TaskSource` added + in form |
| **Status (Y)** | ✅ | `Dropped` added — all 5 §4.11 values |
| Deadline | ✅ | `dueAt` |
| **Owner (Y)** | 🟡 | `assigneeId` optional but now editable |
| Assistant | ✅ | `assistantId` added |
| Notes | ✅ | `body` |
| **Escalation flag (Auto)** | ✅ | `escalated` + `flagOverdueTasks()` sweep (auto-set on overdue, auto-clears when Done/rescheduled; not caller-writable) |
| **CRUD** | ✅ | Full create/edit/delete via `tasks.ts` service + drawer + mutations (`6b91929`, `0bf2329`) |

### 3.9 Document → `Document` (unchanged)

All fields present except **File is still an optional `fileUrl` text — no upload/storage** (🟡, explicitly deferred by user decision). Access level exact + enforced by the visibility engine; type superset; review chain beyond spec. **Linked-record now includes the Mandate FK (pass 2)** — drawer select + a documents card on mandate detail — ✅.

### 3.10 Communication → `Activity` — generalized this pass

| Spec field (Req) | Status | Notes |
|---|---|---|
| Comm ID (Y) | ✅ | |
| **Channel (Y)** — WhatsApp/Email/Slack/Web chat/Call/Meeting | ✅ | `channel CommChannel` added (exact 6 values) |
| **Linked record (Y)** | ✅ | `clientId` added; `logActivity` accepts any of client/mandate/transaction/investor/engagement, **at-least-one enforced server-side** |
| Direction | ✅ | `direction CommDirection` added |
| **Summary (Y)** | ✅ | `subject` **now required** (zod min-1 + GraphQL required + dialog validation) — pass 2 |
| Extracted action items | ✅ | **"+ Task" per timeline activity (pass 2)** — opens the task drawer prefilled (title from subject, links + `activityId` copied); linked tasks listed under each activity |
| **Timestamp (Y)** | ✅ | `occurredAt` |
| **Logged by (Y)** | ✅ | `createdById` now populated from the trusted actor |
| **Write path** | ✅ | Generalized `logActivity` (`f1db74c`); `logEngagement` kept backward-compatible; client-detail timeline added |

*Remaining §9 gap:* WhatsApp/Slack/email *ingestion* into these fields is the integration work, still unbuilt.

### 3.11 Investor-Deal Engagement → `Engagement` — **best entity, unchanged**

All 15 spec fields ✅ (12-value stage exact order, interest level, NDA type, term sheet + date, total/disbursed/pending with pending auto-derived, disbursement status exact §4.10, date received, year/quarter auto-derived, probability, feedback). Stage changes audited via `StageChange` (§7.1). **Full edit surface added (pass 2)** — `engagement-form-drawer.tsx` on engagement detail + per-row on the /engagement disbursement table edits every §3.11 field (stage stays in the NDA-guarded restage control; derived fields recompute server-side) — ✅ end to end.

---

## 4. Picklist library (§4.1–§4.16)

| § | Picklist | Status | Detail |
|---|---|---|---|
| 4.1 | Deal type (Debt; Equity; Equity & Debt) | ✅ | New `DealFinancingType` exact 3 values |
| 4.2 | Instrument (Debt; Equity; Mezzanine; Grant; Hybrid) | ✅ | `Hybrid` added — all spec values present (extra `Convertible` retained) |
| 4.3 | Deal milestone (Term Sheet; NBO; Loan Agreement; SPA/SHA; DD; IC; TA; Closed) | ✅ | New `DealMilestone` exact values on Transaction |
| 4.4 | Deal stage (Indicative TS → Closed, 9 values) | 🟡 | Kanban `MandateStage`/`TransactionStage` still generic (client question 7) |
| 4.5 | Deal status (Open; On Hold; Closed; Closed & Reopened; Closed & On Hold; Dropped) | ✅ | New `DealStatus` exact 6 values |
| 4.6 | Origination source (9 values) | ✅ | All 9 now present (added Direct enquiry, Consultant, Investor, Partner, Social media, Internal BD; Event=Networking event) — *structural note:* still one shared `Source` enum with Task-source values |
| 4.7 | Max selling stake (Minority; Majority; Full Sale; N/A) | ✅ | New `MaxSellingStake` exact values |
| 4.8 | Advisory project type | ➖ | Advisory not in scope |
| 4.9 | Advisory project milestone | ➖ | Advisory not in scope |
| 4.10 | Engagement status (Disbursed; Ongoing; Fell off; Dropped) | ✅ | Exact match |
| 4.11 | Task status (5 values) | ✅ | `Dropped` added — all 5 |
| 4.12 | Task source (Monday Meeting; WhatsApp; Email; Verbal; Other) | ✅ | New `TaskSource` enum, now a real Task field with all 5 values |
| 4.13 | Investor deployment status (Active/Deploying; Not deploying; On hold) | 🟡 | Reworked to fund lifecycle (client question 10) |
| 4.14 | Engagement classification (5 values) | ✅ | Exact match; drives visibility |
| 4.15 | NDA type (Open; Closed) | ✅ | Exact match |
| 4.16 | Document access level (4 values) | ✅ | Exact match |

**Moved from 5 exact / 6 partial / 5 missing → 11 exact-complete / 3 partial (§4.4 deal stage, §4.13 deployment — both client questions) / 2 ➖ advisory.**

---

## 5. Sector taxonomy (§5)

16/18 spec sectors now exact (**Energy added** this pass; "Retail & FMCG" label fixed). Remaining deviations: extra top-level `Banking` (client question 9); **sub-sector taxonomy still ❌** (client question — sub-sector depth). Restricted-sector screening still ❌ (no qualification logic — §10).

---

## 6. Milestone framework (§6) — write path added (pass 2)

| Element | Status | Detail |
|---|---|---|
| 6.1 Doc-prep milestones (Teaser, Model, IM) | ✅ | Deal Preparation checklist derived from the Document register |
| 6.1 Valuation report (equity only) / Business plan (optional) | ✅ | **Valuation row now hidden for Debt-only deals** (`visiblePrepMilestones`, pass 2); Business plan labeled optional |
| 6.2 The 14 investor-side milestones | ✅ | All encoded + portal steppers; **individually recordable/dateable/unrecordable (pass 2)** — `recordMilestone`/`unrecordMilestone` upsert + internal checklist on engagement detail (recorded / implied-by-stage / open states) |
| 6.3 Disbursement | ✅ | Total/disbursed/pending table (+ new year/quarter summary, §13) |
| 6.3 Success-fee invoicing & payment | 🟡 | Fields on Transaction; no invoice generation |
| 6.3 Post-transaction monitoring | ❌ | Nothing |

---

## 7. Audit, immutability, access control (§7)

| Requirement | Status | Evidence |
|---|---|---|
| Prior value + timestamp + user on protected-field changes (§7.1) | ✅ | Stage & status changes audited (`1713507`); **core-identifier changes now audited too (pass 2, `d82f6e5`)** — client name/registration-no, investor/partner names, primary-contact reassignment write `StageChange` rows (client/investor/partner FKs added); Change History panels on all three detail pages |
| Deal stage history (every change + user) | ✅ | `StageChange` rows for mandate/transaction/engagement stage + dealStatus + dealMilestone; shown reverse-chron on detail pages; **dashboard roll-up feed added (pass 2)** |
| Immutable deal creation date / source / ID | ✅ | **`Mandate.dateOpened`/`source` and `Transaction.dateOpened` locked once set (pass 2)** — server `CrudError` + disabled edit fields; IDs are cuids never exposed for edit |
| Role-based CRUD matrix enforced at data layer (§7.2) | ❌ | `/access-matrix` still display-only; omits external roles |
| Real authentication | ❌ | `ns_viewpoint` cookie is a demo lens; OTP hardcoded |
| GraphQL mutation authorization | ❌ | No role checks in resolvers |
| External viewpoint kept out of internal shell | ✅* | Server-side redirect — within the demo-lens trust model |
| External-role visibility gating | ✅ | Enforced via the visibility engine (§11) |

---

## 8. Agent specifications (§8) — 0 of 4 built (unchanged)

`ai.ts` = 4 read-only heuristic helpers with `// SEAM: replace with Lua` comments; no Lua SDK; no triggers, channel listeners, classifiers, or agent-authored writes. The data + guard substrate an agent would drive is now richer (stages, NDA guard, disbursement, **stage history, overdue flags**), but the agents themselves are unbuilt. `docs/agents/04-noblestride-agents.md` is a build guide only.

---

## 9. WhatsApp integration (§9) — ❌ nothing (unchanged)

No webhook/API client/parser. All six mapping-table rows MISSING. The substrate is now readier: **Communication.channel + Task.source + escalation flag now exist** to receive structured inbound once the integration is built. §9.1 never-automated list: still no enforcement to prevent naive future violation.

---

## 10. Website intake & qualification (§10) — ❌ built for the wrong actor (unchanged)

`/register` is **investor** self-registration (implements §11.2 access control), not the spec's **target-company** intake. 0/12 required §10.1 fields on any public surface; **§10.2 qualification logic entirely absent** (no revenue/raise/audited-accounts/restricted-sector/SSA/PEP screens, no Qualified/Rejected label); §10.3 open-queue exists for investors, not for company leads.

---

## 11. Investor deal visibility (§11) — best-covered deliverable (unchanged)

Engine `src/server/visibility/` + 200+ tests implements the full matrix, hard rules (partner identity + other investors never visible), and excluded/greylisted blocking across three code paths. **§11.1 investor-facing filters still missing** (matching is automatic from the stored profile); the **impact filter is now unblocked at the data layer** (impact flags added this pass) but has no UI. VDR locked until interest + NDA ✅; decline-revocation only via manual restage 🟡.

---

## 12. Automation guardrails & escalation (§12)

**12.1 never-automated (10 rules):** unchanged — structural guards exist where features exist (no-auto-NDA-signing ✅, VDR-without-NDA ✅, excluded-investor sharing ✅, onboarding approval human-clicked ✅ but not role-protected). Rules 2,3,5,8,9,10 remain N/A pending the agents.

**12.2 escalation triggers:** **overdue-task escalation now built** (`escalated` auto-flag + `flagOverdueTasks()` sweep, surfaced on the tasks page and dashboard). Deal-status-change notifications, WhatsApp task auto-creation, tracked request workflows, and review-request workflows still ❌.

---

## 13. Reporting & dashboards (§13)

| Dashboard | Field/grouping | Status |
|---|---|---|
| Pipeline overview | Active vs inactive | ✅ (pass 2 — dealStatus split: Open+Reopened vs OnHold/Closed/Dropped, stat cards) |
| | Deals by lead | ✅ (new) |
| | By transaction type | ✅ (new — financing type) |
| | By sector | ✅ (new) |
| | By ticket-size band | ✅ (new — reuses `ticket-bands.ts`) |
| Deal status | Distribution | 🟡 keyed to internal stage vocab |
| | Stage history | ✅ (pass 2 — "Recent Changes" feed across all six audited entities + transitions-by-field counts) |
| Investor engagement | Deals under review per investor | ✅ (pass 2 — per-investor rollup table: under review / rejected / invested) |
| | Deals rejected | ✅ (Declined count on engagement page + rollup column) |
| | Invested/completed | ✅ (pass 2 — count + total-disbursed stat) |
| | Historical summary | ✅ (pass 2 — year/quarter × outcome table from derived fields) |
| Disbursement | Total/disbursed/pending by deal + investor | ✅ |
| | By year and quarter | ✅ (new — grouped summary) |
| Referrals & partners | Deals per partner + status | ✅ |
| | Conversion funnel | ✅ (pass 2 — per-partner introduced → progressed → won/lost table) |
| Team & tasks | Deal load by member | ✅ (new) |
| | Task status by owner | ✅ (new — cross-tab) |
| | Overdue actions | ✅ (new — uses the escalation flag) |
| Advisory | All | ➖ |

Beyond spec: investor-onboarding stat group, 6-month pipeline trend chart, AI insight cards.

---

## 14. Systems & integrations (§14) + Deliverables (§15)

Integrations unchanged: WhatsApp ❌ · Outlook/M365 ❌ · Slack ❌ · Website embed ❌ · SharePoint/file storage ❌. Data protection (§14.2): external-role confidentiality gates ✅; RBAC/encryption-audit posture ❌.

| §15 deliverable | Status |
|---|---|
| Discovery & configuration brief | ✅ (in-repo docs) |
| Configured CRM | ✅ mostly — entities/picklists/fields/tagging/contact-CRUD built; stage + identifier audit and immutability done; real auth + RBAC still pending |
| Four deployed agents | ❌ |
| WhatsApp integration | ❌ |
| Website intake & qualification agent | ❌ |
| Investor deal visibility | ✅ |
| Reporting dashboards | ✅ (all non-advisory §13 views) |
| Access controls & DPA configuration | 🟡 — full §7.1 audit+immutability + external gating done; in-org RBAC + full DPA config pending |
| Onboarding & handover | 🟡 docs exist; walkthrough/PoC support pending |

---

## 15. Where the build exceeds the spec

- **Investor self-registration + approval queue + NDA recording** (implements §11.2 back-end control with a real PendingReview→Approved gate).
- **Investor portal as a working CRM** (fund-profile editing, milestone steppers, Express Interest write-back) vs the spec's "controlled view".
- **Partner portal** (referral submission creating real mandates, funnel, expected fee).
- Document **review chain**; teaser **codename masking** pre-NDA; corporate-email gate; kanban boards; real-data import (106 mandates / 104 clients / 387 tasks).
- **New in pass 1:** append-only stage/status **audit trail**, full **Task management** with auto-escalation, **Service Provider** management UI, generalized **communication logging** with channel/direction, and the first set of **§13 dashboard groupings**.
- **New in pass 2:** full **contact management** with primary-contact governance, **engagement + milestone edit surfaces**, the complete **§7.1 identifier audit + immutability** slice, **task-from-communication**, and the remaining **§13 analytics** (change feed, investor rollup, historical outcomes, referral funnel) — plus an app-wide edit-save fix caught in review.

---

## 16. What to do next

### ✅ Done in the 2026-07-06 spec-gap pass (were the "instantly actionable" items)
1. Task entity completion (source, Dropped status, assistant, escalation + overdue, full CRUD) — **done**.
2. Deal vocabulary & fields (Deal type, Deal status, Deal milestone, max selling stake, target profile, use of funds, VDR link, deal-level probability, notes) — **done**.
3. Company/Target §3.1 fields (codename, registration no., HQ country, business model, founders' nationality, ownership, directors, target clients, staff/branches, EBITDA/net profit, existing debt, loan book, total assets, impact flags, status) — **done** (except years-of-operation derivation).
4. Picklist corrections (missing §4.6 origination values, Hybrid instrument, Energy sector, "Retail & FMCG" label, Task source split into its own field) — **done**.
5. Stage-history audit rows (§7.1 slice) — **done**.
6. Communication upgrades (channel + direction, client link, Activity→Task relation, generalized logging UI) — **done** (create-task-from-comm UI still pending).
7. Service Provider UI — **done**.
8. Dashboard groupings (by lead/sector/type/ticket band; disbursement by year+quarter; team workload; task-status-by-owner; overdue) — **done**.

### ✅ Done in the 2026-07-06 spec-gap pass 2 (were the "still open — no client input" items)
9. Contact (Person) create/edit/delete UI on Client/Investor/Partner, with primary-contact governance — **done**.
10. §3.11 Engagement edit surface (all fields, detail page + disbursement rows) — **done**.
11. §6.2 milestone write path (record/re-date/unrecord, internal checklist; §6.1 valuation conditionality) — **done**.
12. §7.1 completion: core-identifier audit (names, registration no., primary contact) + dateOpened/source immutability — **done**.
13. Field sweep: Profitability picklist, founders' gender multi, years-of-operation derivation, Document→Mandate link, Transaction referrer, Transaction↔ServiceProvider linking — **done**.
14. §3.10 completion: Summary required + create-task-from-communication with linked-task display — **done**.
15. Remaining §13 dashboards: active-vs-inactive, stage-history roll-up + transition counts, per-investor rollup, invested/completed, historical year/quarter summary, referral conversion funnel — **done**.

### ⏳ Still open — no client input needed
- **File upload / storage** for Documents (§3.9 File is spec-required) + a real VDR file flow — the ONLY remaining no-decision item, deferred by explicit user decision pending an infra choice (S3/Azure/SharePoint per §14).
- Small deferred polish from review (tracked in the pass-2 ledger): humanized stage labels in the dashboard change feed; drawer state refresh after save+reopen (app-wide `useEntityForm` pattern); success-fee invoicing + §6.3 post-transaction monitoring.

### 🚧 Larger builds (roadmap)
- The 4 Lua agents (§8), WhatsApp/email/Slack capture (§9/§14), the §10 **company** intake + qualification form, real authentication + enforced in-org RBAC (§7.2).

### ❓ Needs client confirmation first
Recorded in `memory/client-meeting-questions.md` (questions 7–14, added 2026-07-06): deal-stage vocabulary (§4.4), country-vs-region geography, sector/deployment-status vocabulary conflicts between the spec and the client's other docs, single-vs-multi sector, required-field enforcement on legacy imports, teaser/IM/model derived-vs-stored, and Advisory Engagement scope.
