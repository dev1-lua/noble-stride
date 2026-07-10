# Scoping Document Conformance / Gap Report

**Date:** 2026-07-10
**Branch:** `integration/all-features` (working tree, uncommitted changes per usual convention)
**Compared:** `Noblestride_Lua_Phase1... Full Scoping Document` (client-facing, pre-SOW) vs. the built `noblestride-crm` codebase
**Method:** Read the scoping doc in full (10 sections + "implementation scope already agreed"). For every concrete requirement, verified against the actual Prisma schema, server domain/service code, visibility engine, and page components — not against the prior QA docs' claims, which are themselves cross-checked and in several places found to be **stale** (noted explicitly below). Status legend: ✅ Present · 🟡 Partial · ❌ Missing/Not built · ➖ N/A (describes the client's manual process, not a system requirement).

> **Read this first — three prior findings are now stale.** The 2026-07-07 assessment's BUG-01 (document-title identity leak) is **fixed in current code** (`src/server/visibility/project.ts:241`). Its BLOCKER-A (no real auth, unrestricted impersonation) is **resolved** — real credential auth + sessions shipped 2026-07-08, and the impersonation/viewpoint switcher was **fully removed** 2026-07-10 (confirmed: `git status` shows `viewpoint-switcher.tsx`, `portal-switcher.tsx`, `viewing-banner.tsx`, `api/viewpoint/route.ts` all deleted; `topbar.tsx` has zero viewpoint/impersonation references). Its BLOCKER-C claim that "documents are display-only, no upload/download" is **outdated** — real upload/download/versioning against local disk is built and live-verified, with a fully-coded (not stubbed) SharePoint provider gated only on Azure AD credentials. Its BLOCKER-D ("website intake agent built for the wrong actor") is **resolved** — a company-side `/intake` wizard with a real rule-based qualification engine now exists. These are corrections to the historical record, not criticisms of that pass — the build has moved substantially since 2026-07-07.

---

## 1. Executive summary — conformance scorecard

| § | Section | Rollup | Headline |
|---|---------|--------|----------|
| 01 | Deal / Transaction Workflow | 🟡 (~80%) | 17-stage lifecycle modeled almost verbatim as a display-only "Deal Journey"; qualification/rejection criteria are a real rule engine; guardrails against auto-committing the firm are solid. Gap: intake stage (2–10) mostly manual data entry, as intended. |
| 02 | Investor Management & Matching | ✅ (~85%) | Investor model covers the ~25 tracked fields (and more); matching is a real weighted rule engine (sector/geo/ticket/instrument/threshold); "internal only" confidentiality is a hard-coded, tested rule. Gap: matching is not AI/semantic (explicit SEAM for future Lua integration). |
| 03 | WhatsApp Correspondence Integration | ❌ (~10%) | Not built. `WhatsApp` exists only as a manual-entry enum label (Source/Channel/TaskSource) — no capture, parsing, or webhook. Generic overdue-task escalation is built (channel-agnostic), which covers one narrow slice of §03. |
| 04 | Website Client Intake Agent | ✅ (~85%) | `/intake` public wizard + `qualifyIntake()` engine implement the scoping ruleset almost field-for-field (revenue, raise, audited years, SSA geography, restricted sectors, PEP/gov-owned, EBITDA, operating history). Verdict never auto-rejects — always lands as a manual-triage Mandate, matching the spec's "never automatic" rule. Gap: no document upload (CR12/audited accounts) at intake time — deferred to post-review. |
| 05 | Investor Deal Visibility Capability | ✅ (~90%) | The single most fully-built section. Tiered field-level gating (PRE_INTEREST/AFTER_NDA/DD), codename masking, hard-coded "never visible" rules, and 5 of the 5 requested portal filters are all implemented and unit-tested. |
| 06 | Referral & Partner Tracking | ✅ (~85%) | Partner model + referral rollups cover originator, fee-sharing, contacts, referral quality (`referralQualified`), stage, and conversion reporting — all live in the internal `/partners` CRM view. Caveat: the partner's *own* self-service portal (`/portal/partner/**`) is fully built but currently unreachable — no partner login exists since the 2026-07-10 demo-switcher removal (see gap #7). |
| 07 | CRM & Data Structure | 🟡 (~75%) | All core entities exist with rich fields; append-only `StageChange` audit trail is real. Gap: "mandatory fields" are schema-optional almost everywhere except `name`/`type` — nothing blocks saving an incomplete record. |
| 08 | Systems & Integrations | 🟡 (~25%) | Only the SharePoint/file-storage drop-in is real code (config-gated). Outlook/M365/Teams/WhatsApp: no integration code found anywhere. |
| 09 | Implementation Priorities & Success Criteria | ➖/🟡 | Mostly qualitative client narrative (➖). The concrete, checkable parts (automation guardrails, human-in-the-loop) are built and verified. |
| 10 | Supporting Materials & Next Steps | ➖ | Entirely about the client sharing spreadsheets/materials — not a system requirement. |

**Overall:** the CRM itself (data model, pipeline, visibility/confidentiality engine, dashboards, partner/referral tracking, and the rule-based intake-qualification + investor-matching engines) is **substantially complete against the scoping document** — likely the strongest part of the whole engagement. The **channel-integration and "agent" layer is the real gap**: of the 8 "already agreed" scope items, 3 are solidly built, 1 is a real but non-agentic rule engine, and 4 are not built at all (see §2).

---

## 2. Biggest gaps / not-built, ranked

1. **The 4 named "Agents" (Client Agent, Investor Agent, Investor Tracker Agent, Referral/Partner Tracking Agent) are not built as agents.** `src/server/services/ai.ts` implements `aiMatchInvestors`, `aiFindProspects`, `aiOverviewInsights`, `aiAsk` — every one is plain deterministic TypeScript over Prisma, and the file's own header says so: *"canned (data-aware) implementations of AI-flavoured CRM functions... each exported function body is replaced by Lua (Data API/LuaTool) at integration time — see SPEC §8."* The dashboard "Overview Agent" card and the "Ask your agents anything…" box (`src/components/shell/ask-bar.tsx`) are real, working UI over this canned logic — useful, but not the autonomous channel/relationship agents the scoping doc names. This is an intentional, explicitly-marked integration seam, not an oversight — but it means 4 of 8 agreed-scope line items are not yet delivered in the form the client will expect.
2. **WhatsApp Correspondence Integration is entirely absent.** No webhook, parser, or message-ingestion code anywhere in `src/`. `WhatsApp` exists only as a value inside `CommChannel`/`Source`/`TaskSource` enums for a human to select when manually logging an activity or task. None of §03's specific asks (auto-update CRM from chat content, auto-create tasks from WhatsApp-assigned action items, escalate on deal-status mentions) are implemented for WhatsApp specifically. (The *generic*, channel-agnostic overdue-task escalation — `src/server/services/tasks.ts` `escalated` auto-flip — is built and does satisfy one bullet of §03/§09 in spirit, just not tied to WhatsApp content.)
3. **Email/Outlook/M365/Teams integration is entirely absent.** `grep -rniE "outlook|microsoft-graph|office365|sharepoint"` across `src/` turns up nothing beyond the file-storage abstraction (item 4) and an unrelated free-email-provider blocklist. No mail capture, no calendar/Teams integration.
4. **SharePoint is a real, coded, but *inactive* drop-in — not yet a live integration.** `src/server/storage/sharepoint.ts` implements the full MS Graph upload/download/delete flow against a real tenant; `src/server/storage/provider.ts` switches to it only when `STORAGE_PROVIDER=sharepoint` **and** all 5 Azure AD env vars are set. Today the app runs on local-disk storage, live-verified end to end (`playwright assessment/file-storage-e2e.md`). This is good engineering (config-only cutover), but it is not yet "SharePoint" from the client's point of view until Noblestride provisions the Azure AD app.
5. **Client company financials remain sparse in seed/demo data**, which limits how much of §05's "post-NDA reveal" and §04's qualification-on-real-data can be demonstrated (not a code gap — a data-population gap, per the existing BUG-16).
6. **"Mandatory fields" from §07 are not enforced.** Zod create-schemas for `Client`/`Investor`/`Partner`/etc. require only `name` (+ `investorType` for Investor). Every other spec-mandated field (contact phone/email, sector profile, documents shared, deal type) is `.optional()` — a record can be saved with almost nothing in it. The data model has the fields; nothing stops them from being empty.
7. **Partner self-service portal is built but currently unreachable (a new regression, not previously flagged in any prior QA doc).** `src/app/portal/partner/**` (Overview / Submit Referral / My Details) is fully implemented and worked under the old demo-impersonation switcher, but the 2026-07-10 "drop the demo viewpoint lens" change (`9edc6f2`) removed that switcher along with all viewpoint impersonation. Real credential auth only recognizes `AccountKind.INTERNAL` and `AccountKind.INVESTOR` — there is no `PARTNER` value in `prisma/schema.prisma`'s `AccountKind` enum, and no partner-login code exists anywhere under `src/server/auth/`. The layout file says so itself: `src/app/portal/partner/layout.tsx:5-6` — *"Dormant: there is no partner login today (spec 2026-07-10 Task 3); this shell stays in place for when partner auth ships."* Net effect: a partner today has no way to reach their own referral view; the internal `/partners` CRM page (§06's main deliverable) is unaffected and fully live.
8. **Dashboard KPI reconciliation bug persists** (headline "Active Mandates"/"Active Transactions" counts don't match their own stage-breakdown sums; delta badges show the breakdown sum, not a real delta) — confirmed still reproducing as of the 2026-07-10 pass. Cosmetic/trust issue, not a missing-feature gap.

---

## 3. "Already agreed scope" (top-of-doc) — status

| # | Agreed item | Status | Evidence |
|---|---|---|---|
| 1 | Customized CRM & Deal Management System | ✅ Built | Full Prisma schema (30+ models), `/deals` unified queue, Kanban boards, dashboards, RBAC, audit trail |
| 2 | Client Agent | ❌ Not built (as an agent) — **note ambiguity** | No dedicated *ongoing* client-relationship automation beyond CRUD + the intake qualification engine. The doc lists "Client Agent" and "Website Intake & Qualification Agent" as two separate top-of-doc scope items, but the body only elaborates one section (§04, "Website Client Intake Agent") — it's unclear whether these were meant as the same deliverable stated twice, or whether "Client Agent" implies a broader ongoing client-engagement agent beyond initial intake. Scored conservatively (not built) here since no such ongoing-engagement automation exists; flag this for the client to disambiguate before treating it as a hard gap. |
| 3 | Investor Agent | 🟡 Partial | Real rule-based matching engine (`src/server/domain/ranking.ts`) exists and is invoked from a UI popover, but it is not an autonomous agent — it's a scoring function a user triggers |
| 4 | Investor Tracker Agent | ❌ Not built | Investor data (deployment status, criteria, NDA status) is 100% manual CRUD; no automated monitoring/refresh/staleness-detection beyond a static `criteriaVerifiedAt` "stale after 180 days" flag used only in match-score warnings |
| 5 | Referral / Partner Tracking Agent | 🟡 Partial | The *tracking system* (Partner model, referral rollups, conversion funnel, partner portal) is fully built and arguably exceeds the spec's field list — but there is no autonomous "agent" that ingests/triages referrals; it's manual entry via CRM/portal forms |
| 6 | WhatsApp Correspondence Integration | ❌ Not built | See gap #2 above |
| 7 | Website Intake & Qualification Agent | ✅ Built | `/intake` wizard + `qualifyIntake()` — real rule engine, not an LLM agent, but functionally matches the spec's requirements (collect fields, run qualification logic, route to manual review) |
| 8 | Investor Deal Visibility Capability | ✅ Built | Tiered visibility engine (`src/server/visibility/`), codename masking, field-level matrix, portal filters — the most complete deliverable in the whole build |

**3 of 8 solidly delivered, 2 partial (real underlying logic, no "agent" framing), 3 not built.**

---

## 4. Section-by-section detail

### §01 — Deal / Transaction Workflow

| Requirement | Status | Evidence | Note |
|---|---|---|---|
| How opportunities enter the business (8 channels) | ➖ | — | Describes the client's current sourcing channels, not a system feature. Captured as the `Source` enum (`MondayMeeting, WhatsApp, Email, Verbal, Referral, Inbound, Outreach, Event, Website, DirectEnquiry, Consultant, Investor, Partner, SocialMedia, InternalBusinessDev, Other`) on `Mandate`/`Client`/`Activity` — so the *data field* to record the channel exists (✅), even though capturing each channel automatically is ➖/❌ per §03/§08. |
| Intake data fields (10 categories: company profile, ownership, operations, financials, transaction overview, funding requirement, legal/compliance, investor materials, source, engagement details) | 🟡 | `Client` model (`prisma/schema.prisma:634-696`): `registrationNo`, `hqCountry`, `businessModel`, `ownershipStructure`, `directorsManagement`, `staffCount`, `branchCount`, `suppliers`, `competitors`, revenue/EBITDA/netProfit/existingDebt/loanBook/totalAssets, `auditedFinancialsYears`, `pitchDeckUrl`, `source` | Fields exist; not all are captured at `/intake` (e.g. shareholding structure detail, group structure, capacity utilization are schema fields but not wizard inputs — manual CRM entry only) |
| Qualification criteria (11 rules: 3yr ops, 3yr audited financials, profitable/EBITDA+, ≥$1M raise, SSA geography, excluded sectors, traction, management commitment, clean compliance, timeline) | ✅ | `src/server/domain/qualification.ts` — `qualifyIntake()` checks revenue ≥$1M, raise ≥$500K/$1M thresholds, ≥3 audited years, SSA geography (`SSA_GEOGRAPHIES`), restricted sectors (`RESTRICTED_SECTORS`), PEP/gov-ownership, EBITDA profitability, ≥3yr operating history | Management-commitment/traction/timeline-reasonableness are qualitative and correctly left to human review (➖ for those sub-items) |
| Rejection criteria (15 rules) | ✅ | Same engine — `Deprioritized` verdict with itemized `reasons[]` | Mirrors the qualification engine's negative space; matches almost 1:1 |
| Full 17-step transaction lifecycle | ✅ | `src/server/domain/journey.ts` `JOURNEY_TITLES` — 17 entries verbatim matching the scoping doc's Stage 1–17 titles (Sourcing & origination → Post-transaction monitoring); rendered as the "Deal Journey" spine on mandate/transaction detail pages, evidence-derived (no stored journey state) | Explicitly display-only/derived — not a separate stage-machine the user progresses manually, by design (`journey.ts` header) |
| Internal deal-update sharing mechanisms (Monday meetings, Excel tracker, 1:1s, email, WhatsApp, shared folders) | ➖ | — | Describes the client's current manual process; the CRM replaces the *tracker* function (dashboards, stage-change feed) but the meetings/1:1s themselves are ➖ |
| "Never automatic" list (10 items: no auto NDA signing, no auto onboarding, no auto lead→deal conversion, no auto accept/reject, no auto sharing confidential info, no auto VDR grant, no auto sharing with excluded investors/unlicensed partners, no auto external comms, no binding commitments) | ✅ | NDA guard (`src/server/domain/nda-guard.ts`) blocks stage moves without a signed NDA; `qualifyIntake()` verdict never surfaces to the applicant and never auto-creates an active deal (`submitIntake` always lands at Mandate/`NewLead`, unassigned); visibility engine blocks Excluded/Greylisted/OnHold/Inactive investors and ungated VDR docs (`tiers.ts`, `matrix.ts`) | Comprehensively matched — this is a design principle the codebase visibly organizes itself around |

### §02 — Investor Management & Matching

| Requirement | Status | Evidence | Note |
|---|---|---|---|
| ~25 investor tracking fields (sector/geo focus, ticket size, contacts incl. SSA contact, deployment status, instrument type, name/institution type, fund criteria/mandate, target return, stage pref, shareholding pref, EBITDA/revenue/loan-book thresholds, pricing pref, ESG focus, comms history, next-action date, feedback, NDA status, deals shared count, deals under review, pipeline stage, active term sheets, documents shared, past transactions, probability of closure) | ✅ | `Investor` model (`schema.prisma:543-612`): `sectorFocus`, `geographicFocus`, `ticketMin/Max`, `contacts`+`ssaRegionContact`, `status` (deployment), `instruments`, `investorType`, `investmentMandate`, `targetIrr`, `investmentStages`, `shareholdingPreference`, `minRevenue/minEbitda/minLoanBook`, `pricingPreference`, `esgFocus`, `nextActionDate`, `feedback`, `ndaStatus`; deals-shared/under-review/term-sheets derived from `Engagement` rows (`engagementStage`, `termSheetIssued`) | Exceeds 25 — also has `trackRecord`, `notableInvestments`, `portfolioComposition`, `reinvestmentPolicy`, `impactMetrics`, `reputationalRisks`, `criteriaVerifiedAt` (staleness), etc. |
| Matching criteria (sector, geography, funding size/capacity, instrument/facility type, fund status/availability, mandate/strategy, opportunity dynamics, relationship/point-person) | ✅ | `src/server/domain/ranking.ts` `investorMatchScore()` — weighted: sector 0.35, geography 0.25, ticket-fit 0.15, instrument 0.15, threshold 0.10, +0.10 bonus for `ActivelyDeploying`; contact resolution via `resolveContactName()` | Rule-based, not semantic/AI — explicit `// SEAM: replace body with Lua` marker in `ai.ts` for future upgrade |
| Poor-match causes (missing info, disregarded criteria, stale data, decentralized knowledge, comms gaps) | 🟡 | `criteriaStale` flag (>180 days since `criteriaVerifiedAt`) surfaces staleness as a warning in match results | "Decentralized knowledge"/"comms gaps" are organizational problems the CRM's centralization addresses structurally, not a specific feature (➖ for those) |
| "Internal only" info (investor contacts, active-engagement details, excluded/inactive funds, client data, investment criteria, consultant identities) | ✅ | Visibility matrix (`matrix.ts`) hard-codes `otherInvestors`, `engagementContracts`, `investorFeedbackOffers`, `internalMessages` as `"none"` at every tier; `advisorClientContacts` gated to DD tier only; consultant/partner identities never in any external projector (`project.ts` — `GENERIC_CONTACT_LINE` is the only contact string ever shown externally) | Tested table-driven in `__tests__/matrix.test.ts` |
| How investors are currently informed (email outreach, deal tracker summaries, calls/meetings, LinkedIn) | ➖ | — | Describes current manual process |

### §03 — WhatsApp Correspondence Integration

| Requirement | Status | Evidence | Note |
|---|---|---|---|
| Current WhatsApp usage (7 bullets) | ➖ | — | Describes the client's current operational use |
| Info that gets lost in chats | ➖ | — | Problem statement, not a requirement |
| What should auto-update the CRM (deal status, client/investor/transaction updates, action items, deal routing, pending-response tracking) | ❌ | No ingestion code found (`grep -rniE "whatsapp\|twilio"` across `src/` matches only enum display labels in `src/lib/vocab.ts` and a descriptive UI comment in `tasks/page.tsx`) | Zero automated capture from WhatsApp exists |
| Never-automate list (internal allocations, sensitive chats, investor-data routing to clients pre-introduction, advisor→Noblestride deal sharing, commercial discussions) | ➖/✅ (by absence) | The visibility engine already enforces "never share investor identity pre-introduction" and "consultant identity never to investors" regardless of channel | Since no WhatsApp automation exists at all, these guardrails are trivially satisfied — but that's because the feature isn't built, not because a guardrail was deliberately added for WhatsApp |
| Escalation triggers (overdue deadlines, deal-status change, WhatsApp-driven task creation, client/investor request tracking) | 🟡 | `Task.escalated` auto-flips true when an open task's `dueAt` passes (`src/server/services/tasks.ts`); `notify()` fires a `task_overdue`-kind notification; dashboard "Overdue actions" list (`overdueTasks()`) | Overdue-deadline escalation is real and channel-agnostic (✅ for that one bullet); WhatsApp-specific task auto-creation and 3-way-comms escalation are not built (❌) |

### §04 — Website Client Intake Agent

| Requirement | Status | Evidence | Note |
|---|---|---|---|
| Fields prospective clients must provide (profile, registration docs, contacts, 3-5yr audited financials, management accounts, 3yr revenue/profit, total assets, funding write-up, sector, loan book for FIs, signed NDA, other licenses) | 🟡 | `src/app/intake/intake-wizard.tsx` + `src/lib/schemas/intake.ts` collect: legal name, registration no., country, sectors, year founded, website, pitch-deck URL, contact, revenue/EBITDA/net profit/total assets, audited years, loan book (conditionally required for financial-services/banking sectors via `needsLoanBook()`), raise amount, instrument, use of funds, timeline, ownership summary, PEP/gov-owned flags, existing debt | No document upload at intake (registration docs, audited statements, NDA) — UI text defers these to "after initial review"; this is arguably the correct MVP choice but is a literal gap vs. the doc's field list |
| Lead qualification rule (profitable, ≥3yr audited, ≥$1M revenue, ≥$1M funding need, growth-oriented use of funds, acceptable sector, SSA, aligned model) | ✅ | `qualifyIntake()` — see §01 detail | Same engine, reused |
| Post-qualification actions (assign deal lead, schedule intro call, NDA, review financials, assess criteria, engagement contract, move to formal process, hold in open queue until manual assignment) | 🟡 | `submitIntake()` always creates a `Mandate` at `NewLead` with `leadId: null`, `qualificationVerdict` attached but never shown to the applicant, and notifies all Admins (`notify(adminUserIds(), {kind:"new_intake"...})`) | Matches "hold in open queue until manual assignment" exactly; the subsequent steps (NDA, intro call, engagement contract) are existing manual CRM workflows, not intake-specific automation — correctly so per the doc's own "never automatic" rule in §01 |
| Leads to deprioritize/reject (8 criteria) | ✅ | Same `qualifyIntake()` engine | |

### §05 — Investor Deal Visibility Capability

| Requirement | Status | Evidence | Note |
|---|---|---|---|
| What investors should see (limited overview → operational indicators → tracking docs → full financials post-engagement → IM/financial model → DD files/status/contacts) | ✅ | `src/server/visibility/matrix.ts` `FIELD_MATRIX` + `tiers.ts` — 4-tier model (`NONE/PRE_INTEREST/AFTER_NDA/DD`) exactly implementing this progressive disclosure; `project.ts` `projectDealForInvestor()` | Table-driven, unit-tested (`__tests__/matrix.test.ts`, `__tests__/project.test.ts`) |
| What should stay internal (engagement contracts, other investors, investor feedback/offers/client responses, deep company data pre-DD, VDR pre-interest, internal team messages) | ✅ | `NEVER_VISIBLE_GROUPS`/`HARD_RULE_NEVER_VISIBLE` in `matrix.ts`; VDR docs gated `on-request` = hidden until `DD` tier **and** NDA satisfied (`project.ts:231`) | Also fixed since the last QA pass: document *titles* are now masked at PRE_INTEREST (`project.ts:241`, `doc-type label — codename`), closing the previously-reported identity leak |
| Investor filters (country, sector, ticket size/deal type/facility type, financial indicators, impact/women-led/youth-led) | ✅ | `src/server/visibility/filters.ts` `OpportunityFilters` — sector, country, dealType, instrument, ticket min/max, revenue/EBITDA/net-profit min/max, womenLed/youthLed booleans; UI in `src/components/portal/opportunity-filters.tsx` (now with searchable multi-select, verified 2026-07-10) | All 5 requested filter categories present, plus more granularity (separate min/max on 3 financial metrics) |
| Visibility differing by investor type | ✅ | `discoverableDealsForInvestor()` (`project.ts:435`) applies the same sector/geo/ticket discovery rule to every `Active` investor regardless of type — matching the doc's "should not be siloed by type, but back-end can deactivate unengaged investors" — `engagementClassification` (`Excluded/Greylisted/Inactive/OnHold`) is exactly that back-end control | Matches the doc's own "contrasting views" resolution: no type-based hard wall, but classification-based back-end gating |

### §06 — Referral & Partner Tracking

| Requirement | Status | Evidence | Note |
|---|---|---|---|
| Referral fields (originator, fee-sharing details, target-company contacts, referral source, partner contact details incl. advisor type, deals introduced, deal status) | ✅ | `Partner` model: `advisorType`, `organization`, `email`, `phone`, `feeSharingAgreement`, `feeSharingTerms`, `partnerAgreementStatus`; `Mandate.referredById`/`Transaction.referredById` link deals to partner; `Person` contacts link to `Partner` | |
| Current tracking method (Excel trackers, admin-consolidated) | ➖ | — | Describes current manual process |
| Referral reporting (quality/qualified-lead tracking, deal status visibility, current stage, partner performance/conversion, fee-sharing/payment status, NDA/agreement compliance, engagement feedback) | 🟡 | `Mandate.referralQualified` (Boolean) + `qualificationVerdict`; `partnerReferralStats()`/`partnerConversionFunnel()` (`dashboard.ts`) — introduced→progressed→won/lost per partner; `Partner.feeSharingAgreement`/`partnerAgreementStatus`; `Partner.feedbackNotes` | Dashboard "Referral Conversion" panel surfaces this to the internal team today. **Gap 1:** `Partner` has no NDA-status field distinct from `partnerAgreementStatus` — the doc specifically asks for "NDA status" alongside "partner agreement status" as two separate compliance checks; only the latter is modeled. **Gap 2:** the partner-facing self-service view of this same reporting (`src/app/portal/partner/page.tsx`) is built but currently unreachable — see ranked gap #7 |

### §07 — CRM & Data Structure

| Requirement | Status | Evidence | Note |
|---|---|---|---|
| Core entities (deals/target companies, investors, clients, team/allocations, tasks, partners) | ✅ | `Mandate`/`Transaction`, `Investor`, `Client`, `User` (leadId/ownerId relations), `Task`, `Partner` — all present with rich relations | |
| Mandatory fields (Client: name/contact/position/docs; Investor: name/contact/sector profile; Deals: type; Partners: name/contacts; Internal: lead+assistant) | 🟡 | `src/lib/schemas/client.ts`, `investor.ts` — only `name` (+`investorType` on Investor) is `.min(1)`-required; every other field including contact phone/email is `.optional()` | The DB *columns* and relations for every mandated field exist; nothing at the schema/validation layer enforces them being populated — consistent with the observed BUG-16 (empty client financials) |
| Pipeline & stage tracking (Origination→Screening→NDA→Teaser/IM→Financial Model→Outreach→Offers→DD→Closing) | ✅ | `EngagementStage` enum (`Shared, TeaserSent, NDASigned, IMShared, VDRAccess, Meeting, InfoRequest, DueDiligence, TermSheet, Offer, Invested, Declined`) tracks the investor-facing pipeline almost 1:1 with this list; `MandateStage`/`TransactionStage` track the internal client-acquisition/execution pipelines separately; the 17-step Journey (§01) overlays the full lifecycle view | |
| Tagging/classification (sector, ticket size, investor type, deal status, priority) | ✅ | `Sector[]`, ticket-band bucketing (`lib/ticket-bands.ts`), `InvestorType`, `DealStatus`, `Priority` all present and filterable | |
| Reporting/analytics layer | ✅ | `src/server/services/dashboard.ts` — 15+ distinct dashboard queries (see §07 dashboards row below) | |
| Record relationships (uniformity, 1-deal-1-comms-universe, 3-way client/investor/partner matching, investor-deal mapping, client/sector/funding/investor linkage, partner referral tracking) | ✅ | `Activity` anchors to `engagementId`/`transactionId`/`mandateId`/`clientId`/`investorId` (one activity, multiple optional anchors — supports the "1 deal = 1 comms universe" model); `Engagement` = investor×transaction join; `Mandate.referredById`/`Transaction.referredById` = partner link | |
| Immutable/auditable (core-record identifiers with history + responsible user; deal creation/source/ID; investor interest records; full stage-change history w/ timestamps+user) | ✅ | `StageChange` model — append-only, one row per actual value change, `changedById`/`createdSource` captured (`src/server/services/stage-history.ts` `recordStageChange()` — no-ops unless the value actually changed); covers `stage`, `dealStatus`, `engagementStage`, `dealMilestone`, `name`, `registrationNo`, `primaryContact` | Verified by `__tests__/immutability.smoke.test.ts` and `identifier-audit.smoke.test.ts` (not re-read line-by-line this pass, but present and named exactly for this purpose) |
| Operational dashboards (13 requested: active/inactive counts, by-lead, by-type, status distribution, by-sector, by-partner, by-ticket-size, conversion metrics, investor-review status, rejected/invested summaries, historical engagement) | ✅ | `dashboardStats()`, `pipelineOverview()`, `pipelineBreakdowns()` (by-lead/sector/financingType/ticketBand), `pipelineActiveSplit()`, `partnerConversionFunnel()`, `investorEngagementRollup()`, `investedSummary()`, `historicalEngagementSummary()`, `disbursementByPeriod()`, `teamWorkload()`, `taskStatusByOwner()` — all in `src/server/services/dashboard.ts` | Comprehensive; one known reconciliation bug (headline KPI vs. breakdown-sum mismatch) persists as of 2026-07-10, cosmetic not structural |

### §08 — Systems & Integrations

| Requirement | Status | Evidence | Note |
|---|---|---|---|
| Systems currently used (O365, SharePoint, Outlook, Excel, PowerPoint, Teams, WhatsApp, LinkedIn, browsers, Google Meet, Zoom, MS To Do) | ➖ | — | Inventory of the client's current tools, not a build requirement per se |
| Who coordinates system access | ➖ | — | Organizational/staffing question |
| API/admin access availability | ➖ | — | Client-side procurement question, unverifiable from code |
| Compliance/security restrictions (confidentiality, Kenya DPA 2019, access rights, secure storage, downtime mgmt) | 🟡 | Password hashing + rate-limited login + DB sessions (`src/server/auth/`); RBAC (`src/server/rbac/matrix.ts`); document access-level gating (`DocumentAccessLevel`); visibility engine hard rules | No explicit DPA-2019 compliance controls (data-retention policy, breach-notification workflow, data residency) found or expected at this build stage — reasonable to mark unverified/organizational rather than a code gap |

**Integration reality check** (the concrete, checkable part of §08):
- **SharePoint / file storage:** ✅ built (local-disk live; SharePoint provider fully coded against MS Graph, config-gated on Azure AD credentials — `src/server/storage/{provider,sharepoint,local}.ts`).
- **Outlook / Email (M365):** ❌ not found anywhere in `src/`.
- **Teams:** ❌ not found.
- **WhatsApp:** ❌ not found (see §03).
- **LinkedIn:** ➖ (client's own outreach channel; not a system integration ask).

### §09 — Implementation Priorities & Success Criteria

| Requirement | Status | Evidence | Note |
|---|---|---|---|
| "Successful implementation" description (easy to use, reduces manual work, smooth workflow, auto task assignment from WhatsApp/email, syncs comms into CRM, access controls) | ➖/🟡 | Access controls (✅, RBAC + visibility engine); WhatsApp/email comms sync (❌, §03/§08); the rest is a qualitative success narrative | |
| Risks to account for (10 items: data protection, sensitivity, breach, backup, downtime, agent/system performance, incorrect matching, incorrect task assignment, over-automation, compliance) | 🟡 | "Incorrect matching" mitigated by the deterministic, explainable scoring in `ranking.ts` (score + reasons + warnings, not a black box); "over-automation" mitigated by the NDA guard + never-auto-verdict pattern seen throughout | Backup/downtime/breach-response are infra/ops concerns outside this codebase's scope to demonstrate |

### §10 — Supporting Materials & Next Steps

➖ — entirely about the client sharing spreadsheets/trackers/templates with the implementer and the SOW finalization process. Not a system requirement.

---

## 5. Where prior assessment-folder claims disagreed with current code

| Prior claim (2026-07-07 unless noted) | Current code finding |
|---|---|
| BUG-01 (P1): pre-interest document titles leak the real client name | **Fixed.** `src/server/visibility/project.ts:241` masks the document label to `"{DocumentType label} — {codename}"` when `tier === "PRE_INTEREST"`. |
| BLOCKER-A: "any password works," unrestricted impersonation switcher | **Resolved in two steps.** Real credential auth + sessions shipped 2026-07-08 (`2026-07-08-real-auth-verification.md` — 11/11 flows pass, GraphQL RBAC bypass closed). The impersonation/viewpoint switcher itself was then **fully removed** 2026-07-10 (`2026-07-10-role-cleanup-and-filters-verification.md` item 3; confirmed via `git status` showing the switcher components deleted and `topbar.tsx` clean of viewpoint code). |
| BLOCKER-C: "documents are display-only metadata rows — no upload, download, or file storage anywhere" | **Outdated.** Real upload/download/versioning/delete against local disk, live-verified end-to-end (`file-storage-e2e.md`, all 7 scenarios pass, including a 403 confidentiality check on an Internal doc from the investor lens). SharePoint provider is real MS Graph code, gated only on config/credentials, not a stub. |
| BLOCKER-D: "website intake agent built for the wrong actor" (only investor `/register` existed, no company-side intake) | **Resolved.** `/intake` (company-side wizard) + `qualifyIntake()` now exist and implement the §04 ruleset. `/register` (investor onboarding) still exists separately and correctly serves a different purpose (§05's investor-side access, not §04's client intake). |
| 03-COVERAGE-MAP.md: "§8 4 agents ➖ Not built (BLOCKER-C)" | **Still accurate** — confirmed independently this pass via the explicit SEAM comments in `ai.ts` and an absence of WhatsApp/Outlook code. No disagreement. |

---

## 6. Honest overall assessment

The scoping document describes two things that got built to very different degrees:

1. **A CRM/data-structure/visibility platform** — the majority of §01, §02, §05, §06, §07's substance. This is **strongly conformant**: the entity model is richer than the doc's field lists in most places, the 17-step lifecycle and confidentiality tiering are implemented close to verbatim, the investor-matching and intake-qualification logic are real (deterministic, explainable, tested) rule engines rather than decorative, and the guardrails against auto-committing the firm (NDA gates, human-only verdicts, no auto-share to excluded parties) are a genuine architectural throughline, not an afterthought.
2. **The channel/agent layer** — §03 (WhatsApp), most of §08 (Outlook/Teams/SharePoint-as-live-integration), and the 4 named "Agents" from the top-of-doc scope list. This is **the real shortfall**: WhatsApp and Email/Outlook integration have zero code; the four Agents are explicitly-marked-as-deferred rule/data functions, not autonomous agents; only the file-storage/SharePoint piece has a genuine (if inactive) integration built.

If the client's mental model of "AI Operations Implementation" centers on the 4 named agents and WhatsApp — the document's own title — then a large, clearly-scoped piece of the agreed work is still ahead. If it centers on "a CRM that encodes our deal process, investor database, and confidentiality rules correctly" — which is most of the document's actual page count — that work is close to done and, based on this review, is the stronger half of the build by a wide margin.
