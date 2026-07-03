# NobleStride CRM — Comparative Analysis

**Date:** 2026-07-03
**Documents compared:**

| Document | Role |
|---|---|
| `GMAIL-request.md` | Client's original concept note — an investor-facing deal marketplace with hosted VDR |
| `SOW.md` (v2.0, 1 Jun 2026) | Signed Statement of Work — reframed the concept into an internal CRM + agents + controlled investor visibility |
| `BUILD-STATUS-2026-07-03.md` | What is actually built as of 2026-07-03 (local `main`, 270/270 tests green) |

**Scope of this analysis:** CRM only. The four Lua agents (SOW components 2–5), WhatsApp/email/website integrations (components 6–7, SOW §8–10, §14), and the concept note's AI features (behaviour tracking, predictive matching, preference memory) and third-party integrations (DocuSign, Teams, Read.ai, Office 365) are **excluded**.

---

## 1. Executive summary

- The build covers roughly the **full breadth of the SOW's CRM data model** and exceeds it in two areas the SOW never asked for (self-serve portals with write-back, view-as switcher).
- Material shortfalls concentrate in three places: **enforcement** (auth / RBAC / audit is demo-grade), **files** (documents are metadata-only, no upload/storage), and a handful of **entity/field gaps** (Service Provider, Investor Contact, task CRUD, some company fields).
- The concept note describes a **different product** than the SOW: a deal marketplace with real investor accounts, a hosted VDR with download watermarking and activity analytics, and automated commission invoicing. The SOW deliberately narrowed all three away. They are contractually out of scope but the client may still be picturing them — flag as "phase 2" in client conversations.

---

## 2. Entity-by-entity: SOW data dictionary (§3) vs build

| SOW entity | §  | Status | Detail |
|---|---|---|---|
| Company / Target | 3.1 | ⚠️ Mostly built | 104 real clients imported. Missing: **project codename (SOW-required)**, EBITDA / existing debt / total assets, women-led / youth-led impact flags. Sub-sector taxonomy deliberately deferred. |
| Deal / Mandate | 3.2 | ✅ Strong | 106 real mandates with NDA/EA dates; success-fee fields added. Missing: IC-approval + CAK/COMESA fields on deals. |
| Advisory Engagement | 3.3 | ➖ N/A | Optional add-on, not committed PoC scope. Correctly skipped. |
| Investor | 3.4 | ✅ Strong | Classification + NDA status built. Fund-profile work (IRR, track record, IC process, DD requirements, fund lifecycle, +8 new fields) covers most of §3.4's long tail. |
| Investor Contact | 3.5 | ❓ Not evidenced | Named people per investor, primary/SSA contact flags — no trace in the build status. Confirm; likely a gap. |
| Referral / Partner | 3.6 | ✅ Strong | Fee-sharing, advisor type, internal-only flag, referral-to-deal links. Not mentioned: partner NDA/agreement status (None/Sent/Signed). |
| Service Provider | 3.7 | ❌ Missing | The one **new record type** the SOW introduces (law firms, Big 4, tax, ESG, technical advisors per deal). Not built. |
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
| 5 | On-platform scheduling (management calls, onsite DD) + legal-expert collaboration on agreements | Dropped; Service Provider entity (§3.7) is the faint echo | ❌ (Service Provider not built either) |
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
| 4 | **Service Provider entity + Investor Contact** | Straightforward data-model additions; §3.7 is the SOW's one new record type. |
| 5 | Company fields: project codename (required), EBITDA/debt/assets, impact flags | Codename is SOW-required; impact flags unblock the §11.1 impact filter. |
| 6 | Investor-facing filters, disbursement by year/quarter, DD workstream tracks, IC/CAK deal fields | Rounds out §11.1, §13, §6.2. |
| 7 | Success-fee invoice generation | Data hooks already in place; also the concept note's commission ask. |

---

*Supersedes `noblestride-crm/docs/GAP-ANALYSIS-vs-SOW.md` (2026-06-26, stale — predates the 2026-07-03 session).*
