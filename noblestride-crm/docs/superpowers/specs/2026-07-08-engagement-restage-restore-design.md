# Restore the engagement restage control

**Date:** 2026-07-08
**Status:** Approved

## Problem

The By Deal / By Investor focal-views rework (spec `2026-07-08-client-meeting-crm-enhancements-design.md`) replaced the 12-column `EngagementStageBoard` with the read-only `FocalPipelineBoard`. The per-card `EngagementRestageSelect` — the only UI that fired `updateEngagement` with an `engagementStage` — was orphaned with the board. The engagement edit drawer deliberately excludes `engagementStage` ("restage control owns it"), so there is now **no UI path** for an admin to move an engagement through the pipeline. When an investor expresses interest via the portal, the engagement is created at stage `Shared` with status `Interested`, and it is stuck there short of a raw GraphQL call.

The backend is intact: `updateEngagement` still accepts `engagementStage`, enforces the NDA guard (no stage past Teaser without an NDA), and records `StageChange` history. This is purely a lost mount point.

## Decision

Remount the existing `EngagementRestageSelect` in two places (approach and placement chosen by user):

1. **Engagement detail page** (`/engagement/[id]`) — the canonical control.
2. **Focal board rows** (By Deal and By Investor views) — inline, for fast triage.

No new write path, no changes to the mutation, guard, history, or the select component itself.

## Design

### 1. Engagement detail page (`src/app/(crm)/engagement/[id]/page.tsx`)

- Fetch the org lens: `const lens = await getOrgLens()`.
- Compute `canRestage = canUpdateRecord(lens.orgRole, "Engagements", lens.userId, { ownerId: engagement.ownerId })` — the same own-scope-aware check the old board used per card. (`getEngagement` uses a full `include`, so `ownerId` is already on the row; no query change.)
- Add a **Stage** entry to the Details card `<dl>`, as the first item (before Status — today the page never shows the current stage except via history):
  - When `canRestage`: render `EngagementRestageSelect` with `id`, `transactionId`, `investorId`, `currentStage={engagement.engagementStage}`, and `stageOptions`.
  - Otherwise: a static `<Chip value={engagement.engagementStage} group="EngagementStage" />`.
- `stageOptions` built server-side: `ENGAGEMENT_STAGES.map((s) => ({ value: s, label: label("EngagementStage", s) }))` using `ENGAGEMENT_STAGES` from `src/lib/engagement-stage-colors.ts` and `label` from `src/lib/vocab.ts`.
- **Targeted consistency fix:** gate the existing `EngagementFormDrawer` behind the same `canRestage` boolean. Every other detail page (investors, clients, partners) gates its edit drawer via `canUpdateRecord`; this page predates the pattern.

### 2. Focal board rows (`src/components/crm/focal-pipeline-board.tsx`)

- Extend `FocalGroupItemDTO` with `transactionId: string`, `investorId: string`, `canRestage: boolean`.
- Add a `stageOptions: SelectOption[]` prop to `FocalPipelineBoard`.
- In each expanded row (`<li>`), when `item.canRestage`, replace the static stage `Chip` with `EngagementRestageSelect` (the board is already `"use client"`, so it imports the select directly). The InterestLevel chip and "Open →" link are unchanged. When `!canRestage`, keep the static chip exactly as today.
- The select's existing `router.refresh()` re-queries the RSC pages, so the group summary (stage-distribution bar, stage pills, counts) updates automatically after a restage.

### 3. Page wiring (`engagement/deals/page.tsx`, `engagement/investors/page.tsx`)

Both pages already call `getOrgLens()`. Each page:

- Computes `canRestage` per engagement via `canUpdateRecord(lens.orgRole, "Engagements", lens.userId, { ownerId: e.ownerId })` while mapping to `FocalGroupItemDTO` (`engagementsByDeal` / `engagementsByInvestor` use full `include`s — `ownerId` is already present; no service change).
- Passes `transactionId: e.transactionId` and `investorId: e.investorId` through the DTO.
- Builds `stageOptions` once (same expression as the detail page) and passes it to `FocalPipelineBoard`.

### 4. What does not change

- `updateEngagement` mutation, NDA guard, `StageChange` history writes.
- `EngagementRestageSelect` component (reused as-is; it already reverts on failure and surfaces the masked GraphQL error inline).
- `engagement-stage-board.tsx` stays orphaned in place, per the prior spec's explicit instruction not to spend time deleting it.
- The investor portal's `expressInterest` flow (stage `Shared` / status `Interested` on first touch) is untouched.

## Error handling

Existing behavior, inherited from the select: on mutation failure (e.g., NDA guard rejects a move past Teaser), the select reverts to the previous stage and shows the server's message in small rose text beneath the control. On narrow board rows the message wraps below the row's control cluster — acceptable; no new UI.

## Testing & verification

- **Existing coverage reused:** NDA-guard smoke tests (`nda-services.smoke.test.ts`) and stage-history smoke tests already cover the write path.
- **New unit test only if a helper emerges:** if the plan extracts the per-row `canRestage` mapping or `stageOptions` builder into a shared helper, give it a small test; if both stay inline (matching the old board's pattern), no new unit test is required.
- **Playwright pass (single pass at the end, per project workflow):**
  1. As an investor viewpoint, express interest on a visible deal; confirm the engagement shows at Shared/Interested.
  2. As Admin, restage that engagement from a focal-board row (By Deal); confirm the row, stage bar, and pills update.
  3. Open the engagement detail page; confirm the Stage select shows the new stage; restage again from there; confirm StageHistory records both changes.
  4. Attempt a restage past Teaser on an engagement with no NDA; confirm the inline guard error and revert.
  5. Switch to a TeamMember lens on an engagement they don't own; confirm the row and detail page show the read-only chip and no edit drawer.
- Update `playwright assessment/` docs with the results of the pass.

## Out of scope

- Deleting `engagement-stage-board.tsx` / `EngagementRestageSelect`'s old mount.
- Any change to how investor portal responses map to stage/status.
- Drag-and-drop or chip-dropdown restage interactions (rejected in favor of reusing the proven select).
- Syncing `EngagementStatus` when stage changes.
