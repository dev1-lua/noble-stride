# Blockers — NobleStride CRM (2026-07-07)

Things that block **real-world use / go-live / the next phase**, as opposed to individual bugs.
These are mostly *known* scope decisions (the build is a configured PoC), but they are the gates
between "demo" and "operating platform", so they belong in one place.

---

## BLOCKER-A — No real authentication or sessions
**Impact:** Cannot be exposed to real investors/partners/staff.

- Login is demo-only: **any password works**; the email is looked up against contacts and mapped to a viewpoint cookie (`src/app/login/actions.ts`, `src/server/onboarding/resolve-login.ts`). No credentials, no session, no password hash.
- The **viewpoint switcher lets anyone impersonate anyone**. Any logged-in portal user can pick any investor or partner from a dropdown — including seeing the full list of investor names *and their confidential status labels* (Greylisted / Excluded / Inactive / On Hold). In production this is a critical access-control hole; today it's an intentional demo affordance, but it must be removed/gated behind real auth before go-live.
- `resolveLogin` treats **any** `@noblestride.<tld>` email as Admin with no verification.

**Gate:** real IdP / credentials + server sessions + removal of the impersonation switcher (or restrict to Admin only).

## BLOCKER-B — Company/client financial data is absent
**Impact:** Two of the platform's headline capabilities can't be validated or demoed truthfully.

- Client records hold only sector + geography (see BUG-16). There is no revenue, EBITDA, audited-accounts, HQ, founders, or contact data.
- Because of this, the **post-NDA financial disclosure** (Spec §11) shows `—` even to fully-engaged investors, and the **first-pass qualification** logic (Spec §10.2) has nothing to score.

**Gate:** load the real Company/Target data from the Excel trackers (`decrypted/*.xlsx`, `Target companies Data Collector`, `Template to Collect Investor Preferences`) into the required §3.1 fields.

## BLOCKER-C — Channel integrations not built (a core SOW workstream)
**Impact:** The "capture channel signal" workstream (SOW §02/§05, Spec §8–§9, §14) is not demonstrable.

- **WhatsApp** correspondence capture/classification (Spec §9): none.
- **Email / Outlook (M365)** capture (Spec §14): none.
- **SharePoint / document storage**: documents are display-only metadata rows — **no upload, download, or file storage** anywhere in the app.
- The **4 spec agents** (Client, Investor, Investor Tracker, Referral/Partner — Spec §8) are not built. The dashboard's "Overview / Prospecting / CRM" agent cards are a different, largely cosmetic surface (an insights panel + an "Ask" box), not the channel agents the SOW commits to.

**Gate:** these are Phase-1 deliverables (Spec §15) — either build them or explicitly re-scope with the client. Per the existing internal gap analysis these are already tracked as "not built", so this blocker is about *closing the SOW deliverable list*, not a regression.

## BLOCKER-D — "Website intake & qualification agent" is built for the wrong actor
**Impact:** Spec §10 deliverable is not met as specified.

- Spec §10 = a **website agent that collects a fundraising company's** intake fields and runs first-pass qualification (revenue, audited accounts, restricted sectors, SSA, etc.), routing qualified *leads* to a deal lead.
- What exists is `/register` — an **investor** self-registration + OTP + review-queue flow. That flow is good and works (it implements the investor-visibility onboarding), but it is **not** the company/fundraiser intake+qualification agent §10 describes. The qualification ruleset (§10.2) is not implemented anywhere.

**Gate:** build the company-side intake form + qualification screen + routing, or re-scope §10.

---

## Not blockers, but confirm with client (from Spec §17 open items)
- Advisory Engagement (§3.3) in or out of PoC — currently **not built** (correct default; §19.2).
- Open vs Closed NDA → VDR scope mapping (§17.8) — NDA recording exists; the exact VDR gate semantics need the client's rule.
- Final picklist values + team-member User list (§17.2) — see BUG-09 taxonomy drift.
