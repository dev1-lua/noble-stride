# What Was Built — Investor & Partner **Data Layer** (Plan 1 of 3)

**Status:** ✅ Complete, merged to `main`, 77/77 tests green, live in the seeded demo DB.
**Scope of this plan:** the **data foundation only** — database models, migrations, GraphQL API, validation, and seed data. **No UI, no portals, no visibility gating** (those are Plans 2 & 3 — see the bottom of this doc).

> Why the screens look unchanged: every new field below is live in the **database + GraphQL API**, but the existing pages/forms were **not** rewired to display or edit them. That work is Plans 2 & 3.

---

## TL;DR

| | |
|---|---|
| New database tables | **2** — `ServiceProvider`, `Document` |
| Reworked table | `Engagement` (added the 12-stage pipeline + disbursement tracking) |
| Extended tables | `Investor`, `Partner`, `Person` |
| New controlled vocabularies (enums) | **12** new + 2 widened (`Sector`, `InvestorType`) |
| DB migrations | 6 (all additive, no data loss) |
| Layers wired | Prisma schema → migration → GraphQL type/input/mutation → service → Zod validation → seed |
| Tests | 77 passing across 23 files |
| Code commits (this plan) | 11 (`feat`/`fix`/`test`) + 1 docs commit |

---

## 1. New models

### `ServiceProvider` (§3.7) — legal/audit/tax/ESG advisors per deal
Fields: `name`, `type` (LawFirm / Audit / Tax / ESG / Technical / Other), `contactPerson`, `email`, `phone`, `profile`, `fee` (Decimal), `currency`, `status`, `createdSource`, timestamps. Many-to-many link to `Transaction` (`engagedOn`). Full CRUD (create/update/delete/list/get) via GraphQL + service + Zod.

### `Document` (§3.8) — teasers, IMs, NDAs, term sheets, etc.
Fields: `name`, `type` (NDA / EngagementContract / Teaser / IM / FinancialModel / Valuation / PitchDeck / AuditedAccounts / CR12 / TermSheet / LoanAgreement / SPA / SHA / Other), `version`, **`accessLevel`** (Internal / ClientShared / InvestorShared / VDR — *this is what the future visibility engine reads*), `status` (Draft / UnderReview / Approved / Shared / Executed), `fileUrl` (link only — no binary upload this build), plus optional links to User (uploader), Transaction, Client, Investor. Full CRUD.

---

## 2. Reworked model — `Engagement` (investor ↔ deal link) (§3.5)

The biggest change. Added alongside the existing status field (legacy kept intentionally, removal deferred to Plan 3):

- **`engagementStage`** — the real 12-stage pipeline: Shared → TeaserSent → NDASigned → IMShared → VDRAccess → Meeting → InfoRequest → DueDiligence → TermSheet → Offer → Invested / Declined
- **Disbursement tracking:** `totalAmount`, `amountDisbursed`, `amountPending` (auto-computed = total − disbursed), `disbursementStatus` (Disbursed / Ongoing / FellOff / Dropped), `termSheetIssued` + `termSheetDate`, `dateReceived`, derived `year` / `quarter`, `probability`
- **`interestLevel`** (Low / Medium / High), **`ndaType`** (Open / Closed), `feedback`
- New `createEngagement` / `updateEngagement` mutations (with the correct partial-update recompute of `amountPending`).

---

## 3. Extended existing models

### `Investor` (§3.1) — +16 fields
- **`engagementClassification`** (Active / Inactive / OnHold / Excluded / **Greylisted**) — drives future visibility
- **`ndaStatus`** (None / OpenNDA / ClosedNDA)
- Profile depth: `minRevenue`, `minEbitda`, `minLoanBook` (Decimal), `shareholdingPreference`, `pricingPreference`, `remainingInvestmentPeriod`, `ddRequirements`, `icApprovalProcess`, `trackRecord`, `investmentMandate`, `nextActionDate`, `feedback`
- `ssaRegionContact` → link to a `Person`

### `Partner` (§3.6) — +8 fields
- **`feeSharingAgreement`** (bool) + **`feeSharingTerms`** (text)
- **`internalOnly`** (default true — introducer identity never exposed to investors; a hard confidentiality rule)
- `partnerAgreementStatus` (None / Sent / Signed), `advisorType` (Lawyer / Investor / Consultant / TransactionAdvisor / AdvisoryFirm / Other), direct `organization` / `email` / `phone`

### `Person` (§3.2) — +2 fields
- `isPrimaryContact`, `isSSAContact`

---

## 4. Controlled vocabularies

**12 new enums:** EngagementStage, InterestLevel, NdaType, DisbursementStatus, InvestorEngagementClassification, InvestorNdaStatus, AdvisorType, ServiceProviderType, DocumentType, DocumentAccessLevel, DocumentStatus, PartnerAgreementStatus — each with a human-readable label in `vocab.ts`.

**Widened:** `Sector` +8 (Aviation, Construction, Hospitality, Leasing, Media & Entertainment, Services, Transport & Logistics, Water & Sanitation); `InvestorType` +2 (Corporate, Individual).

---

## 5. Verification — it's real and running

**Tests:** `npm run test` → **77 passing, 23 files** (unit tests for disbursement math + Zod schema validation; smoke tests for the GraphQL schema shape; DB-backed tests for the seed and the engagement merge logic).

**Live seeded demo DB** (queried directly):

| Check | Result |
|---|---|
| `ServiceProvider` rows | 4 |
| `Document` rows | 5 |
| `Engagement.engagementStage` distribution | DueDiligence 14, TeaserSent 12, TermSheet 11, Invested 8, Shared 8, Declined 7 |
| Engagements with disbursement amounts | 8 (the Invested ones) |
| Investors with Excluded/Greylisted classification | 2 (1 Excluded, 1 Greylisted) |
| Partners with fee-sharing agreement | 4 (advisor types: Lawyer, Investor, TransactionAdvisor, AdvisoryFirm) |

**Migrations (6, all additive):** `engagement_stages_disbursement`, `add_service_provider`, `add_document`, `extend_investor`, `extend_partner`, `person_contact_flags`.

---

## 6. What is **NOT** built yet (the honest gap)

This plan deliberately stopped at the data layer. Not done:

- ❌ **No UI** for any of the new fields — the Investor/Partner/Engagement edit forms have **no dropdowns** for classification, stage, fee-sharing, etc. yet.
- ❌ **No investor/partner portal** and **no "view as investor/partner" viewpoint switcher.**
- ❌ **No visibility engine** — nothing yet enforces what an investor/partner is allowed to see (the `accessLevel` / classification fields exist but aren't read by any gating logic yet).
- ❌ No stage kanban, no disbursement dashboard.
- ❌ No AI/agents (out of scope for all three plans in this effort).

### What comes next
- **Plan 2 — Visibility engine (§11):** server-side module that decides, per investor/partner, which deals and fields they may see (table-driven, heavily tested).
- **Plan 3 — Portals + viewpoint switcher + in-org access matrix:** the actual external Investor & Partner views, the demo "view as" switcher, and the stage/disbursement UI.

Design for both already exists at `docs/superpowers/specs/2026-06-26-investor-partner-portals-design.md` (§5–§7).

---

## 7. Commits (this plan)

```
69bdf1b feat(crm): seed backfill for engagement stages, classifications, providers, documents
8f0a031 test(crm): make engagements-crud smoke test self-contained + serialize DB test files
c7ed868 feat(crm): person primary/SSA contact flags (spec §3.2)
1d111fc feat(crm): partner fee-sharing, advisor type, internal-only (spec §3.6)
4d3785b test(crm): expand Investor Zod lockdown to all 16 Task-5 fields
ac94b52 feat(crm): extend Investor with classification, NDA status, profile fields (spec §3.1)
78ca37b feat(crm): Document model + access levels (spec §3.8)
a8cee35 fix(crm): harden ServiceProvider Zod schema to match partner.ts idioms
f9e7cea feat(crm): ServiceProvider model + CRUD (spec §3.7)
ad72f8c fix(crm): correct engagement partial-update merge + nativeEnum validation
10a5dad feat(crm): engagement stages + disbursement tracking (spec §4)
e513a57 feat(crm): add investor/partner controlled vocabularies (spec §4)
```

## 8. See it yourself
- Run the app: `npm run dev` → http://localhost:3000 (the data is in the DB + GraphQL API; the old screens just don't surface it yet).
- Run the tests: `npm run test`
- Inspect the DB directly: `docker exec noblestride-postgres psql -U noblestride -d noblestride -c "\\d \"Engagement\""`
