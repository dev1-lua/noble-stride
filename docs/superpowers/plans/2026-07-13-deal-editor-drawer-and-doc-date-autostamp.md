# Comprehensive Deal Editor Drawer + Document-Date Auto-Stamp — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-stamp NDA/EA dates from their status so the Deal Journey stays in sync, and make the Edit/Create drawers a one-stop editor that can change a deal's Stage (with full restage semantics) and every other field.

**Architecture:** A new pure domain helper (`doc-dates.ts`) computes the effective NDA/EA sent/signed dates from a status change; the mandate/transaction services call it on every create/update. Stage becomes an editable field on both drawers; when it changes through the update service it runs the same side-effects as the existing `RestageSelect` (StageChange history + `stageEnteredAt` reset + lead/owner notification + transaction `closedAt`). The detail-page stage controls stay untouched.

**Tech Stack:** Next.js (App Router, RSC), GraphQL (Pothos on `builder`), Prisma (PostgreSQL), Zod schemas, Vitest, Tailwind.

## Global Constraints

- **Domain modules are pure:** no I/O, no `Date.now()` — pass `now: Date` in (matches `src/server/domain/journey.ts`).
- **`DocStatus` enum values:** `NotSent | Sent | Signed` (verbatim).
- **`MandateStage`:** `NewLead | Qualification | PitchPresentation | Proposal | Negotiation | Signed | Lost`.
- **`TransactionStage`:** `DealPreparation | InvestorOutreach | DueDiligence | TermSheet | Closing | ClosedWon | ClosedLost`.
- **Journey triggers this touches:** step 3 = `mandate.ndaSignedDate != null`; step 6 = `mandate.eaSignedDate != null`.
- **Decisions:** (1) stage change from drawer = full restage semantics; (2) lowering a status clears the higher date (clear-on-downgrade); (3) a manually entered date overrides auto-stamp.
- **Test runner:** `npm run test` (= `vitest run`). Pure tests need no DB; `*.smoke.test.ts` use the `withDb` helper and skip when `DATABASE_URL` is unset/unreachable. DB up: `npm run db:up`.
- **Commit style:** frequent, conventional commits (`feat(...)`, `test(...)`). Leave final merge decision to the user (no push).

---

### Task 1: Pure doc-date reconciliation helper

**Files:**
- Create: `noblestride-crm/src/server/domain/doc-dates.ts`
- Test: `noblestride-crm/src/server/domain/__tests__/doc-dates.test.ts`

**Interfaces:**
- Produces:
  - `reconcileDocDates(next: DocDateInput, existing: DocDateState, now: Date): DocDatePatch`
  - `reconcileMandateDocDates(input: MandateDocInput, existing: MandateDocState, now: Date): MandateDocPatch`
  - Types `DocDateInput`, `DocDateState`, `DocDatePatch`, `MandateDocInput`, `MandateDocState`, `MandateDocPatch` (see code).
- Consumes: `DocStatus` from `@prisma/client`.

- [ ] **Step 1: Write the failing test**

Create `noblestride-crm/src/server/domain/__tests__/doc-dates.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { reconcileDocDates, reconcileMandateDocDates } from "@/server/domain/doc-dates";

const NOW = new Date("2026-07-13T00:00:00.000Z");
const notSent = { status: "NotSent" as const, sentDate: null, signedDate: null };

describe("reconcileDocDates", () => {
  it("stamps signedDate when status is set to Signed and no prior date", () => {
    expect(reconcileDocDates({ status: "Signed" }, notSent, NOW)).toEqual({ signedDate: NOW });
  });

  it("keeps an existing signedDate when status stays Signed", () => {
    const prior = new Date("2026-01-01T00:00:00.000Z");
    const existing = { status: "Signed" as const, sentDate: null, signedDate: prior };
    expect(reconcileDocDates({ status: "Signed" }, existing, NOW)).toEqual({ signedDate: prior });
  });

  it("stamps sentDate and clears signedDate when set to Sent (downgrade)", () => {
    const existing = { status: "Signed" as const, sentDate: null, signedDate: new Date("2026-01-01") };
    expect(reconcileDocDates({ status: "Sent" }, existing, NOW)).toEqual({ sentDate: NOW, signedDate: null });
  });

  it("clears both dates when set to NotSent", () => {
    const existing = { status: "Signed" as const, sentDate: new Date("2026-01-01"), signedDate: new Date("2026-01-02") };
    expect(reconcileDocDates({ status: "NotSent" }, existing, NOW)).toEqual({ sentDate: null, signedDate: null });
  });

  it("returns an empty patch when no status is provided", () => {
    expect(reconcileDocDates({}, notSent, NOW)).toEqual({});
  });

  it("respects a manual date override over status-derived stamping", () => {
    const manual = new Date("2025-12-25T00:00:00.000Z");
    expect(reconcileDocDates({ status: "Signed", signedDate: manual }, notSent, NOW)).toEqual({ signedDate: manual });
  });

  it("respects an explicit null override", () => {
    const existing = { status: "Signed" as const, sentDate: null, signedDate: new Date("2026-01-01") };
    expect(reconcileDocDates({ status: "Signed", signedDate: null }, existing, NOW)).toEqual({ signedDate: null });
  });
});

describe("reconcileMandateDocDates", () => {
  it("stamps only the NDA signed date when NDA status becomes Signed", () => {
    const existing = {
      ndaStatus: "NotSent" as const, ndaSentDate: null, ndaSignedDate: null,
      eaStatus: "NotSent" as const, eaSentDate: null, eaSignedDate: null,
    };
    expect(reconcileMandateDocDates({ ndaStatus: "Signed" }, existing, NOW)).toEqual({ ndaSignedDate: NOW });
  });

  it("returns an empty patch when neither status changes", () => {
    const existing = {
      ndaStatus: "Signed" as const, ndaSentDate: null, ndaSignedDate: new Date("2026-01-01"),
      eaStatus: "NotSent" as const, eaSentDate: null, eaSignedDate: null,
    };
    expect(reconcileMandateDocDates({ notes: "x" } as never, existing, NOW)).toEqual({});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd noblestride-crm && npx vitest run src/server/domain/__tests__/doc-dates.test.ts`
Expected: FAIL — cannot resolve `@/server/domain/doc-dates`.

- [ ] **Step 3: Write minimal implementation**

Create `noblestride-crm/src/server/domain/doc-dates.ts`:

```ts
// doc-dates.ts — pure reconciliation of a document's sent/signed dates from
// its status. No I/O, no Date.now() — `now` is passed in, matching journey.ts.
// A document's journey trigger reads the DATE (e.g. mandate.ndaSignedDate),
// while the UI sets the STATUS enum; this keeps the two in sync.

import type { DocStatus } from "@prisma/client";

export interface DocDateState {
  status: DocStatus;
  sentDate: Date | null;
  signedDate: Date | null;
}

/** A caller-supplied change. `undefined` = not provided; explicit `null` = clear. */
export interface DocDateInput {
  status?: DocStatus | null;
  sentDate?: Date | null;
  signedDate?: Date | null;
}

/** Only the fields that should change (spread into a Prisma update). */
export interface DocDatePatch {
  sentDate?: Date | null;
  signedDate?: Date | null;
}

/**
 * Reconcile one document's dates. Manual date overrides win; otherwise, when a
 * status is being set: Signed stamps signedDate (if empty); Sent stamps
 * sentDate and clears signedDate; NotSent clears both. No status + no override
 * → empty patch (dates untouched).
 */
export function reconcileDocDates(next: DocDateInput, existing: DocDateState, now: Date): DocDatePatch {
  const patch: DocDatePatch = {};

  const sentOverridden = next.sentDate !== undefined;
  const signedOverridden = next.signedDate !== undefined;
  if (sentOverridden) patch.sentDate = next.sentDate ?? null;
  if (signedOverridden) patch.signedDate = next.signedDate ?? null;

  if (next.status != null) {
    if (next.status === "Signed") {
      if (!signedOverridden) patch.signedDate = existing.signedDate ?? now;
    } else if (next.status === "Sent") {
      if (!sentOverridden) patch.sentDate = existing.sentDate ?? now;
      if (!signedOverridden) patch.signedDate = null;
    } else {
      // NotSent
      if (!sentOverridden) patch.sentDate = null;
      if (!signedOverridden) patch.signedDate = null;
    }
  }

  return patch;
}

export interface MandateDocInput {
  ndaStatus?: DocStatus | null;
  ndaSentDate?: Date | null;
  ndaSignedDate?: Date | null;
  eaStatus?: DocStatus | null;
  eaSentDate?: Date | null;
  eaSignedDate?: Date | null;
}

export interface MandateDocState {
  ndaStatus: DocStatus;
  ndaSentDate: Date | null;
  ndaSignedDate: Date | null;
  eaStatus: DocStatus;
  eaSentDate: Date | null;
  eaSignedDate: Date | null;
}

export interface MandateDocPatch {
  ndaSentDate?: Date | null;
  ndaSignedDate?: Date | null;
  eaSentDate?: Date | null;
  eaSignedDate?: Date | null;
}

/** Apply reconcileDocDates to a mandate's NDA and EA pairs. */
export function reconcileMandateDocDates(input: MandateDocInput, existing: MandateDocState, now: Date): MandateDocPatch {
  const nda = reconcileDocDates(
    { status: input.ndaStatus, sentDate: input.ndaSentDate, signedDate: input.ndaSignedDate },
    { status: existing.ndaStatus, sentDate: existing.ndaSentDate, signedDate: existing.ndaSignedDate },
    now,
  );
  const ea = reconcileDocDates(
    { status: input.eaStatus, sentDate: input.eaSentDate, signedDate: input.eaSignedDate },
    { status: existing.eaStatus, sentDate: existing.eaSentDate, signedDate: existing.eaSignedDate },
    now,
  );
  return {
    ...(nda.sentDate !== undefined ? { ndaSentDate: nda.sentDate } : {}),
    ...(nda.signedDate !== undefined ? { ndaSignedDate: nda.signedDate } : {}),
    ...(ea.sentDate !== undefined ? { eaSentDate: ea.sentDate } : {}),
    ...(ea.signedDate !== undefined ? { eaSignedDate: ea.signedDate } : {}),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd noblestride-crm && npx vitest run src/server/domain/__tests__/doc-dates.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add noblestride-crm/src/server/domain/doc-dates.ts noblestride-crm/src/server/domain/__tests__/doc-dates.test.ts
git commit -m "feat(domain): pure NDA/EA date reconciliation from status"
```

---

### Task 2: Mandate write path — stage-in-update + auto-stamp + schema/GraphQL input

**Files:**
- Modify: `noblestride-crm/src/lib/schemas/mandate.ts`
- Modify: `noblestride-crm/src/graphql/inputs.ts` (MandateInput + import)
- Modify: `noblestride-crm/src/server/services/mandates.ts`
- Test: `noblestride-crm/src/server/services/__tests__/deal-editor.smoke.test.ts` (new)

**Interfaces:**
- Consumes: `reconcileMandateDocDates` (Task 1), `journeyForMandate` (`@/server/services/journey`), `withDb` pattern (copy from `stage-history.smoke.test.ts`).
- Produces: `mandateStageNotification(id, name, fromStage, toStage)` (module-internal helper); `updateMandate`/`createMandate` now accept `stage` and `qualificationVerdict`.

- [ ] **Step 1: Add fields to the Zod schema**

In `noblestride-crm/src/lib/schemas/mandate.ts`, extend the import and object:

```ts
import { Sector, Source, DocStatus, DealStatus, Priority, MandateStage } from "@prisma/client";
```

Add these two fields inside `mandateCreateSchema` (e.g. just after `source`):

```ts
  stage: z.nativeEnum(MandateStage).optional(),
  qualificationVerdict: z.string().trim().optional(),
```

- [ ] **Step 2: Add fields to the GraphQL input type**

In `noblestride-crm/src/graphql/inputs.ts`, add `MandateStageEnum` to the existing `from "./builder"` import, then add two fields inside `MandateInput`'s `fields` (after `source`):

```ts
    stage: t.field({ type: MandateStageEnum, required: false }),
    qualificationVerdict: t.string({ required: false }),
```

- [ ] **Step 3: Write the failing smoke test**

Create `noblestride-crm/src/server/services/__tests__/deal-editor.smoke.test.ts`:

```ts
// DB-backed smoke tests for the comprehensive deal editor: stage change via the
// generic update service (full restage semantics) + NDA/EA date auto-stamp and
// its effect on the Deal Journey. Uses the project's withDb skip pattern.

import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/db";
import { createClient, deleteClient } from "@/server/services/clients";
import { createMandate, deleteMandate, updateMandate } from "@/server/services/mandates";
import { journeyForMandate } from "@/server/services/journey";

async function withDb<T>(fn: () => Promise<T>): Promise<T | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    return await fn();
  } catch (err: unknown) {
    const m = err instanceof Error ? err.message : String(err);
    if (["ECONNREFUSED", "ENOTFOUND", "connect", "Can't reach database", "P1001", "P1002"].some((s) => m.includes(s))) {
      return null;
    }
    throw err;
  }
}

const stepState = (steps: Awaited<ReturnType<typeof journeyForMandate>>, index: number) =>
  steps?.find((s) => s.index === index)?.state;

describe("deal editor — mandate (smoke)", () => {
  it("changing stage via updateMandate records history and resets the timer", async () => {
    const ran = await withDb(async () => {
      const client = await createClient({ name: "__editor_m_client__" }, { type: "HUMAN" });
      const mandate = await createMandate({ name: "__editor_m__", clientId: client.id }, { type: "HUMAN" });
      try {
        const before = await prisma.mandate.findUniqueOrThrow({ where: { id: mandate.id } });
        await updateMandate(mandate.id, { stage: "Qualification" }, { type: "HUMAN" });

        const after = await prisma.mandate.findUniqueOrThrow({ where: { id: mandate.id } });
        expect(after.stage).toBe("Qualification");
        expect(after.stageEnteredAt.getTime()).toBeGreaterThanOrEqual(before.stageEnteredAt.getTime());

        const rows = await prisma.stageChange.findMany({ where: { mandateId: mandate.id, field: "stage" } });
        expect(rows).toHaveLength(1);
        expect(rows[0].toValue).toBe("Qualification");

        // Editing a non-stage field must NOT add another stage row.
        await updateMandate(mandate.id, { notes: "hello" }, { type: "HUMAN" });
        const rows2 = await prisma.stageChange.findMany({ where: { mandateId: mandate.id, field: "stage" } });
        expect(rows2).toHaveLength(1);
      } finally {
        await prisma.stageChange.deleteMany({ where: { mandateId: mandate.id } });
        await deleteMandate(mandate.id);
        await deleteClient(client.id);
      }
      return true;
    });
    void ran;
  });

  it("setting NDA status to Signed stamps ndaSignedDate and greens journey step 3; downgrade clears it", async () => {
    const ran = await withDb(async () => {
      const client = await createClient({ name: "__editor_nda_client__" }, { type: "HUMAN" });
      const mandate = await createMandate({ name: "__editor_nda__", clientId: client.id }, { type: "HUMAN" });
      try {
        await updateMandate(mandate.id, { ndaStatus: "Signed" }, { type: "HUMAN" });
        const signed = await prisma.mandate.findUniqueOrThrow({ where: { id: mandate.id } });
        expect(signed.ndaSignedDate).not.toBeNull();
        expect(stepState(await journeyForMandate(mandate.id), 3)).toBe("done");

        await updateMandate(mandate.id, { ndaStatus: "Sent" }, { type: "HUMAN" });
        const lowered = await prisma.mandate.findUniqueOrThrow({ where: { id: mandate.id } });
        expect(lowered.ndaSignedDate).toBeNull();
        expect(lowered.ndaSentDate).not.toBeNull();
        expect(stepState(await journeyForMandate(mandate.id), 3)).not.toBe("done");
      } finally {
        await deleteMandate(mandate.id);
        await deleteClient(client.id);
      }
      return true;
    });
    void ran;
  });

  it("creating a mandate with NDA already Signed stamps the date", async () => {
    const ran = await withDb(async () => {
      const client = await createClient({ name: "__editor_create_client__" }, { type: "HUMAN" });
      const mandate = await createMandate(
        { name: "__editor_create__", clientId: client.id, ndaStatus: "Signed" },
        { type: "HUMAN" },
      );
      try {
        const row = await prisma.mandate.findUniqueOrThrow({ where: { id: mandate.id } });
        expect(row.ndaSignedDate).not.toBeNull();
      } finally {
        await deleteMandate(mandate.id);
        await deleteClient(client.id);
      }
      return true;
    });
    void ran;
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `cd noblestride-crm && npm run db:up && npx vitest run src/server/services/__tests__/deal-editor.smoke.test.ts`
Expected: FAIL — stage change via `updateMandate` writes no history / resets nothing, and `ndaSignedDate` stays null (auto-stamp not wired yet). (If DB is unreachable the test skips — bring the DB up first.)

- [ ] **Step 5: Implement in the mandate service**

In `noblestride-crm/src/server/services/mandates.ts`:

(a) Add the import near the top:

```ts
import { reconcileMandateDocDates } from "@/server/domain/doc-dates";
```

(b) Add a module-internal notification builder (place above `createMandate`):

```ts
// Shared by setMandateStage and updateMandate so the restage notification is
// worded identically no matter which write path changed the stage.
function mandateStageNotification(id: string, name: string, fromStage: MandateStage, toStage: MandateStage) {
  return {
    kind: "stage_change" as const,
    title: `${name}: ${label("MandateStage", fromStage)} → ${label("MandateStage", toStage)}`,
    href: `/mandates/${id}`,
  };
}
```

(c) Refactor `setMandateStage`'s notify block to use it (replace the inline object passed to `notify`):

```ts
  if (fromStage !== stage && leadId && leadId !== actor.userId) {
    await notify([leadId], mandateStageNotification(id, name, fromStage, stage));
  }
```

(d) Replace `createMandate` with a version that runs auto-stamp (create has no prior state, so pass NotSent/null defaults):

```ts
export async function createMandate(input: MandateCreateInput, actor: Actor) {
  const data = mandateCreateSchema.parse(input);
  const now = new Date();
  const docDates = reconcileMandateDocDates(data, {
    ndaStatus: data.ndaStatus ?? "NotSent",
    ndaSentDate: data.ndaSentDate ?? null,
    ndaSignedDate: data.ndaSignedDate ?? null,
    eaStatus: data.eaStatus ?? "NotSent",
    eaSentDate: data.eaSentDate ?? null,
    eaSignedDate: data.eaSignedDate ?? null,
  }, now);
  return prisma.mandate.create({ data: { ...data, ...docDates, createdSource: actorSource(actor) } });
}
```

(e) Replace `updateMandate` with a version that reconciles dates and applies full stage semantics only on an actual stage change:

```ts
export async function updateMandate(id: string, input: MandateUpdateInput, actor: Actor = { type: "HUMAN" }) {
  const { stage, ...rest } = mandateUpdateSchema.parse(input);
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.mandate.findUniqueOrThrow({
      where: { id },
      select: {
        dealStatus: true, dateOpened: true, source: true, stage: true, name: true, leadId: true,
        ndaStatus: true, ndaSentDate: true, ndaSignedDate: true,
        eaStatus: true, eaSentDate: true, eaSignedDate: true,
      },
    });
    if (rest.dateOpened !== undefined && existing.dateOpened != null && !sameCalendarDate(rest.dateOpened, existing.dateOpened)) {
      throw new CrudError("Date opened is locked once set (spec §7.1: creation date is immutable).");
    }
    if (rest.source !== undefined && existing.source != null && rest.source !== existing.source) {
      throw new CrudError("Source is locked once set (spec §7.1: originating source is immutable).");
    }

    const docDates = reconcileMandateDocDates(rest, existing, now);
    const stageChanging = stage !== undefined && stage !== existing.stage;

    const updated = await tx.mandate.update({
      where: { id },
      data: { ...rest, ...docDates, ...(stageChanging ? { stage, stageEnteredAt: now } : {}) },
    });

    if (rest.dealStatus !== undefined) {
      await recordStageChange(tx, { field: "dealStatus", fromValue: existing.dealStatus, toValue: rest.dealStatus, actor, mandateId: id });
    }
    if (stageChanging) {
      await recordStageChange(tx, { field: "stage", fromValue: existing.stage, toValue: stage, actor, mandateId: id });
    }

    return { updated, existing, stageChanging };
  });

  // Notify the lead of a restage after commit (never rolls back the change).
  if (result.stageChanging && result.existing.leadId && result.existing.leadId !== actor.userId) {
    await notify([result.existing.leadId], mandateStageNotification(id, result.existing.name, result.existing.stage, stage!));
  }

  return result.updated;
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd noblestride-crm && npx vitest run src/server/services/__tests__/deal-editor.smoke.test.ts`
Expected: PASS (3 cases; skips only if DB unreachable).

- [ ] **Step 7: Regression — stage-history + journey still green**

Run: `cd noblestride-crm && npx vitest run src/server/services/__tests__/stage-history.smoke.test.ts src/server/domain/__tests__/journey.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add noblestride-crm/src/lib/schemas/mandate.ts noblestride-crm/src/graphql/inputs.ts noblestride-crm/src/server/services/mandates.ts noblestride-crm/src/server/services/__tests__/deal-editor.smoke.test.ts
git commit -m "feat(mandates): stage-in-update semantics + NDA/EA date auto-stamp"
```

---

### Task 3: Transaction write path — stage-in-update + schema/GraphQL input

**Files:**
- Modify: `noblestride-crm/src/lib/schemas/transaction.ts`
- Modify: `noblestride-crm/src/graphql/inputs.ts` (TransactionInput + import)
- Modify: `noblestride-crm/src/server/services/transactions.ts`
- Test: `noblestride-crm/src/server/services/__tests__/deal-editor.smoke.test.ts` (extend)

**Interfaces:**
- Consumes: `CLOSED_TXN_STAGES`, `label`, `notify`, `recordStageChange` (already imported in `transactions.ts`).
- Produces: `transactionStageNotification(id, name, fromStage, toStage)`; `updateTransaction` now accepts `stage`.

- [ ] **Step 1: Add `stage` to the Zod schema**

In `noblestride-crm/src/lib/schemas/transaction.ts`, extend the import and object:

```ts
import { Sector, DealType, Instrument, DealStatus, DealMilestone, DealFinancingType, MaxSellingStake, RegulatoryStatus, Priority, PartnerFeeStatus, TransactionStage } from "@prisma/client";
```

Add inside `transactionCreateSchema` (e.g. after `dateOpened`):

```ts
  stage: z.nativeEnum(TransactionStage).optional(),
```

- [ ] **Step 2: Add `stage` to the GraphQL input type**

In `noblestride-crm/src/graphql/inputs.ts`, add `TransactionStageEnum` to the `from "./builder"` import, then add inside `TransactionInput`'s `fields` (after `dateOpened`):

```ts
    stage: t.field({ type: TransactionStageEnum, required: false }),
```

- [ ] **Step 3: Write the failing test (extend the smoke file)**

Append to `noblestride-crm/src/server/services/__tests__/deal-editor.smoke.test.ts`. Add these imports at the top of the file (merge with the existing transaction import line):

```ts
import { createTransaction, deleteTransaction, updateTransaction } from "@/server/services/transactions";
```

Then add a new `describe` block at the end:

```ts
describe("deal editor — transaction (smoke)", () => {
  it("changing stage via updateTransaction records history, resets timer, and sets closedAt on ClosedWon", async () => {
    const ran = await withDb(async () => {
      const client = await createClient({ name: "__editor_t_client__" }, { type: "HUMAN" });
      const txn = await createTransaction({ name: "__editor_t__", clientId: client.id }, { type: "HUMAN" });
      try {
        await updateTransaction(txn.id, { stage: "ClosedWon" }, { type: "HUMAN" });
        const won = await prisma.transaction.findUniqueOrThrow({ where: { id: txn.id } });
        expect(won.stage).toBe("ClosedWon");
        expect(won.closedAt).not.toBeNull();

        const rows = await prisma.stageChange.findMany({ where: { transactionId: txn.id, field: "stage" } });
        expect(rows).toHaveLength(1);
        expect(rows[0].toValue).toBe("ClosedWon");

        // Re-opening clears closedAt.
        await updateTransaction(txn.id, { stage: "DueDiligence" }, { type: "HUMAN" });
        const reopened = await prisma.transaction.findUniqueOrThrow({ where: { id: txn.id } });
        expect(reopened.closedAt).toBeNull();

        // Non-stage edit adds no new stage row.
        await updateTransaction(txn.id, { notes: "x" }, { type: "HUMAN" });
        const rows2 = await prisma.stageChange.findMany({ where: { transactionId: txn.id, field: "stage" } });
        expect(rows2).toHaveLength(2); // ClosedWon + DueDiligence, not 3
      } finally {
        await prisma.stageChange.deleteMany({ where: { transactionId: txn.id } });
        await deleteTransaction(txn.id);
        await deleteClient(client.id);
      }
      return true;
    });
    void ran;
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `cd noblestride-crm && npx vitest run src/server/services/__tests__/deal-editor.smoke.test.ts -t "transaction"`
Expected: FAIL — `updateTransaction` ignores `stage`, so no history row and `closedAt` stays null.

- [ ] **Step 5: Implement in the transaction service**

In `noblestride-crm/src/server/services/transactions.ts`:

(a) Add the notification builder above `createTransaction`:

```ts
// Shared by setTransactionStage and updateTransaction (identical wording).
function transactionStageNotification(id: string, name: string, fromStage: TransactionStage, toStage: TransactionStage) {
  return {
    kind: "stage_change" as const,
    title: `${name}: ${label("TransactionStage", fromStage)} → ${label("TransactionStage", toStage)}`,
    href: `/transactions/${id}`,
  };
}
```

(b) Refactor `setTransactionStage`'s notify block to use it:

```ts
  if (fromStage !== stage && ownerId && ownerId !== actor.userId) {
    await notify([ownerId], transactionStageNotification(id, name, fromStage, stage));
  }
```

(c) Replace `updateTransaction` with a version that applies full stage semantics on an actual stage change:

```ts
export async function updateTransaction(id: string, input: TransactionUpdateInput, actor: Actor = { type: "HUMAN" }) {
  const { serviceProviderIds, stage, ...data } = transactionUpdateSchema.parse(input);
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.transaction.findUniqueOrThrow({
      where: { id },
      select: { dealStatus: true, dealMilestone: true, dateOpened: true, stage: true, name: true, ownerId: true },
    });
    if (data.dateOpened !== undefined && existing.dateOpened != null && !sameCalendarDate(data.dateOpened, existing.dateOpened)) {
      throw new CrudError("Date opened is locked once set (spec §7.1: creation date is immutable).");
    }

    const stageChanging = stage !== undefined && stage !== existing.stage;
    const closedAt = stageChanging ? (CLOSED_TXN_STAGES.includes(stage) ? now : null) : undefined;

    const updated = await tx.transaction.update({
      where: { id },
      data: {
        ...data,
        ...(serviceProviderIds ? { serviceProviders: { set: serviceProviderIds.map((spId) => ({ id: spId })) } } : {}),
        ...(stageChanging ? { stage, stageEnteredAt: now, closedAt } : {}),
      },
    });
    if (data.dealStatus !== undefined) {
      await recordStageChange(tx, { field: "dealStatus", fromValue: existing.dealStatus, toValue: data.dealStatus, actor, transactionId: id });
    }
    if (data.dealMilestone !== undefined) {
      await recordStageChange(tx, { field: "dealMilestone", fromValue: existing.dealMilestone, toValue: data.dealMilestone, actor, transactionId: id });
    }
    if (stageChanging) {
      await recordStageChange(tx, { field: "stage", fromValue: existing.stage, toValue: stage, actor, transactionId: id });
    }
    return { updated, existing, stageChanging };
  });

  if (result.stageChanging && result.existing.ownerId && result.existing.ownerId !== actor.userId) {
    await notify([result.existing.ownerId], transactionStageNotification(id, result.existing.name, result.existing.stage, stage!));
  }

  return result.updated;
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd noblestride-crm && npx vitest run src/server/services/__tests__/deal-editor.smoke.test.ts`
Expected: PASS (all mandate + transaction cases).

- [ ] **Step 7: Regression — stage-history smoke still green**

Run: `cd noblestride-crm && npx vitest run src/server/services/__tests__/stage-history.smoke.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add noblestride-crm/src/lib/schemas/transaction.ts noblestride-crm/src/graphql/inputs.ts noblestride-crm/src/server/services/transactions.ts noblestride-crm/src/server/services/__tests__/deal-editor.smoke.test.ts
git commit -m "feat(transactions): stage-in-update semantics with closedAt handling"
```

---

### Task 4: Mandate Edit/Create drawer — Stage, NDA/EA dates, verdict

**Files:**
- Modify: `noblestride-crm/src/components/crm/mandate-form-drawer.tsx`
- Modify: `noblestride-crm/src/app/(crm)/mandates/[id]/page.tsx` (the `initial` object)

**Interfaces:**
- Consumes: schema/GraphQL `stage`, `qualificationVerdict`, NDA/EA date fields (Task 2). `options("MandateStage")` (vocab). `DateField`, `SelectField`, `TextAreaField` (already imported).

- [ ] **Step 1: Extend the drawer's EMPTY defaults**

In `mandate-form-drawer.tsx`, add to the `EMPTY` object (the NDA/EA date keys already exist):

```ts
  stage: "", qualificationVerdict: "",
```

- [ ] **Step 2: Add the Stage select near the top of the form**

Immediately after the `<RelationSelect label="Client" .../>` line, add:

```tsx
          <SelectField label="Stage" value={v.stage as string} onChange={(x) => f.setValue("stage", x)} options={options("MandateStage")} />
```

- [ ] **Step 3: Add NDA/EA date inputs and the qualification verdict**

Replace the existing NDA/EA status grid block with the status grid plus date rows, and add a verdict field after `Next Action`:

```tsx
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="NDA Status" value={v.ndaStatus as string} onChange={(x) => f.setValue("ndaStatus", x)} options={options("DocStatus")} />
            <SelectField label="EA Status" value={v.eaStatus as string} onChange={(x) => f.setValue("eaStatus", x)} options={options("DocStatus")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <DateField label="NDA Sent" value={v.ndaSentDate as string} onChange={(x) => f.setValue("ndaSentDate", x)} />
            <DateField label="NDA Signed" value={v.ndaSignedDate as string} onChange={(x) => f.setValue("ndaSignedDate", x)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <DateField label="EA Sent" value={v.eaSentDate as string} onChange={(x) => f.setValue("eaSentDate", x)} />
            <DateField label="EA Signed" value={v.eaSignedDate as string} onChange={(x) => f.setValue("eaSignedDate", x)} />
          </div>
          <p className="text-xs text-[var(--text-tertiary)]">Leave a date blank to auto-stamp it from the status; enter one to backdate.</p>
```

And after the `<TextField label="Next Action" .../>` line, add:

```tsx
          <TextField label="Qualification Verdict" value={v.qualificationVerdict as string} onChange={(x) => f.setValue("qualificationVerdict", x)} />
```

- [ ] **Step 4: Prefill from the detail page**

In `noblestride-crm/src/app/(crm)/mandates/[id]/page.tsx`, add to the `initial` object (uses the existing `toDate` helper):

```ts
    stage: m.stage ?? "",
    ndaSentDate: toDate(m.ndaSentDate),
    ndaSignedDate: toDate(m.ndaSignedDate),
    eaSentDate: toDate(m.eaSentDate),
    eaSignedDate: toDate(m.eaSignedDate),
    qualificationVerdict: m.qualificationVerdict ?? "",
```

- [ ] **Step 5: Typecheck + lint the changed files**

Run: `cd noblestride-crm && npx tsc --noEmit && npx next lint --file src/components/crm/mandate-form-drawer.tsx`
Expected: no new errors (pre-existing lint noise per project may remain — do not fix unrelated).

- [ ] **Step 6: Commit**

```bash
git add noblestride-crm/src/components/crm/mandate-form-drawer.tsx "noblestride-crm/src/app/(crm)/mandates/[id]/page.tsx"
git commit -m "feat(ui): mandate drawer exposes stage, NDA/EA dates, and verdict"
```

---

### Task 5: Transaction Edit/Create drawer — Stage

**Files:**
- Modify: `noblestride-crm/src/components/crm/transaction-form-drawer.tsx`
- Modify: `noblestride-crm/src/app/(crm)/transactions/[id]/page.tsx` (the `initial` object)

**Interfaces:**
- Consumes: schema/GraphQL `stage` (Task 3). `options("TransactionStage")`.

- [ ] **Step 1: Extend the drawer's EMPTY defaults**

In `transaction-form-drawer.tsx`, add to the `EMPTY` object:

```ts
  stage: "",
```

- [ ] **Step 2: Add the Stage select**

Immediately after the `<RelationSelect label="Mandate" .../>` line, add:

```tsx
          <SelectField label="Stage" value={v.stage as string} onChange={(x) => f.setValue("stage", x)} options={options("TransactionStage")} />
```

- [ ] **Step 3: Prefill from the detail page**

In `noblestride-crm/src/app/(crm)/transactions/[id]/page.tsx`, add to the `initial` object:

```ts
    stage: txn.stage ?? "",
```

- [ ] **Step 4: Typecheck the changed files**

Run: `cd noblestride-crm && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add noblestride-crm/src/components/crm/transaction-form-drawer.tsx "noblestride-crm/src/app/(crm)/transactions/[id]/page.tsx"
git commit -m "feat(ui): transaction drawer exposes stage"
```

---

### Task 6: Full verification + browser pass

**Files:** none (verification only).

- [ ] **Step 1: Full test suite**

Run: `cd noblestride-crm && npm run db:up && npm run test`
Expected: PASS (new doc-dates + deal-editor tests green; existing suites unchanged). Note any pre-existing failures unrelated to this change.

- [ ] **Step 2: Typecheck + build**

Run: `cd noblestride-crm && npx tsc --noEmit && npm run build`
Expected: clean typecheck; successful Next.js build.

- [ ] **Step 3: Browser verification (single pass, per project convention)**

Start the dev server (`npm run dev`), then with Playwright:
1. Open a mandate detail page (e.g. `localhost:3000/mandates/<id>`), click **Edit**.
2. Set **NDA Status = Signed**, Save. Confirm the Deal Journey's **NDA** stage turns green and "Currently" advances past it.
3. Re-open **Edit**, set **Stage = Qualification**, Save. Confirm the detail-page stage `Chip` updates and the "Stage Since" timer resets.
4. Lower **NDA Status = Sent**, Save. Confirm the NDA stage un-greens.
5. On a transaction detail page, Edit → set **Stage = ClosedWon**, Save. Confirm the stage chip updates.
Capture before/after screenshots into `playwright assessment/` and append a dated note (per project QA-log convention).

- [ ] **Step 4: Final commit (screenshots + QA note)**

```bash
git add "playwright assessment/"
git commit -m "test(qa): browser verification of deal editor + doc-date auto-stamp"
```

---

## Self-Review

**Spec coverage:**
- Auto-stamp NDA/EA from status (service layer, all callers) → Task 1 (pure) + Task 2 (create/update wiring). ✅
- Clear-on-downgrade → Task 1 rules + Task 2 test. ✅
- Manual date override wins → Task 1 rules + test. ✅
- Stage editable in drawer with full restage semantics (history + timer + notify + `closedAt`) → Task 2 (mandate), Task 3 (transaction) + Tasks 4/5 (UI). ✅
- Create scenario → Task 2 create path + test; drawers apply in create mode. ✅
- Comprehensive mandate drawer (stage + NDA/EA dates + verdict) → Task 4. ✅
- Transaction drawer stage → Task 5. ✅
- Outer detail-page controls unchanged → no task removes them; only `initial` objects extended. ✅

**Placeholder scan:** No TBD/TODO; every code step shows real code and exact commands.

**Type consistency:** `reconcileDocDates`/`reconcileMandateDocDates` signatures identical across Tasks 1–3. `mandateStageNotification`/`transactionStageNotification` used consistently. `stageChanging`/`closedAt` locals consistent within each service. GraphQL enums `MandateStageEnum`/`TransactionStageEnum` sourced from `./builder` (confirmed present).

**Known nuance:** `next.status?: DocStatus | null` — `!= null` guards handle both `undefined` (field absent) and explicit `null`. Manual-override flags (`sentOverridden`/`signedOverridden`) are keyed on `!== undefined`, so an explicit `null` counts as an override (clear), while an absent field defers to status logic.
