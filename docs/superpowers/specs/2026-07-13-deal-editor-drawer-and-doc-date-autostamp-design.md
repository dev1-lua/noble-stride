# Comprehensive Deal Editor Drawer + Document-Date Auto-Stamp

**Date:** 2026-07-13
**Status:** Approved (design) — pending implementation
**Author:** Shaurya Dabral (with Claude)

## Problem

Two related gaps surfaced while working with the Deal Journey on a mandate:

1. **Status and journey disagree.** The Deal Journey (`src/server/domain/journey.ts`) marks the NDA stage done from `mandate.ndaSignedDate` (step 3) and the Engagement-contract stage from `mandate.eaSignedDate` (step 6). But the Edit Mandate drawer only sets the *status* enum (`ndaStatus`/`eaStatus` — `DocStatus = NotSent | Sent | Signed`). Nothing stamps the corresponding date. So a user sets **NDA Status = Signed**, the Deal Summary shows a "Signed" pill, yet the journey's NDA stage stays pending because `ndaSignedDate` is still null. The two fields are never reconciled.

2. **You cannot change everything from one place.** The Edit drawer is missing key fields a deal moves through — most importantly the **Stage** (`MandateStage` / `TransactionStage`), which today is only editable via the `RestageSelect` panel on the detail page. To change a deal's state a user has to hunt around the page. The intent is: click **Edit**, and change anything about the deal (mandate or transaction) from that one drawer.

## Goals

- When a document status is set to `Sent` or `Signed`, auto-stamp the matching date; when it is lowered, clear the now-invalid date. Applies to **NDA** and **EA** on mandates (the two status→date pairs the journey reads). Behavior lives at the service layer so **every** writer (drawer, GraphQL API, scripts) gets it.
- Make the Edit/Create drawers a comprehensive editor: add **Stage** to both mandate and transaction drawers; add NDA/EA **sent + signed date** overrides and **qualification verdict** to the mandate drawer. The transaction drawer already exposes every other field.
- Changing Stage from the drawer behaves **identically** to the existing `RestageSelect` control (records `StageChange` history, resets the "days in stage" timer, notifies the lead/owner, and — for transactions — sets/clears `closedAt`).
- Apply to the **create** scenario as well (stage selectable; auto-stamp runs if a deal is created with a status already set).
- Keep the existing stage `Chip` + `RestageSelect` on the detail pages (additive, nothing removed).

## Non-goals

- No changes to how `Document` records (steps 8/9/14) or `Engagement` rows (steps 10–13) drive the journey.
- No change to the journey engine (`src/server/domain/journey.ts`) — it stays a pure, display-only derivation.
- No new "manual override" of a journey stage's state (the journey remains evidence-derived).

## Decisions (from brainstorming)

1. **Stage change from the drawer = full restage semantics** (history + timer reset + notify + `closedAt`).
2. **Clear-on-downgrade** — lowering NDA/EA status clears the higher date so status and journey stay in sync.
3. **Comprehensive drawer** — include Stage + manual NDA/EA date overrides + qualification verdict. A manually entered date wins over auto-stamp (enables backdating a signature).

## Design

### Component 1 — Doc-date reconciliation (pure domain helper)

New file `src/server/domain/doc-dates.ts`, pure and unit-testable (takes `now` as a parameter — no `Date.now()`, matching the discipline in `journey.ts`).

```
reconcileDocDates(
  next:     { status?: DocStatus; sentDate?: Date | null; signedDate?: Date | null },
  existing: { status: DocStatus; sentDate: Date | null; signedDate: Date | null },
  now: Date,
): { sentDate?: Date | null; signedDate?: Date | null }
```

Returns only the fields that should change (so the caller can spread them into the Prisma `update` data without touching untouched columns). Rules for one document:

- **Manual override wins.** If `next.signedDate !== undefined`, use it verbatim (including an explicit `null` clear). Same for `sentDate`. An override is never overwritten by status-derived logic.
- **Otherwise, when `next.status` is present** (status is being set/changed), derive from the target status:
  - `Signed` → `signedDate = existing.signedDate ?? now` (stamp only if empty; a real prior date is preserved). `sentDate` left as-is.
  - `Sent` → `sentDate = existing.sentDate ?? now`; **`signedDate = null`** (downgrade clears the higher date).
  - `NotSent` → **`sentDate = null`, `signedDate = null`** (clear both).
- **If `next.status` is absent and no date override** → return `{}` (leave dates untouched; never restamp on unrelated edits).

A thin wrapper (e.g. `reconcileMandateDocDates(input, existing, now)`) applies the helper to both NDA and EA and returns the merged `{ ndaSentDate?, ndaSignedDate?, eaSentDate?, eaSignedDate? }` to spread into the update/create data.

### Component 2 — Stage-transition side-effect (shared helper)

Extract the side-effect body currently inline in `setMandateStage` into a reusable helper so `updateMandate` produces identical behavior:

```
applyMandateStageChange(tx, { id, fromStage, toStage, actor })
  → updates { stage: toStage, stageEnteredAt: now }, records StageChange,
    returns { name, leadId } so the caller can notify post-commit.
```

- `setMandateStage` keeps its public signature and now calls this helper (behavior unchanged).
- `updateMandate` (in its existing `$transaction`) reads `existing.stage`; if `input.stage` is present **and differs**, it calls `applyMandateStageChange` instead of writing `stage` as a plain field, and fires the lead notification after commit (same guard: only when the stage actually changed and the actor isn't the lead). If `input.stage` is absent or equal, the stage/timer are left alone.

Mirror for transactions:

```
applyTransactionStageChange(tx, { id, fromStage, toStage, actor })
  → updates { stage: toStage, stageEnteredAt: now, closedAt },
    records StageChange, returns { name, ownerId }.
```

- `closedAt` = `now` when `toStage ∈ CLOSED_TXN_STAGES` (ClosedWon/ClosedLost), else `null` — preserving `setTransactionStage`'s current rule.
- `setTransactionStage` calls the helper (behavior unchanged). `updateTransaction` calls it when `input.stage` differs from existing, notifies the owner post-commit, and keeps its existing dealStatus/dealMilestone `StageChange` recording.

### Component 3 — Schemas

- `mandate.ts`: add `stage: z.nativeEnum(MandateStage).optional()` and `qualificationVerdict: z.string().trim().optional()`. NDA/EA date fields already present.
- `transaction.ts`: add `stage: z.nativeEnum(TransactionStage).optional()`.
- `Lost`/`ClosedLost` remain valid enum choices (a user can move a deal to a lost stage from the drawer).

### Component 4 — Drawers (UI)

**Mandate drawer (`mandate-form-drawer.tsx`):**
- Add a **Stage** `SelectField` (`options("MandateStage")`), placed near the top with the other status fields.
- Under the existing NDA/EA status selects, add **NDA Sent / NDA Signed / EA Sent / EA Signed** `DateField`s. Blank = defer to auto-stamp; a typed date is an override (backdate). These are **not** in `clearableFields` — clearing a date is done by lowering the status; typing one backdates it.
- Add a **Qualification Verdict** field.
- Applies in both `create` and `edit` mode; on create, Stage defaults via Prisma if left blank.

**Transaction drawer (`transaction-form-drawer.tsx`):**
- Add a **Stage** `SelectField` (`options("TransactionStage")`) near the top of the "Deal Status" group. All other fields already exist.

### Component 5 — Outer detail pages (unchanged)

`src/app/(crm)/mandates/[id]/page.tsx` and `.../transactions/[id]/page.tsx` keep their stage `Chip` and `RestageSelect` panel exactly as-is. The drawer is purely additive; both paths now converge on the same service behavior.

### Data flow

```
Edit drawer (stage / status / date fields)
  → updateMandate|updateTransaction GraphQL mutation
    → service: schema.parse(input)
      → reconcile*DocDates(input, existing, new Date())   // NDA/EA dates
      → applies stage-transition helper when input.stage differs
      → single prisma.update inside $transaction
    → (post-commit) notify lead/owner on stage change
  → next render: journeyForMandate re-derives → DealJourney greens update
```

## Edge cases

- **Editing non-status fields** must not restamp dates or reset the stage timer — guaranteed because reconciliation returns `{}` when status is absent, and the stage helper runs only on an actual stage change.
- **Create with status pre-set** (e.g. NDA Status = Signed on a new mandate) stamps the date via the same reconciliation on the create path.
- **Manual date + status both provided** in one save → the explicit date wins (override rule), status-derived logic is skipped for that field.
- **Lowering status** (Signed→Sent, →NotSent) clears the higher date(s); the journey stage un-greens on next render.
- **`stage` unchanged** in an edit → no `StageChange` row, no timer reset, no notification (matches current behavior).

## Testing

- **`doc-dates.test.ts`** (pure): every status target (NotSent/Sent/Signed) from every prior state; downgrade-clearing; override precedence (date wins); "status absent → `{}`"; create path (no existing).
- **Service tests** (`mandates`/`transactions`):
  - `updateMandate` with a changed `stage` writes a `StageChange`, resets `stageEnteredAt`, notifies the lead; unchanged `stage` does none of these.
  - `updateTransaction` with a changed `stage` sets `closedAt` for ClosedWon/ClosedLost and clears it otherwise; still records dealStatus/dealMilestone history.
  - `updateMandate` with `ndaStatus: Signed` results in a non-null `ndaSignedDate`; lowering to `Sent`/`NotSent` clears it.
- **Journey integration:** mandate with `ndaStatus: Signed` → journey step 3 `done`; after downgrade → `pending`. Same shape for EA/step 6.
- **Regression:** existing `journey.test.ts`, mandate/transaction service tests, and `dashboard.smoke.test.ts` stay green.

## Files touched

- `src/server/domain/doc-dates.ts` — new pure helper (+ test).
- `src/server/services/mandates.ts` — extract `applyMandateStageChange`; wire reconciliation + stage handling into `createMandate`/`updateMandate`.
- `src/server/services/transactions.ts` — extract `applyTransactionStageChange`; wire stage handling into `createTransaction`/`updateTransaction`.
- `src/lib/schemas/mandate.ts` — add `stage`, `qualificationVerdict`.
- `src/lib/schemas/transaction.ts` — add `stage`.
- `src/components/crm/mandate-form-drawer.tsx` — add Stage, NDA/EA dates, verdict fields.
- `src/components/crm/transaction-form-drawer.tsx` — add Stage field.
- Tests as listed above.
