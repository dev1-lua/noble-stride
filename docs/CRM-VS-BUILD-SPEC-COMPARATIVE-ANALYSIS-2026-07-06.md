# NobleStride CRM vs Build Specification — Full Comparative Analysis

**Date:** 2026-07-06
**Spec compared:** `decrypted/Lua x Noblestride - Build Specification (INTERNAL).pdf` — v2.0, 1 June 2026, 29 pages, read end-to-end (identical content to `docs/SOW.md`). Every table in the PDF is covered below: the entity catalogue (§2), all 11 data-dictionary tables (§3.1–3.11), all 16 picklists (§4.1–4.16), the sector taxonomy (§5), the milestone framework (§6, 3 tables), the access matrix (§7.2), the 4 agent specs (§8), the WhatsApp mapping (§9), intake + qualification (§10.1/10.2), the visibility matrix (§11), guardrails/escalation (§12), dashboards (§13), integrations (§14) and deliverables (§15).
**Build compared:** `noblestride-crm/` on branch `feat/InvestorOnboarding` (HEAD `3f5c145`). All claims verified against code with `file:line` evidence via four parallel audits (data model & picklists · UI & dashboards · access & visibility · agents & integrations), spot-checked against `prisma/schema.prisma` directly.
**Supersedes** `docs/CRM-COMPARATIVE-ANALYSIS-2026-07-03.md` for spec-vs-build status (that doc's three-way concept-note comparison remains valid).

**Legend:** ✅ DONE · 🟡 PARTIAL (halfway — data or UI exists but incomplete/mismatched) · ❌ MISSING · ➖ Not committed scope (optional add-on per spec)

---

## 0. Executive summary — scorecard by spec section

| Spec section | Verdict | One-line status |
|---|---|---|
| §2 Entity catalogue (11 entities) | 🟡 | 9 of 11 built as models (Advisory ➖ optional; Communication substituted by a narrower `Activity`) |
| §3 Data dictionary | 🟡 | Investor-Deal Engagement (§3.11) is a near-exact match; Investor (§3.4) strong; Company (§3.1) and Deal (§3.2) have large field gaps; Task read-only |
| §4 Picklists (16 lists) | 🟡 | 5 exact matches, 6 partial, 5 missing — Deal type/status/milestone vocabularies are the big misses |
| §5 Sector taxonomy | 🟡 | 15/18 top-level sectors exact; Energy narrowed, "Retail &" dropped, extra `Banking`; **sub-sectors entirely absent** |
| §6 Milestones | 🟡 | All 14 investor-side milestones encoded + portal steppers; but milestone rows are backfill-only (no write path), doc-prep conditionality label-only, post-transaction monitoring absent |
| §7 Audit / access control | ❌ | **Largest gap.** No audit trail, no stage history, no field immutability, RBAC display-only, auth is a demo cookie lens |
| §8 Four agents | ❌ | 0 of 4 built; `ai.ts` holds read-only heuristic stubs with `SEAM` comments |
| §9 WhatsApp integration | ❌ | Nothing beyond a manual "WhatsApp" source tag |
| §10 Website intake & qualification | ❌ | `/register` is **investor** self-registration; the spec's **company** intake form + qualification rules don't exist |
| §11 Investor deal visibility | ✅/🟡 | **Best-covered deliverable.** Visibility engine implements the matrix, hard rules and classification blocking with 200+ tests; investor-facing filter UI (§11.1) missing |
| §12 Guardrails / escalation | 🟡/❌ | Structural guards exist where features exist (NDA guard, onboarding gate); **all §12.2 escalation triggers missing** |
| §13 Dashboards (7 views) | 🟡 | Disbursement + referrals strong; pipeline groupings, stage history, team-workload and year/quarter views missing |
| §14 Integrations | ❌ | 0/5 (WhatsApp, Outlook, Slack, website, SharePoint/file storage) |
| §15 Deliverables | 🟡 | CRM + visibility delivered; agents/integrations/intake not started; RBAC/DPA config missing |

**The shape of the gap:** the *data core* (entities, engagement pipeline, visibility) is genuinely strong — several picklists match the spec character-for-character. The shortfall concentrates in (a) **vocabularies** the spec fixed but the build re-themed (deal type/stage/status), (b) **field completeness** on Company and Deal, (c) **operational plumbing** (tasks CRUD, escalation, audit trail, dashboards groupings), and (d) **everything channel-facing** (agents, WhatsApp, email, website intake, files).

---

## 1. Scope at a glance (§1.2 — 9 components)

| # | Component | Status | Evidence / notes |
|---|---|---|---|
| 1 | CRM & Deal Management | 🟡 | 11-entity Prisma schema + CRUD UI for most entities; audit trails missing (see §7) |
| 2 | Client Agent | ❌ | Not built (`src/server/services/ai.ts` has no client-correspondence logic) |
| 3 | Investor Agent | ❌ | Not built; only heuristic `aiMatchInvestors` (ai.ts:16–54) overlaps its "surface fits" duty |
| 4 | Investor Tracker Agent | 🟡 | The *data + guard layer* it would drive exists (Engagement stages, NDA guard, disbursement); no agent, no scheduled checks, no stall flags |
| 5 | Referral / Partner Tracking Agent | 🟡 | Manual equivalent: partner portal referral form creates real Mandates (`submit-referral.ts:39-92`); no agent/channel capture |
| 6 | WhatsApp Integration | ❌ | No webhook/API client anywhere (grep: 2 hits, both picklist labels) |
| 7 | Website Intake & Qualification Agent | ❌ | Company intake + qualification logic absent; `/register` serves investors instead |
| 8 | Investor Deal Visibility | ✅ | `src/server/visibility/` — tiers, field matrix, codenames, NDA-gated VDR docs, classification blocking |
| 9 | Reporting & Dashboards | 🟡 | See §13 breakdown |

---

## 2. Entity catalogue (§2)

| Spec entity | Built as | Status | Notes |
|---|---|---|---|
| Company / Target | `Client` | 🟡 | Central-anchor role holds (mandates/transactions/tasks/documents link back); many fields missing (§3.1) |
| Deal / Mandate | `Mandate` **+** `Transaction` | 🟡 | Spec's one entity split into client-acquisition + fundraising-execution pipelines; stage/status vocab diverges (§4.4/§4.5) |
| Advisory Engagement | — | ➖ | Optional add-on, correctly not built pending discovery (spec §3.3, §19.2) |
| Investor | `Investor` | ✅ | Fullest entity; onboarding + NDA fields added on this branch |
| Investor Contact | `Person` | 🟡 | Model complete (flags incl. SSA/primary); **no create/edit UI anywhere** |
| Referral / Partner | `Partner` | ✅ | Fee-sharing, advisor type, agreement status, internal-only default true |
| Service Provider | `ServiceProvider` | 🟡 | Model + GraphQL mutations complete; **zero UI surface, no nav entry** |
| Task | `Task` | 🟡 | Model exists, 387 real rows imported; **entirely read-only** (no schema/input/mutation/drawer), fields missing |
| Document | `Document` | 🟡 | Register + access levels + review chain; File = optional URL, no upload |
| Communication | `Activity` | 🟡 | Timeline log exists; no channel/direction fields, no client link, write path requires Transaction+Investor pair |
| Investor-Deal Engagement | `Engagement` | ✅ | Near-exact §3.11 match incl. derived year/quarter and amount-pending |

**Relationship rules (§2.1):** deal→company anchoring ✅ (required `clientId` on both pipelines); one-deal-one-communication-universe 🟡 (Activity can't link to Client at all); investor-deal links via Engagement ✅; company holding both deal types ➖ (no advisory); partner internal-only ✅ (`internalOnly @default(true)`, never projected to investors).

---

## 3. Data dictionary (§3.1–§3.11) — field-by-field

### 3.1 Company / Target → `Client` (schema.prisma:462–490) — weakest entity

| Spec field (Req) | Status | Notes |
|---|---|---|
| Company ID (Y) | ✅ | cuid |
| **Project codename (Y)** | ❌ | Single `name` field serves both codename and legal name — spec keeps them separate for confidentiality; the visibility engine generates display codenames on the fly (`visibility/codename.ts`) but nothing is stored |
| Legal name (Y) | 🟡 | `name` (required in zod) but not distinct from codename |
| Registration no. | ❌ | No field |
| Year founded | ✅ | `yearFounded` |
| **HQ city / country (Y)** | 🟡 | `hqCity` only — no country; optional |
| Countries of operations | 🟡 | `countries Geography[]` — regional buckets (EastAfrica…), not countries |
| **Sector (Y)** | 🟡 | Multi-select array vs spec single-select; optional |
| Sub-sector | ❌ | No taxonomy anywhere (see §5) |
| **Core product / service (Y)** | 🟡 | Present, optional |
| **Description (Y)** | 🟡 | Present, optional |
| Business model | ❌ | No field |
| Founders, gender | 🟡 | Single-select `FounderGender` enum vs spec multi |
| Founders, nationality | ❌ | Only free-text `founders` (names) |
| Ownership / shareholding | ❌ | No field |
| Directors / management | ❌ | No field |
| Target clients | ❌ | No field |
| Years of operation | ❌ | Not stored or derived |
| Staff / branches | ❌ | No field |
| Last year revenue (USD) | ✅ | `revenueLastYear` |
| Revenue forecast (USD) | ✅ | `revenueForecast` |
| EBITDA / net profit | ❌ | Only `profitable Boolean?` |
| Profitability | 🟡 | Boolean vs spec picklist |
| Existing debt | ❌ | No field |
| Loan book (FIs) | ❌ | No field |
| Total assets | ❌ | No field |
| **Primary contact (Y)** | 🟡 | Modeled as `Person.isPrimaryContact` flag; **no UI to create/edit client contacts** |
| Website / social | 🟡 | Website only |
| **Origination source (Y)** | 🟡 | `source Source?` optional; value-set mismatch (§4.6) |
| Impact flags (women-led / youth-led) | ❌ | Absent — this also blocks the §11.1 impact filter |
| **Status (Y)** | ❌ | No Active/Prospect/Archived field at all |

**Count: 5 ✅ · 10 🟡 · 16 ❌ of 31 fields.**

### 3.2 Deal / Mandate → `Mandate` (496–531) + `Transaction` (537–572)

| Spec field (Req) | Status | Notes |
|---|---|---|
| Deal ID (Y) | ✅ | cuid on both |
| Project (Y) | ✅ | `name` |
| Company (Y) | ✅ | Required `clientId` on both |
| **Deal type (Y)** — Debt/Equity/Equity & Debt | ❌ | `DealType` enum was **repurposed** to round names (SeriesA/SeriesB/Growth/Expansion/AcquisitionFinance, schema:145-151); spec's 3 values absent; nothing on Mandate |
| Instrument | 🟡 | `Instrument[]` on Transaction (multi vs single); `Convertible` replaces spec's `Hybrid` |
| Target profile | ❌ | No field |
| Max selling stake (§4.7) | ❌ | No field/enum |
| **Ticket size USD Mn (Y)** | 🟡 | `Mandate.dealSize` / `Transaction.targetRaise`, both optional |
| Use of funds | ❌ | No field |
| **Sector (Y, inherited)** | 🟡 | Multi array, optional, no inherit-from-company logic |
| **Status (Y)** — Open/On Hold/Closed/Dropped/Closed & Reopened/Closed & On Hold | ❌ | No status field distinct from stage on either model |
| **Deal stage (Y)** (§4.4) | 🟡 | `MandateStage`/`TransactionStage` are generic sales stages; only DD/Term Sheet/Closed overlap spec's document-driven list |
| Deal milestone (§4.3) | ❌ | No deal-level milestone field (`MilestoneKey` is the investor-engagement cycle) |
| **Deal lead (Y)** | 🟡 | `Mandate.leadId` / `Transaction.ownerId`, optional |
| Deal assistant | ❌ | No field |
| Consultant / referrer | 🟡 | `Mandate.referredById → Partner` ✅; absent on Transaction |
| **Date onboarded (Y, immutable)** | 🟡 | `dateOpened` optional; no immutability enforcement |
| **Source (Y)** | 🟡 | Mandate only, optional |
| Teaser / IM / Model (Not started/Draft/Done) | 🟡 | No stored tri-state; derived live from the Document register (deal-prep checklist, milestones.ts:89-95) — a reasonable substitute but not the spec picklists |
| VDR (link) | ❌ | Only `DocumentAccessLevel.VDR` on individual docs |
| Probability of closure | ❌ | Deal-level absent (exists per-investor on Engagement) |
| Comments | 🟡 | `Mandate.notes`; nothing on Transaction |

### 3.3 Advisory Engagement — ➖ entirely unbuilt, **correctly**: spec marks it optional, not committed PoC scope (§3.3, §17 item 1, §19.2). All 12 fields + picklists §4.8/§4.9 pending client confirmation.

### 3.4 Investor → `Investor` (391–456) — strong

| Spec field (Req) | Status | Notes |
|---|---|---|
| Investor ID (Y) | ✅ | |
| Firm / fund name (Y) | ✅ | Required |
| **Institution type (Y)** | 🟡 | All 7 spec values present (DebtProvider≈Lender) + 3 extras (Angel, CorporateVC, GrantDonor) |
| Website | ✅ | |
| **Sector focus (Y)** | 🟡 | Present; required only in registration flow, optional in admin path |
| **Geographic focus (Y)** | 🟡 | Present, optional; regional buckets |
| Country restrictions | ✅ | |
| **Ticket min/max (Y)** | 🟡 | Present, optional |
| **Instruments (Y)** | 🟡 | Present, optional; Hybrid missing |
| **Deployment status (Y)** (§4.13) | 🟡 | Vocabulary reworked to fund lifecycle (ActivelyDeploying/Fundraising/FinalClose/FullyDeployed/Dormant) — spec's "Not deploying"/"On hold" absent |
| Investment mandate | ✅ | |
| Stage preference | 🟡 | Multi `investmentStages[]` vs single picklist |
| Target return / IRR | 🟡 | `Float` vs spec Text |
| Shareholding preference | 🟡 | Free text vs Minority/Majority picklist |
| Min EBITDA / revenue / loan-book | ✅ | Three distinct currency fields (superset) |
| Pricing preference | ✅ | |
| ESG / impact focus | ✅ | |
| Current fund size / deployable | ✅ | `aum` |
| Remaining investment period | ✅ | |
| DD requirements / timeline | ✅ | |
| IC / approval process | ✅ | |
| Track record | ✅ | Superset: + notableInvestments, portfolioComposition, caseStudies |
| **NDA status (Y)** | 🟡 | `InvestorNdaStatus{None,OpenNDA,ClosedNDA}` exact values; field defaulted, not required-at-entry |
| **Engagement classification (Y)** | 🟡 | Exact §4.14 values; drives visibility ✅ |
| Next action date | 🟡 | Schema + GraphQL only — **no UI to set it** |
| Feedback | 🟡 | Same — data layer only |
| SSA-region contact | 🟡 | Same — data layer only |

### 3.5 Investor Contact → `Person` (359–385)

| Spec field (Req) | Status | Notes |
|---|---|---|
| Contact ID (Y) | ✅ | |
| Investor lookup (Y) | ✅ | Nullable FK (Person shared across Client/Investor/Partner) |
| Name (Y) | 🟡 | first/last split |
| Role | 🟡 | `jobTitle` |
| **Email (Y)** | 🟡 | Nullable; corporate-email (no Gmail/Yahoo) check ✅ implemented in registration (`src/lib/corporate-email.ts`) — the spec's §3.5 note |
| **Phone (Y)** | 🟡 | Nullable; OTP use is demo-only (static `000000`) |
| Primary contact | ✅ | `isPrimaryContact` |
| SSA contact | ✅ | `isSSAContact` |
| **CRUD** | ❌ | No person form drawer, no create/update mutation call sites — contacts render read-only everywhere; only self-registration and the investor Fund Profile page write them |

### 3.6 Referral / Partner → `Partner` (641–669)

| Spec field (Req) | Status | Notes |
|---|---|---|
| Partner ID (Y) | ✅ | |
| Name (Y) | ✅ | Required |
| Advisor type | ✅ | Exact 6-value enum match |
| Organization | 🟡 | In schema, **not in the form drawer** |
| **Email (Y) / Phone (Y)** | 🟡 | In schema, optional, **not in the form drawer** |
| Fee-sharing agreement + terms | ✅ | Boolean + conditional long-text, in drawer |
| NDA / partner agreement | ✅ | `PartnerAgreementStatus{None,Sent,Signed}` exact |
| Deals introduced (multi) | 🟡 | Only settable from the Mandate side (`referredById`); referral-form contact info lands as free text in `Mandate.notes` |
| Internal-only (Y, default true) | ✅ | `@default(true)`; never projected to investors |
| Status | 🟡 | Extra `Preferred` value |

### 3.7 Service Provider → `ServiceProvider` (732–750)

All 9 fields ✅ at data layer (type enum exact 6-value match; status is free text vs picklist 🟡). **But: no UI page, no form drawer, no sidebar entry — mutations exist with zero call sites.** Effectively invisible to users. ❌ on UI.

### 3.8 Task → `Task` (704–726) — biggest small-entity gap

| Spec field (Req) | Status | Notes |
|---|---|---|
| Task ID (Y) | ✅ | |
| **Linked record (Y)** | 🟡 | 4 optional FKs (mandate/transaction/investor/client); unlinked tasks possible |
| **Action point (Y)** | ✅ | `title` |
| **Source (Y)** (§4.12) | ❌ | No field at all |
| **Status (Y)** | 🟡 | `Dropped` missing from enum |
| Deadline | ✅ | `dueAt` |
| **Owner (Y)** | 🟡 | `assigneeId` optional |
| Assistant | ❌ | No field |
| Notes | ✅ | `body` |
| **Escalation flag (Auto)** | ❌ | No field; zero overdue/escalation logic in the codebase |
| **CRUD** | ❌ | No zod schema, no GraphQL input/mutation, no drawer — tasks exist only via import/seed; `/tasks` page is a read-only table |

### 3.9 Document → `Document` (757–788)

| Spec field (Req) | Status | Notes |
|---|---|---|
| Document ID (Y) | ✅ | |
| **Linked record (Y)** | 🟡 | transaction/client/investor optional FKs; **no Mandate link**; none required |
| **Type (Y)** | ✅ | All 14 spec values + `BusinessPlan` extra |
| Version | ✅ | |
| **Access level (Y)** | ✅ | Exact §4.16 enum; enforced by the visibility engine for external roles |
| Status | ✅ | Exact 5-value enum; + review chain (reviewer → approver → client review) beyond spec |
| **File (Y)** | 🟡 | Optional `fileUrl` text — **no upload/storage anywhere** (`<TextField label="File URL">`, document-form-drawer.tsx:66) |
| Uploaded by / date (Y, Auto) | 🟡 | Fields exist; uploader not auto-populated (no auth identity) |

### 3.10 Communication → `Activity` (675–698)

| Spec field (Req) | Status | Notes |
|---|---|---|
| Comm ID (Y) | ✅ | |
| **Channel (Y)** — WhatsApp/Email/Slack/Web chat/Call/Meeting | ❌ | `InteractionType` conflates channel with engagement-event type; WhatsApp/Slack/Web chat absent |
| **Linked record (Y)** | 🟡 | engagement/transaction/investor/mandate FKs; **no clientId** — can't log against a company |
| Direction | ❌ | No field |
| **Summary (Y)** | 🟡 | `subject`/`body`, optional |
| Extracted action items | ❌ | No Activity↔Task relation |
| **Timestamp (Y)** | ✅ | `occurredAt` |
| **Logged by (Y)** | 🟡 | `createdSource` always set; `createdById` never populated by the live write path (engagements.ts:150-166) |
| **Write path** | 🟡 | Single mutation `logEngagement` requires **both** transactionId AND investorId — no company-only or mandate-only logging |

### 3.11 Investor-Deal Engagement → `Engagement` (578–617) — **best entity in the build**

All 15 spec fields ✅: link ID, investor+deal lookups, 12-value engagement stage (exact §3.11 order Shared→Declined), interest level (exact), NDA type (exact), term sheet boolean + date, total/disbursed/pending (pending auto-derived), engagement status (`DisbursementStatus` exact §4.10), date received, year/quarter (auto-derived, engagements-crud.ts:8-13), probability, feedback.
Two caveats: 🟡 UI edits only `engagementStage` (restage dropdown + NDA record buttons) — interest level, amounts, probability, feedback have no edit surface; 🟡 a legacy second `status: EngagementStatus` field (NotContacted…Committed) overlaps confusingly.

---

## 4. Picklist library (§4.1–§4.16)

| § | Picklist | Status | Detail |
|---|---|---|---|
| 4.1 | Deal type (Debt; Equity; Equity & Debt) | ❌ | `DealType` holds round names instead — none of the 3 spec values exist |
| 4.2 | Instrument (Debt; Equity; Mezzanine; Grant; Hybrid) | 🟡 | 4/5 exact; `Hybrid` missing, extra `Convertible` |
| 4.3 | Deal milestone (Term Sheet; NBO; Loan Agreement; SPA/SHA; DD; IC; TA; Closed) | ❌ | No deal-level milestone enum/field |
| 4.4 | Deal stage (Indicative TS → Closed, 9 values) | 🟡 | Replaced by generic `MandateStage`/`TransactionStage`; ~3 concepts overlap |
| 4.5 | Deal status (Open; On Hold; Closed; Closed & Reopened; Closed & On Hold; Dropped) | ❌ | No status field exists |
| 4.6 | Origination source (9 values) | 🟡 | Referral/Website ✅; Event≈Networking event; Consultant/Investor/Partner/Direct enquiry/Social media/Internal BD ❌; enum polluted with Task-source values (MondayMeeting, Verbal) |
| 4.7 | Max selling stake (Minority; Majority; Full Sale; N/A) | ❌ | Nothing |
| 4.8 | Advisory project type | ➖ | Advisory not in scope |
| 4.9 | Advisory project milestone | ➖ | Advisory not in scope |
| 4.10 | Engagement status (Disbursed; Ongoing; Fell off; Dropped) | ✅ | Exact match |
| 4.11 | Task status (5 values) | 🟡 | 4/5; `Dropped` missing |
| 4.12 | Task source (Monday Meeting; WhatsApp; Email; Verbal; Other) | ❌ | Task has no source field; 4/5 values sit misplaced in the shared `Source` enum, `Other` absent |
| 4.13 | Investor deployment status (Active/Deploying; Not deploying; On hold) | 🟡 | Reworked into fund-lifecycle values; 1/3 spec values represented |
| 4.14 | Engagement classification (5 values) | ✅ | Exact match; drives visibility |
| 4.15 | NDA type (Open; Closed) | ✅ | Exact match (+ `InvestorNdaStatus` exact for §3.4) |
| 4.16 | Document access level (4 values) | ✅ | Exact match |

---

## 5. Sector taxonomy (§5)

15/18 spec sectors exact. Deviations: **Energy** narrowed to `RenewableEnergy` 🟡; **Retail & FMCG** labeled just "FMCG" 🟡; extra top-level `Banking` (spec treats Banks as a Financial Services *sub-sector*) 🟡. **Sub-sector taxonomy (second-level picklist): ❌ entirely absent** — no field, enum, or data (depth is discovery item §17.5, but the *mechanism* is committed spec). Restricted-sector screening (real estate, oil & gas, mining, alcohol, tobacco, gambling) ❌ — no qualification logic exists anywhere (see §10).

---

## 6. Milestone framework (§6)

| Element | Status | Detail |
|---|---|---|
| 6.1 Doc-prep milestones (Teaser, Model, IM) | ✅ | Deal Preparation checklist derived live from the Document register (transactions/[id]/page.tsx:267-285; milestones.ts:89-95) |
| 6.1 Valuation report (equity only) / Business plan (optional) | 🟡 | Rendered unconditionally for every deal — conditionality is label-text only |
| 6.2 The 14 investor-side milestones | 🟡 | All 14 encoded 1:1 in `MilestoneKey` + portal steppers. **But** `EngagementMilestone` has **zero write mutations** — display is backfilled from the 12 coarse stages, so milestones 6–14 collapse into stage cliff-edges (IC paper/1st IC/NBO all "complete" the moment stage hits TermSheet). Not individually recordable or dateable. Internal CRM never shows the stepper (portal-only). |
| 6.3 Disbursement | ✅ | Total/disbursed/pending table on `/engagement` with editable dialog |
| 6.3 Success-fee invoicing & payment | 🟡 | Amount/invoiced/paid fields on Transaction + form; no invoice generation |
| 6.3 Post-transaction monitoring | ❌ | Nothing |

---

## 7. Audit, immutability, access control (§7) — **largest gap**

| Requirement | Status | Evidence |
|---|---|---|
| Prior value + timestamp + user kept on protected-field changes (§7.1) | ❌ | No AuditLog/history model; `updateEngagement` overwrites in place (engagements-crud.ts:30-53); grep for audit/prevValue/changedBy → nothing |
| Deal stage history (every change + user) | ❌ | Restage mutations don't even receive the actor (mutations.ts:206-209); no history rows |
| Immutable deal creation date / source / ID | ❌ | Plain fields, no guard |
| Role-based CRUD matrix enforced at data layer (§7.2) | ❌ | `/access-matrix` is explicitly "display-only… nothing is persisted or enforced" (access-matrix.tsx:3-4); also omits the two external roles and 2 of 10 entities |
| Real authentication | ❌ | `ns_viewpoint` cookie is unsigned and settable by anyone via `/api/viewpoint?role=…` (route.ts:4-16); OTP is a hardcoded `000000` printed on screen |
| GraphQL mutation authorization | ❌ | Zero role checks across all resolvers — any caller can run any mutation |
| External viewpoint kept out of internal shell | ✅* | Server-side redirect in (crm)/layout.tsx:14-17 — *within the demo-lens trust model only |
| External-role visibility gating | ✅ | The one genuinely enforced §7 element — via the visibility engine (see §11) |

---

## 8. Agent specifications (§8) — 0 of 4 built

`src/server/services/ai.ts` (182 lines) = 4 read-only heuristic helpers (`aiMatchInvestors`, `aiFindProspects`, `aiOverviewInsights`, `aiAsk`), each with a `// SEAM: replace body with Lua` comment. No Lua SDK in package.json; no triggers, channel listeners, classifiers, or agent-authored writes anywhere. `docs/agents/04-noblestride-agents.md` is a build guide describing three *different* agents; its "Engagement Logger" is marked not-yet-built.

| Agent | Trigger | Channels | Does/Writes | Human gate | Verdict |
|---|---|---|---|---|---|
| 8.1 Client Agent | ❌ | ❌ | ❌ | n/a | ❌ Nothing exists |
| 8.2 Investor Agent | ❌ | ❌ | 🟡 matching heuristic only (ai.ts:16-54); no outreach drafting/correspondence capture | n/a | ❌ |
| 8.3 Investor Tracker Agent | ❌ no scheduler | n/a | 🟡 the data+guard substrate exists (stages, NDA guard, disbursement); no stall/overdue flags, no auto follow-up tasks | ✅ NDA guard is a real structural gate (nda-guard.ts:41-52) | 🟡 substrate only |
| 8.4 Referral/Partner Agent | 🟡 portal form, not an agent | ❌ | 🟡 referral→Mandate creation + conversion boolean; no performance compilation | manual by default | 🟡 manual equivalent |

"Never" rules: mostly N/A (no automation exists to violate them); the two that are enforceable today are enforced — VDR-without-NDA blocked (nda-guard + visibility), partner identity never projected (structural).

---

## 9. WhatsApp integration (§9) — ❌ nothing

No webhook receiver, Business-API client, or message parser. Grep for "whatsapp" → 2 picklist-label hits. All six mapping-table rows MISSING; the substrate they'd write to is also incomplete (no Communication.channel, no Task.source, no escalation flag). §9.1 never-automated list: moot (no automation), and no enforcement exists to prevent naive future violation.

---

## 10. Website intake & qualification (§10) — ❌ built for the wrong actor

**Critical mismatch:** the spec's §10 is a public intake form for **target companies raising capital**. The branch's `/register` is **investor** self-registration ("Register as an Investor", register/page.tsx:32-39; creates an `Investor` PendingReview). Valuable — it implements §11.2 access control and the concept-note's anti-broker ask — but it is not the §10 deliverable.

- **10.1 intake fields:** 0/12 required fields collected by any public surface. ~4/24 partially covered by the *partner-portal* referral form (companyName, dealSize, sector, contactName) — internal, not the public website agent. Five §10.1 fields have no schema column at all (post-money valuation, raised-to-date ×2, founders' nationality, target clients); NDA-acceptance flag absent.
- **10.2 qualification logic:** ❌ entirely. No screening code for revenue ≥ $1M, raise ≥ $1M, 3-yr audited accounts, restricted sectors, SSA-only, gov-owned/PEP. No Qualified/Rejected label on Client or Mandate. (`ranking.ts`/`filters.ts` match *investors*, not leads.)
- **10.3 routing:** 🟡 for investors an open-queue + human approve/reject exists (investors/page.tsx:56-66 + onboarding-actions.tsx); for company leads, referrals land straight on the Mandates kanban at NewLead with no qualification marker or assignment step.

---

## 11. Investor deal visibility (§11) — **best-covered deliverable**

Engine: `src/server/visibility/` (matrix.ts, tiers.ts, project.ts, load.ts, codename.ts) + 200+ table-driven tests.

| Visibility-matrix row (Pre-interest / After-NDA / DD) | Status | Notes |
|---|---|---|
| Company profile, sector, target profile — V/V/V | ✅ | Client identity masked as codename pre-interest (stricter than spec; flagged as client question) |
| Deal type, ticket — V/V/V | ✅ | |
| Revenue, EBITDA, assets, use of funds — Limited/V/V | 🟡 | Revenue banded pre-NDA ✅; EBITDA/assets/use-of-funds can't be gated — **not in the data model** (§3.1 gap cascades here) |
| Matching active mandate status — V/V/V | ✅ | |
| Full financials, IM, model — Hidden/V/V | 🟡 | "Full financials" = the same revenue fields; docs gated via access levels |
| VDR / DD files — Hidden/On-request/V | ✅ | Requires DD tier **and** `ndaSatisfied` (project.ts:195) |
| Advisor + client contacts — Hidden/Hidden/V | ✅ | Generic contact line even at DD — stricter than spec, zero leak |
| Other investors — Hidden ×3 | ✅ | Structurally absent from the projection type |
| Engagement contracts — Hidden ×3 | ✅ | `NEVER_SHARED_DOC_TYPES` hard filter |
| Feedback / offers / client responses — Hidden ×3 | ✅ | Explicitly never projected |
| Internal team messages — Hidden ×3 | ✅ | Activity data never reaches investor paths |
| **Hard rule: partner identity** | ✅ | Projection type cannot carry it; tested |
| **Hard rule: excluded/greylisted see nothing** | ✅ | Enforced in 3 independent code paths (tiers/discovery/pipeline) |
| §11.1 investor-facing filters | ❌/🟡 | Matching is automatic from the stored profile (sector/geo/ticket 🟡); **no interactive filter UI**; deal-type + core-financials filters ❌; impact filter ❌ (blocked by missing company flags) |
| §11.2 baseline visibility, not type-siloed | ✅ | No investorType branching in discovery |
| §11.2 back-end limit/restrict/deactivate | ✅ | Classification switch + onboarding approval gate (this branch) — real data-level controls |
| §11.2 VDR locked until interest + NDA | ✅ | Both conditions independently required |
| §11.2 revoked promptly on decline | 🟡 | Declining zeroes the tier ✅ but only via manual restage; no dedicated revoke action or audit event |

**Caveat spanning all of §11:** identity behind the gates is the forgeable demo cookie — the logic is real, the *authentication* isn't.

---

## 12. Automation guardrails & escalation (§12)

**12.1 never-automated (10 rules):** where a feature exists, the guard exists — no-auto-NDA-signing ✅ (recording only), VDR-without-NDA ✅ (NdaGuardError), excluded-investor sharing ✅, onboarding approval human-clicked ✅ (but not role-protected 🟡). Rules 2,3,5,8,9,10 are N/A — no automation exists yet to constrain; they must be designed into the agents when built.

**12.2 escalation triggers: ❌ all five.** No overdue computation (Task has no escalation flag), no deal-status-change notifications (the topbar bell is decorative with a hardcoded "3"), no WhatsApp task auto-creation, no tracked request workflows, no review-request workflow.

---

## 13. Reporting & dashboards (§13)

| Dashboard | Field/grouping | Status |
|---|---|---|
| Pipeline overview | Active vs inactive | 🟡 active counts only |
| | Deals by lead | ❌ |
| | By transaction type | ❌ |
| | By sector | ❌ |
| | By ticket-size band | ❌ (bands exist in `ticket-bands.ts`, used only in registration) |
| Deal status | Distribution | 🟡 keyed to internal stage vocab, not spec buckets |
| | Stage history | ❌ (blocked by missing audit trail) |
| Investor engagement | Deals under review per investor | 🟡 stage kanban; no per-investor rollup |
| | Deals rejected | ❌ |
| | Invested/completed | 🟡 disbursement rows, not a summary metric |
| | Historical summary | ❌ |
| Disbursement | Total/disbursed/pending by deal + investor | ✅ |
| | By year and quarter | ❌ (data derived and stored, never grouped) |
| Referrals & partners | Deals per partner + status | ✅ |
| | Conversion funnel | 🟡 single aggregate %, not introduced→progressed→closed |
| Team & tasks | Deal load by member | ❌ |
| | Task status by owner | 🟡 global counts + owner column, no cross-tab |
| | Overdue actions | ❌ |
| Advisory | All | ➖ |

Beyond spec: investor-onboarding stat group (Pending Review / Approved This Month / NDA Coverage), 6-month pipeline trend chart, AI insight cards.

---

## 14. Systems & integrations (§14) + Deliverables (§15)

Integrations: WhatsApp ❌ · Outlook/M365 email capture ❌ · Slack ❌ · Website embed ❌ · SharePoint/file storage ❌ (Document.fileUrl free-text only; no `<input type="file">` anywhere). Data protection (§14.2): confidentiality gates ✅ at data layer for external roles; RBAC/encryption-audit posture ❌ not configured.

| §15 deliverable | Status |
|---|---|
| Discovery & configuration brief | ✅ as in-repo docs (specs, plans, gap analyses) |
| Configured CRM | 🟡 entities/picklists/tagging largely built; audit trails missing |
| Four deployed agents | ❌ |
| WhatsApp integration | ❌ |
| Website intake & qualification agent | ❌ |
| Investor deal visibility | ✅ |
| Reporting dashboards | 🟡 |
| Access controls & DPA configuration | ❌/🟡 |
| Onboarding & handover | 🟡 docs exist; walkthrough/PoC support pending |

---

## 15. Where the build exceeds the spec

- **Investor self-registration + approval queue + NDA recording** (this branch) — the spec never asks for investor self-service; the concept note did. Implements §11.2's "Noblestride keeps back-end control" with a real PendingReview→Approved gate enforced at two layers.
- **Investor portal as a working CRM** (fund-profile editing, milestone steppers, Express Interest write-back) vs the spec's "controlled view".
- **Partner portal** (referral submission creating real mandates, funnel, expected fee) vs a tracking *agent*.
- Document **review chain** (reviewer → approver → client review dates); teaser **codename masking** pre-NDA; corporate-email gate; kanban boards with drag-drop; real-data import (106 mandates / 104 clients / 387 tasks).

---

## 16. What to do next

See the companion recommendations in this analysis' final section of the session report and `memory/client-meeting-questions.md` for items needing client input. Summary of instantly actionable work (no client sign-off needed — all spec-explicit):

1. **Task entity completion** — source picklist (§4.12), `Dropped` status, assistant, escalation flag + overdue computation, full CRUD UI. Unblocks the Team & Tasks dashboard and §12.2's first trigger.
2. **Deal vocabulary & fields** — real `Deal type` (Debt/Equity/Equity & Debt), separate Deal **status** (§4.5), deal **milestone** (§4.3), max selling stake (§4.7), target profile, use of funds, deal assistant, VDR link, deal-level probability, comments on Transaction.
3. **Company/Target §3.1 fields** — project codename, registration no., HQ country, business model, founders' nationality, ownership, directors, target clients, staff/branches, EBITDA/net profit, existing debt, loan book, total assets, **impact flags** (also unblocks §11.1 impact filter), company **status**.
4. **Picklist corrections** — split Task source out of `Source`; add missing §4.6 origination values; add `Hybrid` instrument; add `Energy` sector + "Retail & FMCG" label.
5. **Stage-history audit rows** (§7.1's most tractable slice) — append-only history for mandate/transaction/engagement stage changes with timestamp + actor; unblocks the Deal-status stage-history dashboard.
6. **Communication upgrades** (§3.10) — channel + direction fields, client link, Activity→Task relation, generalized logging UI.
7. **Service Provider UI** — page + drawer + nav (backend already complete).
8. **Dashboard groupings** (§13) — by lead / sector / type / ticket band; disbursement by year+quarter; team workload; task-status-by-owner; overdue actions.
9. **§10 company intake + qualification** — the full field list and qualification rules are spec-explicit; build the public form, screening labels and review queue (the agent wrapper can come later).
10. **Contact (Person) CRUD UI**; expose the investor fields that exist in schema but not in any form (nextActionDate, feedback, SSA contact, shareholding preference).

Items requiring client confirmation first are recorded in `memory/client-meeting-questions.md` (questions 7–14 added 2026-07-06).
