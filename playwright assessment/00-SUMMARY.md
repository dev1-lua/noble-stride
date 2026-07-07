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
