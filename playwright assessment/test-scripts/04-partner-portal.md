# 04 — Partner Portal

Covers all 3 routes under `src/app/portal/partner/`: Overview (`/portal/partner`), Submit Referral
(`/refer`), My Details (`/details`). This portal has no seeded demo credentials listed in the task
brief — if a partner login isn't readily available, register/derive one via an Admin session (check
a Partner record's linked contact email in `/partners/[id]`, or ask whoever manages the seed DB for a
partner login). If genuinely no partner credential can be obtained, mark the affected steps "not
exercised — no partner credential available" rather than skipping the script silently, and note it
prominently in the handoff.

All data on this portal is scoped server-side to the acting partner's own record
(`loadPartnerPortalData`) via the session/viewpoint cookie — never a client-supplied id.

---

## 1. Overview (`/portal/partner`)

| # | Step | Expected | Record result |
|---|---|---|---|
| 1.1 | Load `/portal/partner`. | Referral Funnel (Introduced/In Progress/Signed/Lost counts), Referrals-by-Stage bar chart with deal-size totals, Expected Fee section (only if `feeSharingAgreement` is true for this partner), 3 summary tiles (Deals referred / Converted / Conversion rate %), full referred-deals table (mandate, client, stage, deal size, fee-sharing status, partner-fee-status chip). | Pass/Fail — |
| 1.2 | If this partner has NO fee-sharing agreement. | Expected Fee section correctly omitted (not shown as empty/zero). | Pass/Fail — |
| 1.3 | Cross-check the referred-deals table row count against this partner's `/partners/[id]` "Referred Mandates" list in the Admin CRM (same partner, viewed via Admin session). | Counts/records should agree (same underlying data, different views) — note any discrepancy. | Pass/Fail — |
| 1.4 | Confirm no other partner's referrals ever appear in this table (session-scoped). | Only this partner's own referred deals. | Pass/Fail — SECURE |
| 1.5 | Check the topbar for the design-unification treatment (colored icons if a sidebar exists for partner portal, Card borders/shadow on the stat tiles/table). | Consistent with the investor portal's design (see `06-cross-cutting.md` §7 cross-portal parity). | Pass/Fail — |

---

## 2. Submit Referral (`/portal/partner/refer`)

Fields: Company name (required, client + server validated), Sector (optional select), Estimated deal
size USD (optional numeric), Contact at company (optional), Context/why-a-fit (optional textarea).
Acting partner id is always resolved server-side from the session — never trusts a client-passed id.

| # | Step | Expected | Record result |
|---|---|---|---|
| 2.1 | Load `/portal/partner/refer`. | Form renders with all 5 fields listed above. | Pass/Fail — |
| 2.2 | Submit with Company name blank. | Rejected: `redirect("/portal/partner/refer?error=name")` → inline "Company name is required." | Pass/Fail — |
| 2.3 | Submit with only Company name filled (all optional fields blank). | Succeeds — confirms optional fields are truly optional. | Pass/Fail — |
| 2.4 | Fill all 5 fields with realistic test data (prefix with something identifiable, e.g. "QA Referral Co", per the existing convention from the 2026-07-07 pass) and submit. | Success → `?submitted=1` → green "Referral received" banner. Log this created record in `../04-TEST-ARTIFACTS-LEFT-IN-DB.md`. | Pass/Fail — |
| 2.5 | As Admin, verify the referral created a Client + Mandate record and incremented this partner's referral funnel (cross-check `/portal/partner` Overview and the CRM `/partners/[id]` detail). | New Client "QA Referral Co" (or similar) and a Mandate exist; funnel count on Overview incremented. | Pass/Fail — |
| 2.6 | Attempt to submit a referral with a crafted/injected Company name (e.g. `<script>alert(1)</script>` or a very long string). | Stored/rendered safely — no script execution anywhere it's later displayed (CRM client list, partner overview table). | Pass/Fail — SECURE |
| 2.7 | Attempt to tamper with the acting-partner identity (e.g. replay the form submission with a modified hidden field or cookie claiming a different partner id, if such a field is exposed in the DOM). | Server always resolves the acting partner from the session/viewpoint cookie, ignoring any client-supplied partner id — the referral attributes to the REAL logged-in partner regardless of tampering. | Pass/Fail — SECURE |

---

## 3. My Details (`/portal/partner/details`)

Partnership Status section is READ-ONLY (Partner name, Advisor type, Partner agreement status,
Fee-sharing agreed/terms) with a note "Agreement status and fee-sharing terms are maintained by
NobleStride." Only Contact Details (Email, Phone, Organization) are editable —
`updateOwnDetailsAction` explicitly rejects/ignores advisorType/agreement fields.

| # | Step | Expected | Record result |
|---|---|---|---|
| 3.1 | Load `/portal/partner/details`. | Partnership Status card (read-only) + Contact Details card (editable: Email, Phone, Organization). | Pass/Fail — |
| 3.2 | **Re-check BUG-07**: compare this page's "Advisor type" value against the SAME partner's Advisor type shown in the CRM at `/partners/[id]` (Admin session, `02-admin-crm.md` §6.3). | Per code research, both surfaces read the same shared vocab (`label("AdvisorType", …)`) from the same field — expect them to AGREE now (FIXED/not reproducible). If they still disagree for a live record, log as a genuine data-inconsistency finding (a specific record's stored value may differ from what's expected, even though the code paths are unified) — note the exact partner name and both values seen. | Pass/Fail — |
| 3.3 | Attempt to edit Advisor type or Partner agreement status directly (inspect whether any input exists for them on this page). | No editable control exists for these fields — confirm they are genuinely read-only here, not just visually disabled while still submittable. | Pass/Fail — |
| 3.4 | Edit Email, Phone, and Organization, Save. | Persists; reload confirms the DB write (not just optimistic UI). | Pass/Fail — |
| 3.5 | Attempt to submit an invalid email format in the Email field. | Clear validation error, not a silent failure or crash. | Pass/Fail — |
| 3.6 | As Admin, change this partner's Advisor type in the CRM (`/partners/[id]` edit drawer), save, then reload the partner's My Details page. | The portal reflects the CRM-set value correctly (single shared source of truth) — confirms the "no divergent value set" conclusion from code research empirically, not just by reading code. | Pass/Fail — |

---

## 4. Referral tracking / funnel accuracy

| # | Step | Expected | Record result |
|---|---|---|---|
| 4.1 | As Admin, advance the stage of a referred mandate/transaction that originated from this partner (e.g. move it from "New Lead" toward "Signed" via `/deals` restage). | On reload, the partner's Overview funnel (Introduced/In Progress/Signed/Lost) and conversion-rate tile reflect the new stage. | Pass/Fail — |
| 4.2 | If a referred deal reaches "Closed"/Signed with a fee-sharing agreement in place. | Expected Fee section reflects the closed deal appropriately (exact calculation not fully confirmed by code research — note actual displayed behavior). | Pass/Fail — describe |
| 4.3 | Mark a referred deal "Lost"/Dropped as Admin. | Partner's funnel "Lost" count increments; conversion rate recalculates. | Pass/Fail — |

---

## Summary

- 3 routes, 4 subsections, ~19 test cases.
- Flagship re-check: BUG-07 (§3.2, §3.6) — code research suggests this is likely FIXED/not
  reproducible via the shared vocab, but confirm empirically against a live record since a specific
  seed record could still carry a stale/divergent stored value even with unified code paths.
- Security-relevant: §1.4 (session-scoped data), §2.6 (injection), §2.7 (identity-tampering on
  referral submission).
