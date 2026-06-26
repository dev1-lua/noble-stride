# NobleStride CRM — Gap Analysis vs Signed SOW & Build Spec

**Date:** 2026-06-26
**Reviewed against:**
- `Lua x Noblestride - Build Specification (INTERNAL) (1)` v2.0 (the engineer-ready spec, 9 components, full data dictionary)
- `Noblestride_Lua_Phase1_Client_SOW_ Signed (1)` (client-signed, lists the same 9 components as Phase 1 deliverables)
- `NobleStride_Lua_Phase1_Context (2)`
- Codebase: `noblestride-crm/` (verified against `prisma/schema.prisma`, GraphQL layer, app routes, `docs/agents/`)

> **How to read this:** This is a documentation-review gap map, not a discovery workshop. Where the spec marks something "to confirm in discovery" it is noted. Field-level detail was machine-mapped from the schema; the headline gaps (Engagement disbursement fields, Partner fee-sharing/internal-only, missing entities, agents, integrations, visibility) were verified directly.

---

## The bottom line

The signed SOW lists **nine** Phase-1 components. The demo showed a **CRM foundation** covering roughly the first one and a half. That is why the client says it "isn't complete — it's all in the docs": they are reading the demo against a document they signed that promises agents, WhatsApp/email capture, website intake, controlled investor visibility, and a full disbursement-tracking pipeline.

| # | SOW component | Status | Demo-ready against spec? |
|---|---------------|--------|--------------------------|
| 1 | CRM & deal management (data model, CRUD, dashboards) | 🟡 **Partial (~55%)** | Foundation real; missing entities + many fields |
| 2 | Client Agent | 🔴 **Not built** | No |
| 3 | Investor Agent | 🔴 **Not built** | No |
| 4 | Investor Tracker Agent | 🔴 **Not built** | No |
| 5 | Referral / Partner Tracking Agent | 🔴 **Not built** | No |
| 6 | WhatsApp integration | 🔴 **Not built** (enum value only) | No |
| 7 | Email (Outlook/M365) capture | 🔴 **Not built** (enum value only) | No |
| 8 | Website intake & qualification agent | 🔴 **Not built** | No |
| 9 | Investor deal visibility (gated external view) | 🔴 **Not built** | No |
| — | Reporting & dashboards | 🟡 **Partial** | Pipeline/segments real; investor-engagement, disbursement, team/task, advisory missing |
| — | Investor matching & intelligence ("highest-value piece") | 🟡 **Heuristic stub** | Rule-based scoring exists; not LLM-backed, not mandate-level, ignores deployment status/restrictions |
| — | Role-based access control + audit/immutability | 🔴 **Not built** | No permission checks in resolvers; no change history |

**Two framing facts the team needs to align on internally:**

1. **Scope tension.** Intern/build notes treat the 4 agents + integrations as "Phase 2." The *client-signed SOW* lists them as **Phase 1 deliverables**. The client is correct per the document. This needs an explicit conversation (re-scope, re-sequence, or set expectations) — it is not just a build-progress question.
2. The demo's strongest areas (Clients, Mandates, Transactions kanban, Investor list, basic dashboard) are genuinely real and wired to data. The problem is breadth, not that the foundation is fake.

---

## DEEP DIVE 1 — Partners / Referral pipeline (client flagged)

**What exists (real):** `/partners` list with stat tiles (total partners, deals referred, closed revenue, conversion rate) + per-partner referral rollup; `/partners/[id]` detail with contacts and referred mandates; create/edit drawer; `partnerReferralStats()` service.

**What the spec requires that is MISSING:**

| Spec requirement (§3.6, §13) | Status | Notes |
|---|---|---|
| **Fee-sharing agreement** (bool) + **fee-sharing terms** (text) | ❌ Missing | Not in `Partner` model or form. Core to partner obligations. |
| **NDA / partner agreement status** (None / Sent / Signed) | ❌ Missing | Not in schema. |
| **Internal-only** flag (default true — identity *never* exposed to investors) | ❌ Missing | This is a **hard confidentiality rule** in the spec (§7). Not modelled. |
| **Advisor type** as spec'd (Lawyer / Investor / Consultant / Transaction advisor / Advisory firm / Other) | ⚠️ Wrong values | `PartnerType` enum conflates referral partners with service providers (LawFirm/Auditor/Bank…). |
| Direct **Email / Phone** on partner | ⚠️ Indirect | Only via nested `Person`; spec wants them as required fields on the partner. |
| **Organization** field | ❌ Missing | — |
| **Referral conversion pipeline** (introduced → progressed → closed/rejected) as a *view* | ⚠️ Stats only | Counts exist; no stage/funnel visualization. |
| **"Referrals & partners" dashboard** card on the main dashboard | ❌ Missing | Stats live only on `/partners`. |
| **Referral/Partner Tracking Agent** (auto-capture introductions, fee-sharing, conversion, performance) | ❌ Missing | No agent. |

**Why the client noticed:** the page *looks* done but cannot answer "what do we owe this introducer, and have they signed?" — the fee-sharing, NDA, and internal-only fields that make it a *partner* record (not just a contact) are absent.

---

## DEEP DIVE 2 — Investors pipeline (client flagged)

**What exists (real):** `/investors` database with filters + segments; `/investors/[id]` detail (sector/geo focus, instruments, ticket range, contacts, engagements, activity timeline); create/edit drawer; `/engagement` tracker grouped by deal with a "log engagement" dialog; `aiMatchInvestors(transactionId)` button returning a ranked list with reasons.

**What the spec requires that is MISSING or wrong:**

| Spec requirement | Status | Notes |
|---|---|---|
| **Investor-Deal Engagement stages** (Shared → Teaser sent → NDA signed → IM shared → VDR access → Meeting → Info request → DD → Term sheet → Offer → Invested / Declined) | ❌ Wrong model | `Engagement.status` has only 6 generic states (NotContacted→Committed). The 12-stage spec pipeline can't be tracked. |
| **Disbursement tracking** — term sheet issued (+date), total / disbursed / pending amounts, engagement status (Disbursed/Ongoing/Fell off/Dropped), date received, year-quarter, probability | ❌ Missing entirely | None of these fields exist on `Engagement`. This is the whole "Term Sheet Deals" tab — a primary reason the pipeline reads as incomplete. |
| **Interest level** (Low/Med/High) and **NDA type** (Open/Closed) on the engagement | ❌ Missing | — |
| **Engagement-stage kanban / pipeline view** | ❌ Missing | Only a flat grouped list. |
| **Investor engagement classification** (Active / Inactive / On hold / Excluded / **Greylisted**) | ❌ Missing | Spec uses this to drive visibility — excluded/greylisted investors see nothing. Can't be enforced. |
| **Investor NDA status (Noblestride)** (None / Open NDA / Closed NDA) | ❌ Missing | On investor record. |
| Investor profile depth: Min EBITDA/revenue/loan-book, shareholding pref, pricing pref, remaining investment period, DD requirements, IC/approval process, track record, next-action date, feedback, SSA-region contact | ❌ Mostly missing | ~13 investor fields absent; many feed matching. |
| **Matching at mandate level**, using **deployment status** + **country restrictions** + relationship history, with rationale | ⚠️ Partial | Heuristic, transaction-level only, ignores deployment status/restrictions. Spec calls matching "one of the highest-value pieces." |
| **Investor engagement dashboard** (under review / rejected / invested per investor; historical summary) | ⚠️ Partial | — |
| **Disbursement dashboard** (total/disbursed/pending by deal, investor, year, quarter) | ❌ Missing | No data model to back it. |
| **Investor deal visibility** — external gated view, field-level gates by stage, VDR locked until NDA, filters | ❌ Missing entirely | No external portal, no gating layer. |
| Investor / Investor Tracker **Agents** | ❌ Missing | No agents. |

---

## Data model — entity & field coverage

11 spec entities. Status:

| # | Entity | Model | CRUD | Field coverage | Verdict |
|---|--------|-------|------|----------------|---------|
| 1 | Company / Target | ✅ `Client` | ✅ full | ~14/27 | 🟡 Partial — missing project codename, status, primary contact, financials (EBITDA, debt, assets), impact flags, sub-sector |
| 2 | Deal / Mandate | ✅ `Mandate` + `Transaction` (split) | ✅ full | ~50% | 🟡 Partial — missing deal status, milestone, use of funds, max stake, Teaser/IM/Model tracking, probability |
| 3 | Advisory Engagement | ❌ | ❌ | 0 | ⚪ Intentionally optional (confirm in discovery) |
| 4 | Investor | ✅ `Investor` | ✅ full | ~13/26 | 🟡 Partial — missing classification, NDA status, thresholds, IC process, track record (see pipeline above) |
| 5 | Investor Contact | ⚠️ generic `Person` | ❌ no own mutations | 5/7 | 🟡 Missing primary/SSA flags; not independently managed |
| 6 | Referral / Partner | ✅ `Partner` | ✅ full | ~5/11 | 🟡 Partial — see partners pipeline above |
| 7 | **Service Provider** (NEW) | ❌ | ❌ | 0/8 | 🔴 Missing — no way to file legal/audit/tax/ESG advisors per deal |
| 8 | Task | ✅ `Task` | ⚠️ agent-only, hidden | 6/10 | 🟡 No user UI; missing source + auto escalation flag |
| 9 | **Document** | ❌ | ❌ | 0/8 | 🔴 Missing — no teaser/IM/term-sheet storage, versioning, or access levels. Blocks visibility gates. |
| 10 | Communication | ⚠️ `Activity` (different semantics) | ⚠️ agent-only | 4/9 | 🟡 No channel/direction; can't log inbound/outbound email/WhatsApp as comms |
| 11 | Investor-Deal Engagement | ✅ `Engagement` | ⚠️ no full CRUD | ~2/14 | 🔴 Critical — missing all stage/disbursement/term-sheet fields (see pipeline above) |

**Picklist library:** Sector enum has 11/18 spec values (missing Aviation, Construction, Hospitality, Leasing, Media & Entertainment, Services, Transport & Logistics, Water & Sanitation). **Not defined at all:** Deal Milestone, Engagement Stage, Engagement Classification, Investor NDA status, Engagement NDA type, Document type, Document access level, post-investment Engagement status.

---

## Entirely missing (no model / no code)

- **Service Provider** entity (§3.7)
- **Document** entity + file storage + access levels (§3.8) — also blocks visibility gates
- **Communication** as spec'd (channel/direction/extracted action items) (§3.9)
- **All 4 agents** (Client, Investor, Investor Tracker, Referral/Partner) (§8)
- **WhatsApp integration** (§9) — only a `Source.WhatsApp` enum value exists
- **Email / Outlook capture** (§9)
- **Website intake & qualification agent** + qualification rules (≥$1M revenue, 3yr accounts, sector exclusions, SSA geography) (§10)
- **Investor deal visibility** — external portal + field-level gates + VDR lock (§11)
- **Role-based access control** enforcement + **audit trail / immutability** on protected fields (§6, §7)
- **Human-in-the-loop guardrails** — the 13 "never automated" rules are not enforced in code (§12); `createdSource` provenance exists but isn't gated

---

## Suggested priority order to get "complete against the docs"

Sequenced to close the *client-visible* gaps first (the two flagged pipelines), then breadth.

**P0 — make the two flagged pipelines real (data-model work):**
1. Rebuild `Engagement` to the spec: 12-stage `EngagementStage` enum, NDA type, interest level, term-sheet issued+date, **total/disbursed/pending amounts**, post-investment status, date received, derived year/quarter, probability, feedback. Add a stage **kanban** view + a **disbursement dashboard**.
2. Extend `Partner`: fee-sharing agreement + terms, NDA/partner-agreement status, **internal-only** flag, organization, direct email/phone, correct advisor-type values. Add a referral **conversion funnel** view + partner dashboard card.
3. Add **Investor engagement classification** (incl. Excluded/Greylisted) + investor NDA status.

**P1 — close data-model breadth:**
4. Add **Service Provider** and **Document** entities (Document unlocks visibility gates later).
5. Fill missing Company/Deal/Investor fields + complete the picklist library + missing enums.
6. Promote Task/Communication to first-class (user CRUD, channel/direction, source, auto-escalation).

**P2 — the parts the SOW calls Phase 1 but were sequenced later (needs scope conversation first):**
7. Investor matching → mandate-level, deployment-status + restriction aware, with rationale (and LLM-back it).
8. Website intake & qualification agent (highest-leverage agent; self-contained).
9. WhatsApp + email capture.
10. The 4 agents proper.
11. Investor deal visibility (external gated portal) — depends on Document + classification + RBAC.
12. RBAC + audit/immutability + guardrail enforcement.

---

## Open items the spec itself defers to discovery (don't pre-build)

Advisory engagement in/out of PoC; final picklist values + user list; full Term Sheet Deals semantics; full investor field set + required flags; sub-sector depth; API/admin access (SharePoint/Outlook/WhatsApp); access coordinator; Open vs Closed NDA → VDR mapping.
