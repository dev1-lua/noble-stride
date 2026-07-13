# QA — Comprehensive Deal Editor Drawer + Document-Date Auto-Stamp

**Date:** 2026-07-13 (browser pass ran into 2026-07-14)
**Feature branch state:** integration/all-features
**Plan:** docs/superpowers/plans/2026-07-13-deal-editor-drawer-and-doc-date-autostamp.md
**Spec:** docs/superpowers/specs/2026-07-13-deal-editor-drawer-and-doc-date-autostamp-design.md
**Method:** SDD (Sonnet implementers, Opus per-task reviewers). Browser pass driven live against the
running dev server (localhost:3000) backed by local Postgres (localhost:5544); every write confirmed by
direct `psql` query against the DB, and each detail page re-fetched (RSC, no client cache) after save.

## Automated verification
- `npm run test` → **840 passed / 8 skipped / 0 failed** (125 files).
- `npx tsc --noEmit` → **exit 0** (clean).
- `npx next build` → **exit 0** (all routes compiled, static generation OK).

## Browser pass — results

| # | Scenario | Expected | Result |
|---|----------|----------|--------|
| 1 | **Original bug.** Busoga Flowers mandate had NDA Status = Signed but journey NDA step "(upcoming)" (ndaSignedDate was null). Edit → save with NDA Signed + blank date box. | Auto-stamp ndaSignedDate; journey NDA step greens. | ✅ Journey step 3 went "(upcoming)" → **"(done)"**, progress 1→2. |
| 2 | **Mandate stage via drawer.** Edit → Stage Qualification → Proposal → Save. | Chip updates, timer resets, StageChange history row written (full restage semantics, like RestageSelect). | ✅ Deal Summary "Proposal (0 days in stage)"; new Stage History row `Qualification → Proposal`. |
| 3 | **Transaction stage via drawer.** Akili Kids (Deal Preparation) Edit → Stage ClosedWon → Save. | stage=ClosedWon, closedAt set, timer reset, history row. | ✅ psql: `stage=ClosedWon`, `closedAt=2026-07-13 14:16:31`, `stageEnteredAt` reset; StageChange row `DealPreparation → ClosedWon`. |
| 4 | **Clear-on-downgrade via drawer.** Lower NDA Signed → Sent → Save. | ndaSignedDate cleared; journey NDA step un-greens. | ⚠️→✅ (see finding + fix below). |

## Finding (item 4) and fix

**Finding.** As originally built, lowering NDA/EA status through the drawer did **not** clear the higher
date. The detail-page `initial` object **prefilled** the NDA/EA date boxes from the DB; on save the drawer
re-submitted those dates, which the service correctly honors as a **manual override** (Decision 3 —
"a typed date wins", enabling backdating). This silently blocked Decision 2 (clear-on-downgrade):
status went to Sent but `ndaSignedDate` was kept (tell-tale `00:00:00` timestamp = came from the date
input, not the auto-stamp), so the journey stayed green — the exact status/journey desync the feature was
built to eliminate. The unit/smoke tests missed it because they call the service with only the status
field; only the real UI re-submits the prefilled dates. Emerged on integration (per-task reviews are
diff-scoped), which is precisely what the end-to-end browser pass is for.

**Fix (commit f6cbccb).** Removed the four NDA/EA date prefills from `mandates/[id]/page.tsx` `initial`,
so the date boxes are blank in edit mode — matching the drawer's own "leave blank to auto-stamp" hint.
Blank now defers to the status (auto-stamp on raise, clear on downgrade); typing a date still backdates.
Verified: blank date fields submit as *absent* (not `null`), so status logic governs and unrelated edits
never wipe a stored date.

**Re-verification in browser (post-fix):**
- Edit drawer date boxes render **blank** in edit mode (were prefilled). ✅
- Raise: NDA → Signed with blank box → `ndaSignedDate` set (existing preserved) → journey green. ✅
- Downgrade: NDA Signed → Sent with blank box → psql `ndaSignedDate = NULL`, `ndaSentDate` stamped →
  journey step 3 back to **"(upcoming)"**. Status and journey now in sync. ✅

## Separate pre-existing branch blocker (NOT this feature)

`src/graphql/auth-gate.ts:23` had a TS2352 bad cast (`args.contextValue as GraphQLContext`; needs
`as unknown as`). From commit **18bc4ed** (GraphQL 401 auth-gate hardening merge), not in this feature's
diff (`42d868b..29ab48e`). Latent — masked by stale generated types, unmasked when the Pothos types
regenerated during this session. It was the only project-wide type error and blocked `next build`.
Fixed in its **own** commit (**06f71f5**), separate from the feature commits. `next build` green after.

## Console note
The only browser console errors during the pass were the embedded Lua/heylua.ai chat widget failing to
reach its external API (`api.heylua.ai` 400, `api.lua.dev` 401) — expected in local dev, unrelated.

## Data touched (left as-is, per decision)
- Busoga Flowers mandate: now Proposal / NDA Sent (ndaSignedDate null) — consistent, status & journey in sync.
- Akili Kids transaction: now ClosedWon (closedAt set) — consistent.

## Screenshots (this directory)
- `2026-07-13-deal-editor-01-busoga-nda-bug-before.png` — the bug: NDA "Signed" pill but journey NDA "(upcoming)".
- `2026-07-13-deal-editor-02-busoga-nda-autostamp-greens.png` — after save: journey NDA "(done)".
- `2026-07-13-deal-editor-03-busoga-stage-change-history.png` — stage → Proposal + new Stage History row.
- `2026-07-13-deal-editor-04-akili-txn-closedwon.png` — transaction → ClosedWon via drawer.
- `2026-07-13-deal-editor-05-busoga-downgrade-fix-ungreened.png` — post-fix: NDA lowered to Sent, step 3 back to "(upcoming)".

## Commits (feature + separate fix)
- `12dda08` feat(domain): pure NDA/EA date reconciliation from status
- `192ce86` feat(mandates): stage-in-update semantics + NDA/EA date auto-stamp
- `afb5cb4` feat(transactions): stage-in-update semantics with closedAt handling
- `bbc5aa2` feat(ui): mandate drawer exposes stage, NDA/EA dates, and verdict
- `29ab48e` feat(ui): transaction drawer exposes stage
- `f6cbccb` fix(ui): don't prefill NDA/EA date boxes so clear-on-downgrade works via drawer (browser-pass fix)
- `06f71f5` fix(graphql): correct auth-gate context cast (pre-existing, separate from feature)
