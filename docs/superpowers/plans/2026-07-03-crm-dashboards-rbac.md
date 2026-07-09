# CRM Dashboards, Company/Deal Fields, DD Tracks & In-Org RBAC — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add §3.1 company fields + §3.2 IC/CAK deal fields + §6.2 DD workstream tracks, investor filters + investor/partner dashboards (§11.1, §13), disbursement-by-period analytics, and demo-lens in-org RBAC views (§7.2) to the NobleStride CRM.

**Architecture:** One Prisma migration adds all new columns/enums/models. Internal CRM keeps the RSC→service→Prisma read path and GraphQL(Pothos)→service write path. All investor/partner-facing data continues to flow through `src/server/visibility/` (allowlist projection); filters are a pure narrowing step layered on top of discovery gating. RBAC is a cookie-lens (like the existing viewpoint), enforced at UI level from a single shared matrix table.

**Tech Stack:** Next.js 16 App Router (RSC), Prisma 6 + Postgres (docker, port 5544), Pothos GraphQL, Zod, Vitest, hand-rolled SVG/CSS charts (motion/react). **No new dependencies.**

**Spec:** `docs/superpowers/specs/2026-07-03-crm-dashboards-rbac-design.md`

## Global Constraints

- All commands run from `noblestride-crm/` unless stated otherwise. DB: `docker compose up -d` (Postgres on **5544**).
- Test suite must stay green: `npm run test` (Vitest, 270 tests pre-existing, `fileParallelism: false`, tests colocated in `__tests__/` dirs).
- **Zod gate:** any writable field NOT added to the matching `src/lib/schemas/<model>.ts` create schema is silently stripped before the Prisma write. Every new writable field must be added there.
- **Portal never uses GraphQL.** Anything investor/partner-facing goes through `src/server/visibility/` only.
- **No chart library.** Charts are hand-rolled SVG/CSS per `src/components/crm/pipeline-chart.tsx`.
- After `prisma migrate dev` / `prisma generate`: the dev server holds a stale Prisma client — kill port 3000, delete `.next/dev`, restart. (Tests import the client fresh, so tests are fine.)
- `scripts/*.ts` run via `tsx` cannot use the `@/` alias — relative imports only.
- Hard rules (visibility): DD tracks, IC dates, CAK/COMESA fields, other-investor identities, partner/provider identities, internal notes/feedback must NEVER appear in any external projection.
- Naming: company = `Client`, origination = `Mandate`, execution = `Transaction`, investor↔deal join = `Engagement`.
- Prisma `OrgRole` values are `Admin | DealLead | TeamMember` (no spaces); display labels come from `src/lib/vocab.ts`.
- Commit after each task with a conventional-commits message; include `prisma/migrations/**` and regenerated `src/generated/pothos-types.ts` in the Task 1 commit.

---

### Task 1: Prisma data model — enums, Client/Transaction/User fields, DueDiligenceTrack

**Files:**
- Modify: `noblestride-crm/prisma/schema.prisma`
- Create (generated): `noblestride-crm/prisma/migrations/<ts>_company_ic_cak_dd_rbac_fields/migration.sql`

**Interfaces:**
- Produces: Prisma models/enums used by every later task: `Client.projectCodename/ebitda/existingDebt/totalAssets/womenLed/youthLed`, `Transaction.icFirstApprovalDate/icSecondApprovalDate/cakComesaStatus/cakComesaFiledDate/cakComesaApprovedDate/ddTracks`, `User.role`, model `DueDiligenceTrack`, enums `RegulatoryStatus`, `DDTrack`, `DDStatus`, `OrgRole`.

- [ ] **Step 1: Add the four new enums** after `enum PartnerAgreementStatus` (~line 308):

```prisma
enum RegulatoryStatus {
  NotStarted
  Filed
  Approved
  NotRequired
}

// §6.2 due-diligence workstreams
enum DDTrack {
  Financial
  Tax
  Commercial
  ESG
  Legal
}

enum DDStatus {
  NotStarted
  InProgress
  Complete
  Flagged
  NotApplicable
}

// §7.2 in-org roles (demo lens, not auth)
enum OrgRole {
  Admin
  DealLead
  TeamMember
}
```

- [ ] **Step 2: Extend `Client`** — insert after `pitchDeckUrl String?` (line ~467):

```prisma
  // §3.1 financial + impact fields
  projectCodename   String?
  ebitda            Decimal?       @db.Decimal(20, 2)
  existingDebt      Decimal?       @db.Decimal(20, 2)
  totalAssets       Decimal?       @db.Decimal(20, 2)
  womenLed          Boolean        @default(false)
  youthLed          Boolean        @default(false)
```

- [ ] **Step 3: Extend `Transaction`** — insert after `successFeePaidDate DateTime?` (line ~539):

```prisma
  // §3.2 IC approvals + CAK/COMESA regulatory tracking (deal-level, internal-only)
  icFirstApprovalDate   DateTime?
  icSecondApprovalDate  DateTime?
  cakComesaStatus       RegulatoryStatus @default(NotStarted)
  cakComesaFiledDate    DateTime?
  cakComesaApprovedDate DateTime?
```

and add to the Transaction relations block (next to `documents Document[]`):

```prisma
  ddTracks         DueDiligenceTrack[]
```

- [ ] **Step 4: Extend `User` and `ServiceProvider`.** In `model User` add after `isActive`:

```prisma
  role        OrgRole  @default(Admin)
```

and to User's relations: `ddTracks DueDiligenceTrack[] @relation("DDTrackOwner")`.
In `model ServiceProvider` (line ~718) add to relations: `ddTracks DueDiligenceTrack[] @relation("DDTrackProvider")`.

- [ ] **Step 5: Add the `DueDiligenceTrack` model** after `EngagementMilestone` (~line 621):

```prisma
// ─────────────────────────────────────────────────────────────────────────────
// DueDiligenceTrack — deal-level DD workstreams (SPEC §6.2): financial / tax /
// commercial / ESG / legal. INTERNAL ONLY — never projected to the portal.
// ─────────────────────────────────────────────────────────────────────────────

model DueDiligenceTrack {
  id          String    @id @default(cuid())
  track       DDTrack
  status      DDStatus  @default(NotStarted)
  startedAt   DateTime?
  completedAt DateTime?
  notes       String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  transactionId     String
  transaction       Transaction      @relation(fields: [transactionId], references: [id], onDelete: Cascade)
  ownerId           String?
  owner             User?            @relation("DDTrackOwner", fields: [ownerId], references: [id], onDelete: SetNull)
  serviceProviderId String?
  serviceProvider   ServiceProvider? @relation("DDTrackProvider", fields: [serviceProviderId], references: [id], onDelete: SetNull)

  @@unique([transactionId, track])
  @@index([transactionId])
}
```

- [ ] **Step 6: Migrate + generate.**

Run: `docker compose up -d` then `npx prisma migrate dev --name company_ic_cak_dd_rbac_fields` then `npx prisma generate`
Expected: migration applied, client regenerated, `src/generated/pothos-types.ts` updated. If the dev server is running: kill it, delete `.next/dev`, restart later.

- [ ] **Step 7: Verify suite still green.** Run: `npm run test` — Expected: 270 passed.

- [ ] **Step 8: Commit** — `feat(schema): company financials/impact, IC+CAK deal fields, DD tracks, user org roles` (include `prisma/`, `src/generated/pothos-types.ts`).

---

### Task 2: Zod + GraphQL plumbing for the new fields

**Files:**
- Modify: `noblestride-crm/src/lib/schemas/client.ts`, `src/lib/schemas/transaction.ts`
- Create: `noblestride-crm/src/lib/schemas/due-diligence.ts`
- Modify: `noblestride-crm/src/graphql/builder.ts`, `src/graphql/types.ts`, `src/graphql/inputs.ts`
- Test: `noblestride-crm/src/lib/schemas/__tests__/new-fields.test.ts`

**Interfaces:**
- Consumes: Task 1 Prisma types.
- Produces: `clientCreateSchema` (+6 fields), `transactionCreateSchema` (+5 fields), `ddTrackUpsertSchema` / `DDTrackUpsertInput` (from `src/lib/schemas/due-diligence.ts`), Pothos enums `RegulatoryStatusEnum/DDTrackEnum/DDStatusEnum/OrgRoleEnum`, `DueDiligenceTrackInput`, `DueDiligenceTrackRef`.

- [ ] **Step 1: Write the failing test** `src/lib/schemas/__tests__/new-fields.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { clientCreateSchema } from "@/lib/schemas/client";
import { transactionCreateSchema } from "@/lib/schemas/transaction";
import { ddTrackUpsertSchema } from "@/lib/schemas/due-diligence";

describe("client schema — §3.1 fields survive parsing (Zod strips undeclared keys)", () => {
  it("keeps codename, financials and impact flags", () => {
    const parsed = clientCreateSchema.parse({
      name: "Acme",
      projectCodename: "Project Baobab",
      ebitda: 1_200_000,
      existingDebt: 500_000,
      totalAssets: 4_000_000,
      womenLed: true,
      youthLed: false,
    });
    expect(parsed.projectCodename).toBe("Project Baobab");
    expect(parsed.ebitda).toBe(1_200_000);
    expect(parsed.existingDebt).toBe(500_000);
    expect(parsed.totalAssets).toBe(4_000_000);
    expect(parsed.womenLed).toBe(true);
    expect(parsed.youthLed).toBe(false);
  });
});

describe("transaction schema — §3.2 IC/CAK fields survive parsing", () => {
  it("keeps IC dates and CAK/COMESA fields", () => {
    const parsed = transactionCreateSchema.parse({
      name: "Deal",
      clientId: "c1",
      icFirstApprovalDate: "2026-01-15",
      icSecondApprovalDate: "2026-03-01",
      cakComesaStatus: "Filed",
      cakComesaFiledDate: "2026-04-01",
      cakComesaApprovedDate: "2026-05-01",
    });
    expect(parsed.icFirstApprovalDate).toBeInstanceOf(Date);
    expect(parsed.cakComesaStatus).toBe("Filed");
    expect(parsed.cakComesaApprovedDate).toBeInstanceOf(Date);
  });
});

describe("dd track schema", () => {
  it("requires transactionId + track, defaults nothing else", () => {
    const parsed = ddTrackUpsertSchema.parse({ transactionId: "t1", track: "Financial", status: "InProgress" });
    expect(parsed.track).toBe("Financial");
    expect(parsed.status).toBe("InProgress");
    expect(() => ddTrackUpsertSchema.parse({ track: "Financial" })).toThrow();
  });
});
```

- [ ] **Step 2: Run to verify it fails.** `npm run test -- src/lib/schemas` — Expected: FAIL (module `due-diligence` missing, fields stripped).

- [ ] **Step 3: Extend `src/lib/schemas/client.ts`** — add inside `clientCreateSchema`:

```ts
  projectCodename: z.string().trim().optional(),
  ebitda: z.number().optional(),
  existingDebt: z.number().nonnegative().optional(),
  totalAssets: z.number().nonnegative().optional(),
  womenLed: z.boolean().optional(),
  youthLed: z.boolean().optional(),
```

(EBITDA may legitimately be negative — no `.nonnegative()`. Codename stays optional at the API layer; the create drawer enforces it in Task 5.)

- [ ] **Step 4: Extend `src/lib/schemas/transaction.ts`** — add `RegulatoryStatus` to the `@prisma/client` import and inside `transactionCreateSchema`:

```ts
  icFirstApprovalDate: z.coerce.date().optional(),
  icSecondApprovalDate: z.coerce.date().optional(),
  cakComesaStatus: z.nativeEnum(RegulatoryStatus).optional(),
  cakComesaFiledDate: z.coerce.date().optional(),
  cakComesaApprovedDate: z.coerce.date().optional(),
```

- [ ] **Step 5: Create `src/lib/schemas/due-diligence.ts`:**

```ts
import { z } from "zod";
import { DDStatus, DDTrack } from "@prisma/client";

export const ddTrackUpsertSchema = z.object({
  transactionId: z.string().trim().min(1, "Transaction is required"),
  track: z.nativeEnum(DDTrack),
  status: z.nativeEnum(DDStatus).optional(),
  ownerId: z.string().trim().optional(),
  serviceProviderId: z.string().trim().optional(),
  startedAt: z.coerce.date().optional(),
  completedAt: z.coerce.date().optional(),
  notes: z.string().trim().optional(),
});
export type DDTrackUpsertInput = z.infer<typeof ddTrackUpsertSchema>;
```

- [ ] **Step 6: Register GraphQL enums** in `src/graphql/builder.ts` — add `DDStatus, DDTrack, OrgRole, RegulatoryStatus` to the `@prisma/client` import and append:

```ts
export const RegulatoryStatusEnum = builder.enumType(RegulatoryStatus, { name: "RegulatoryStatus" });
export const DDTrackEnum = builder.enumType(DDTrack, { name: "DDTrack" });
export const DDStatusEnum = builder.enumType(DDStatus, { name: "DDStatus" });
export const OrgRoleEnum = builder.enumType(OrgRole, { name: "OrgRole" });
```

- [ ] **Step 7: Expose fields in `src/graphql/types.ts`** (add `RegulatoryStatusEnum, DDTrackEnum, DDStatusEnum, OrgRoleEnum` to the `./builder` import):

In `ClientRef` after `pitchDeckUrl`:
```ts
    projectCodename: t.exposeString("projectCodename", { nullable: true }),
    ebitda: t.float({ nullable: true, resolve: (c) => (c.ebitda == null ? null : Number(c.ebitda)) }),
    existingDebt: t.float({ nullable: true, resolve: (c) => (c.existingDebt == null ? null : Number(c.existingDebt)) }),
    totalAssets: t.float({ nullable: true, resolve: (c) => (c.totalAssets == null ? null : Number(c.totalAssets)) }),
    womenLed: t.exposeBoolean("womenLed"),
    youthLed: t.exposeBoolean("youthLed"),
```

In `TransactionRef` after `successFeePaidDate`:
```ts
    icFirstApprovalDate: t.field({ type: "DateTime", nullable: true, resolve: (tx) => tx.icFirstApprovalDate }),
    icSecondApprovalDate: t.field({ type: "DateTime", nullable: true, resolve: (tx) => tx.icSecondApprovalDate }),
    cakComesaStatus: t.field({ type: RegulatoryStatusEnum, resolve: (tx) => tx.cakComesaStatus }),
    cakComesaFiledDate: t.field({ type: "DateTime", nullable: true, resolve: (tx) => tx.cakComesaFiledDate }),
    cakComesaApprovedDate: t.field({ type: "DateTime", nullable: true, resolve: (tx) => tx.cakComesaApprovedDate }),
```
and in TransactionRef relations: `ddTracks: t.relation("ddTracks"),`

In `UserRef` after `isActive`: `role: t.field({ type: OrgRoleEnum, resolve: (u) => u.role }),`

New object at the end of the file:
```ts
// ─── DueDiligenceTrack ───────────────────────────────────────────────────────

export const DueDiligenceTrackRef = builder.prismaObject("DueDiligenceTrack", {
  fields: (t) => ({
    id: t.exposeID("id"),
    track: t.field({ type: DDTrackEnum, resolve: (d) => d.track }),
    status: t.field({ type: DDStatusEnum, resolve: (d) => d.status }),
    startedAt: t.field({ type: "DateTime", nullable: true, resolve: (d) => d.startedAt }),
    completedAt: t.field({ type: "DateTime", nullable: true, resolve: (d) => d.completedAt }),
    notes: t.exposeString("notes", { nullable: true }),
    createdAt: t.field({ type: "DateTime", resolve: (d) => d.createdAt }),
    updatedAt: t.field({ type: "DateTime", resolve: (d) => d.updatedAt }),
    transactionId: t.exposeString("transactionId"),
    ownerId: t.exposeString("ownerId", { nullable: true }),
    serviceProviderId: t.exposeString("serviceProviderId", { nullable: true }),
    transaction: t.relation("transaction"),
    owner: t.relation("owner", { nullable: true }),
    serviceProvider: t.relation("serviceProvider", { nullable: true }),
  }),
});
```

- [ ] **Step 8: Inputs** in `src/graphql/inputs.ts` (import `RegulatoryStatusEnum, DDTrackEnum, DDStatusEnum`):

`ClientInput` — append:
```ts
    projectCodename: t.string({ required: false }),
    ebitda: t.float({ required: false }),
    existingDebt: t.float({ required: false }),
    totalAssets: t.float({ required: false }),
    womenLed: t.boolean({ required: false }),
    youthLed: t.boolean({ required: false }),
```

`TransactionInput` — append:
```ts
    icFirstApprovalDate: t.field({ type: "DateTime", required: false }),
    icSecondApprovalDate: t.field({ type: "DateTime", required: false }),
    cakComesaStatus: t.field({ type: RegulatoryStatusEnum, required: false }),
    cakComesaFiledDate: t.field({ type: "DateTime", required: false }),
    cakComesaApprovedDate: t.field({ type: "DateTime", required: false }),
```

New input at the end:
```ts
export const DueDiligenceTrackInput = builder.inputType("DueDiligenceTrackInput", {
  fields: (t) => ({
    transactionId: t.id({ required: true }),
    track: t.field({ type: DDTrackEnum, required: true }),
    status: t.field({ type: DDStatusEnum, required: false }),
    ownerId: t.id({ required: false }),
    serviceProviderId: t.id({ required: false }),
    startedAt: t.field({ type: "DateTime", required: false }),
    completedAt: t.field({ type: "DateTime", required: false }),
    notes: t.string({ required: false }),
  }),
});
```

- [ ] **Step 9: Run tests.** `npm run test` — Expected: all pass (270 + 3 new).

- [ ] **Step 10: Commit** — `feat(graphql): expose §3.1/§3.2 fields + DD track type through Zod and Pothos`.

---

### Task 3: DD service + mutations, vocab labels

**Files:**
- Create: `noblestride-crm/src/server/services/due-diligence.ts`
- Modify: `noblestride-crm/src/graphql/mutations.ts`, `src/lib/vocab.ts`

**Interfaces:**
- Consumes: `ddTrackUpsertSchema` (Task 2), `DueDiligenceTrackInput` (Task 2).
- Produces: `listDDTracks(transactionId)`, `upsertDDTrack(input)`, `deleteDDTrack(transactionId, track)`; GraphQL `upsertDueDiligenceTrack` / `deleteDueDiligenceTrack`; `LABELS.RegulatoryStatus/DDTrack/DDStatus/OrgRole`.

- [ ] **Step 1: Create `src/server/services/due-diligence.ts`:**

```ts
// Due-diligence service — deal-level DD workstream tracks (SPEC §6.2).
// Thin layer: Prisma calls only. No GraphQL, no React. Internal-only —
// nothing here is ever fed to the visibility engine.

import type { DDTrack } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ddTrackUpsertSchema, type DDTrackUpsertInput } from "@/lib/schemas/due-diligence";

/** All tracks recorded for one transaction, with owner + provider for display. */
export async function listDDTracks(transactionId: string) {
  return prisma.dueDiligenceTrack.findMany({
    where: { transactionId },
    include: { owner: true, serviceProvider: true },
    orderBy: { track: "asc" },
  });
}

/** Create-or-update one (transaction, track) row — the panel's only write. */
export async function upsertDDTrack(input: DDTrackUpsertInput) {
  const { transactionId, track, ...rest } = ddTrackUpsertSchema.parse(input);
  return prisma.dueDiligenceTrack.upsert({
    where: { transactionId_track: { transactionId, track } },
    create: { transactionId, track, ...rest },
    update: rest,
  });
}

export async function deleteDDTrack(transactionId: string, track: DDTrack) {
  return prisma.dueDiligenceTrack.delete({
    where: { transactionId_track: { transactionId, track } },
  });
}
```

- [ ] **Step 2: Wire mutations** in `src/graphql/mutations.ts` — add imports (`DueDiligenceTrackInput` from `./inputs`, `DDTrackEnum` from `./builder`, service functions) and inside `builder.mutationFields`, following the exact style of the Client block:

```ts
  // ── DueDiligenceTrack ──
  upsertDueDiligenceTrack: t.prismaField({
    type: "DueDiligenceTrack", nullable: false,
    args: { input: t.arg({ type: DueDiligenceTrackInput, required: true }) },
    resolve: (_q, _r, args) => upsertDDTrack(args.input as never),
  }),
  deleteDueDiligenceTrack: t.prismaField({
    type: "DueDiligenceTrack", nullable: false,
    args: { transactionId: t.arg.id({ required: true }), track: t.arg({ type: DDTrackEnum, required: true }) },
    resolve: (_q, _r, args) => deleteDDTrack(String(args.transactionId), args.track),
  }),
```

- [ ] **Step 3: Vocab labels** — append to `LABELS` in `src/lib/vocab.ts`:

```ts
  RegulatoryStatus: {
    NotStarted: "Not Started",
    Filed: "Filed",
    Approved: "Approved",
    NotRequired: "Not Required",
  },
  DDTrack: {
    Financial: "Financial",
    Tax: "Tax",
    Commercial: "Commercial",
    ESG: "ESG",
    Legal: "Legal",
  },
  DDStatus: {
    NotStarted: "Not Started",
    InProgress: "In Progress",
    Complete: "Complete",
    Flagged: "Flagged",
    NotApplicable: "N/A",
  },
  OrgRole: {
    Admin: "Admin",
    DealLead: "Deal Lead",
    TeamMember: "Team Member",
  },
```

Check the rest of `vocab.ts` for a parallel chip-color map (e.g. `CHIP_TONES`/`COLORS`); if `Chip` requires an entry per group, add neutral tones for the four new groups mirroring an existing neutral group.

- [ ] **Step 4: Run tests + typecheck.** `npm run test` — Expected: green. `npx tsc --noEmit` if the repo has no separate typecheck script.

- [ ] **Step 5: Commit** — `feat(dd): due-diligence track service, mutations and vocab`.

---

### Task 4: Internal UI — Client drawer fields + Transaction IC/CAK fields + DD panel

**Files:**
- Modify: `noblestride-crm/src/components/crm/client-form-drawer.tsx`
- Modify: `noblestride-crm/src/components/crm/transaction-form-drawer.tsx` (read first; mirror how `dateOpened` is edited there)
- Modify: `noblestride-crm/src/app/(crm)/transactions/[id]/page.tsx`
- Modify: `noblestride-crm/src/app/(crm)/clients/[id]/page.tsx` (read first; add display rows to the existing facts `<dl>`)
- Create: `noblestride-crm/src/components/crm/dd-tracks-panel.tsx`

**Interfaces:**
- Consumes: `listDDTracks` (Task 3), GraphQL mutations (Task 3), vocab labels (Task 3).
- Produces: `<DDTracksPanel transactionId tracks users serviceProviders />` client component.

- [ ] **Step 1: Client drawer.** In `client-form-drawer.tsx`:
  - Extend `EMPTY`: `projectCodename: "", ebitda: undefined, existingDebt: undefined, totalAssets: undefined, womenLed: false, youthLed: false,`
  - Enforce codename on create only (API stays lenient): where the schema is chosen, use

```ts
import { z } from "zod";
// UI-only rule: codename is required when creating (SPEC §3.1); imported legacy rows may lack it.
const clientCreateUiSchema = clientCreateSchema.extend({
  projectCodename: z.string().trim().min(1, "Project codename is required"),
});
...
schema: mode === "create" ? clientCreateUiSchema : clientUpdateSchema,
```

  - Add fields (codename right under Name; financials next to the revenue row; impact flags next to Profitable):

```tsx
<TextField label="Project Codename" required value={v.projectCodename as string} onChange={(x) => f.setValue("projectCodename", x)} error={f.errors.projectCodename} />
<div className="grid grid-cols-2 gap-3">
  <MoneyField label="EBITDA" value={v.ebitda as number} onChange={(x) => f.setValue("ebitda", x)} />
  <MoneyField label="Existing Debt" value={v.existingDebt as number} onChange={(x) => f.setValue("existingDebt", x)} />
</div>
<MoneyField label="Total Assets" value={v.totalAssets as number} onChange={(x) => f.setValue("totalAssets", x)} />
<div className="grid grid-cols-2 gap-3">
  <CheckboxField label="Women-led" value={v.womenLed as boolean} onChange={(x) => f.setValue("womenLed", x)} />
  <CheckboxField label="Youth-led" value={v.youthLed as boolean} onChange={(x) => f.setValue("youthLed", x)} />
</div>
```

  - Wherever the clients pages construct `initial` for edit mode, include the six new fields (Decimal → `Number(...)`).

- [ ] **Step 2: Transaction drawer.** In `transaction-form-drawer.tsx` add to its `EMPTY`/fields (using the same date-field component it already uses for `dateOpened` and `SelectField` with `options("RegulatoryStatus")`):
  `icFirstApprovalDate`, `icSecondApprovalDate`, `cakComesaStatus`, `cakComesaFiledDate`, `cakComesaApprovedDate` — grouped under a small "IC & Regulatory" heading. In `transactions/[id]/page.tsx` extend `initial` with the five fields (dates via the existing `toDate` helper).

- [ ] **Step 3: Detail displays.**
  - `transactions/[id]/page.tsx` Deal Facts `<dl>`: add "IC Approvals" (first/second dates via `formatDate`) and "CAK / COMESA" (`label("RegulatoryStatus", txn.cakComesaStatus)` + filed/approved dates) entries following the Success Fee pattern.
  - `clients/[id]/page.tsx`: add rows for Project Codename, EBITDA / Existing Debt / Total Assets (`formatMoney`), and impact chips ("Women-led" / "Youth-led") when true.

- [ ] **Step 4: DD panel.** Create `src/components/crm/dd-tracks-panel.tsx` — a client component rendering one row per `DDTrack` enum value (all five, whether or not a DB row exists): status `<select>`, owner `<select>`, provider `<select>`, started/completed `<input type="date">`, notes `<input>`, Save button per row. Reuse the exact GraphQL-fetch pattern used by `restage-select.tsx` (read it first) with:

```ts
const UPSERT = `mutation UpsertDDTrack($input: DueDiligenceTrackInput!) { upsertDueDiligenceTrack(input: $input) { id } }`;
```

On save call `router.refresh()` (same as restage). Props:

```ts
export interface DDTrackRow {
  track: string; status: string; ownerId: string | null; serviceProviderId: string | null;
  startedAt: string | null; completedAt: string | null; notes: string | null;
}
export function DDTracksPanel({ transactionId, tracks, users, serviceProviders }: {
  transactionId: string;
  tracks: DDTrackRow[];
  users: { id: string; name: string }[];
  serviceProviders: { id: string; name: string }[];
})
```

- [ ] **Step 5: Mount the panel** in `transactions/[id]/page.tsx` (new Card between "Deal Preparation" and "Documents"):

```tsx
const ddTracks = await listDDTracks(id);
const providers = await listServiceProviders(); // check src/server/services/service-providers.ts for the actual list fn name
...
<Card>
  <CardHeader><h2 className="text-sm font-semibold text-zinc-900">Due Diligence Workstreams</h2></CardHeader>
  <CardBody>
    <DDTracksPanel
      transactionId={txn.id}
      tracks={ddRows}
      users={rel.users}
      serviceProviders={providers.map((p) => ({ id: p.id, name: p.name }))}
    />
  </CardBody>
</Card>
```

where `ddRows` maps the five enum values over `ddTracks` (dates → `toISOString().slice(0,10)`).

- [ ] **Step 6: Verify in the app.** Restart dev server (`.next/dev` deleted). Create/edit a client with the new fields; set IC/CAK on a transaction; set all 5 DD tracks; reload → all persist.

- [ ] **Step 7: Run tests, commit** — `feat(crm-ui): company financial/impact fields, IC/CAK fields, DD workstreams panel`.

---

### Task 5: Disbursement by year/quarter (§13)

**Files:**
- Modify: `noblestride-crm/src/server/domain/disbursement.ts`
- Test: `noblestride-crm/src/server/domain/__tests__/disbursement.test.ts` (create; match location of any existing domain tests)
- Modify: `noblestride-crm/src/server/services/dashboard.ts`
- Create: `noblestride-crm/src/components/crm/disbursement-period-chart.tsx`
- Modify: `noblestride-crm/src/app/(crm)/dashboard/page.tsx` (read first)

**Interfaces:**
- Consumes: `amountPending`, `deriveYearQuarter` (existing).
- Produces: pure `groupDisbursementsByPeriod(rows)` and service `disbursementByPeriod()` returning `DisbursementPeriodRow[] = { year: number; quarter: number; disbursed: number; pending: number }[]` (ascending by year, quarter). Also reused by the investor dashboard (Task 8) for own-only rows.

- [ ] **Step 1: Failing test** `src/server/domain/__tests__/disbursement.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { groupDisbursementsByPeriod } from "@/server/domain/disbursement";

describe("groupDisbursementsByPeriod", () => {
  it("buckets by stored year/quarter, falling back to dateReceived", () => {
    const rows = [
      { totalAmount: 10, amountDisbursed: 4, amountPending: null, dateReceived: null, year: 2025, quarter: 4 },
      { totalAmount: 5, amountDisbursed: 5, amountPending: 0, dateReceived: new Date(Date.UTC(2026, 0, 10)), year: null, quarter: null },
      { totalAmount: 8, amountDisbursed: 2, amountPending: 6, dateReceived: null, year: 2026, quarter: 1 },
      { totalAmount: null, amountDisbursed: null, amountPending: null, dateReceived: null, year: null, quarter: null }, // dropped
    ];
    expect(groupDisbursementsByPeriod(rows)).toEqual([
      { year: 2025, quarter: 4, disbursed: 4, pending: 6 },
      { year: 2026, quarter: 1, disbursed: 7, pending: 6 },
    ]);
  });
});
```

- [ ] **Step 2: Run** `npm run test -- src/server/domain` — Expected: FAIL (function missing).

- [ ] **Step 3: Implement** in `src/server/domain/disbursement.ts`:

```ts
import { amountPending as pendingOf } from existing... // (same file — just add below)

export interface DisbursementRowInput {
  totalAmount: number | null;
  amountDisbursed: number | null;
  amountPending: number | null;
  dateReceived: Date | null;
  year: number | null;
  quarter: number | null;
}

export interface DisbursementPeriodRow {
  year: number;
  quarter: number;
  disbursed: number;
  pending: number;
}

/**
 * Group engagement disbursements into (year, quarter) buckets (SPEC §13).
 * Period = stored year/quarter, else derived from dateReceived; rows with
 * neither are dropped. Pending prefers the stored amountPending, else
 * total − disbursed. Sorted ascending.
 */
export function groupDisbursementsByPeriod(rows: DisbursementRowInput[]): DisbursementPeriodRow[] {
  const buckets = new Map<string, DisbursementPeriodRow>();
  for (const row of rows) {
    let year = row.year;
    let quarter = row.quarter;
    if ((year == null || quarter == null) && row.dateReceived) {
      const derived = deriveYearQuarter(row.dateReceived);
      year = year ?? derived.year;
      quarter = quarter ?? derived.quarter;
    }
    if (year == null || quarter == null) continue;
    const key = `${year}-${quarter}`;
    const bucket = buckets.get(key) ?? { year, quarter, disbursed: 0, pending: 0 };
    bucket.disbursed += row.amountDisbursed ?? 0;
    bucket.pending += row.amountPending ?? amountPending(row.totalAmount, row.amountDisbursed) ?? 0;
    buckets.set(key, bucket);
  }
  return [...buckets.values()].sort((a, b) => a.year - b.year || a.quarter - b.quarter);
}
```

(`deriveYearQuarter` and `amountPending` are already in this file — no import needed.)

- [ ] **Step 4: Run test → PASS.**

- [ ] **Step 5: Service** — append to `src/server/services/dashboard.ts`:

```ts
import { groupDisbursementsByPeriod, type DisbursementPeriodRow } from "@/server/domain/disbursement";

/** Disbursement analytics by calendar year/quarter across all engagements (§13). */
export async function disbursementByPeriod(): Promise<DisbursementPeriodRow[]> {
  const rows = await prisma.engagement.findMany({
    where: { OR: [{ totalAmount: { not: null } }, { amountDisbursed: { not: null } }] },
    select: { totalAmount: true, amountDisbursed: true, amountPending: true, dateReceived: true, year: true, quarter: true },
  });
  return groupDisbursementsByPeriod(
    rows.map((r) => ({
      totalAmount: r.totalAmount == null ? null : Number(r.totalAmount),
      amountDisbursed: r.amountDisbursed == null ? null : Number(r.amountDisbursed),
      amountPending: r.amountPending == null ? null : Number(r.amountPending),
      dateReceived: r.dateReceived,
      year: r.year,
      quarter: r.quarter,
    })),
  );
}
```

- [ ] **Step 6: Chart component** `src/components/crm/disbursement-period-chart.tsx` — client component, grouped bars per period (disbursed = emerald `#059669`, pending = teal `#5eead4`), same motion/label conventions as `pipeline-chart.tsx` (viewBox SVG, y-ticks, `LegendDot`-style legend, `formatMoney` for tooltips/labels). Props: `{ data: { year: number; quarter: number; disbursed: number; pending: number }[] }`, x-label `Q{quarter} {year}`.

- [ ] **Step 7: Render on `/dashboard`** — in `src/app/(crm)/dashboard/page.tsx`, load `disbursementByPeriod()` alongside the existing loaders and add a Card "Disbursements by Quarter" using the chart (empty state: "No disbursements recorded.").

- [ ] **Step 8: Run tests + verify dashboard renders. Commit** — `feat(dashboard): disbursement by year/quarter analytics`.

---

### Task 6: Visibility engine — impact flags + opportunity filters (narrow-only)

**Files:**
- Modify: `noblestride-crm/src/server/visibility/project.ts`
- Create: `noblestride-crm/src/server/visibility/filters.ts`
- Modify: `noblestride-crm/src/server/visibility/load.ts`, `src/server/visibility/index.ts`
- Modify: `noblestride-crm/src/server/visibility/__tests__/fixtures.ts`
- Test: `noblestride-crm/src/server/visibility/__tests__/filters.test.ts` (create) + extend the existing leak assertions in `project.test.ts`

**Interfaces:**
- Consumes: `DealInput`, `toNum`, `discoverableDealsForInvestor`.
- Produces: `OpportunityFilters`, `applyOpportunityFilters(deals, filters)`, `parseOpportunityFilters(searchParams)`; `ProjectedDeal.companyProfile.womenLed/youthLed: boolean`; `loadInvestorPortalData(prisma, investorId, filters?)`.

- [ ] **Step 1: Extend input/output shapes** in `project.ts`:
  - `DealClientInput` add: `womenLed?: boolean; youthLed?: boolean;` and under the never-projected comment: `ebitda?: DecimalLike | null; existingDebt?: DecimalLike | null; totalAssets?: DecimalLike | null;`
    (EBITDA/debt/assets belong to `fullFinancials`/`financialsSummary` handling — for now they are **not** projected at any tier; only the flags surface.)
  - `DealInput` — add to the "NEVER projected" block: `ddTracks?: unknown[];` and `icFirstApprovalDate?: unknown; icSecondApprovalDate?: unknown; cakComesaStatus?: unknown; cakComesaFiledDate?: unknown; cakComesaApprovedDate?: unknown;`
  - `ProjectedDeal.companyProfile` add `womenLed: boolean; youthLed: boolean;` and map in `projectDealForInvestor`:

```ts
      womenLed: client?.womenLed ?? false,
      youthLed: client?.youthLed ?? false,
```

- [ ] **Step 2: Failing tests** `src/server/visibility/__tests__/filters.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { applyOpportunityFilters, parseOpportunityFilters } from "@/server/visibility/filters";
import { makeDealFixture } from "./fixtures";

const deal = makeDealFixture(); // Agribusiness / EastAfrica / raise 8M / womenLed true (set in fixtures step)

describe("applyOpportunityFilters — narrowing only", () => {
  it("empty filters are the identity", () => {
    expect(applyOpportunityFilters([deal], {})).toEqual([deal]);
  });
  it("never returns a deal not in the input (cannot widen)", () => {
    const out = applyOpportunityFilters([deal], { sector: "Technology" });
    expect(out.every((d) => [deal].includes(d))).toBe(true);
    expect(out).toHaveLength(0);
  });
  it("filters by sector, country, instrument, dealType", () => {
    expect(applyOpportunityFilters([deal], { sector: "Agribusiness" })).toHaveLength(1);
    expect(applyOpportunityFilters([deal], { country: "WestAfrica" })).toHaveLength(0);
    expect(applyOpportunityFilters([deal], { instrument: "Debt" })).toHaveLength(0);
    expect(applyOpportunityFilters([deal], { dealType: "Growth" })).toHaveLength(1);
  });
  it("filters by ticket band", () => {
    expect(applyOpportunityFilters([deal], { ticketMin: 10_000_000 })).toHaveLength(0);
    expect(applyOpportunityFilters([deal], { ticketMin: 1_000_000, ticketMax: 10_000_000 })).toHaveLength(1);
  });
  it("honours impact flags", () => {
    expect(applyOpportunityFilters([deal], { womenLed: true })).toHaveLength(1);
    expect(applyOpportunityFilters([deal], { youthLed: true })).toHaveLength(0);
  });
});

describe("parseOpportunityFilters — defensive", () => {
  it("ignores unknown enum values and junk numbers", () => {
    expect(parseOpportunityFilters({ sector: "NotASector", ticketMin: "abc", womenLed: "1" })).toEqual({ womenLed: true });
  });
  it("parses valid params", () => {
    expect(parseOpportunityFilters({ sector: "Agribusiness", ticketMax: "5000000" })).toEqual({
      sector: "Agribusiness",
      ticketMax: 5_000_000,
    });
  });
});
```

- [ ] **Step 3: Run → FAIL** (module missing).

- [ ] **Step 4: Create `src/server/visibility/filters.ts`:**

```ts
// Visibility engine — investor-side opportunity filters (SPEC §11.1).
// Pure narrowing over already-gated candidates: filters can only REDUCE what
// discovery/tier gating produced, never widen it. Parsing is defensive —
// anything invalid is simply ignored (unfiltered, still gated).

import { DealType, Geography, Instrument, Sector } from "@prisma/client";
import type { DealInput } from "./project";
import { toNum } from "./project";

export interface OpportunityFilters {
  sector?: Sector;
  country?: Geography;
  dealType?: DealType;
  instrument?: Instrument;
  ticketMin?: number;
  ticketMax?: number;
  revenueMin?: number;
  revenueMax?: number;
  womenLed?: boolean;
  youthLed?: boolean;
}

export function applyOpportunityFilters<T extends DealInput>(deals: T[], f: OpportunityFilters): T[] {
  return deals.filter((deal) => {
    const client = deal.client ?? null;
    if (f.sector) {
      const sectors = [...(deal.sector ?? []), ...(client?.sector ?? [])];
      if (!sectors.includes(f.sector)) return false;
    }
    if (f.country && !(client?.countries ?? []).includes(f.country)) return false;
    if (f.dealType && deal.dealType !== f.dealType) return false;
    if (f.instrument && !(deal.instrument ?? []).includes(f.instrument)) return false;
    const raise = toNum(deal.targetRaise);
    if (f.ticketMin != null && (raise == null || raise < f.ticketMin)) return false;
    if (f.ticketMax != null && (raise == null || raise > f.ticketMax)) return false;
    const revenue = toNum(client?.revenueLastYear);
    if (f.revenueMin != null && (revenue == null || revenue < f.revenueMin)) return false;
    if (f.revenueMax != null && (revenue == null || revenue > f.revenueMax)) return false;
    if (f.womenLed && !client?.womenLed) return false;
    if (f.youthLed && !client?.youthLed) return false;
    return true;
  });
}

type RawParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function parseEnum<T extends Record<string, string>>(enumObj: T, v: string | undefined): T[keyof T] | undefined {
  return v != null && Object.values(enumObj).includes(v) ? (v as T[keyof T]) : undefined;
}

function parseNum(v: string | undefined): number | undefined {
  if (v == null || v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/** Parse URL searchParams into filters, dropping anything invalid. */
export function parseOpportunityFilters(params: RawParams): OpportunityFilters {
  const f: OpportunityFilters = {};
  const sector = parseEnum(Sector, first(params.sector));
  if (sector) f.sector = sector;
  const country = parseEnum(Geography, first(params.country));
  if (country) f.country = country;
  const dealType = parseEnum(DealType, first(params.dealType));
  if (dealType) f.dealType = dealType;
  const instrument = parseEnum(Instrument, first(params.instrument));
  if (instrument) f.instrument = instrument;
  const ticketMin = parseNum(first(params.ticketMin));
  if (ticketMin != null) f.ticketMin = ticketMin;
  const ticketMax = parseNum(first(params.ticketMax));
  if (ticketMax != null) f.ticketMax = ticketMax;
  const revenueMin = parseNum(first(params.revenueMin));
  if (revenueMin != null) f.revenueMin = revenueMin;
  const revenueMax = parseNum(first(params.revenueMax));
  if (revenueMax != null) f.revenueMax = revenueMax;
  if (first(params.womenLed) === "1") f.womenLed = true;
  if (first(params.youthLed) === "1") f.youthLed = true;
  return f;
}
```

- [ ] **Step 5: Fixtures + leak sentinels** in `__tests__/fixtures.ts`:
  - Add sentinels and register them:

```ts
export const DD_TRACK_NOTE = "DD-TRACK-NOTE-financial-red-flag";
export const CAK_SENTINEL = "cakComesa";
// add DD_TRACK_NOTE to FORBIDDEN_STRINGS
```

  - In `makeDealFixture()` set on `client`: `womenLed: true, youthLed: false, ebitda: 1_500_000, existingDebt: 900_000, totalAssets: 5_000_000,` and on the deal:

```ts
    icFirstApprovalDate: new Date("2026-01-15"),
    cakComesaStatus: "Filed",
    ddTracks: [{ track: "Financial", status: "Flagged", notes: DD_TRACK_NOTE }],
```

  - In `project.test.ts`, alongside the existing FORBIDDEN_STRINGS leak assertions, add for every tier:

```ts
const json = JSON.stringify(projectDealForInvestor(makeDealFixture(), tier));
expect(json).not.toContain("ddTrack");
expect(json).not.toContain(DD_TRACK_NOTE);
expect(json).not.toContain("icFirstApproval");
expect(json).not.toContain(CAK_SENTINEL);
// and the flags DO surface:
expect(projectDealForInvestor(makeDealFixture(), "PRE_INTEREST")!.companyProfile.womenLed).toBe(true);
```

- [ ] **Step 6: `load.ts`** — change the portal loader signature (narrow-only by construction — filters intersect the candidate set):

```ts
import { applyOpportunityFilters, type OpportunityFilters } from "./filters";

export async function loadInvestorPortalData(
  prisma: PrismaClient,
  investorId: string,
  filters: OpportunityFilters = {},
): Promise<InvestorPortalData> {
  ...
  const filteredIds = new Set(applyOpportunityFilters(deals, filters).map((d) => d.id));

  const projected: ProjectedDeal[] = [];
  for (const deal of deals) {
    const engagement = engagementByTxn.get(deal.id) ?? null;
    if (!engagement && !discoverableIds.has(deal.id)) continue;
    if (!filteredIds.has(deal.id)) continue; // filters narrow, never widen
    ...
```

- [ ] **Step 7: Barrel** — export from `index.ts`: `applyOpportunityFilters, parseOpportunityFilters, type OpportunityFilters` from `./filters`.

- [ ] **Step 8: Run full suite → PASS. Commit** — `feat(visibility): impact flags in projection + narrow-only opportunity filters, DD/IC/CAK leak guards`.

---

### Task 7: Investor portal — filter UI on Opportunities

**Files:**
- Create: `noblestride-crm/src/components/portal/opportunity-filters.tsx`
- Modify: `noblestride-crm/src/app/portal/investor/page.tsx`

**Interfaces:**
- Consumes: `parseOpportunityFilters`, `loadInvestorPortalData(prisma, id, filters)` (Task 6), `options()` from `@/lib/vocab`.

- [ ] **Step 1: Create `opportunity-filters.tsx`** (client component; URL `searchParams` are the single source of truth):

```tsx
"use client";

// opportunity-filters.tsx — investor-side deal filters (SPEC §11.1).
// Writes URL searchParams only; the server re-runs the gated + filtered query.
// Filters can only narrow what the visibility engine already allows.

import { useRouter, useSearchParams } from "next/navigation";
import { options } from "@/lib/vocab";

const SELECTS = [
  { key: "sector", label: "Sector", group: "Sector" },
  { key: "country", label: "Country", group: "Geography" },
  { key: "dealType", label: "Deal type", group: "DealType" },
  { key: "instrument", label: "Instrument", group: "Instrument" },
] as const;

const NUMBERS = [
  { key: "ticketMin", label: "Ticket min (USD)" },
  { key: "ticketMax", label: "Ticket max (USD)" },
  { key: "revenueMin", label: "Revenue min (USD)" },
  { key: "revenueMax", label: "Revenue max (USD)" },
] as const;

const FLAGS = [
  { key: "womenLed", label: "Women-led" },
  { key: "youthLed", label: "Youth-led" },
] as const;

export function OpportunityFilters() {
  const router = useRouter();
  const params = useSearchParams();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`/portal/investor?${next.toString()}`, { scroll: false });
  }

  const hasAny = [...SELECTS, ...NUMBERS, ...FLAGS].some((f) => params.get(f.key));

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-end gap-3">
        {SELECTS.map((f) => (
          <label key={f.key} className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
            {f.label}
            <select
              value={params.get(f.key) ?? ""}
              onChange={(e) => setParam(f.key, e.target.value)}
              className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900"
            >
              <option value="">All</option>
              {options(f.group).map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
        ))}
        {NUMBERS.map((f) => (
          <label key={f.key} className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
            {f.label}
            <input
              type="number"
              min={0}
              defaultValue={params.get(f.key) ?? ""}
              onBlur={(e) => setParam(f.key, e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setParam(f.key, (e.target as HTMLInputElement).value)}
              className="w-32 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900"
            />
          </label>
        ))}
        {FLAGS.map((f) => (
          <label key={f.key} className="flex items-center gap-1.5 pb-1.5 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={params.get(f.key) === "1"}
              onChange={(e) => setParam(f.key, e.target.checked ? "1" : "")}
              className="h-4 w-4 rounded border-zinc-300 text-emerald-700"
            />
            {f.label}
          </label>
        ))}
        {hasAny && (
          <button
            onClick={() => router.replace("/portal/investor", { scroll: false })}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
```

Check `options()`'s return shape in `src/lib/vocab.ts` first (`{ value, label }` assumed — adjust if different). Verify `DealType` exists in `LABELS` (the drawers already call `options("DealType")`).

- [ ] **Step 2: Wire the page** — `src/app/portal/investor/page.tsx`:

```tsx
import { loadInvestorPortalData, parseOpportunityFilters } from "@/server/visibility";
import { OpportunityFilters } from "@/components/portal/opportunity-filters";

export default async function InvestorPortalPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const vp = await getViewpoint();
  if (vp.role !== "investor" || !vp.recordId) redirect("/dashboard");
  const filters = parseOpportunityFilters(await searchParams);
  const { investor, deals } = await loadInvestorPortalData(prisma, vp.recordId, filters);
  ...
  <OpportunityFilters />
  <p className="text-xs text-zinc-400">{deals.length} opportunit{deals.length === 1 ? "y" : "ies"} match</p>
```

(filters section between the heading and the grid; keep the existing empty state, tweak its copy to "No opportunities match your filters." when any filter is set). Optionally add impact chips to the deal card: when `deal.companyProfile.womenLed` render a violet "Women-led" pill next to the sector chips (same for youth-led).

- [ ] **Step 3: Verify manually** — as Lightrock: filters narrow; junk URL params ignored; greylisted fund still sees nothing.

- [ ] **Step 4: Run tests. Commit** — `feat(portal): investor opportunity filters (§11.1)`.

---

### Task 8: Investor dashboard tab

**Files:**
- Modify: `noblestride-crm/src/server/visibility/load.ts`, `index.ts`
- Create: `noblestride-crm/src/app/portal/investor/dashboard/page.tsx`
- Modify: `noblestride-crm/src/components/portal/investor-nav.tsx`

**Interfaces:**
- Consumes: `discoverableDealsForInvestor`, `isBlockedClassification`, `toNum`, `groupDisbursementsByPeriod` (Task 5).
- Produces: `loadInvestorDashboard(prisma, investorId): Promise<InvestorDashboardData>` where

```ts
export interface InvestorDashboardData {
  investor: { id: string; name: string };
  matchingOpportunities: number;
  engagedDeals: number;
  pipeline: { stage: EngagementStage; count: number }[];       // own engagements only
  disbursement: { committed: number; disbursed: number; pending: number }; // own totals only
  disbursementByPeriod: { year: number; quarter: number; disbursed: number; pending: number }[]; // own rows only
}
```

- [ ] **Step 1: Loader** in `load.ts` (own-data only; explicit allowlist — never feedback/probability/notes/owners/other investors):

```ts
import { groupDisbursementsByPeriod } from "@/server/domain/disbursement";
import { applyOpportunityFilters } from "./filters"; // already imported in Task 6

export interface InvestorDashboardData { /* as above */ }

/**
 * Aggregates for the investor dashboard (§13). OWN data only: the pipeline
 * and disbursement numbers are computed exclusively from the investor's own
 * engagements; opportunity count reuses the same discovery gating as the
 * portal list. Blocked classifications get zeros.
 */
export async function loadInvestorDashboard(
  prisma: PrismaClient,
  investorId: string,
): Promise<InvestorDashboardData> {
  const investor = await prisma.investor.findUniqueOrThrow({
    where: { id: investorId },
    include: { engagements: true },
  });
  const base = { investor: { id: investor.id, name: investor.name } };
  if (isBlockedClassification(investor.engagementClassification)) {
    return { ...base, matchingOpportunities: 0, engagedDeals: 0, pipeline: [], disbursement: { committed: 0, disbursed: 0, pending: 0 }, disbursementByPeriod: [] };
  }

  const deals = await prisma.transaction.findMany({
    where: { stage: ACTIVE_STAGES_FILTER },
    include: { client: true },
  });
  const matchingOpportunities = discoverableDealsForInvestor(investor, deals).length;

  const own = investor.engagements.filter((e) => e.engagementStage !== "Declined");
  const stageCounts = new Map<string, number>();
  for (const e of own) stageCounts.set(e.engagementStage, (stageCounts.get(e.engagementStage) ?? 0) + 1);

  let committed = 0, disbursed = 0, pending = 0;
  for (const e of own) {
    const total = toNum(e.totalAmount);
    const d = toNum(e.amountDisbursed);
    committed += total ?? 0;
    disbursed += d ?? 0;
    pending += toNum(e.amountPending) ?? (total != null ? total - (d ?? 0) : 0);
  }

  return {
    ...base,
    matchingOpportunities,
    engagedDeals: own.length,
    pipeline: [...stageCounts.entries()].map(([stage, count]) => ({ stage: stage as EngagementStage, count })),
    disbursement: { committed, disbursed, pending },
    disbursementByPeriod: groupDisbursementsByPeriod(
      own.map((e) => ({
        totalAmount: toNum(e.totalAmount), amountDisbursed: toNum(e.amountDisbursed),
        amountPending: toNum(e.amountPending), dateReceived: e.dateReceived, year: e.year, quarter: e.quarter,
      })),
    ),
  };
}
```

Add `EngagementStage` to the type-only prisma import at the top; export the new fn + type from `index.ts`.

- [ ] **Step 2: Nav tab** — in `investor-nav.tsx` add `{ href: "/portal/investor/dashboard", label: "Dashboard" }` after "My Pipeline".

- [ ] **Step 3: Page** `src/app/portal/investor/dashboard/page.tsx` (RSC, gated exactly like the other portal pages):

```tsx
// portal/investor/dashboard/page.tsx — investor analytics (§13). Own data only;
// everything here came out of loadInvestorDashboard (visibility engine).
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { loadInvestorDashboard } from "@/server/visibility";
import { getViewpoint } from "@/server/viewpoint";
import { label } from "@/lib/vocab";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function InvestorDashboardPage() {
  const vp = await getViewpoint();
  if (vp.role !== "investor" || !vp.recordId) redirect("/dashboard");
  const data = await loadInvestorDashboard(prisma, vp.recordId);
  const maxStage = Math.max(...data.pipeline.map((p) => p.count), 1);

  const kpis = [
    { label: "Matching opportunities", value: String(data.matchingOpportunities) },
    { label: "Deals engaged", value: String(data.engagedDeals) },
    { label: "Committed", value: formatMoney(data.disbursement.committed) },
    { label: "Disbursed", value: formatMoney(data.disbursement.disbursed) },
    { label: "Pending", value: formatMoney(data.disbursement.pending) },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Your engagement summary with NobleStride Capital — {data.investor.name}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-zinc-200 bg-white p-4">
            <div className="text-xl font-bold text-zinc-900">{k.value}</div>
            <div className="mt-0.5 text-xs text-zinc-500">{k.label}</div>
          </div>
        ))}
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Your Pipeline by Stage</h2>
        {data.pipeline.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-400">No active engagements yet.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {data.pipeline.map((p) => (
              <div key={p.stage} className="flex items-center gap-3">
                <span className="w-32 shrink-0 text-xs text-zinc-600">{label("EngagementStage", p.stage)}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
                  <div className="h-full rounded-full bg-emerald-600" style={{ width: `${(p.count / maxStage) * 100}%` }} />
                </div>
                <span className="w-6 text-right text-xs font-semibold tabular-nums text-zinc-900">{p.count}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Your Disbursements by Quarter</h2>
        {data.disbursementByPeriod.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-400">No disbursements recorded.</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                <th className="py-2">Period</th><th className="py-2">Disbursed</th><th className="py-2">Pending</th>
              </tr>
            </thead>
            <tbody>
              {data.disbursementByPeriod.map((row) => (
                <tr key={`${row.year}-${row.quarter}`} className="border-b border-zinc-100 last:border-0">
                  <td className="py-2 font-medium text-zinc-900">Q{row.quarter} {row.year}</td>
                  <td className="py-2 text-zinc-600">{formatMoney(row.disbursed)}</td>
                  <td className="py-2 text-zinc-600">{formatMoney(row.pending)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Verify** — Lightrock sees own numbers; a greylisted fund sees zeros; page payload contains no other-investor names, feedback, probability or owner names.

- [ ] **Step 5: Run tests. Commit** — `feat(portal): investor dashboard tab with own-only KPIs`.

---

### Task 9: Partner dashboard enhancements

**Files:**
- Modify: `noblestride-crm/src/server/partner-portal.ts`
- Modify: `noblestride-crm/src/app/portal/partner/page.tsx`
- Test: extend `partner-portal` tests if they exist (search `src/server/__tests__` / colocated); otherwise add `noblestride-crm/src/server/__tests__/partner-portal.test.ts` for the new pure helper.

**Interfaces:**
- Produces: pure `referralsByStage(deals: { stage: MandateStage; dealSize: number | null }[]): { stage: MandateStage; count: number; totalSize: number }[]` (vocab stage order, zero-count stages skipped).

- [ ] **Step 1: Failing test** for `referralsByStage` (buckets counts + sums dealSize, ordered by MandateStage vocab order, drops empty stages).

```ts
import { describe, expect, it } from "vitest";
import { referralsByStage } from "@/server/partner-portal";

describe("referralsByStage", () => {
  it("buckets referred deals by stage with size totals, in stage order", () => {
    expect(
      referralsByStage([
        { stage: "Signed", dealSize: 5 },
        { stage: "NewLead", dealSize: 2 },
        { stage: "Signed", dealSize: null },
      ]),
    ).toEqual([
      { stage: "NewLead", count: 1, totalSize: 2 },
      { stage: "Signed", count: 2, totalSize: 5 },
    ]);
  });
});
```

- [ ] **Step 2: Implement** in `partner-portal.ts`:

```ts
import { LABELS } from "@/lib/vocab";

export interface ReferralStageRow {
  stage: MandateStage;
  count: number;
  totalSize: number;
}

/** Referred-deal counts + total deal size per stage, in vocab order (§13). */
export function referralsByStage(
  deals: { stage: MandateStage; dealSize: number | null }[],
): ReferralStageRow[] {
  const byStage = new Map<MandateStage, ReferralStageRow>();
  for (const d of deals) {
    const row = byStage.get(d.stage) ?? { stage: d.stage, count: 0, totalSize: 0 };
    row.count += 1;
    row.totalSize += d.dealSize ?? 0;
    byStage.set(d.stage, row);
  }
  return (Object.keys(LABELS.MandateStage) as MandateStage[])
    .map((s) => byStage.get(s))
    .filter((r): r is ReferralStageRow => r != null);
}
```

- [ ] **Step 3: Render** in `portal/partner/page.tsx` — after the Referral Funnel section, add a "Referrals by Stage" section: horizontal bars (same div-bar pattern as the investor dashboard pipeline in Task 8) showing count per stage with `formatMoney(totalSize)` alongside, fed by `referralsByStage(referredDeals.map(d => ({ stage: d.stage, dealSize: d.dealSize })))`. Data source is the already-projected `referredDeals` — no new leak surface.

- [ ] **Step 4: Verify as DLA Piper; run tests; commit** — `feat(portal): partner referrals-by-stage chart`.

---

### Task 10: RBAC matrix module (single source of truth) + tests

**Files:**
- Create: `noblestride-crm/src/server/rbac/matrix.ts`, `src/server/rbac/context.ts`
- Test: `noblestride-crm/src/server/rbac/__tests__/matrix.test.ts`
- Modify: `noblestride-crm/src/components/crm/access-matrix.tsx`

**Interfaces:**
- Produces: `RBAC_ENTITIES`, `RbacEntity`, `Perm`, `RBAC_MATRIX: Record<OrgRole, Record<RbacEntity, readonly Perm[]>>`, `can(role, entity, perm)`, `ownsRecord(userId, record)`, `canUpdateRecord(role, entity, userId, record)`, `canDeleteRecord(role, entity)` and `getOrgLens(): Promise<{ orgRole: OrgRole; userId?: string }>`.

- [ ] **Step 1: Failing tests** `src/server/rbac/__tests__/matrix.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { RBAC_ENTITIES, RBAC_MATRIX, can, canUpdateRecord, ownsRecord } from "@/server/rbac/matrix";

describe("RBAC matrix (§7.2)", () => {
  it("Admin has full CRUD everywhere", () => {
    for (const entity of RBAC_ENTITIES)
      for (const perm of ["C", "R", "U", "D"] as const) expect(can("Admin", entity, perm)).toBe(true);
  });
  it("Deal Lead: CRU on deal entities, read-only partners/providers, never delete", () => {
    expect(can("DealLead", "Transactions", "C")).toBe(true);
    expect(can("DealLead", "Transactions", "D")).toBe(false);
    expect(can("DealLead", "Partners", "U")).toBe(false);
    expect(can("DealLead", "Service Providers", "R")).toBe(true);
  });
  it("Team Member: read all, update only engagements/tasks", () => {
    expect(can("TeamMember", "Clients", "R")).toBe(true);
    expect(can("TeamMember", "Clients", "U")).toBe(false);
    expect(can("TeamMember", "Engagements", "U")).toBe(true);
    expect(can("TeamMember", "Tasks", "U")).toBe(true);
    expect(can("TeamMember", "Tasks", "C")).toBe(false);
  });
});

describe("own-record scoping", () => {
  it("ownsRecord matches ownerId / leadId / assigneeId", () => {
    expect(ownsRecord("u1", { ownerId: "u1" })).toBe(true);
    expect(ownsRecord("u1", { leadId: "u1" })).toBe(true);
    expect(ownsRecord("u1", { assigneeId: "u2" })).toBe(false);
    expect(ownsRecord(undefined, { ownerId: "u1" })).toBe(false);
  });
  it("Admin updates anything; Deal Lead updates own deals but not others'", () => {
    expect(canUpdateRecord("Admin", "Transactions", "u1", { ownerId: "u2" })).toBe(true);
    expect(canUpdateRecord("DealLead", "Transactions", "u1", { ownerId: "u1" })).toBe(true);
    expect(canUpdateRecord("DealLead", "Transactions", "u1", { ownerId: "u2" })).toBe(false);
    expect(canUpdateRecord("DealLead", "Clients", "u1", {})).toBe(true); // non-ownable entity
  });
  it("Team Member updates only own engagements/tasks and nothing else", () => {
    expect(canUpdateRecord("TeamMember", "Engagements", "u1", { ownerId: "u1" })).toBe(true);
    expect(canUpdateRecord("TeamMember", "Engagements", "u1", { ownerId: "u2" })).toBe(false);
    expect(canUpdateRecord("TeamMember", "Transactions", "u1", { ownerId: "u1" })).toBe(false);
  });
});
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement `src/server/rbac/matrix.ts`** (pure module — no Prisma runtime, importable from client components like `access-matrix.tsx`):

```ts
// RBAC matrix (design spec §7.2) — the single source of truth for the in-org
// access model. Pure module: type-only Prisma import, no runtime deps, safe to
// import from client components. This drives BOTH the /access-matrix display
// and the demo view-lens enforcement. Demo-grade: enforced at UI level, not auth.

import type { OrgRole } from "@prisma/client";

export const RBAC_ENTITIES = [
  "Investors",
  "Clients",
  "Mandates",
  "Transactions",
  "Engagements",
  "Partners",
  "Documents",
  "Service Providers",
  "Tasks",
] as const;

export type RbacEntity = (typeof RBAC_ENTITIES)[number];
export type Perm = "C" | "R" | "U" | "D";

const FULL: readonly Perm[] = ["C", "R", "U", "D"];

/** §7.2 defaults: Admin full CRUD; Deal Lead CRU own deals + read all; Team Member read all, update assigned work. */
export const RBAC_MATRIX: Record<OrgRole, Record<RbacEntity, readonly Perm[]>> = {
  Admin: Object.fromEntries(RBAC_ENTITIES.map((e) => [e, FULL])) as Record<RbacEntity, readonly Perm[]>,
  DealLead: {
    Investors: ["C", "R", "U"],
    Clients: ["C", "R", "U"],
    Mandates: ["C", "R", "U"],
    Transactions: ["C", "R", "U"],
    Engagements: ["C", "R", "U"],
    Partners: ["R"],
    Documents: ["C", "R", "U"],
    "Service Providers": ["R"],
    Tasks: ["C", "R", "U"],
  },
  TeamMember: {
    Investors: ["R"],
    Clients: ["R"],
    Mandates: ["R"],
    Transactions: ["R"],
    Engagements: ["R", "U"],
    Partners: ["R"],
    Documents: ["R"],
    "Service Providers": ["R"],
    Tasks: ["R", "U"],
  },
};

export function can(role: OrgRole, entity: RbacEntity, perm: Perm): boolean {
  return RBAC_MATRIX[role][entity].includes(perm);
}

/** Entities whose UPDATE is scoped to "own records" for non-admin roles. */
const OWN_SCOPED: Readonly<Partial<Record<RbacEntity, true>>> = {
  Mandates: true,
  Transactions: true,
  Engagements: true,
  Tasks: true,
};

/** Ownership links: Transaction/Engagement.ownerId, Mandate.leadId, Task.assigneeId. */
export interface OwnableRecord {
  ownerId?: string | null;
  leadId?: string | null;
  assigneeId?: string | null;
}

export function ownsRecord(userId: string | undefined, record: OwnableRecord): boolean {
  if (!userId) return false;
  return record.ownerId === userId || record.leadId === userId || record.assigneeId === userId;
}

/** Row-level update check: matrix perm + own-scope for non-admins. */
export function canUpdateRecord(
  role: OrgRole,
  entity: RbacEntity,
  userId: string | undefined,
  record: OwnableRecord,
): boolean {
  if (!can(role, entity, "U")) return false;
  if (role === "Admin") return true;
  if (!OWN_SCOPED[entity]) return true; // no ownership link on this entity — matrix perm decides
  return ownsRecord(userId, record);
}

export function canDeleteRecord(role: OrgRole, entity: RbacEntity): boolean {
  return can(role, entity, "D");
}
```

- [ ] **Step 4: `src/server/rbac/context.ts`:**

```ts
// getOrgLens — resolve the active in-org demo lens from the viewpoint cookie.
// External viewpoints (investor/partner) never reach the internal shell, so
// they resolve to Admin here only as a type-safe fallback.

import type { OrgRole } from "@prisma/client";
import { getViewpoint } from "@/server/viewpoint";

export interface OrgLens {
  orgRole: OrgRole;
  userId?: string;
}

export async function getOrgLens(): Promise<OrgLens> {
  const vp = await getViewpoint();
  if (vp.role !== "admin") return { orgRole: "Admin" };
  return { orgRole: (vp.orgRole ?? "Admin") as OrgRole, userId: vp.userId };
}
```

(`vp.orgRole`/`vp.userId` exist after Task 11 — if implementing Tasks 10–11 out of order, stub with `{ orgRole: "Admin" }` and finish in Task 11.)

- [ ] **Step 5: Run tests → PASS.**

- [ ] **Step 6: Refactor `access-matrix.tsx`** to consume the shared table:
  - Delete the local `ROLES`/`ENTITIES`/`DEFAULTS` definitions; import `RBAC_MATRIX, RBAC_ENTITIES, type RbacEntity, type Perm` from `@/server/rbac/matrix` and `label` from `@/lib/vocab`.
  - `const ROLES = ["Admin", "DealLead", "TeamMember"] as const;` — render `<option value={r}>{label("OrgRole", r)}</option>`.
  - Initialise grids from the shared matrix: `JSON.parse(JSON.stringify(RBAC_MATRIX))` (in-session toggling stays, reset restores the shared defaults).
  - Banner text → `This matrix drives the in-org view lens (demo — not backed by real login). Use the viewpoint switcher to see the CRM as each role; in-session toggles here are illustrative and not persisted.`

- [ ] **Step 7: Run tests + typecheck. Commit** — `feat(rbac): shared §7.2 matrix module with own-scope helpers`.

---

### Task 11: Org-role view lens — viewpoint plumbing, switcher, banner, seed roles

**Files:**
- Modify: `noblestride-crm/src/lib/viewpoint.ts`, `src/app/api/viewpoint/route.ts`
- Modify: `noblestride-crm/src/components/shell/viewpoint-switcher.tsx`, `src/components/shell/topbar.tsx` (read first — pass `users` through)
- Modify: `noblestride-crm/src/app/(crm)/layout.tsx`
- Modify: `noblestride-crm/prisma/seed.ts`
- Test: `noblestride-crm/src/lib/__tests__/viewpoint.test.ts` (extend if exists, else create)

**Interfaces:**
- Produces: `Viewpoint = { role; recordId?; orgRole?: "Admin"|"DealLead"|"TeamMember"; userId? }`; `/api/viewpoint?role=admin&orgRole=DealLead&userId=<id>`; lens banner in the CRM shell.

- [ ] **Step 1: Failing test** (parse round-trip):

```ts
import { describe, expect, it } from "vitest";
import { parseViewpoint, serializeViewpoint } from "@/lib/viewpoint";

describe("viewpoint org-role lens", () => {
  it("round-trips an org-role lens", () => {
    const raw = serializeViewpoint({ role: "admin", orgRole: "DealLead", userId: "u1" });
    expect(parseViewpoint(raw)).toEqual({ role: "admin", orgRole: "DealLead", userId: "u1" });
  });
  it("falls back to Admin for unknown orgRole", () => {
    expect(parseViewpoint(JSON.stringify({ role: "admin", orgRole: "SuperUser" }))).toEqual({ role: "admin", orgRole: "Admin" });
  });
  it("keeps investor/partner behaviour unchanged", () => {
    expect(parseViewpoint(JSON.stringify({ role: "investor", recordId: "i1" }))).toEqual({ role: "investor", recordId: "i1" });
  });
});
```

- [ ] **Step 2: Extend `src/lib/viewpoint.ts`:**

```ts
export type ViewpointRole = "admin" | "investor" | "partner";

/** In-org demo roles — string mirror of Prisma's OrgRole (kept dependency-free). */
export type OrgRoleLens = "Admin" | "DealLead" | "TeamMember";
const ORG_ROLES: readonly OrgRoleLens[] = ["Admin", "DealLead", "TeamMember"];

export type Viewpoint = {
  role: ViewpointRole;
  /** Impersonated Investor/Partner id when role is investor/partner. */
  recordId?: string;
  /** In-org role lens — only meaningful when role is "admin". */
  orgRole?: OrgRoleLens;
  /** Impersonated User id for DealLead/TeamMember lenses. */
  userId?: string;
};

export const ADMIN_VIEWPOINT: Viewpoint = { role: "admin", orgRole: "Admin" };

export function parseViewpoint(raw: string | undefined | null): Viewpoint {
  if (!raw) return ADMIN_VIEWPOINT;
  try {
    const parsed = JSON.parse(raw) as { role?: string; recordId?: string; orgRole?: string; userId?: string };
    if (parsed.role === "investor" || parsed.role === "partner") {
      if (!parsed.recordId) return ADMIN_VIEWPOINT;
      return { role: parsed.role, recordId: parsed.recordId };
    }
    const orgRole = ORG_ROLES.includes(parsed.orgRole as OrgRoleLens) ? (parsed.orgRole as OrgRoleLens) : "Admin";
    if (orgRole === "Admin") return ADMIN_VIEWPOINT;
    return { role: "admin", orgRole, userId: parsed.userId };
  } catch {
    return ADMIN_VIEWPOINT;
  }
}

export function serializeViewpoint(vp: Viewpoint): string {
  if (vp.role !== "admin") return JSON.stringify({ role: vp.role, recordId: vp.recordId });
  if (!vp.orgRole || vp.orgRole === "Admin") return JSON.stringify({ role: "admin" });
  return JSON.stringify({ role: "admin", orgRole: vp.orgRole, userId: vp.userId });
}
```

Note: `parseViewpoint(serializeViewpoint({role:"admin"}))` must equal `ADMIN_VIEWPOINT` — the test above pins the DealLead round-trip.

- [ ] **Step 3: Route** `src/app/api/viewpoint/route.ts` — pass the new params through:

```ts
  const vp = parseViewpoint(
    JSON.stringify({
      role: params.get("role"),
      recordId: params.get("recordId") ?? undefined,
      orgRole: params.get("orgRole") ?? undefined,
      userId: params.get("userId") ?? undefined,
    }),
  );
```

- [ ] **Step 4: Switcher** — `viewpoint-switcher.tsx` gains `users: ViewpointOption[]` prop and, when role is `admin`, an org-role `<select>` (Admin / Deal Lead / Team Member) plus a user `<select>` when the org-role isn't Admin. `go()` gains org params:

```ts
function go(nextRole: string, recordId?: string, orgRole?: string, userId?: string) {
  const params = new URLSearchParams({ role: nextRole });
  if (recordId) params.set("recordId", recordId);
  if (orgRole && orgRole !== "Admin") params.set("orgRole", orgRole);
  if (userId) params.set("userId", userId);
  window.location.href = `/api/viewpoint?${params.toString()}`;
}
```

Behaviour: selecting org-role "Admin" → `go("admin")`; selecting "DealLead"/"TeamMember" shows the user picker; picking a user → `go("admin", undefined, orgRole, userId)`. Read `topbar.tsx` and thread a `users` prop from the layout through `Topbar` to the switcher.

- [ ] **Step 5: Layout + banner** — `(crm)/layout.tsx`: also load users and the lens:

```tsx
import { getOrgLens } from "@/server/rbac/context";
import { label } from "@/lib/vocab";

const [investors, partners, users] = await Promise.all([
  prisma.investor.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  prisma.partner.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
]);
const lens = await getOrgLens();
const lensUser = lens.userId ? users.find((u) => u.id === lens.userId) : undefined;
```

pass `users` to `<Topbar ... users={users} />`; render above `{children}` inside `<main>`'s parent:

```tsx
{lens.orgRole !== "Admin" && (
  <div className="border-b border-amber-200 bg-amber-50 px-6 py-1.5 text-xs text-amber-800">
    Viewing as <span className="font-semibold">{label("OrgRole", lens.orgRole)}</span>
    {lensUser ? <> — {lensUser.name}</> : null} · demo lens, controls hidden per the{" "}
    <a href="/access-matrix" className="underline">access matrix</a>
  </div>
)}
```

- [ ] **Step 6: Seed roles + demo impact flags** — in `prisma/seed.ts`, after mandates are created (and before the final count block):

```ts
// §7.2 org roles (demo lens): mandate leads become Deal Leads, first two seed
// users are Admins, everyone else Team Member.
await prisma.user.updateMany({ data: { role: "TeamMember" } });
await prisma.user.updateMany({ where: { ledMandates: { some: {} } }, data: { role: "DealLead" } });
const adminEmails = seedData.users.slice(0, 2).map((u) => u.email);
await prisma.user.updateMany({ where: { email: { in: adminEmails } }, data: { role: "Admin" } });

// §3.1 impact flags: derive women-led from founder gender so the investor
// impact filter has demo data.
await prisma.client.updateMany({ where: { founderGender: "Female" }, data: { womenLed: true } });
```

(Verify the `FounderGender` enum literal in schema.prisma first — use the exact female value.)

- [ ] **Step 7: Reseed + verify switcher** — `npm run seed && npm run import:real && npx tsx scripts/plant-portal-data.ts && npx tsx scripts/seed-milestones.ts` (same chain the repo docs use); switch lenses; banner shows; cookie round-trips.

- [ ] **Step 8: Run tests. Commit** — `feat(rbac): org-role view lens via viewpoint cookie + seeded roles`.

---

### Task 12: RBAC UI enforcement across CRM pages

**Files (all under `noblestride-crm/src/app/(crm)/`):** `investors/page.tsx`, `investors/[id]/page.tsx`, `clients/page.tsx`, `clients/[id]/page.tsx`, `mandates/page.tsx`, `mandates/[id]/page.tsx`, `transactions/page.tsx`, `transactions/[id]/page.tsx`, `engagement/page.tsx`, `engagement/[id]/page.tsx`, `partners/page.tsx`, `partners/[id]/page.tsx`, `documents/page.tsx`, `tasks/page.tsx`.
Possibly modify: `src/components/crm/kanban-board.tsx` (accept `readOnly?: boolean` that disables drag), `engagement-stage-board.tsx` (same).

**Interfaces:**
- Consumes: `getOrgLens()`, `can`, `canUpdateRecord`, `canDeleteRecord` (Task 10/11).

- [ ] **Step 1: Establish the pattern once** (clients list + detail), then replicate. List page:

```tsx
import { getOrgLens } from "@/server/rbac/context";
import { can } from "@/server/rbac/matrix";
...
const lens = await getOrgLens();
...
{can(lens.orgRole, "Clients", "C") && <ClientFormDrawer mode="create" />}
```

Detail page:

```tsx
import { canDeleteRecord, canUpdateRecord } from "@/server/rbac/matrix";
...
const lens = await getOrgLens();
const mayEdit = canUpdateRecord(lens.orgRole, "Clients", lens.userId, {});
const mayDelete = canDeleteRecord(lens.orgRole, "Clients");
...
{mayEdit && <ClientFormDrawer mode="edit" initial={initial} />}
{mayDelete && <DeleteConfirm ... />}
```

- [ ] **Step 2: Replicate per entity** — for each detail page pass the real ownership record into `canUpdateRecord`:

| Page | Entity | Ownership record |
|---|---|---|
| investors/[id] | `"Investors"` | `{}` (non-ownable) |
| clients/[id] | `"Clients"` | `{}` |
| mandates/[id] | `"Mandates"` | `{ leadId: mandate.leadId }` |
| transactions/[id] | `"Transactions"` | `{ ownerId: txn.ownerId }` |
| engagement/[id] | `"Engagements"` | `{ ownerId: eng.ownerId }` |
| partners/[id] | `"Partners"` | `{}` |
| documents (list drawer) | `"Documents"` | `{}` |
| tasks | `"Tasks"` | `{ assigneeId: task.assigneeId }` (check the actual FK name on the Task model first) |

Gate on each page: create buttons/drawers (`C`), edit drawers + `RestageSelect` + DD panel + `LogEngagementDialog`-style write controls (`U` via `canUpdateRecord`), `DeleteConfirm` (`D`). List pages only gate their create button — read stays "all" for every role per the matrix.

- [ ] **Step 3: Kanban boards** — `mandates/page.tsx` and `transactions/page.tsx` (and the engagement stage board): compute `readOnly = !can(lens.orgRole, "<Entity>", "U")` and pass to the board component; in `kanban-board.tsx` / `engagement-stage-board.tsx` add an optional `readOnly` prop that disables the drag handlers when true (early-return in the drag-start/drop handler; visual affordance unchanged — demo-grade). Deal Lead keeps drag (own-scope on kanban is out of demo scope — the banner and detail pages carry the own-scope story).

- [ ] **Step 4: Manual verification sweep** — as Team Member lens: no create/edit/delete buttons anywhere except own tasks/engagements; as Deal Lead: edit visible only on own mandates/transactions/engagements, no delete anywhere; as Admin: everything. `/access-matrix` shows the same grid that drives it.

- [ ] **Step 5: Run tests. Commit** — `feat(rbac): enforce §7.2 matrix across CRM pages (demo lens)`.

---

### Task 13: Final verification + docs

- [ ] **Step 1: Full suite.** `npm run test` — Expected: all green (270 pre-existing + new).
- [ ] **Step 2: End-to-end sweep** per spec §Verification: company fields persist; IC/CAK + 5 DD tracks persist; Lightrock filters narrow + dashboard renders own data; greylisted fund sees nothing; no DD/IC/CAK/other-investor leaks in any portal payload (view-source check); DLA Piper sees funnel + stage chart; three lenses behave per matrix.
- [ ] **Step 3: Update `docs/BUILD-STATUS-2026-07-03.md`** — mark section-9 points 4 & 5 and the RBAC-views item as built (short bullets, follow the doc's existing format).
- [ ] **Step 4: Commit** — `docs: build status for dashboards/fields/DD/RBAC batch`.

---

## Self-review notes

- Spec coverage: §3.1 fields → Tasks 1/2/4; §3.2 IC/CAK → 1/2/4; §6.2 DD tracks → 1/2/3/4 + leak guards in 6; §11.1 filters → 6/7; §13 dashboards → 5/8/9; §7.2 RBAC → 10/11/12; testing → embedded per task (2, 5, 6, 9, 10, 11) + 13.
- Type consistency: `OpportunityFilters` produced in Task 6, consumed in 7/8 by name; `groupDisbursementsByPeriod` produced in 5, consumed in 8; `can/canUpdateRecord/canDeleteRecord/getOrgLens` produced in 10/11, consumed in 12; `OrgRoleLens` string union deliberately mirrors Prisma `OrgRole` (kept dependency-free in `lib/`).
- Known judgment calls (approved in spec): codename required only in the create drawer (API lenient for imports/agents); EBITDA/debt/assets stored but not projected externally at any tier; kanban own-scope not enforced (banner + detail pages carry it); investor dashboard shows own aggregate amounts only.
