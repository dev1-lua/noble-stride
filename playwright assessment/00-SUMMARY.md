# NobleStride CRM — End-to-End QA Findings

**Date:** 2026-07-07
**Branch:** `integration/all-features`
**Tested against:** `http://localhost:3000` (live dev server, seeded DB)
**Method:** Manual end-to-end walkthrough via Playwright (Chromium), every route, all three
personas (investor / partner / internal team), cross-checked against the two signed specs:
- `Noblestride_Lua_Phase1_Client_SOW_ Signed.pdf` (client SOW)
- `Lua x Noblestride - Build Specification (INTERNAL).pdf` (engineer spec — data model, visibility gates §11, RBAC §7, guardrails §12)

> ⚠️ These files are intentionally **uncommitted**. Review each, then decide what to keep. See
> [`04-TEST-ARTIFACTS-LEFT-IN-DB.md`](04-TEST-ARTIFACTS-LEFT-IN-DB.md) for records I created/edited during testing that you may want to clean out of the seed DB.

## Documents in this folder
| File | Contents |
|------|----------|
| [`01-BUGS.md`](01-BUGS.md) | Every defect found, ranked by severity, with repro + evidence + spec ref + suggested fix |
| [`02-BLOCKERS.md`](02-BLOCKERS.md) | Things that block real deployment / the next phase |
| [`03-COVERAGE-MAP.md`](03-COVERAGE-MAP.md) | What was tested, what works, and known scope gaps vs the spec |
| [`04-TEST-ARTIFACTS-LEFT-IN-DB.md`](04-TEST-ARTIFACTS-LEFT-IN-DB.md) | Data I created/modified while testing |

## Headline

The build is **substantially further along than a demo** — the investor onboarding lifecycle,
the field-level visibility gates, the RBAC lenses, and the full dashboard suite are all real and
mostly working. No client-side JS errors or failed network calls were observed anywhere.

The **one finding that matters most** is a confidentiality leak (BUG-01): at the pre-interest tier,
the deal name and company profile are correctly codename-masked, **but document titles are not** —
a Teaser document titled `"Teaser — Chipori Ltd (Sabor A' Mexico)"` is shown to an investor who is
only supposed to see the codename `"Project Amber Harrier"`. Since NDA-gated confidentiality is the
product's core promise (SOW §07, Spec §11), this should be fixed before any external demo.

## Scorecard

| Area | Verdict |
|------|---------|
| Investor onboarding (register → OTP → review → approve → access) | ✅ Full lifecycle works end-to-end |
| Anti-broker gate (pending / excluded / greylisted see nothing) | ✅ Works, incl. direct-URL access |
| Visibility tiers / financial masking (Spec §11) | ⚠️ Gate works, but **document titles leak identity** (BUG-01); post-NDA reveal unexercised (no financial data) |
| Investor portal (opportunities, deal, pipeline, dashboard, profile) | ✅ Works; a few consistency bugs (BUG-02, BUG-03) |
| Partner portal (overview, refer, details) | ✅ Works; advisor-type mismatch (BUG-07) |
| Internal CRM (11 nav sections) | ✅ All render, CRUD write paths work |
| RBAC lenses (Spec §7.2) | ⚠️ Enforced, but switcher shows wrong active lens (BUG-04) |
| Dashboards (Spec §13) | ⚠️ Comprehensive, but KPI numbers don't reconcile (BUG-06) |
| Data quality | ⚠️ Mojibake in 2 records (BUG-05); empty client financials; test junk in lists |
| Agents / WhatsApp / Email / SharePoint (Spec §8, §9, §14) | ➖ Not built (known scope gaps — see coverage map) |

**Counts:** 1 high / 5 medium / ~10 low bugs; 3 deployment blockers; ~7 known scope gaps.

---

## 2026-07-08 — Gap-closure + simplification SDD run (verification pass)

**Branch:** `integration/all-features` (work uncommitted/staged on top of `833de8f`). **Method:** 19-task SDD plan executed subagent-driven (sonnet implement, opus review per task); this is the Task-19 consolidated verification.

**Gates (all green):** `tsc --noEmit` clean · `vitest run` **636 passed / 78 files, 0 failed** · `next build` succeeds (all 36 routes compile, incl. `/home`, `/engagement`, `/intake`, `/access-matrix`) · eslint clean on touched files (only the pre-existing `dashboard/page.tsx` `<a href>` error remains, unrelated).

**Live Playwright pass — new surfaces this run (all verified working):**
- **`/home` "Today" page** — Today nav item first (Sun icon, active); 4 lens-scoped sections render, empty sections omitted ("Going quiet" correctly listed a stale deal); welcome checklist with 4 items + dismiss.
- **Nav revert (user request)** — "Investor Outreach" → **"Engagements"** everywhere; sidebar dropdown flattened to a single "Engagements" item → `/engagement` (→ redirects to By Deal board). Transaction pipeline STAGE "Investor Outreach" (Marko-verbatim) preserved.
- **Help panel (Task 18)** — topbar "?" button; `?help=journey` deep-link opens the drawer scrolled to the 17-step "How a deal flows" list — verified on the checklist **client-side nav** path (the reviewer-caught I1 defect, now fixed).
- **Deal Journey spine (Task 16)** — renders on mandate detail (17 steps, done=emerald / current=accent ring / pending / manual=dashed), evidence-based out-of-order states correct.
- **`/intake` public wizard (Task 11)** — 6-step, renders standalone (no CRM shell).
- **Notification bell (Task 14)** present in topbar (empty for the default demo-Admin lens — known limitation: recipient targeting needs `feat/real-auth`'s real `userId`).

**Confirmed intact (client concern):** the investor-onboarding **PendingReview queue is live on the dashboard** (`OnboardingQueueCard` + "Pending Review" stat, inline Approve/Decline/Greylist) — not removed by simplification; Task 14 also now fires an in-app bell to Admins on new registration.

**Coverage note (honest):** this pass focused on the Wave-1/2/3 surfaces this SDD run added/changed. Flows built+reviewed in Tasks 1–13 (match popover, client compliance round-trip, portal EBITDA/net-profit filters, full intake submit → dashboard callout → review-panel accept/deprioritize, restage→notification write path) are covered by the 636 unit/smoke tests + the passing `next build`, and by the 2026-07-07 manual pass above; they were **not** re-exercised end-to-end live this round. No new DB test artifacts were created this pass (read-only navigation only — see `04`).

Per-task detail, findings, and minor-for-final-review items live in `.superpowers/sdd/progress.md`. The Fable whole-branch review is the final gate.

### Update (2026-07-08, post-review): "Today" `/home` page removed at user request
The user reviewed the new `/home` "Today" page and asked for it to be removed. Task 17's page + welcome checklist were deleted; the sidebar "Today" item, the `/home` topbar entry, and the team login/root redirect were reverted (team users land on `/dashboard` again, as before). `quietTransactions()` (the shared query extracted from `aiOverviewInsights`) was kept — it's decoupled from `/home` and still powers the dashboard "attention" insight. Gates re-verified green: tsc clean, vitest 636/78, `next build` OK (35 routes now — `/home` gone).

### Update (2026-07-09): "Engagements" sidebar dropdown restored at user request
The user asked to bring back the sidebar dropdown that the simplification wave (`6b1c1aa`) had flattened. The `EngagementNavGroup` disclosure from `7cabf81` was re-added to `src/components/shell/sidebar.tsx`, adapted to the current sidebar (label "Engagements", Users item and admin-gating untouched): clicking "Engagements" toggles an inline sub-menu (By Deal → `/engagement/deals`, By Investor → `/engagement/investors`) without navigating; chevron rotates with state; group auto-opens when a child route is active. Verified live via Playwright as admin (evans@): toggle opens/closes, both children navigate, active styling correct on `/engagement/deals`. `tsc --noEmit` clean. Change left uncommitted per convention.

### Update (2026-07-14, evening): crmAgent data-in (P1, 11 tasks) + client-agent OTP status (P2, 8 tasks) — SDD build COMPLETE, uncommitted
Two-plan autonomous SDD run on `integration/all-features` (base b209ddd, tree left dirty per no-commit rule). P1: delegated-actor RBAC + AgentPendingWrite ledger + 25-op registry + prepare/commit/cancel two-phase writes (3 new mutations) + summariser→crm_agent rename + staff-email identify gate + 4 write tools; E2E write-smoke 13/13. P2: ClientOtpChallenge model + anti-enumeration OTP request/verify + 15-min HS256 token + 10-field whitelisted clientStatus (+ Activity log) + schema-lock smoke + 3 client_agent status tools + skill/persona carve-out; E2E status smoke 7/7 incl. impostor probes. All Fable-reviewed (per-task through P2.5; P2.6/2.7 covered at task-gate depth in the final whole-branch review per user directive). Final review verdict "With fixes" → consolidated F1–F10 fix pass applied & re-approved (highlights: production AGENT_API_KEY redacted from tracked doc; production-write guards on both smoke scripts; deleted-record commit path now lands Failed; HS256 pinned). Full detail: `2026-07-14-crmagent-datain-clientstatus-verification.md` + `.superpowers/sdd/progress.md`. Browser pass: /talk-to-us + widgets verified (deployed agents = v1 behavior, this build undeployed by design); **webchat "out of credits" blocker did NOT reproduce** on the client channel; staff channel (4rtza3) gave no reply in ~35s — check before deploy. 3 derivation/timing ambiguities need a user ruling before deploy (listed in the verification doc).
