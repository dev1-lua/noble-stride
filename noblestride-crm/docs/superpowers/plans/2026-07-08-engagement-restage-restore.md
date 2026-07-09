# Engagement Restage Control Restore — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore an admin UI path to move an Engagement through the 12-stage pipeline by remounting the existing `EngagementRestageSelect` on the engagement detail page and on the By Deal / By Investor focal-board rows.

**Architecture:** Pure remount — no new write path. The existing `EngagementRestageSelect` client component (urql `updateEngagement` mutation with NDA guard, inline error + revert, `router.refresh()`) gets mounted in two places. RBAC gating is computed server-side per row via `canUpdateRecord` (own-scope aware), exactly as the orphaned `EngagementStageBoard` did. A tiny shared helper builds the stage `SelectOption[]` list from vocab.

**Tech Stack:** Next.js 16 App Router (RSC + client islands), urql/GraphQL (Pothos), Prisma, vitest, Tailwind v4.

**Spec:** `noblestride-crm/docs/superpowers/specs/2026-07-08-engagement-restage-restore-design.md`

## Global Constraints

- App root is `noblestride-crm/` inside the repo — run ALL commands from `D:\LuaWork\NobleStride\noble-stride\noblestride-crm`. File paths below are relative to that root.
- Package manager is **pnpm via corepack** (`corepack pnpm ...`), NOT npm. Node v22.
- Do NOT run `corepack pnpm build` (its `prisma generate` step fails with EPERM on Windows while the dev server holds the query-engine DLL). Type-gate with `npx tsc --noEmit` instead.
- `npx tsc --noEmit` baseline has **6 pre-existing errors** (`src/graphql/mutations.ts:212/217/222`, `src/graphql/queries.ts:439/454`, `src/graphql/types.ts:462`). The gate is **no NEW errors**.
- `corepack pnpm lint` has pre-existing failures in `clients-table.tsx`, `count-up.tsx`, `prisma/seed.ts`, `investors-crud.smoke.test.ts` (3 errors, 2 warnings). The gate is **no NEW errors/warnings**.
- The full vitest suite needs `DATABASE_URL=postgresql://noblestride:noblestride@localhost:5544/noblestride` exported (vitest does not auto-load `.env`); DB is the shared docker `noblestride-postgres` on host port **5544**. With env exported the baseline is 452/452 passing.
- If `src/generated/pothos-types.ts` shows churn (machine-specific absolute path), revert it — never stage it.
- Work directly on branch `integration/all-features`.
- Browser verification is ONE pass at the very end (Task 4, main session) — per-task gates are typecheck/lint/vitest only.
- Commit steps below are pre-authorized ONLY by the user's approval of this plan; if the user strikes them, end each task with a dirty working tree instead.

---

### Task 1: `engagementStageOptions()` helper

**Files:**
- Modify: `src/lib/engagement-stage-colors.ts`
- Test: `src/lib/__tests__/engagement-stage-options.test.ts` (create)

**Interfaces:**
- Consumes: `ENGAGEMENT_STAGES` and `LABELS`/`label` already exported from `src/lib/engagement-stage-colors.ts` / `src/lib/vocab.ts`.
- Produces: `engagementStageOptions(): { value: string; label: string }[]` exported from `src/lib/engagement-stage-colors.ts` — 12 entries in vocab order (Shared → Declined), `label` is the vocab display label. Structurally compatible with the UI `SelectOption` type; deliberately does NOT import from `@/components/ui` (keeps `src/lib` free of component imports). Tasks 2 and 3 call this.

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/engagement-stage-options.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { ENGAGEMENT_STAGES, engagementStageOptions } from "@/lib/engagement-stage-colors";

describe("engagementStageOptions", () => {
  it("returns one {value,label} option per stage, in vocab order", () => {
    const options = engagementStageOptions();
    expect(options.map((o) => o.value)).toEqual(ENGAGEMENT_STAGES);
    expect(options).toHaveLength(12);
  });

  it("uses vocab display labels, not raw enum values", () => {
    const byValue = new Map(engagementStageOptions().map((o) => [o.value, o.label]));
    expect(byValue.get("TeaserSent")).toBe("Teaser Sent");
    expect(byValue.get("NDASigned")).toBe("NDA Signed");
    expect(byValue.get("VDRAccess")).toBe("VDR Access");
    expect(byValue.get("Shared")).toBe("Shared");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm vitest run src/lib/__tests__/engagement-stage-options.test.ts`
Expected: FAIL — `engagementStageOptions` is not exported (TypeError: engagementStageOptions is not a function). No DATABASE_URL needed; this test is pure.

- [ ] **Step 3: Write minimal implementation**

In `src/lib/engagement-stage-colors.ts`, change the vocab import (line 3) and append the helper at the end of the file:

```ts
import { LABELS, label } from "@/lib/vocab";
```

```ts
/** {value,label} list for the engagement restage selects, in vocab order. */
export function engagementStageOptions(): { value: string; label: string }[] {
  return ENGAGEMENT_STAGES.map((s) => ({ value: s, label: label("EngagementStage", s) }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `corepack pnpm vitest run src/lib/__tests__/engagement-stage-options.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/engagement-stage-colors.ts src/lib/__tests__/engagement-stage-options.test.ts
git commit -m "feat(engagement): add engagementStageOptions helper for restage controls"
```

---

### Task 2: Inline restage on the focal boards (board + both pages)

These three files change together — the DTO change does not compile until both producer pages supply the new fields, so they are one reviewable unit.

**Files:**
- Modify: `src/components/crm/focal-pipeline-board.tsx`
- Modify: `src/app/(crm)/engagement/deals/page.tsx`
- Modify: `src/app/(crm)/engagement/investors/page.tsx`

**Interfaces:**
- Consumes: `engagementStageOptions()` from Task 1; existing `EngagementRestageSelect` (`src/components/crm/engagement-restage-select.tsx`) with props `{ id, transactionId, investorId, currentStage, stageOptions }`; existing `canUpdateRecord(role, "Engagements", userId, { ownerId })` from `@/server/rbac/matrix`; existing `getOrgLens()` (already called by both pages).
- Produces: `FocalGroupItemDTO` gains `transactionId: string`, `investorId: string`, `canRestage: boolean` and LOSES the never-read `stageLabel` field; `FocalPipelineBoard` gains a required `stageOptions: SelectOption[]` prop. No other component consumes these — the two pages in this task are the only call sites.

- [ ] **Step 1: Update `src/components/crm/focal-pipeline-board.tsx`**

Add to the imports (the file is already `"use client"`, so the client-island select imports directly):

```ts
import type { SelectOption } from "@/components/ui";
import { EngagementRestageSelect } from "./engagement-restage-select";
```

Replace the `FocalGroupItemDTO` interface (removing `stageLabel`, adding the three new fields):

```ts
export interface FocalGroupItemDTO {
  id: string;
  transactionId: string;
  investorId: string;
  counterpartName: string;
  counterpartHref: string;
  stage: string;
  interestLevel: string | null;
  /** §7.2 lens: computed server-side via canUpdateRecord (own-scope aware). */
  canRestage: boolean;
}
```

Change the component signature:

```ts
export function FocalPipelineBoard({ groups, stageOptions }: { groups: FocalGroupDTO[]; stageOptions: SelectOption[] }) {
```

In the expanded-row `<li>`, replace the static stage chip line

```tsx
<Chip value={it.stage} group="EngagementStage" />
```

with the gated select (InterestLevel chip and "Open →" link stay untouched):

```tsx
{it.canRestage ? (
  <div className="w-40">
    <EngagementRestageSelect
      id={it.id}
      transactionId={it.transactionId}
      investorId={it.investorId}
      currentStage={it.stage}
      stageOptions={stageOptions}
    />
  </div>
) : (
  <Chip value={it.stage} group="EngagementStage" />
)}
```

Also extend the file-header comment's "use client" rationale with one line, e.g.: `// The per-row EngagementRestageSelect is the second client-island reason.`

- [ ] **Step 2: Wire `src/app/(crm)/engagement/deals/page.tsx`**

Change the matrix import (currently `import { can } from "@/server/rbac/matrix";`):

```ts
import { can, canUpdateRecord } from "@/server/rbac/matrix";
```

Extend the stage-colors import:

```ts
import { ENGAGEMENT_STAGES, stageColorSwatch, engagementStageOptions } from "@/lib/engagement-stage-colors";
```

After the `Promise.all` block, add:

```ts
const stageOptions = engagementStageOptions();
```

Replace the `items:` mapping inside `dealGroups` (drops `stageLabel`, adds the new fields):

```ts
items: engagements.map((e) => ({
  id: e.id,
  transactionId: e.transactionId,
  investorId: e.investorId,
  counterpartName: e.investor.name,
  counterpartHref: `/investors/${e.investorId}`,
  stage: e.engagementStage,
  interestLevel: e.interestLevel,
  canRestage: canUpdateRecord(lens.orgRole, "Engagements", lens.userId, { ownerId: e.ownerId }),
})),
```

(`engagementsByDeal()` uses a full `include`, so `e.ownerId` is already on the row — no service change.)

Pass the options to the board:

```tsx
<FocalPipelineBoard groups={dealGroups} stageOptions={stageOptions} />
```

- [ ] **Step 3: Wire `src/app/(crm)/engagement/investors/page.tsx`**

Same three changes as Step 2:

```ts
import { can, canUpdateRecord } from "@/server/rbac/matrix";
import { ENGAGEMENT_STAGES, stageColorSwatch, engagementStageOptions } from "@/lib/engagement-stage-colors";
```

After the `Promise.all` block:

```ts
const stageOptions = engagementStageOptions();
```

Replace the `items:` mapping inside `groups`:

```ts
items: engagements.map((e) => ({
  id: e.id,
  transactionId: e.transactionId,
  investorId: e.investorId,
  counterpartName: e.transaction.name,
  counterpartHref: `/transactions/${e.transactionId}`,
  stage: e.engagementStage,
  interestLevel: e.interestLevel,
  canRestage: canUpdateRecord(lens.orgRole, "Engagements", lens.userId, { ownerId: e.ownerId }),
})),
```

And the render:

```tsx
<FocalPipelineBoard groups={groups} stageOptions={stageOptions} />
```

- [ ] **Step 4: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: exactly the 6 pre-existing baseline errors (graphql mutations/queries/types) — no new ones. In particular, no `stageLabel` / missing-property errors remain.

Run: `corepack pnpm lint`
Expected: only the pre-existing failures listed in Global Constraints.

- [ ] **Step 5: Run the full test suite**

Run (bash): `DATABASE_URL=postgresql://noblestride:noblestride@localhost:5544/noblestride corepack pnpm test`
(PowerShell equivalent: `$env:DATABASE_URL = 'postgresql://noblestride:noblestride@localhost:5544/noblestride'; corepack pnpm test`)
Expected: all tests pass (baseline 452 + the 2 from Task 1).

- [ ] **Step 6: Commit**

```bash
git add src/components/crm/focal-pipeline-board.tsx "src/app/(crm)/engagement/deals/page.tsx" "src/app/(crm)/engagement/investors/page.tsx"
git commit -m "feat(engagement): inline restage select on By Deal / By Investor board rows"
```

---

### Task 3: Stage control + drawer gating on the engagement detail page

**Files:**
- Modify: `src/app/(crm)/engagement/[id]/page.tsx`

**Interfaces:**
- Consumes: `engagementStageOptions()` from Task 1; `EngagementRestageSelect` with props `{ id, transactionId, investorId, currentStage, stageOptions }`; `getOrgLens()` from `@/server/rbac/context`; `canUpdateRecord` from `@/server/rbac/matrix`. (`getEngagement` uses a full `include`, so `engagement.ownerId` is already available — no service change.)
- Produces: nothing consumed by other tasks.

- [ ] **Step 1: Add imports and the RBAC computation**

Add imports:

```ts
import { getOrgLens } from "@/server/rbac/context";
import { canUpdateRecord } from "@/server/rbac/matrix";
import { EngagementRestageSelect } from "@/components/crm/engagement-restage-select";
import { engagementStageOptions } from "@/lib/engagement-stage-colors";
```

After the `const rel = await relationOptions();` line, add:

```ts
const lens = await getOrgLens();
const canRestage = canUpdateRecord(lens.orgRole, "Engagements", lens.userId, { ownerId: engagement.ownerId });
const stageOptions = engagementStageOptions();
```

- [ ] **Step 2: Add the Stage entry to the Details card**

In the Details card `<dl>`, insert this as the FIRST entry (before the existing Status `<div>` — today the page never shows the current stage except via history):

```tsx
<div>
  <dt className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Stage</dt>
  <dd className="mt-1">
    {canRestage ? (
      <div className="max-w-56">
        <EngagementRestageSelect
          id={engagement.id}
          transactionId={engagement.transactionId}
          investorId={engagement.investorId}
          currentStage={engagement.engagementStage}
          stageOptions={stageOptions}
        />
      </div>
    ) : (
      <Chip value={engagement.engagementStage} group="EngagementStage" />
    )}
  </dd>
</div>
```

(`RecordClosedNdaButton` on this same page already fires urql mutations, so the provider context is proven present.)

- [ ] **Step 3: Gate the edit drawer**

Replace the unconditional drawer in the header:

```tsx
<EngagementFormDrawer initial={editInitial} />
```

with:

```tsx
{canRestage && <EngagementFormDrawer initial={editInitial} />}
```

(Consistency fix — investors/clients/partners detail pages already gate their drawers via `canUpdateRecord`; this page predates the pattern.)

- [ ] **Step 4: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: only the 6 pre-existing baseline errors.

Run: `corepack pnpm lint`
Expected: only the pre-existing failures.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(crm)/engagement/[id]/page.tsx"
git commit -m "feat(engagement): restage control + RBAC-gated edit drawer on engagement detail"
```

---

### Task 4: End-to-end browser verification (MAIN SESSION — do not dispatch to a subagent)

One comprehensive Playwright pass against the running dev server (localhost:3000 — reuse it, don't restart). Demo lens switching: `GET /api/viewpoint?role=investor|partner|admin&recordId=<id>&next=<path>` sets the session cookie and redirects; record ids come from `href="/investors/<id>"` links on the admin list pages.

**Files:**
- Modify: `playwright assessment/` docs (record the pass results per the living QA-log convention).

- [ ] **Step 1: Investor expresses interest.** Switch to an investor viewpoint, open a visible deal in the portal, submit Express Interest. Confirm redirect with `?interest=sent`.
- [ ] **Step 2: Engagement lands at Shared/Interested.** As admin, open Engagement → By Deal, expand the deal's group: the new engagement row shows stage select at `Shared`; open the detail page and confirm the `Interested` status chip.
- [ ] **Step 3: Restage from a board row.** On By Deal, change the row's stage select (e.g. Shared → TeaserSent). Confirm the row, the group's stage-distribution bar, and stage pills update after refresh.
- [ ] **Step 4: Restage from the detail page.** Open the engagement; the Details card Stage select shows the new stage; change it again (e.g. TeaserSent → Meeting, on an engagement WITH an NDA). Confirm Stage History records both changes with actor + source.
- [ ] **Step 5: NDA guard.** On an engagement with NO NDA (none recorded, investor NDA status None), attempt Shared → NDASigned from either control. Confirm the inline rose error appears and the select reverts.
- [ ] **Step 6: Read-only lens.** Switch the org-role lens to TeamMember on an engagement owned by someone else: board row shows the static stage chip (no select); detail page shows the static chip and NO edit drawer.
- [ ] **Step 7: Update the assessment log.** Record findings in `playwright assessment/` (new section or updated coverage map entry for the restage flow).
- [ ] **Step 8: Report.** Summarize results to the user; leave the assessment-doc changes uncommitted for review.

---

## Self-Review (completed at write time)

- **Spec coverage:** detail-page control (Task 3), board rows + page wiring (Task 2), shared options helper + its unit test (Task 1), drawer gating (Task 3 Step 3), Playwright steps 1–5 of the spec map to Task 4 Steps 1–6, assessment-log update (Task 4 Step 7). "What does not change" honored — no task touches the mutation, guard, select component internals, or the orphaned board.
- **Placeholder scan:** none — every code step shows the exact code; commands include expected output.
- **Type consistency:** `engagementStageOptions(): { value: string; label: string }[]` is structurally assignable to the `SelectOption[]` prop (verified `SelectOption = { value: string; label: string; ... }` in `src/components/ui/select.tsx`); `FocalGroupItemDTO` fields in Task 2 Steps 1–3 match producer/consumer exactly; `EngagementRestageSelect` prop names match its interface (`id`, `transactionId`, `investorId`, `currentStage`, `stageOptions`).
