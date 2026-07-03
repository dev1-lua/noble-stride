# NobleStride CRM — Comparative Analysis

**Date:** 2026-07-03
**Documents compared (citation keys used throughout):**

| Key | Document | Role |
|---|---|---|
| **CN** | `data/decrypted/Noblestride-CRM-Concept-Note-decrypted.pdf` (11 pp) | Client's original concept note (the "recent mail") — an investor-facing deal marketplace with hosted VDR. `docs/GMAIL-request.md` is its text extraction. |
| **SOW-S** | `Noblestride_Lua_Phase1_Client_SOW_ Signed (2).pdf` (6 pp, issued 4 Jun 2026, signature block: Evans Wesonga, MD) | The **client-facing signed SOW** — 12 numbered sections; "intentionally avoids the internal field-by-field configuration detail" (SOW-S §01 p.1). |
| **SOW-INT** | `docs/SOW.md` (v2.0, 1 Jun 2026) | Internal build specification — the field-level data dictionary behind SOW-S. Unkeyed "§" references in sections 2–9 below are to this document. |
| **BS** | `docs/BUILD-STATUS-2026-07-03.md` | What is actually built as of 2026-07-03 (local `main`, 270/270 tests green). |
| **schema** | `noblestride-crm/prisma/schema.prisma` | Ground truth for data-layer claims (cited as `schema:<line>`). |

> **Section 10 is the master three-way table** (concept note vs signed SOW vs build) with per-cell citations.

**Scope of this analysis:** CRM only. The four Lua agents (SOW components 2–5), WhatsApp/email/website integrations (components 6–7, SOW §8–10, §14), and the concept note's AI features (behaviour tracking, predictive matching, preference memory) and third-party integrations (DocuSign, Teams, Read.ai, Office 365) are **excluded**.

---

## 1. Executive summary

- The build covers roughly the **full breadth of the SOW's CRM data model** and exceeds it in two areas the SOW never asked for (self-serve portals with write-back, view-as switcher).
- Material shortfalls concentrate in three places: **enforcement** (auth / RBAC / audit is demo-grade), **files** (documents are metadata-only, no upload/storage), and a handful of **field/UI gaps** (task CRUD + escalation, some company fields). *(Earlier drafts flagged Service Provider and Investor Contact as missing — both are in fact built at the data layer; see corrections in section 2.)*
- The concept note describes a **different product** than the SOW: a deal marketplace with real investor accounts, a hosted VDR with download watermarking and activity analytics, and automated commission invoicing. The SOW deliberately narrowed all three away. They are contractually out of scope but the client may still be picturing them — flag as "phase 2" in client conversations.

---

## 2. Entity-by-entity: SOW data dictionary (§3) vs build

| SOW entity | §  | Status | Detail |
|---|---|---|---|
| Company / Target | 3.1 | ⚠️ Mostly built | 104 real clients imported. Missing: **project codename (SOW-required)**, EBITDA / existing debt / total assets, women-led / youth-led impact flags. Sub-sector taxonomy deliberately deferred. |
| Deal / Mandate | 3.2 | ✅ Strong | 106 real mandates with NDA/EA dates; success-fee fields added. Missing: IC-approval + CAK/COMESA fields on deals. |
| Advisory Engagement | 3.3 | ➖ N/A | Optional add-on, not committed PoC scope. Correctly skipped. |
| Investor | 3.4 | ✅ Strong | Classification + NDA status built. Fund-profile work (IRR, track record, IC process, DD requirements, fund lifecycle, +8 new fields) covers most of §3.4's long tail. |
| Investor Contact | 3.5 | ✅ Built | **Correction (verified in schema):** `Person` model with `isPrimaryContact` / `isSSAContact` flags, linkable to investor (schema:353–372; migration `20260626064321_person_contact_flags`). Built in the Plan-1 session (2026-06-26), which is why the July-3 build status doesn't mention it. |
| Referral / Partner | 3.6 | ✅ Strong | Fee-sharing, advisor type, internal-only flag, referral-to-deal links. Not mentioned: partner NDA/agreement status (None/Sent/Signed). |
| Service Provider | 3.7 | ✅ Built | **Correction (verified in schema):** `ServiceProvider` model with type / contact / fee / status + many-to-many transaction links (schema:718–733; migration `20260626061111_add_service_provider`). Built in the Plan-1 session (2026-06-26). |
| Task | 3.8 | ⚠️ Half | 387 real tasks imported but **view-only** — SOW §7.2 gives team members CRU on own tasks. Overdue escalation flag not built. |
| Document | 3.9 | ⚠️ Half | Register with type/version/access level/status + review chain (richer than SOW). But SOW marks **File as required** — build is metadata + URL, no upload/storage. |
| Communication | 3.10 | ⚠️ Thin | Activity logging exists (Express Interest, referral submission write Activities). Full §3.10 record (channel, direction, extracted action items) is mostly integration-fed → partially out of scope here. |
| Investor-Deal Engagement | 3.11 | ✅ Strongest area | 12-stage pipeline matches §3.11 exactly; disbursement total/disbursed/pending; term sheet; probability; 15 milestones (SOW's 14 + success fee); 558 milestone rows backfilled. |

**Legend:** ✅ built · ⚠️ partial · ❌ missing · ❓ unconfirmed · ➖ not in committed scope

---

## 3. Milestone framework (SOW §6) vs build

| SOW §6 element | Status | Detail |
|---|---|---|
| 6.1 Client-side doc preparation (teaser, model, IM, valuation, business plan) | ✅ | Deal Preparation checklist on transaction detail, derived from the document register. `BusinessPlan` doc type added. |
| 6.2 Investor-side process milestones (14 steps) | ✅ | All 14 encoded in the 15-step `MilestoneKey` enum + steppers in the investor portal. |
| 6.3 Post-deal: disbursement | ✅ | Disbursement table (total / disbursed / pending) on `/engagement`. |
| 6.3 Post-deal: success-fee invoicing | ⚠️ | Success-fee **fields** exist on transactions; invoice generation not built. |
| 6.3 Post-deal: post-transaction monitoring | ❌ | Not built. |

---

## 4. Audit, immutability, access control (SOW §7) vs build — **largest SOW gap**

The SOW is unambiguous: access is role-based and **enforced at the data layer**; protected fields keep prior value + timestamp + user.

| SOW §7 requirement | Status | Detail |
|---|---|---|
| Real authentication | ❌ | View-as switcher is a cookie-based demo lens; no login. |
| Enforced in-org RBAC (Admin / Deal lead / Team member matrix, §7.2) | ❌ | `/access-matrix` page is **display-only** — a picture of the rule, not the rule. |
| Immutable / audited fields (§7.1) | ❌ | No audit trail, no field history, no deal-stage history. |
| External-role gating (investors / partners) | ✅ | The one genuine enforcement: visibility engine, server-side viewpoint cookie (client can never act as another fund), 193 + 32 tests. |
| Hard rule: partner identity + other investors never visible externally | ✅ | Tested at every tier; never in any projected output. |

---

## 5. Investor deal visibility (SOW §11 / component 8) vs build — **best-covered deliverable**

| SOW §11 element | Status | Detail |
|---|---|---|
| Field-level visibility matrix by tier (pre-interest / after-NDA / DD) | ✅ | §5.2 matrix encoded as data; financials as coarse bands pre-NDA; 193 pure table-driven tests. |
| Hard-hidden rows (other investors, engagement contracts, feedback/offers, internal messages) | ✅ | Never in any projected output, tested at every tier. |
| Excluded / greylisted funds see nothing | ✅ | Demo shows a Greylisted fund's self-explaining empty portal. |
| §11.1 investor filters (country, sector, ticket, deal type, financials, impact) | ❓/⚠️ | Not confirmed as built. Impact filter **cannot** work until women-led/youth-led company flags exist. |
| §11.2 VDR locked until NDA + formal interest, revoked on decline | ⚠️ | VDR is a document access-level value only — no file storage, no grant/revoke workflow. Representational, not operational. |
| Access granted/revocable by Noblestride | ⚠️ | Partially via engagement classification; no per-investor access controls beyond it. |

---

## 6. Reporting & dashboards (SOW §13) vs build

| SOW dashboard | Status | Detail |
|---|---|---|
| Pipeline overview | ⚠️ | `/dashboard` KPIs + `/mandates` exist; by-lead / by-ticket-band groupings not confirmed. |
| Deal status distribution + stage history | ❌ | Stage history impossible without the audit trail. |
| Investor engagement | ⚠️ | Per-investor pipeline visible via portal/engagement board; roll-up dashboard not evidenced. |
| Disbursement (by deal, investor, **year, quarter**) | ⚠️ | Disbursement table built; year/quarter grouping not evidenced. |
| Referrals & partners | ✅ | Referral funnel (Introduced → In Progress → Signed / Lost) + expected-fee card. |
| Team & tasks (workload, overdue) | ❌ | Blocked: tasks are view-only, no escalation flag. |
| Advisory | ➖ | N/A — advisory not in committed scope. |

---

## 7. Three-way: concept note ask → SOW commitment → build

### 7.1 Aligned across all three (asked, committed, built)

| Concept note ask | SOW | Build |
|---|---|---|
| Investor logs in, sees matching deals, reviews teaser, progresses NDA → IM → EOI | §11 / component 8 | ✅ Investor portal: tier-gated opportunities, milestone steppers, Express Interest write-back — delivers the *experience*, not just the "controlled view" |
| Full deal lifecycle (teaser → NDA → EOI → data room → DD → IC → TS → offer → SPA/loan → CAK/COMESA → close) | §6.2 (14 milestones) | ✅ All encoded (15 with success fee), 558 rows backfilled |
| Investor database with investment criteria (2000+ funds) | §3.4 | ✅ Built; fund-profile tab lets investors maintain own criteria (beyond SOW) |
| Historical data upload | Data load (§18) | ✅ Real import: 106 mandates, 104 clients, 387 tasks |
| NDA / term-sheet status per investor per deal | §3.11 | ✅ Investor-Deal Engagement fully built |

### 7.2 Narrowed away by the SOW (asked, **never committed**, not built) — expectation-management list

| # | Concept note ask | What the SOW did with it | Build |
|---|---|---|---|
| 1 | **Hosted VDR** with visibility into what investors review, watermarked downloads, activity tracking | Reduced to a `VDR` document access-level; storage "subject to SharePoint API access" (§14.1); §19.2 excludes the rest | ❌ Metadata + URL only. **Largest vision-vs-scope divergence.** |
| 2 | **Investor self-registration** with 2FA on company email + approval workflow (anti-broker gate) | Dropped — investors are records Noblestride creates | ❌ No auth at all |
| 3 | Template library (NDA / term-sheet templates) + investor-uploaded documents | Not in the SOW document model | ❌ |
| 4 | Automated **2% commission tracking + milestone-based invoicing** | §6.3 lists success-fee invoicing as a milestone, never as a deliverable | ⚠️ Success-fee fields exist; invoice generation not built. Cheapest of these to close. |
| 5 | On-platform scheduling (management calls, onsite DD) + legal-expert collaboration on agreements | Dropped; Service Provider entity (§3.7) is the faint echo | ⚠️ ServiceProvider entity exists (schema:718); no scheduling or collaboration workflow |
| 6 | Investor-facing analytics dashboard (their pipeline, NDA statuses, calls) | Not committed | ⚠️ "My Pipeline" tab covers a decent chunk anyway |
| 7 | Vendor DD as a premium paid service | Not in SOW | ❌ |

### 7.3 Concept note + SOW agree, build hasn't caught up (double-weighted gaps)

| Gap | Concept note | SOW | Build |
|---|---|---|---|
| Real authentication | 2FA + investor approval, explicit | Enforced RBAC (§7) | ❌ Cookie demo lens |
| Investor search filters (country, sector, ticket "USD 1–4mn", deal type, stage) | Explicit, with example | §11.1 | ❓ Not confirmed |
| File upload / storage | Document-centric flow throughout | Document.File required (§3.9) | ❌ |

---

## 8. Where the build exceeds the SOW

| Built | SOW asked for |
|---|---|
| Investor **portal with write-back** (fund-profile editing, Express Interest → engagement upsert + activity log) | A controlled investor *view* (component 8) |
| **Partner portal** (referral submission creating real mandates, funnel, expected fee, self-service details) | Partner tracking as an *agent* (component 5) only |
| View-as switcher + access-matrix page (demo affordances) | Not requested |
| Real-data import at depth (106 mandates, 387 tasks, milestone backfill) | "Agreed initial load" |
| Document review chain (reviewer → MD approver → client review dates) | Basic document status |

Notably, the portals push the product *back toward* the concept note's original vision more than the SOW required.

---

## 9. Priority list to close the CRM gap

| # | Item | Why |
|---|---|---|
| 1 | **Auth + enforced RBAC + audit trail** (§7) | Only item contractually "enforced at the data layer" that isn't; also the concept note's 2FA ask. Unblocks stage-history dashboard. |
| 2 | **File upload / storage** | Document.File is SOW-required; prerequisite for any real VDR story and the concept note's document flow. |
| 3 | **Task create/edit + overdue escalation flag** | Small build; closes an entity and unblocks the team-&-tasks dashboard. |
| 4 | Company fields: project codename (required), EBITDA/debt/assets, impact flags | Codename is SOW-required; impact flags unblock the §11.1 impact filter. Verified absent from schema. |
| 5 | Investor-facing filters, disbursement by year/quarter, DD workstream tracks, IC/CAK deal fields | Rounds out §11.1, §13, §6.2. |
| 6 | Success-fee invoice generation | Data hooks already in place; also the concept note's commission ask. |

*(Service Provider + Investor Contact were on earlier drafts of this list — removed after schema verification showed both already built. Remaining question for them is UI coverage, not data model.)*

---

## 10. Master table — concept note (recent mail) vs signed SOW vs build, cited

Sources read in full from the PDFs: **CN** = concept note, 11 pages; **SOW-S** = signed client-facing Phase 1 SOW, 6 pages, 12 sections. Per-column verdicts: ✅ present/committed/built · ⚠️ partial · ❌ absent/not committed/not built · ➖ out of this analysis' CRM scope.

| # | Capability | CN — recent mail | SOW-S — signed SOW | Build |
|---|---|---|---|---|
| 1 | Core CRM records — companies, deals, investors, contacts, partners, service providers, tasks, documents, communications, investor-deal engagement | ⚠️ Implied only: "HubSpot (custom CRM)… deal tracking and pipeline management" (CN p.3) | ✅ Named workstream + core-record table listing all ten record types (SOW-S §02 p.1, §03 p.3) | ✅ All ten in Prisma schema, incl. `ServiceProvider` (schema:718) and contact flags on `Person` (schema:364–365); field gaps in row 15 (BS "data model additions") |
| 2 | Deal pipeline visible to logged-in investors (800+ deals) | ✅ "enable an investor to login review the deal tracker of more than 800 companies" (CN p.1); "Deal pipeline display (800+ deals)" (CN p.5) | ⚠️ Narrowed to "controlled view of **matching** opportunities" for **approved** investors (SOW-S §02 p.2, §07 p.4) | ⚠️ Investor portal shows tier-gated matching opportunities (BS §4); no real login — cookie demo lens (BS §3, known gaps) |
| 3 | Secure investor login, 2FA on company email, investor approval to block brokers | ✅ "sign up automatically… via a two factor authentication on their official company email, we will diligence and approve the investors" (CN p.1); 2FA again pp.4, 7, 10 | ❌ No auth/registration workstream anywhere in SOW-S §02–§05; closest is "approved investors" phrasing (§02 p.2) | ❌ Not built (BS "What remains": real authentication) |
| 4 | Investor search filters — country, sector, size, deal type, stage, ticket | ✅ "search deals by country, by sector, by size, by deal type -debt or equity, by stage… by ticket size USD1 to 4mn" (CN p.1); repeated p.8 | ⚠️ Implied by "matching opportunities" (§02 p.2); explicit filter list only in SOW-INT §11.1 | ❓ Not evidenced in BS; impact filter blocked by missing company flags (schema verified) |
| 5 | Teaser review → NDA → financial model/IM → EOI flow | ✅ Narrated end-to-end (CN p.1, pp.8–9: "Teaser review, NDA signing, financial model/IM access… send an expression of interest") | ✅ "Deal tracking across… investor outreach, NDA, IM, VDR, due diligence, term sheet, offer, close" (SOW-S §04 p.3) | ✅ 15-step milestone steppers + Express Interest write-back with Activity log (BS §4) |
| 6 | E-signature NDA signing (DocuSign) | ✅ "sign an NDA via docsign" (CN p.1); DocuSign named pp.2, 3, 8, 10 | ❌ Absent; guardrail is the opposite — "No signing, acceptance, or contractual action happens automatically" (SOW-S §06 p.4) | ❌ Not built; NDA tracked as status fields only |
| 7 | Hosted VDR with activity tracking + watermarked downloads | ✅ "visibility on what the investor is reviewing on the data room… download information with watermarks" (CN p.1); "track what investors download or view" (CN p.3, p.9) | ❌ Narrowed to SharePoint "store **or link** deal documents, VDR material… subject to API/admin access" (SOW-S §05 p.4); VDR appears only as an access **gate** (§06 p.4, §07 p.5) | ❌ Document = metadata + `fileUrl` (schema:750); no storage, tracking, or watermarking (BS "What remains") |
| 8 | Teams call scheduling + Read.ai recording | ✅ "schedule a call… via Teams call… record the telcom via read.ai" (CN p.1); pp.2–3, 9 | ❌ Teams/Read.ai nowhere in SOW-S; §05 channel list is WhatsApp, Outlook, website, SharePoint, Slack (p.3–4) | ❌ Not built |
| 9 | Template library (NDA/term-sheet) + investor-uploaded documents | ✅ "upload client's historical data, NDA, Term sheet templates etc… enable the investor to share their own NDAs or term sheets" (CN p.1; also pp.2, 6, 9) | ❌ Out of scope: "Automated production of teasers, IMs, models, valuation reports, or legal documents" (SOW-S §11 p.6) | ❌ Not built |
| 10 | 2% commission + milestone-based invoicing | ✅ "commission of 2% on each deal closed… invoiced on milestone based on the progress of the deal" (CN p.1); "Milestone-Based Invoicing" (CN p.10) | ⚠️ Tracking only: "success fee" inside deal-tracking workflow (SOW-S §04 p.3); no invoicing deliverable | ⚠️ Success-fee fields on transactions (BS data-model additions); invoice generation not built (BS "What remains") |
| 11 | Investor database with criteria (2000+ funds) + investor matching | ✅ "2000+ PE funds, DFIs… we have their email addresses and their investment criteria" (CN pp.1–2) | ✅ Dedicated workstream: "Investor matching and intelligence — identifies and ranks relevant investors… with a clear match rationale" (SOW-S §02 p.2; §04 p.3) | ⚠️ Investor records + editable fund profiles built (BS §4); ranking exists only as heuristic stub (BS "What remains" — AI, outside CRM scope) |
| 12 | Investor-deal engagement tracked through TS, DD, close, disbursement | ✅ "issue a term sheet… access the virtual data room… deal closed" (CN p.1) | ✅ Investor Tracker workstream: "NDA, IM, VDR, DD, term sheet, offer, invested, or declined" (SOW-S §02 p.2); Investor-Deal Engagement record incl. disbursement (§03 p.3) | ✅ Strongest area: 12-stage pipeline, disbursement table, 558 milestone rows (BS §2, §6) |
| 13 | Referral / partner tracking (originators, fee-sharing, conversion) | ❌ **Not in the concept note at all** — partners/referrals never mentioned | ✅ Named workstream (SOW-S §02 p.2); Referral/Partner core record (§03 p.3) | ✅ Built + partner portal with referral submission, beyond scope (BS §5) |
| 14 | Stage-gated investor visibility (pre-interest / after-NDA / DD) with hard-hidden internals | ⚠️ Implied: "role-based access to information based on the stage of the deal" (CN p.2) | ✅ Explicit three-stage visibility table incl. hidden columns (SOW-S §07 pp.4–5); restricted-investor guardrail (§06 p.4) | ✅ Visibility engine, field matrix as data, 193+32 tests; greylisted funds see nothing (BS §1, §4) |
| 15 | Company/deal field completeness (codename, EBITDA/debt/assets, impact flags, IC/CAK fields) | ➖ Not field-level | ✅ Field-level only in SOW-INT §3.1–3.2 (SOW-S deliberately avoids this detail, §01 p.1) | ⚠️ Verified absent from schema: codename, EBITDA/debt/assets, impact flags; IC/CAK deal fields (BS "What remains") |
| 16 | Task capture, ownership, overdue escalation | ⚠️ Adjacent ask: notify lead "where an email has not been responded to or a deliverable is pending" (CN p.2) | ✅ Tasks as core record (§03 p.3); "team workload, task status, and overdue actions" dashboard (§08 p.5) | ⚠️ 387 real tasks imported, view-only; no escalation flag (schema:690–712; BS "What remains") |
| 17 | Dashboards / reporting | ✅ Investor analytics dashboard (CN p.4); "user-friendly dashboard for uploading, managing, and tracking deals" (CN p.10) | ✅ Seven views: pipeline, deal status + stage history, investor engagement, disbursement by year/quarter, referrals, team workload, advisory-if-confirmed (SOW-S §08 p.5) | ⚠️ KPIs, engagement board, referral funnel built (BS §2, §5); stage history and team-workload views blocked (no audit trail, tasks view-only) |
| 18 | Audit trail + role-based access enforced internally | ⚠️ "role-based access" (CN p.2) | ✅ Operating layer configured "around Noblestride's workflow, records, approvals, and access controls" (SOW-S §03 p.2); guardrails §06 p.4 | ⚠️ External gating genuinely enforced + tested (BS §1); in-org RBAC display-only, no audit/immutability (BS "What remains") |
| 19 | Historical data load from existing trackers | ✅ "upload client's historical data" (CN p.1); "Historical Data Upload" (CN p.6) | ✅ "Excel trackers — starting point for CRM data load and field validation" (SOW-S §05 p.4) | ✅ `import:real`: 106 mandates, 104 clients, 387 tasks from the client's actual trackers (BS §6) |
| 20 | Onsite-DD scheduling + legal experts on agreements | ✅ "schedule onsite due diligence and have a team of legal expert support the preparation of loan agreements or share purchase agreements" (CN p.1, p.9) | ⚠️ Only as a record: Service Provider "law firms, audit, tax, ESG, technical" (SOW-S §03 p.3); no scheduling/workflow commitment | ⚠️ `ServiceProvider` entity built (schema:718); no scheduling or legal workflow |
| 21 | Vendor DD as a paid premium service | ✅ CN p.9 | ❌ Nowhere in SOW-S | ❌ Not built |
| 22 | Agents, WhatsApp/email capture, website intake, AI notifications & preference memory | ✅ Throughout (CN pp.1–3, 9–10) | ✅ Workstreams (SOW-S §02) | ➖ Excluded from this CRM analysis; all remain unbuilt or heuristic stubs (BS "What remains") |

**Reading of the table:** rows 5, 12, 14, 19 are the through-line all three documents agree on — and they are built. Rows 3, 6, 7, 8, 9, 21 are concept-note asks the signed SOW never committed to (the expectation-management set). Rows 2, 4, 10, 15, 16, 17, 18 are committed in the signed SOW and only partially delivered — that is the actual contractual punch-list, and it matches the priority list in section 9.

One divergence worth naming to the client: **referral/partner tracking (row 13) appears nowhere in their concept note** — it entered at SOW stage — yet it's one of the most completely built areas, including a portal. Conversely their single most-repeated concept-note ask (the tracked, watermarked VDR, row 7) is the least represented in both the signed scope and the build.

---

*Supersedes `noblestride-crm/docs/GAP-ANALYSIS-vs-SOW.md` (2026-06-26, stale — predates the 2026-07-03 session). Section 10 sources: text extracted from both PDFs via pypdf, read in full; build claims spot-verified against `prisma/schema.prisma`.*
