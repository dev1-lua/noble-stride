# Investor & Partner Build + Viewpoint Switcher — Design Spec

**Date:** 2026-06-26
**Status:** Approved design, pre-implementation
**Scope:** Data-model rebuild for the Investor & Partner domains, the §11 investor/partner visibility engine, external portals, a demo "view-as" switcher, and a display-only in-org RBAC matrix. **AI/agents explicitly out of scope** for this build.
**Authority:** `Lua x Noblestride - Build Specification (INTERNAL) v2.0` §3 (data dictionary), §6–7 (audit/access), §11 (investor visibility), §13 (dashboards). Field lists cross-checked against the decrypted client trackers (`Investor Tracker`, `Engagement contract Tracker`, `Law Firms` tab).

---

## 1. Goals

1. Make the **partner** and **investor** pipelines spec-complete at the data layer (the two areas the client flagged as incomplete).
2. Stand up **external Partner and Investor views** that enforce the spec's confidentiality model — investors/partners see only what their stage and classification permit.
3. Provide a **demo viewpoint switcher** (Admin / Investor / Partner) so the team can show the CRM through each lens with no login.
4. Provide a **display-only in-org access matrix** (Admin / Deal Lead / Team Member) to illustrate who-sees-what internally.

**Non-goals:** AI agents, WhatsApp/email capture, website intake, real authentication, enforced in-org RBAC, advisory engagements.

---

## 2. Architecture overview

- **One gating authority.** All external visibility flows through a single server-side projector module (`src/server/visibility/`). UI never decides what an external role sees; it renders whatever the projector returns. This keeps the confidentiality rules in one auditable place.
- **Viewpoint is request context, not auth.** The active viewpoint (role + optional impersonated investor/partner id) is carried in CRM context (cookie/searchParam for the demo). Resolvers branch on it: internal roles get full data; external roles get projected data.
- **Data model first.** Sections 3–4 land before any portal/UI work; the projector and portals depend on the new `Engagement`, `Investor`, `Partner`, `Document` shapes.

---

## 3. Data model — new models

### 3.1 `ServiceProvider` (new) — spec §3.7, grounded in the Law Firms tab
| Field | Type | Req | Notes |
|---|---|---|---|
| id | cuid | Y | |
| name | String | Y | |
| type | `ServiceProviderType` | Y | LawFirm / Audit / Tax / ESG / Technical / Other |
| contactPerson | String | N | |
| email | String | N | |
| phone | String | N | |
| profile | String | N | |
| fee | Decimal | N | "Amount" in the Law Firms tab |
| currency | String | N | default USD |
| status | String | N | |
| engagedOn | Transaction[] (M:N) | N | deals the provider works on |
| createdSource | ActorSource | Y | existing provenance pattern |

### 3.2 `Document` (new) — spec §3.8, grounded in the Engagement Contract Tracker
| Field | Type | Req | Notes |
|---|---|---|---|
| id | cuid | Y | |
| name | String | Y | |
| type | `DocumentType` | Y | NDA / EngagementContract / Teaser / IM / FinancialModel / Valuation / PitchDeck / AuditedAccounts / CR12 / TermSheet / LoanAgreement / SPA / SHA / Other |
| version | String | N | |
| accessLevel | `DocumentAccessLevel` | Y | Internal / ClientShared / InvestorShared / VDR — **read by the visibility engine** |
| status | `DocumentStatus` | N | Draft / UnderReview / Approved / Shared / Executed |
| fileUrl | String | N | storage ref/link (no upload pipeline this build; URL/link field) |
| uploadedById | FK User | N | |
| uploadedAt | DateTime | Y | |
| transactionId / clientId / investorId | FK (nullable) | one req | linked record |

> File **upload/storage pipeline is out of scope** this build — `Document` stores metadata + a link/URL. The model is built in full so access-level gating works now; binary storage is a later pass.

---

## 4. Data model — reworked models & enums

### 4.1 `Engagement` (Investor-Deal link) — spec §3.5 — **largest change**
Replace the 6-value `status` with the spec stage model and add disbursement tracking.

Add: `engagementStage` (`EngagementStage`), `interestLevel` (`InterestLevel?`), `ndaType` (`NdaType?`), `termSheetIssued` (Boolean), `termSheetDate` (DateTime?), `totalAmount` / `amountDisbursed` / `amountPending` (Decimal USD Mn), `disbursementStatus` (`DisbursementStatus?`), `dateReceived` (DateTime?), `year`/`quarter` (Int?, derived from dateReceived in the service layer), `probability` (Int? percent), `feedback` (String?).

Remove: `EngagementStatus` enum + `status` field (superseded by `engagementStage`). Migration maps old → new (Committed→Invested, Passed→Declined, else→Shared).

### 4.2 `Investor` — spec §3.1
Add (gating-critical): `engagementClassification` (`InvestorEngagementClassification`, default Active), `ndaStatus` (`InvestorNdaStatus`, default None).
Add (profile): `shareholdingPreference`, `minRevenue`/`minEbitda`/`minLoanBook` (Decimal?), `pricingPreference`, `remainingInvestmentPeriod`, `ddRequirements`, `icApprovalProcess`, `trackRecord`, `investmentMandate`, `nextActionDate` (DateTime?), `feedback`, `ssaRegionContactId` (FK Person?).

### 4.3 `Partner` (Referral/Partner) — spec §3.6
Add: `advisorType` (`AdvisorType?`), `organization`, `email`, `phone`, `feeSharingAgreement` (Boolean default false), `feeSharingTerms` (String?), `partnerAgreementStatus` (`PartnerAgreementStatus`, default None), `internalOnly` (Boolean default true).
`PartnerType` is retired for new use (provider types move to `ServiceProviderType`; referral types become `AdvisorType`). Existing rows migrate by mapping LawFirm/Auditor → spin off / relabel; kept nullable to avoid data loss.

### 4.4 `Person` (Investor/Partner/Client contact) — spec §3.2
Add: `isPrimaryContact` (Boolean default false), `isSSAContact` (Boolean default false). (Email-domain warning for generic Gmail/Yahoo on fund contacts is UI-layer, not a field.)

### 4.5 New enums
`EngagementStage` (Shared, TeaserSent, NDASigned, IMShared, VDRAccess, Meeting, InfoRequest, DueDiligence, TermSheet, Offer, Invested, Declined) · `InterestLevel` (Low, Medium, High) · `NdaType` (Open, Closed) · `DisbursementStatus` (Disbursed, Ongoing, FellOff, Dropped) · `InvestorEngagementClassification` (Active, Inactive, OnHold, Excluded, Greylisted) · `InvestorNdaStatus` (None, OpenNDA, ClosedNDA) · `AdvisorType` (Lawyer, Investor, Consultant, TransactionAdvisor, AdvisoryFirm, Other) · `ServiceProviderType` (LawFirm, Audit, Tax, ESG, Technical, Other) · `DocumentType` (14 values above) · `DocumentAccessLevel` (Internal, ClientShared, InvestorShared, VDR) · `DocumentStatus` (Draft, UnderReview, Approved, Shared, Executed) · `PartnerAgreementStatus` (None, Sent, Signed).

### 4.6 Enum corrections
`InvestorType` += `Corporate`, `Individual`. `Sector` += `Aviation`, `Construction`, `Hospitality`, `Leasing`, `MediaEntertainment`, `Services`, `TransportLogistics`, `WaterSanitation`.

---

## 5. Visibility engine (§11) — the gating authority

Module `src/server/visibility/` exposes:
- `investorTier(investor, engagement?) → Tier` where `Tier ∈ { NONE, PRE_INTEREST, AFTER_NDA, DD }`
- `projectDealForInvestor(deal, tier) → PartialDeal` (strips fields per the matrix)
- `discoverableDealsForInvestor(investor) → Deal[]` (filtered by focus + classification)
- `projectForPartner(partner) → { ownProfile, ownReferredDeals }`

### 5.1 Tier resolution
| Condition | Tier |
|---|---|
| classification ∈ {Excluded, Greylisted, Inactive, OnHold} | NONE |
| engagement.stage = Declined | NONE |
| no engagement OR stage ∈ {Shared, TeaserSent} | PRE_INTEREST |
| stage ∈ {NDASigned, IMShared, Meeting, InfoRequest, TermSheet, Offer} | AFTER_NDA |
| stage ∈ {VDRAccess, DueDiligence, Invested} | DD |

### 5.2 Field matrix (encoded as data, straight from §11)
| Field group | PRE_INTEREST | AFTER_NDA | DD |
|---|---|---|---|
| Company profile, sector, target profile | ✓ | ✓ | ✓ |
| Deal type, requested ticket size | ✓ | ✓ | ✓ |
| Revenue, EBITDA, total assets, use of funds | limited | ✓ | ✓ |
| Status of matching active mandates | ✓ | ✓ | ✓ |
| Full financials, IM, financial model | ✗ | ✓ | ✓ |
| VDR / DD files (`Document.accessLevel=VDR`) | ✗ | on request | ✓ |
| Advisor & client contacts | ✗ | ✗ | ✓ |
| Other investors on the deal | ✗ | ✗ | ✗ |
| Engagement contracts | ✗ | ✗ | ✗ |
| Investor feedback / offers / client responses | ✗ | ✗ | ✗ |
| Internal team messages | ✗ | ✗ | ✗ |

**Hard rules (never overridable):** other investors' identities, partner/consultant identities, internal notes, and engagement contracts are never visible to any external role.

### 5.3 Investor filters (portal)
Country · sector · ticket size · deal/facility type · core financials (revenue, EBITDA, net profit) · impact (women-led, youth-led). Discovery list = active investors see matching mandates only; Excluded/Greylisted/Inactive/OnHold see an empty portal.

### 5.4 Partner view
Read-only: own `Partner` profile, own referred deals with stage + conversion + fee-sharing status. Never other partners, investor identities, internal notes, or full deal financials.

---

## 6. Viewpoint switcher (UX)

- Global top-bar control with two parts: **role** (Admin / Investor / Partner) and, when Investor/Partner is chosen, a **record picker** (which investor/partner to impersonate).
- Selection persists in CRM context (cookie + URL param) and drives resolver branching.
- Persistent banner: "Viewing as Investor — Gulf Capital (after-NDA)" with a one-click return to Admin.
- Internal nav (dashboards, full lists, admin) hidden for external viewpoints; external viewpoints land on their portal.

---

## 7. In-org access matrix (Admin, display-only)

- Within the Admin viewpoint, a second dropdown selects an org role: **Admin / Deal Lead / Team Member**.
- Renders the §7 access matrix as a grid (entity rows × C/R/U/none) for the selected role. Cells editable in-session for illustration; **not persisted, not enforced**.
- Purpose: explain internal visibility in the demo. A banner states it is illustrative.

---

## 8. Build sequence (milestones)

1. **M1 — Schema & migration:** new models, reworked models, enums, enum fixes; Prisma migration with old→new mapping; seed/backfill so the demo data populates new fields (stages, classifications, disbursement amounts, fee-sharing, document records).
2. **M2 — Services & GraphQL:** CRUD for ServiceProvider, Document; extend Investor/Partner/Engagement inputs & resolvers; engagement-stage + disbursement mutations.
3. **M3 — Visibility engine:** projector module + unit tests against the §11 matrix (table-driven).
4. **M4 — Internal pipeline UI:** Engagement stage kanban + disbursement view; Partner fee-sharing/conversion view; ServiceProvider list; Document list per deal.
5. **M5 — External portals:** Investor portal (discovery + gated deal view) and Partner portal, both fed by the projector.
6. **M6 — Viewpoint switcher + Admin access matrix.**

---

## 9. Testing

- **Visibility engine:** table-driven unit tests — for each (classification × stage × field-group) assert the matrix outcome; explicit tests that other-investor identity, partner identity, internal notes, and engagement contracts are never returned at any tier.
- **Migration:** assert old `EngagementStatus` rows map to the correct `EngagementStage` and no engagement loses its investor/deal link.
- **Portals:** smoke tests that an Excluded/Greylisted investor sees an empty portal and a PRE_INTEREST investor cannot see financials/IM/VDR.

---

## 10. Open items (confirm with Noblestride; do not block build)
- Exact VDR "on request" behavior after NDA (request flow vs. simply hidden until granted) — building as "hidden until VDRAccess stage."
- Open vs Closed NDA → data-room scope mapping (§17 open item).
- Final picklist values / team-member user list.
- Whether `internalOnly=false` partners are ever surfaced anywhere external (default: never).
