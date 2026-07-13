# Verification — Dashboard count reconciliation + Deal Journey redesign

**Date:** 2026-07-13
**Branch:** `integration/all-features`
**Status:** ✅ Verified. Working tree left dirty (no commit), per convention.

Two independent pieces of work, implemented in Sonnet, reviewed in Fable, then
verified with one Playwright pass as staff (`evans@noblestride.capital`).

---

## Task 1 — Dashboard KPI ↔ by-stage chart reconciliation

**Problem:** the headline KPI cards didn't reconcile with the Pipeline Overview
chart beneath them (the chart summed *all* stages, KPI counted active only), and
the second chart group was mislabelled "Active Transactions" while listing every
stage including closed ones. The green `+N` delta pill also read like
period-over-period growth when it is really "added in the last 30 days".

**Fix**
- `pipelineOverview()` now also returns `mandatesActive` / `transactionsActive`,
  computed with the **same** stage sets `dashboardStats()` uses
  (`ACTIVE_MANDATE_STAGES`; `NOT IN CLOSED_TXN_STAGES`) — so the KPI and the
  chart subtotal can't drift.
- Each chart group shows a subtotal line **"N active · N closed · N total"**
  (`closed = total − active`). The `active` value is passed from the service, so
  it equals the KPI by construction.
- The mislabelled "Active Transactions" heading is renamed **"Transactions
  Pipeline"** (it lists all stages; the subtotal conveys the active/closed split).
- The delta pill lost its upward-arrow icon and now reads `+N new` with an
  explanatory `title` tooltip. Made per-card honest: "Investors Engaged" uses
  `+N active` / "Investors with activity in the last 30 days" (its delta is
  *distinct investors active in 30d*, not new investors — caught in Fable review);
  "Capital Raised" tooltip is "Capital raised in the last 30 days".
- Added/extended tests in `dashboard.smoke.test.ts`: subtotals are self-consistent
  with the by-stage arrays, and a new test asserts
  `dashboardStats().activeMandates.value === pipelineOverview().mandatesActive`
  (and the transactions equivalent) — the actual reconciliation guarantee.

**Observed live (dev DB):**
- Active Mandates KPI = **93**  ↔  Mandates Pipeline = **"93 active · 13 closed · 106 total"** (38+16+2+12+25 = 93 active; Signed 13). Reconciles.
- Active Transactions KPI = **7**  ↔  Transactions Pipeline = **"7 active · 5 closed · 12 total"** (ClosedWon 4 + ClosedLost 1 = 5 closed). Reconciles.
- Delta pills: `+106 new`, `+12 new`, `+28 active`, `+$15.0M new` — labels honest, tooltips correct.
- Screenshots: `2026-07-13-dashboard-kpi-cards.png`, `2026-07-13-dashboard-pipeline-overview.png`.

## Task 2 — Deal Journey redesign (first-visit clarity)

**Problem:** 17 tiny dots wrapping to two rows with a dangling connector at the
wrap; no legend, no progress summary, no step numbers; current step barely
emphasised; nothing said what the graph was.

**Fix** (`src/components/crm/deal-journey.tsx` only; engine untouched; still a
presentational server component with the same `JourneyStep[]` prop):
- One-line explainer (states that stages complete out of order, evidence-derived).
- Progress summary **"X of 16 stages complete · Currently: <step>"** + emerald progress bar.
- Legend: Done / Current / Upcoming / Manual.
- Numbered step cells (1–17) in a responsive grid (`grid-cols-2 sm:3 lg:4`) — no
  connector lines, so the wrap artifact is gone; order is conveyed by numbering.
- Current step emphasised with an accent border/ring + a small **"Now"** tag.
- Per-step tooltips from `JOURNEY_STEP_HELP`; step 1 keeps its evidence link with
  the source shown as an accent sub-line.
- Accessibility: `<ol>` semantics, `aria-current="step"`, sr-only state labels.

**Observed live** on mandate **Busoga Flowers** (New Lead — shows all four states):
step 1 done (with "Unknown source" sub-line), step 2 current ("Now"), steps 3–16
upcoming, step 17 manual; progress "1 of 16 stages complete · Currently:
Introductory engagement". No wrap dangle. Screenshot: `2026-07-13-deal-journey-busoga.png`.

## Gates
- `tsc --noEmit`: **clean** (0 errors).
- `vitest run` (with `DATABASE_URL`): **835 passed / 835** across 127 files (incl. new reconciliation tests).
- Fable review: Part 2 clean PASS; Part 1 PASS with one actionable finding (the "Investors Engaged" delta suffix), which was fixed as above.
- No `src/generated/pothos-types.ts` churn; no commit.
