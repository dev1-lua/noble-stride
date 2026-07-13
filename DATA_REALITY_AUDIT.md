# NobleStride CRM — Data Reality Audit

**Date:** 2026-07-13
**Author:** Lua implementation team
**Scope:** Every file in `d:\LuaWork\NobleStride\noble-stride\decrypted\` (Excel, Word, PDF), plus the data that has been loaded into the local CRM database (`noblestride-crm/prisma/real-data.json` and `seed-data.json`).
**Purpose:** State exactly what data is **real** (came from NobleStride's own operational files), what is **not real** (curated / derived / demo), and what is **missing** — i.e. what NobleStride still has to hand over before the platform can run end-to-end on 100% real data with no synthetic or curated content.

> **Grounding rule applied throughout:** Every "missing" claim below is grounded in one of two things: (a) the file simply is not present in `decrypted/` (verified by listing the folder), or (b) NobleStride's **own** documents (Concept Note, Scoping Document, signed SOW, Solomon's feedback email) state the data exists but it was not included in what was shared. Where I could not verify existence either way, it is explicitly marked **"confirm with NobleStride"** rather than asserted as missing.

---

## 1. Files examined

All 12 files in `decrypted/` were opened and read in full:

| # | File | Type | What it is |
|---|------|------|-----------|
| 1 | `Engagement contract Tracker _ CRM.xlsx` | Excel (data) | The live deal/mandate pipeline |
| 2 | `Investor Tracker _ CRM.xlsx` | Excel (data) | Investor firms + contacts, and a Law Firms tab |
| 3 | `Tasks Tracker Whatsapp 2026_ CRM.xlsx` | Excel (data) | Weekly action-point tracker + dashboard |
| 4 | `Target companies Data Collector_ CRM.docx` | Word (template) | **Blank** intake form for target companies |
| 5 | `Data collected from potential investors_ CRM.docx` | Word (template) | **Blank** spec of investor fields to collect |
| 6 | `Template to Collect Investor Preferences_ CRM.docx` | Word (template) | **Blank** Microsoft Form for investor preferences |
| 7 | `Sectors and Milestones_ CRM.docx` | Word (reference) | Sector/sub-sector taxonomy + milestone list |
| 8 | `End-to-End Client Onboarding and Fundraising Workflow_ CRM.docx` | Word (process) | The written 4-stage workflow |
| 9 | `NobleStride_Full_Scoping_Document.docx` | Word (spec) | Full scoping document |
| 10 | `Lua x Noblestride - Build Specification (INTERNAL).pdf` | PDF (spec) | The agreed data model & build spec |
| 11 | `Noblestride_Lua_Phase1_Client_SOW_ Signed.pdf` | PDF (contract) | Signed Phase-1 statement of work |
| 12 | `Noblestride-CRM-Concept-Note-decrypted.pdf` | PDF (vision) | Original concept note |

**Only files 1, 2 and 3 contain actual operational records.** Files 4–12 are templates, taxonomies, process descriptions and specifications — they tell us what NobleStride *intends* to capture, but hold no populated business data themselves.

---

## 2. What data is REAL

This is genuine NobleStride operational data. It has been parsed into `noblestride-crm/prisma/real-data.json` by `scripts/parse-real-data.py`.

### 2.1 Deals / Mandates — REAL ✅
**Source:** `Engagement contract Tracker _ CRM.xlsx`, sheet `Engagement Contract Tracker` (~810 populated rows).
**Imported:** **785 deal/mandate records.**

Real fields present per row:
- **Client / company name** (e.g. *Taimba, Kocela, Swift Capital, Karibu Loo Ltd, M-Kopa Holdings, Habari Financial Services*).
- **Date** the deal was opened.
- **NDA — Sent date / Signed date.**
- **Engagement Agreement — Sent date / Signed date.**
- **Lead** (internal owner: Amos, James, Brenda, Duncan, Cliff, Evans M/W, Sheilla, Ken, Irene, Muriuki, Solomon, Brian…).
- **Source / Referee** (referrer — e.g. *Bowmans, Africapital, Truly Accountants, Arnold Engoru Mutebi, Ronnie Afema*).
- **Deal info** free-text notes (e.g. *"Valuation", "Dropped Too small", "Paid", "On hold", "Business plan/Pitch deck preparation"*).

Date range is real and continuous: **Dec 2023 → mid-2026**. From these fields the importer derives NDA/EA status and a coarse stage (`NewLead → Qualification → Proposal → Negotiation → Signed`) — see §3.3 for the caveat on derived fields.

### 2.2 Investors (firms) — REAL ✅
**Source:** `Investor Tracker _ CRM.xlsx`, sheet `Contacts VC PE DFI` (77 numbered firms, 698 populated rows).
**Imported:** **84 investor firm records.**

Real, richly detailed — these are real funds with real people:
- Firm name + website (e.g. *Gulf Capital, Vantage Capital, OIKOCREDIT, AfricInvest, BlueOrchard, responsAbility, Norfund, FMO, IFC, Finnfund, IncoFin, I&P, Grassroots Business Fund, Triple Jump, Symbiotics, TLG Capital, Enko Capital*).
- **Geographic focus** and **sector focus** as free-text prose.
- **Investment-mandate prose** and **notes** (real relationship history, e.g. *"not investing till FY25", "LEFT to FMO", "DO NOT SHARE DEALS WITH ROSEMARY", "Already in discussion with Phil"*).

### 2.3 Investor contacts — REAL ✅
**Source:** same sheet, person-level rows.
**Imported:** **688 contact records** (name, role, email, phone where present). Real named individuals with real corporate emails and phone numbers, grouped under their firm.

### 2.4 Service providers (law firms) — REAL ✅
**Source:** `Investor Tracker _ CRM.xlsx`, sheet `Law Firms` (52 numbered firms, 167 populated rows).
**Imported:** **49 service-provider records** (type = Law Firm).
Real firms: *Anjarwalla & Khanna, Bowmans (Coulson Harney), Kaplan & Stratton, Hamilton Harrison & Mathews, IKM, KN Law, MMAN, DLA Piper, ENS Africa, Clyde & Co, AF Mpanga, Engoru Mutebi, KG Partners…* with partner names, emails and short deal-experience profiles.

### 2.5 Referral partners — REAL (derived) ✅
**Source:** the `Source/Referee` column of the Engagement tracker.
**Imported:** **131 partner records**, each with the list of client names they referred. Real, but note the derivation caveat in §3.2.

### 2.6 Tasks — REAL ✅
**Source:** `Tasks Tracker Whatsapp 2026_ CRM.xlsx`, sheet `Task Tracker` (406 populated rows).
**Imported:** **387 task records** (project/client, action point, status, deadline, owner, assist, notes).
The `Dashboard` sheet independently confirms **384 tasks** across **12 real team members** (Brenda C, Brian B, Cliff N, Evans W, Irine M, Joel M, Ken W, Sheilla W, Duncan M, Ivy N, Susan B, Solomon O) with status counts (Done 325 / Ongoing 38 / Pending 3 / Not started 6 / Dropped 12).

### 2.7 Team members — REAL ✅
The staff names in the Task dashboard, task owners, and deal leads are the **real NobleStride team** and are used as the CRM user list.

### 2.8 Reference taxonomies — REAL ✅
`Sectors and Milestones_ CRM.docx` (sector → sub-sector list; client-side and investor-side milestone lists) and the picklists in the Build Spec are NobleStride's real controlled vocabularies. These are legitimate configuration, not business records.

---

## 3. What data is NOT real (synthetic, curated, or derived)

Nothing in the pipeline is *invented out of thin air*, but the following is **not raw client data** and should not be presented to NobleStride as "their real data":

### 3.1 The demo seed slice — CURATED (`prisma/seed-data.json`)
This is an **older, hand-trimmed demo subset**, not the full import:
- 20 clients, 40 investors, 15 partners, 14 users — all drawn from the real names above but **cut down for a demo**.
- Some **framing text is fabricated** for presentation: mandate names like *"Atilla Poultry Farm – Capital Raise"* and next-action text like *"Kick off the transaction"* were generated, not taken from the sheet.
- Numeric fields it could not source are left **null** (e.g. `ticketMin`/`ticketMax`), which is correct — no amounts were invented.
- **Action:** the app should be driven by `real-data.json` (full 785/84/688/49/131/387), and `seed-data.json` should be retired or clearly labelled "demo" so no one mistakes the 20-client slice for the real pipeline.

### 3.2 Derived / inferred fields in the real import — DERIVED, not source
These exist in `real-data.json` but were **computed by heuristics**, not read from the sheet, so they are best-effort and should be treated as provisional:
- **Investor `investorType`** (PE / VC / DFI / Angel / …) — inferred from the firm name by keyword, because the sheet has no type column.
- **Investor `sectorFocus` / `geographicFocus` enums** — mapped from free-text prose by keyword; the raw prose is preserved in `investmentMandate`, which is the authoritative value.
- **Deal `stage` / `ndaStatus` / `eaStatus`** — inferred purely from which of the four date columns are filled. This is a proxy; the sheet has **no real pipeline-stage column** (see §4).
- **Partner records** — extracted from the free-text Source/Referee column; internal staff names and status words were filtered out by a denylist, so this is approximate.

### 3.3 Data-quality noise inside the real files — REAL but DIRTY
These are genuine cells, but they are messy and need cleaning/confirmation (do **not** silently "correct" them):
- **Bad date years**: e.g. `2014-10-17` (Paksons), `2027-01-16` (Busoga Flowers), `2026-12-02` (LOLC EA-signed) — typos in the source.
- **Stringly-typed dates**: `17/042025`, `4//2026`, `14/5/2026`, ` 17/09/25`.
- **Duplicate client rows**: *Zanifu Limited*, *Greenfire/GreenFire Innovation*, *Fresh Kyenyanja*, *Funscapes Limited*, *Microfin Uganda*, *Refuah Ltd Ghana*, *Savannah Hospital* each appear more than once (the importer keeps the most-recent/most-complete and de-dupes).
- **Placeholder / junk rows**: `xxxx xxxx`, blank-client rows carrying only a note, and three fee-total cells at the very bottom (*pakson 72500 / muhindi 189000 / synovia 285000 / total 546500*) that are not deal rows.

---

## 4. What data is MISSING (what NobleStride still needs to provide)

This is the core of the request. The provided Excel files cover the **relationship/pipeline layer** (who, when, NDA/EA status, tasks, contacts). They do **not** cover the **deal-economics layer, the company-profile layer, the investor-criteria layer, or any documents**. The Build Spec (`§3`) defines a data model that is far richer than what the three spreadsheets contain. Below, each gap is grounded.

### 4.1 The "Active Deals" deal-summary file — NOT PROVIDED (highest priority)
**Grounding:**
- Solomon's feedback email explicitly refers to *"the deal summary contained in the **Active Deals CRM file**"* and *"the current deal structure as set out in the CRM Excel templates that have already been shared."*
- The Scoping Document (line 124) describes a *"shared deal tracker, usually maintained as an Excel file showing each deal's **stage, status, funding target, responsible team members, next steps, and key developments.**"*

**What's missing:** No such file exists in `decrypted/`. The `Engagement contract Tracker` we have contains **only** NDA/EA dates + lead + source + a free-text note. It has **no** columns for:
- **Ticket size / amount being raised (USD)** — required field `Deal.Ticket size (USD Mn)` in Build Spec §3.2.
- **Sector** — required field (only occasionally hinted in the free-text note).
- **Deal type** (Debt / Equity / Equity & Debt) and **Instrument**.
- **Real pipeline stage / milestone** (Indicative TS, Term Sheet, DD, IC, Loan Agreement, SPA/SHA, Closed).
- **Deal status** (Open / On Hold / Closed / Dropped / Reopened).
- **Use of funds, max selling stake, probability of closure, VDR link, next steps.**

➡️ **Ask NobleStride for the "Active Deals" tracker (and any privately-shared/opportunistic deal trackers referenced in Scoping line 131).** This is the single biggest missing input and the one Solomon's own email points to.

### 4.2 Target-company profiles — NOT PROVIDED
**Grounding:** `Target companies Data Collector_ CRM.docx` is a **blank template** listing 20+ fields (legal name, year founded, HQ, countries, pitch deck, sector, core product, description, founders' gender & nationality, target clients, last-year revenue, revenue forecast, profitability, amount raising, instrument, expected post-money valuation, raised-to-date, existing investors, contacts). Build Spec §3.1 (Company/Target) requires many of these.

**What's missing:** **Zero populated company profiles.** None of these fields exist for any of the 785 deals. All company financials, valuations, founders, revenue and "amount raising" data is absent.

➡️ **Ask for the completed target-company intake data** (or the underlying teasers/IMs/financial models from which it can be populated). Confirm whether this lives in SharePoint per-deal folders.

### 4.3 Investor investment criteria (structured) — LARGELY NOT PROVIDED
**Grounding:**
- Build Spec §3.4 makes **ticket-size min/max, sector focus, geographic focus, instruments, and deployment status *required*** matching inputs.
- The Concept Note (lines 38–41) states: *"We already have **2000+ PE funds, DFIs etc** … We have their email addresses and their investment criteria."*
- `Data collected from potential investors_ CRM.docx` and `Template to Collect Investor Preferences_ CRM.docx` are **blank** collection forms — no responses captured.

**What's missing:**
- **Structured ticket size (min/max)** — absent; only occasionally buried in free-text notes. Cannot power the deal-matching engine as-is.
- **Structured instruments, deployment status, stage preference, target IRR, engagement classification, NDA status** — absent.
- **Volume gap:** the Concept Note claims 2000+ investor funds with criteria; only **84 firms / 688 contacts** were provided. **~1,900+ investor records are referenced but not supplied.** *(Confirm with NobleStride whether the full 2000+ list exists in exportable form.)*

➡️ **Ask for the full investor list with structured investment criteria** (or the Microsoft Form responses if the preference form was ever circulated).

### 4.4 Investor ↔ Deal engagement & disbursement history — NOT PROVIDED
**Grounding:** Build Spec §3.11 defines an *Investor-Deal Engagement* record *"from the **Term Sheet Deals tab**"* with **Total amount (USD Mn), Amount disbursed, Amount pending, engagement stage, term-sheet-issued, probability, engagement status (Disbursed/Ongoing/Fell off/Dropped).**"*

**What's missing:** There is **no "Term Sheet Deals" tab** in any provided workbook. So the entire record of *which investor is on which deal, term sheets issued, amounts committed/disbursed/pending* — the actual transaction-execution and commission (2%) data — is absent. Today it can only be glimpsed indirectly in the Task tracker notes (e.g. *"Umoja second disbursement", "Proteq disbursement due 23rd March"*).

➡️ **Ask for the Term Sheet / Deals / disbursement tracker.** Without it, analytics on closed deals, disbursed value and commission cannot be real.

### 4.5 Advisory (non-fundraising) engagements — NOT PROVIDED
**Grounding:** Build Spec §3.3 references an *"Advisory Work tab"* valued in KES; the Task tracker repeatedly mentions valuations and an *"Advisory Work Tracker."*
**What's missing:** No Advisory Work tab/file was provided. *(Optional add-on scope — confirm whether NobleStride wants it in Phase 1 before requesting.)*

### 4.6 Documents — NOT PROVIDED
**Grounding:** Build Spec §3.9 (Document) and Solomon's point #4 ("Document management — NDA, Engagement Contracts, Fee Share Agreements, VDR — integrated into the workflow").
**What's missing:** **No actual documents** — no NDAs, engagement contracts, teasers, IMs, financial models, valuation reports, term sheets, fee-share agreements, or CR12s. The spreadsheets only record *whether/when* an NDA/EA was sent/signed, not the files.

➡️ **Ask for the document repository** (likely SharePoint) or a representative sample per deal stage, plus the NDA / Engagement / Fee-Share **templates**.

### 4.7 Communications history — NOT PROVIDED
**Grounding:** Build Spec §3.10 (Communication) and the Concept Note's Office-365/WhatsApp integration ambition.
**What's missing:** No email or WhatsApp correspondence logs. These live in Office 365 / WhatsApp and were not exported. *(This is expected to arrive via integration rather than a file — confirm the intended source.)*

### 4.8 Partner commercial terms — PARTIAL
**Grounding:** Build Spec §3.6 wants partner **email, phone, fee-sharing agreement & terms, NDA/partner-agreement status.**
**What's missing:** Partners were derived from a single free-text column only. **No partner emails, phones, or fee-share terms** were provided.

### 4.9 Service-provider fees & full contacts — PARTIAL
**Grounding:** Build Spec §3.7 wants **fee/amount** and complete contacts.
**What's missing:** Law-firm records have partner names/emails and deal-experience blurbs, but **no engagement-specific fee amounts** and inconsistent phone/email coverage.

---

## 5. Missing-data checklist to hand to NobleStride

| # | Item to provide | Grounded in | Priority |
|---|-----------------|-------------|----------|
| 1 | **"Active Deals" tracker** (deal summary: funding target, sector, deal type, stage, status, next steps, team) | Solomon email; Scoping §124 | 🔴 Critical |
| 2 | **Term Sheet / Deals / disbursement tracker** (amounts, disbursed/pending, investor-per-deal, 2% commission) | Build Spec §3.11 | 🔴 Critical |
| 3 | **Structured investor criteria** (ticket min/max, instruments, stage, deployment status) + the full **2000+ investor list** | Build Spec §3.4; Concept Note | 🔴 Critical |
| 4 | **Target-company profiles / intake data** (financials, valuation, raise amount, founders) | Target-company template; Build Spec §3.1 | 🟠 High |
| 5 | **Documents** — NDAs, engagement & fee-share agreements, teasers, IMs, models, term sheets (+ templates) | Build Spec §3.9; Solomon #4 | 🟠 High |
| 6 | **Partner** emails/phones + **fee-sharing** terms | Build Spec §3.6 | 🟡 Medium |
| 7 | **Service-provider** engagement fees + complete contacts | Build Spec §3.7 | 🟡 Medium |
| 8 | **Advisory Work tab** (if Phase-1 scope) | Build Spec §3.3 | ⚪ Optional |
| 9 | **Communications** source (Office 365 / WhatsApp) — via integration, confirm source | Build Spec §3.10 | ⚪ Integration |
| 10 | **Confirmation / correction** of the dirty cells in §3.3 (bad dates, duplicates) — do not auto-fix silently | This audit | 🟡 Medium |

---

## 6. How this maps to Solomon's feedback (NobleStride reply)

Solomon's email is about **product/UX** and is consistent with the data findings:

1. **Replace Kanban with a queue/list (Jira-style) view** — a presentation choice; the 785-row real pipeline is already list-shaped and suits a sortable/filterable/exportable queue better than a board. *(No new data needed.)*
2. **"Retain the existing CRM deal structure … as set out in the CRM Excel templates already shared"** — reinforces item #1 in §5: build the deal grid on the real tracker columns, but the **richer deal-summary columns require the Active Deals file** that has not yet been shared.
3. **Analytics/Summary from the "Active Deals CRM file" deal summary** — **directly depends on the missing file in §4.1.** We cannot produce a real deal-summary analytics view until that file is provided; anything shown before then is placeholder.
4. **Document management (NDA, Engagement Contracts, Fee-Share Agreements, VDR) tied to workflow stages** — **depends on §4.6** (documents not yet provided). The stage hooks exist; the files do not.
5. **Consolidate Mandate & Transaction menus** — UX consolidation; no new data.
6. **Flexible filtering / custom views / export** — enabled by the real data already loaded; will be materially better once the deal-economics columns (§4.1) arrive so users can filter by sector, ticket size, stage, etc.

**Bottom line for the reply to NobleStride:** the relationship/pipeline data (deals, investors, contacts, law firms, partners, tasks) is **real and loaded**. To reach the end-to-end, 100%-real, no-synthetic target — and to build the list/analytics/document views Solomon asked for — NobleStride needs to provide the **Active Deals deal-summary file, the term-sheet/disbursement data, structured investor criteria (and the full investor list), target-company profiles, and the actual documents** (items #1–#5 in §5).

---

## 7. Appendix — record counts as loaded

Authoritative import (`noblestride-crm/prisma/real-data.json`):

| Entity | Count | Source file / sheet |
|--------|------:|---------------------|
| Deals / mandates | **785** | Engagement contract Tracker |
| Investor firms | **84** | Investor Tracker · Contacts VC PE DFI |
| Investor contacts | **688** | Investor Tracker · Contacts VC PE DFI |
| Service providers (law firms) | **49** | Investor Tracker · Law Firms |
| Referral partners | **131** | Engagement tracker · Source/Referee (derived) |
| Tasks | **387** | Tasks Tracker · Task Tracker |

Demo slice (`prisma/seed-data.json`, curated — retire/label): 20 clients · 40 investors · 15 partners · 14 users.
