# CRUD System — Plan A: Backend & API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Create / Update / guarded-Delete to the GraphQL API for Mandate, Transaction, Investor, Client, and Partner, with `createdSource` provenance so the same write path serves humans and AI agents.

**Architecture:** Per-entity Zod schemas (`src/lib/schemas/*`) are the single validation contract, imported by the services. Thin services (`src/server/services/*`) validate then call Prisma, stamping `createdSource` from the request actor on create and guarding destructive deletes. Typed Pothos input types + mutations (`src/graphql/*`) expose the services. UI is Plan B.

**Tech Stack:** Next.js 16, Prisma 6 (PostgreSQL 16), Pothos 4 + `@pothos/plugin-prisma`, graphql-yoga 5, Zod 4, Vitest 4.

## Global Constraints

- Services are thin: Prisma + domain helpers only, **no GraphQL or React imports** (existing convention).
- Prisma client is imported as `import { prisma } from "@/lib/db"`.
- GraphQL money fields are exposed as `Float` (Prisma `Decimal` → `Number(...)`), matching `src/graphql/types.ts`.
- `stage`, `stageEnteredAt`, and `closedAt` are **excluded** from create/update — stage transitions stay in the existing `updateMandateStage`/`updateTransactionStage` mutations. Create uses the Prisma stage default.
- Enums come from `@prisma/client`; GraphQL enums are already registered in `src/graphql/builder.ts` (incl. `ActorSourceEnum`).
- Tests follow the existing `*.smoke.test.ts` convention: skip (never fail) when `DATABASE_URL` is unset or the DB is unreachable; use the `withDb` helper pattern from `src/server/__tests__/mandates.smoke.test.ts`.
- Run tests with `corepack pnpm test`. Run typecheck with `corepack pnpm exec tsc --noEmit`.
- Commit messages end with the two trailer lines used in this repo (Co-Authored-By + Claude-Session).

---

### Task 1: Add `createdSource` provenance to the five entity models

**Files:**
- Modify: `prisma/schema.prisma` (Mandate, Transaction, Investor, Client, Partner models)
- Creates: `prisma/migrations/<timestamp>_add_createdsource_to_entities/migration.sql` (generated)

**Interfaces:**
- Produces: a `createdSource ActorSource @default(HUMAN)` column on the 5 entity tables; the regenerated Prisma client types include `createdSource` on those models.

- [ ] **Step 1: Add the field to each of the 5 models**

In `prisma/schema.prisma`, add this line to **each** of `model Investor`, `model Client`, `model Mandate`, `model Transaction`, `model Partner` (place it just above the existing `createdAt` line so it groups with the timestamps):

```prisma
  createdSource ActorSource @default(HUMAN)
```

(The `ActorSource` enum already exists in the schema; `Engagement` and `Activity` already have this field — match their style.)

- [ ] **Step 2: Create and apply the migration**

Run:
```bash
corepack pnpm migrate -- --name add_createdsource_to_entities
```
Expected: Prisma creates the migration, applies it to the dev DB on port 5544, and prints "Your database is now in sync with your schema." It also regenerates the client.

(If `pnpm migrate` does not forward `--name`, run `corepack pnpm exec prisma migrate dev --name add_createdsource_to_entities`.)

- [ ] **Step 3: Regenerate the Pothos types**

Run:
```bash
corepack pnpm generate
```
Expected: regenerates `src/generated/pothos-types.ts` with `createdSource` on the 5 models. No errors.

- [ ] **Step 4: Typecheck**

Run: `corepack pnpm exec tsc --noEmit`
Expected: PASS (no type errors).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/generated/pothos-types.ts
git commit -m "feat(db): add createdSource provenance to 5 entity models" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" \
  -m "Claude-Session: https://claude.ai/code/session_01DqS31xA4r9wZ3Fy2rpg3rT"
```

---

### Task 2: Shared CRUD helper (`CrudError` + `actorSource`)

**Files:**
- Create: `src/server/services/crud.ts`
- Test: `src/server/__tests__/crud.test.ts`

**Interfaces:**
- Produces:
  - `class CrudError extends Error` — thrown by `deleteX` when dependents block deletion.
  - `function actorSource(actor: Actor): ActorSource` — maps the request actor to the provenance enum (`AGENT`→`AGENT`, `API`→`API`, else `HUMAN`).
- Consumes: `Actor` from `src/graphql/context.ts`; `ActorSource` from `@prisma/client`.

- [ ] **Step 1: Write the failing test**

`src/server/__tests__/crud.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { CrudError, actorSource } from "@/server/services/crud";

describe("crud helpers", () => {
  it("actorSource maps actor types to provenance", () => {
    expect(actorSource({ type: "HUMAN" })).toBe("HUMAN");
    expect(actorSource({ type: "AGENT" })).toBe("AGENT");
    expect(actorSource({ type: "API" })).toBe("API");
  });

  it("CrudError is an Error with name CrudError", () => {
    const e = new CrudError("blocked");
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe("CrudError");
    expect(e.message).toBe("blocked");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm exec vitest run src/server/__tests__/crud.test.ts`
Expected: FAIL ("Cannot find module '@/server/services/crud'").

- [ ] **Step 3: Write the implementation**

`src/server/services/crud.ts`:
```ts
// Shared helpers for the entity CRUD services.
// No GraphQL/React imports — thin domain layer only.

import type { Actor } from "@/graphql/context";
import type { ActorSource } from "@prisma/client";

/** Thrown when a delete is blocked because dependent records exist. */
export class CrudError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CrudError";
  }
}

/** Map the request actor to the provenance enum stamped on created records. */
export function actorSource(actor: Actor): ActorSource {
  if (actor.type === "AGENT") return "AGENT";
  if (actor.type === "API") return "API";
  return "HUMAN";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `corepack pnpm exec vitest run src/server/__tests__/crud.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/server/services/crud.ts src/server/__tests__/crud.test.ts
git commit -m "feat(services): add CrudError + actorSource helper" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" \
  -m "Claude-Session: https://claude.ai/code/session_01DqS31xA4r9wZ3Fy2rpg3rT"
```

---

### Task 3: Zod schemas for all five entities

**Files:**
- Create: `src/lib/schemas/investor.ts`, `src/lib/schemas/client.ts`, `src/lib/schemas/mandate.ts`, `src/lib/schemas/transaction.ts`, `src/lib/schemas/partner.ts`
- Test: `src/lib/__tests__/schemas.test.ts`

**Interfaces:**
- Produces (per entity `X`): `xCreateSchema` (Zod object), `xUpdateSchema = xCreateSchema.partial()`, and inferred types `XCreateInput = z.infer<typeof xCreateSchema>`, `XUpdateInput = z.infer<typeof xUpdateSchema>`.
- These are pure (no Prisma/React imports beyond the enum values from `@prisma/client`), so the client (Plan B) can import them too.

- [ ] **Step 1: Write the failing test**

`src/lib/__tests__/schemas.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { investorCreateSchema } from "@/lib/schemas/investor";
import { mandateCreateSchema } from "@/lib/schemas/mandate";
import { partnerCreateSchema } from "@/lib/schemas/partner";

describe("entity create schemas", () => {
  it("investor: accepts a minimal valid payload", () => {
    const r = investorCreateSchema.safeParse({ name: "Acme Capital", investorType: "VentureCapital" });
    expect(r.success).toBe(true);
  });

  it("investor: rejects missing name", () => {
    const r = investorCreateSchema.safeParse({ investorType: "VentureCapital" });
    expect(r.success).toBe(false);
  });

  it("investor: rejects a bad enum", () => {
    const r = investorCreateSchema.safeParse({ name: "X", investorType: "NotAType" });
    expect(r.success).toBe(false);
  });

  it("mandate: requires name and clientId", () => {
    expect(mandateCreateSchema.safeParse({ name: "M" }).success).toBe(false);
    expect(mandateCreateSchema.safeParse({ name: "M", clientId: "c1" }).success).toBe(true);
  });

  it("partner: accepts name only", () => {
    expect(partnerCreateSchema.safeParse({ name: "Bowmans" }).success).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm exec vitest run src/lib/__tests__/schemas.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Write the five schema files**

`src/lib/schemas/investor.ts`:
```ts
import { z } from "zod";
import { InvestorType, InvestorStatus, Sector, Geography, Instrument, InvestmentStage } from "@prisma/client";

export const investorCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  investorType: z.nativeEnum(InvestorType),
  website: z.string().trim().optional(),
  status: z.nativeEnum(InvestorStatus).optional(),
  sectorFocus: z.array(z.nativeEnum(Sector)).optional(),
  geographicFocus: z.array(z.nativeEnum(Geography)).optional(),
  instruments: z.array(z.nativeEnum(Instrument)).optional(),
  investmentStages: z.array(z.nativeEnum(InvestmentStage)).optional(),
  aum: z.number().nonnegative().optional(),
  ticketMin: z.number().nonnegative().optional(),
  ticketMax: z.number().nonnegative().optional(),
  currency: z.string().trim().min(1).optional(),
  targetIrr: z.number().optional(),
  countryRestrictions: z.string().trim().optional(),
  esgFocus: z.string().trim().optional(),
  decisionProcess: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});
export const investorUpdateSchema = investorCreateSchema.partial();
export type InvestorCreateInput = z.infer<typeof investorCreateSchema>;
export type InvestorUpdateInput = z.infer<typeof investorUpdateSchema>;
```

`src/lib/schemas/client.ts`:
```ts
import { z } from "zod";
import { Sector, Geography, FounderGender, Source } from "@prisma/client";

export const clientCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  yearFounded: z.number().int().optional(),
  hqCity: z.string().trim().optional(),
  countries: z.array(z.nativeEnum(Geography)).optional(),
  website: z.string().trim().optional(),
  sector: z.array(z.nativeEnum(Sector)).optional(),
  coreProduct: z.string().trim().optional(),
  description: z.string().trim().optional(),
  founders: z.string().trim().optional(),
  founderGender: z.nativeEnum(FounderGender).optional(),
  revenueLastYear: z.number().nonnegative().optional(),
  revenueForecast: z.number().nonnegative().optional(),
  currency: z.string().trim().min(1).optional(),
  profitable: z.boolean().optional(),
  existingInvestors: z.string().trim().optional(),
  source: z.nativeEnum(Source).optional(),
  pitchDeckUrl: z.string().trim().optional(),
});
export const clientUpdateSchema = clientCreateSchema.partial();
export type ClientCreateInput = z.infer<typeof clientCreateSchema>;
export type ClientUpdateInput = z.infer<typeof clientUpdateSchema>;
```

`src/lib/schemas/mandate.ts`:
```ts
import { z } from "zod";
import { Sector, Source, DocStatus } from "@prisma/client";

export const mandateCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  clientId: z.string().trim().min(1, "Client is required"),
  leadId: z.string().trim().optional(),
  referredById: z.string().trim().optional(),
  dealSize: z.number().nonnegative().optional(),
  currency: z.string().trim().min(1).optional(),
  sector: z.array(z.nativeEnum(Sector)).optional(),
  source: z.nativeEnum(Source).optional(),
  dateOpened: z.coerce.date().optional(),
  ndaStatus: z.nativeEnum(DocStatus).optional(),
  ndaSentDate: z.coerce.date().optional(),
  ndaSignedDate: z.coerce.date().optional(),
  eaStatus: z.nativeEnum(DocStatus).optional(),
  eaSentDate: z.coerce.date().optional(),
  eaSignedDate: z.coerce.date().optional(),
  nextAction: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});
export const mandateUpdateSchema = mandateCreateSchema.partial();
export type MandateCreateInput = z.infer<typeof mandateCreateSchema>;
export type MandateUpdateInput = z.infer<typeof mandateUpdateSchema>;
```

`src/lib/schemas/transaction.ts`:
```ts
import { z } from "zod";
import { Sector, DealType, Instrument } from "@prisma/client";

export const transactionCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  clientId: z.string().trim().min(1, "Client is required"),
  mandateId: z.string().trim().optional(),
  ownerId: z.string().trim().optional(),
  dealType: z.nativeEnum(DealType).optional(),
  instrument: z.array(z.nativeEnum(Instrument)).optional(),
  targetRaise: z.number().nonnegative().optional(),
  currency: z.string().trim().min(1).optional(),
  sector: z.array(z.nativeEnum(Sector)).optional(),
  dateOpened: z.coerce.date().optional(),
});
export const transactionUpdateSchema = transactionCreateSchema.partial();
export type TransactionCreateInput = z.infer<typeof transactionCreateSchema>;
export type TransactionUpdateInput = z.infer<typeof transactionUpdateSchema>;
```

`src/lib/schemas/partner.ts`:
```ts
import { z } from "zod";
import { PartnerType, PartnerStatus } from "@prisma/client";

export const partnerCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  partnerType: z.nativeEnum(PartnerType).optional(),
  profile: z.string().trim().optional(),
  status: z.nativeEnum(PartnerStatus).optional(),
  location: z.string().trim().optional(),
  amount: z.number().nonnegative().optional(),
  currency: z.string().trim().min(1).optional(),
});
export const partnerUpdateSchema = partnerCreateSchema.partial();
export type PartnerCreateInput = z.infer<typeof partnerCreateSchema>;
export type PartnerUpdateInput = z.infer<typeof partnerUpdateSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `corepack pnpm exec vitest run src/lib/__tests__/schemas.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/schemas src/lib/__tests__/schemas.test.ts
git commit -m "feat(schemas): add Zod create/update schemas for 5 entities" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" \
  -m "Claude-Session: https://claude.ai/code/session_01DqS31xA4r9wZ3Fy2rpg3rT"
```

---

### Task 4: Investor service CRUD

**Files:**
- Modify: `src/server/services/investors.ts` (append create/update/delete)
- Test: `src/server/__tests__/investors-crud.smoke.test.ts`

**Interfaces:**
- Consumes: `investorCreateSchema`/`investorUpdateSchema` (Task 3); `actorSource`/`CrudError` (Task 2); `Actor` (context).
- Produces:
  - `createInvestor(input: InvestorCreateInput, actor: Actor): Promise<Investor>`
  - `updateInvestor(id: string, input: InvestorUpdateInput): Promise<Investor>`
  - `deleteInvestor(id: string): Promise<Investor>` — throws `CrudError` if `engagements > 0`.

- [ ] **Step 1: Write the failing test**

`src/server/__tests__/investors-crud.smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/db";
import { createInvestor, deleteInvestor } from "@/server/services/investors";

async function withDb<T>(fn: () => Promise<T>): Promise<T | null> {
  if (!process.env.DATABASE_URL) return null;
  try { return await fn(); }
  catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    if (/ECONNREFUSED|ENOTFOUND|connect|Can't reach database|P1001|P1002/.test(m)) return null;
    throw err;
  }
}

describe("investor CRUD (smoke)", () => {
  it("createInvestor stamps createdSource from the actor, then deletes", async () => {
    const out = await withDb(async () => {
      const inv = await createInvestor(
        { name: "ZZ Test Fund", investorType: "VentureCapital", sectorFocus: ["Technology"] },
        { type: "AGENT" }
      );
      expect(inv.name).toBe("ZZ Test Fund");
      expect(inv.createdSource).toBe("AGENT");
      const removed = await deleteInvestor(inv.id);
      expect(removed.id).toBe(inv.id);
      return true;
    });
    if (out === null) return; // DB down — skip
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm exec vitest run src/server/__tests__/investors-crud.smoke.test.ts`
Expected: FAIL ("createInvestor is not a function" / import error).

- [ ] **Step 3: Append the implementation to `src/server/services/investors.ts`**

```ts
import { investorCreateSchema, investorUpdateSchema, type InvestorCreateInput, type InvestorUpdateInput } from "@/lib/schemas/investor";
import { actorSource, CrudError } from "./crud";
import type { Actor } from "@/graphql/context";

export async function createInvestor(input: InvestorCreateInput, actor: Actor) {
  const data = investorCreateSchema.parse(input);
  return prisma.investor.create({ data: { ...data, createdSource: actorSource(actor) } });
}

export async function updateInvestor(id: string, input: InvestorUpdateInput) {
  const data = investorUpdateSchema.parse(input);
  return prisma.investor.update({ where: { id }, data });
}

export async function deleteInvestor(id: string) {
  const engagements = await prisma.engagement.count({ where: { investorId: id } });
  if (engagements > 0) {
    throw new CrudError(`Cannot delete: ${engagements} engagement(s) reference this investor.`);
  }
  return prisma.investor.delete({ where: { id } });
}
```
(Add the imports at the top of the file with the other imports; `prisma` is already imported.)

- [ ] **Step 4: Run test to verify it passes**

Run: `corepack pnpm exec vitest run src/server/__tests__/investors-crud.smoke.test.ts`
Expected: PASS (skips cleanly if DB down; otherwise creates+deletes a row).

- [ ] **Step 5: Commit**

```bash
git add src/server/services/investors.ts src/server/__tests__/investors-crud.smoke.test.ts
git commit -m "feat(services): investor create/update/guarded-delete" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" \
  -m "Claude-Session: https://claude.ai/code/session_01DqS31xA4r9wZ3Fy2rpg3rT"
```

---

### Task 5: Partner service CRUD

**Files:**
- Modify: `src/server/services/partners.ts`
- Test: `src/server/__tests__/partners-crud.smoke.test.ts`

**Interfaces:**
- Produces: `createPartner(input, actor)`, `updatePartner(id, input)`, `deletePartner(id)` — delete throws `CrudError` if `referredMandates > 0`.

- [ ] **Step 1: Write the failing test**

`src/server/__tests__/partners-crud.smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { createPartner, deletePartner } from "@/server/services/partners";

async function withDb<T>(fn: () => Promise<T>): Promise<T | null> {
  if (!process.env.DATABASE_URL) return null;
  try { return await fn(); }
  catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    if (/ECONNREFUSED|ENOTFOUND|connect|Can't reach database|P1001|P1002/.test(m)) return null;
    throw err;
  }
}

describe("partner CRUD (smoke)", () => {
  it("creates (default HUMAN) and deletes a partner", async () => {
    const out = await withDb(async () => {
      const p = await createPartner({ name: "ZZ Test Advisors", partnerType: "Advisor" }, { type: "HUMAN" });
      expect(p.createdSource).toBe("HUMAN");
      await deletePartner(p.id);
      return true;
    });
    if (out === null) return;
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm exec vitest run src/server/__tests__/partners-crud.smoke.test.ts`
Expected: FAIL (import error).

- [ ] **Step 3: Append to `src/server/services/partners.ts`**

```ts
import { partnerCreateSchema, partnerUpdateSchema, type PartnerCreateInput, type PartnerUpdateInput } from "@/lib/schemas/partner";
import { actorSource, CrudError } from "./crud";
import type { Actor } from "@/graphql/context";

export async function createPartner(input: PartnerCreateInput, actor: Actor) {
  const data = partnerCreateSchema.parse(input);
  return prisma.partner.create({ data: { ...data, createdSource: actorSource(actor) } });
}

export async function updatePartner(id: string, input: PartnerUpdateInput) {
  const data = partnerUpdateSchema.parse(input);
  return prisma.partner.update({ where: { id }, data });
}

export async function deletePartner(id: string) {
  const referred = await prisma.mandate.count({ where: { referredById: id } });
  if (referred > 0) {
    throw new CrudError(`Cannot delete: ${referred} mandate(s) were referred by this partner.`);
  }
  return prisma.partner.delete({ where: { id } });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `corepack pnpm exec vitest run src/server/__tests__/partners-crud.smoke.test.ts`
Expected: PASS (or skip if DB down).

- [ ] **Step 5: Commit**

```bash
git add src/server/services/partners.ts src/server/__tests__/partners-crud.smoke.test.ts
git commit -m "feat(services): partner create/update/guarded-delete" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" \
  -m "Claude-Session: https://claude.ai/code/session_01DqS31xA4r9wZ3Fy2rpg3rT"
```

---

### Task 6: Client service CRUD

**Files:**
- Modify: `src/server/services/clients.ts`
- Test: `src/server/__tests__/clients-crud.smoke.test.ts`

**Interfaces:**
- Produces: `createClient(input, actor)`, `updateClient(id, input)`, `deleteClient(id)` — delete throws `CrudError` if `mandates > 0` OR `transactions > 0`.

- [ ] **Step 1: Write the failing test** (verifies the delete guard fires)

`src/server/__tests__/clients-crud.smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { createClient, deleteClient } from "@/server/services/clients";
import { createMandate, deleteMandate } from "@/server/services/mandates";
import { CrudError } from "@/server/services/crud";

async function withDb<T>(fn: () => Promise<T>): Promise<T | null> {
  if (!process.env.DATABASE_URL) return null;
  try { return await fn(); }
  catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    if (/ECONNREFUSED|ENOTFOUND|connect|Can't reach database|P1001|P1002/.test(m)) return null;
    throw err;
  }
}

describe("client CRUD (smoke)", () => {
  it("blocks delete when a mandate references the client", async () => {
    const out = await withDb(async () => {
      const c = await createClient({ name: "ZZ Test Co" }, { type: "HUMAN" });
      const m = await createMandate({ name: "ZZ Test Mandate", clientId: c.id }, { type: "HUMAN" });
      await expect(deleteClient(c.id)).rejects.toBeInstanceOf(CrudError);
      // cleanup: remove the mandate, then the client deletes cleanly
      await deleteMandate(m.id);
      await deleteClient(c.id);
      return true;
    });
    if (out === null) return;
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm exec vitest run src/server/__tests__/clients-crud.smoke.test.ts`
Expected: FAIL (import error). (Depends on Task 7's `createMandate`/`deleteMandate`; if running tasks in order, implement this service then Task 7 before the test passes — or run after Task 7. The mandate guard test in Task 7 is independent.)

- [ ] **Step 3: Append to `src/server/services/clients.ts`**

```ts
import { clientCreateSchema, clientUpdateSchema, type ClientCreateInput, type ClientUpdateInput } from "@/lib/schemas/client";
import { actorSource, CrudError } from "./crud";
import type { Actor } from "@/graphql/context";

export async function createClient(input: ClientCreateInput, actor: Actor) {
  const data = clientCreateSchema.parse(input);
  return prisma.client.create({ data: { ...data, createdSource: actorSource(actor) } });
}

export async function updateClient(id: string, input: ClientUpdateInput) {
  const data = clientUpdateSchema.parse(input);
  return prisma.client.update({ where: { id }, data });
}

export async function deleteClient(id: string) {
  const [mandates, transactions] = await Promise.all([
    prisma.mandate.count({ where: { clientId: id } }),
    prisma.transaction.count({ where: { clientId: id } }),
  ]);
  if (mandates > 0 || transactions > 0) {
    throw new CrudError(
      `Cannot delete: ${mandates} mandate(s) and ${transactions} transaction(s) reference this client.`
    );
  }
  return prisma.client.delete({ where: { id } });
}
```

- [ ] **Step 4: Run test to verify it passes** (after Task 7 is implemented)

Run: `corepack pnpm exec vitest run src/server/__tests__/clients-crud.smoke.test.ts`
Expected: PASS (or skip if DB down).

- [ ] **Step 5: Commit**

```bash
git add src/server/services/clients.ts src/server/__tests__/clients-crud.smoke.test.ts
git commit -m "feat(services): client create/update/guarded-delete" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" \
  -m "Claude-Session: https://claude.ai/code/session_01DqS31xA4r9wZ3Fy2rpg3rT"
```

---

### Task 7: Mandate service CRUD

**Files:**
- Modify: `src/server/services/mandates.ts`
- Test: `src/server/__tests__/mandates-crud.smoke.test.ts`

**Interfaces:**
- Produces: `createMandate(input, actor)`, `updateMandate(id, input)`, `deleteMandate(id)` — delete throws `CrudError` if `transactions > 0`. (`stage` is not set here; Prisma default `NewLead` applies on create.)

- [ ] **Step 1: Write the failing test**

`src/server/__tests__/mandates-crud.smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { createClient, deleteClient } from "@/server/services/clients";
import { createMandate, deleteMandate } from "@/server/services/mandates";

async function withDb<T>(fn: () => Promise<T>): Promise<T | null> {
  if (!process.env.DATABASE_URL) return null;
  try { return await fn(); }
  catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    if (/ECONNREFUSED|ENOTFOUND|connect|Can't reach database|P1001|P1002/.test(m)) return null;
    throw err;
  }
}

describe("mandate CRUD (smoke)", () => {
  it("creates a mandate at default stage NewLead and deletes it", async () => {
    const out = await withDb(async () => {
      const c = await createClient({ name: "ZZ Mandate Client" }, { type: "HUMAN" });
      const m = await createMandate({ name: "ZZ Mandate", clientId: c.id }, { type: "HUMAN" });
      expect(m.stage).toBe("NewLead");
      expect(m.createdSource).toBe("HUMAN");
      await deleteMandate(m.id);
      await deleteClient(c.id);
      return true;
    });
    if (out === null) return;
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm exec vitest run src/server/__tests__/mandates-crud.smoke.test.ts`
Expected: FAIL (import error).

- [ ] **Step 3: Append to `src/server/services/mandates.ts`**

```ts
import { mandateCreateSchema, mandateUpdateSchema, type MandateCreateInput, type MandateUpdateInput } from "@/lib/schemas/mandate";
import { actorSource, CrudError } from "./crud";
import type { Actor } from "@/graphql/context";

export async function createMandate(input: MandateCreateInput, actor: Actor) {
  const data = mandateCreateSchema.parse(input);
  return prisma.mandate.create({ data: { ...data, createdSource: actorSource(actor) } });
}

export async function updateMandate(id: string, input: MandateUpdateInput) {
  const data = mandateUpdateSchema.parse(input);
  return prisma.mandate.update({ where: { id }, data });
}

export async function deleteMandate(id: string) {
  const transactions = await prisma.transaction.count({ where: { mandateId: id } });
  if (transactions > 0) {
    throw new CrudError(`Cannot delete: ${transactions} transaction(s) reference this mandate.`);
  }
  return prisma.mandate.delete({ where: { id } });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `corepack pnpm exec vitest run src/server/__tests__/mandates-crud.smoke.test.ts`
Expected: PASS (or skip).

- [ ] **Step 5: Commit**

```bash
git add src/server/services/mandates.ts src/server/__tests__/mandates-crud.smoke.test.ts
git commit -m "feat(services): mandate create/update/guarded-delete" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" \
  -m "Claude-Session: https://claude.ai/code/session_01DqS31xA4r9wZ3Fy2rpg3rT"
```

---

### Task 8: Transaction service CRUD

**Files:**
- Modify: `src/server/services/transactions.ts`
- Test: `src/server/__tests__/transactions-crud.smoke.test.ts`

**Interfaces:**
- Produces: `createTransaction(input, actor)`, `updateTransaction(id, input)`, `deleteTransaction(id)` — delete throws `CrudError` if `engagements > 0`. (`stage` default `DealPreparation`; `closedAt` not set here.)

- [ ] **Step 1: Write the failing test**

`src/server/__tests__/transactions-crud.smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { createClient, deleteClient } from "@/server/services/clients";
import { createTransaction, deleteTransaction } from "@/server/services/transactions";

async function withDb<T>(fn: () => Promise<T>): Promise<T | null> {
  if (!process.env.DATABASE_URL) return null;
  try { return await fn(); }
  catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    if (/ECONNREFUSED|ENOTFOUND|connect|Can't reach database|P1001|P1002/.test(m)) return null;
    throw err;
  }
}

describe("transaction CRUD (smoke)", () => {
  it("creates a transaction at default stage DealPreparation and deletes it", async () => {
    const out = await withDb(async () => {
      const c = await createClient({ name: "ZZ Txn Client" }, { type: "HUMAN" });
      const t = await createTransaction(
        { name: "ZZ Txn", clientId: c.id, targetRaise: 1000000 },
        { type: "API" }
      );
      expect(t.stage).toBe("DealPreparation");
      expect(t.createdSource).toBe("API");
      await deleteTransaction(t.id);
      await deleteClient(c.id);
      return true;
    });
    if (out === null) return;
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm exec vitest run src/server/__tests__/transactions-crud.smoke.test.ts`
Expected: FAIL (import error).

- [ ] **Step 3: Append to `src/server/services/transactions.ts`**

```ts
import { transactionCreateSchema, transactionUpdateSchema, type TransactionCreateInput, type TransactionUpdateInput } from "@/lib/schemas/transaction";
import { actorSource, CrudError } from "./crud";
import type { Actor } from "@/graphql/context";

export async function createTransaction(input: TransactionCreateInput, actor: Actor) {
  const data = transactionCreateSchema.parse(input);
  return prisma.transaction.create({ data: { ...data, createdSource: actorSource(actor) } });
}

export async function updateTransaction(id: string, input: TransactionUpdateInput) {
  const data = transactionUpdateSchema.parse(input);
  return prisma.transaction.update({ where: { id }, data });
}

export async function deleteTransaction(id: string) {
  const engagements = await prisma.engagement.count({ where: { transactionId: id } });
  if (engagements > 0) {
    throw new CrudError(`Cannot delete: ${engagements} engagement(s) reference this transaction.`);
  }
  return prisma.transaction.delete({ where: { id } });
}
```
**Note:** `setTransactionStage` already exists in this file and remains the only writer of `stage`/`closedAt`. Do not duplicate it.

- [ ] **Step 4: Run test to verify it passes**

Run: `corepack pnpm exec vitest run src/server/__tests__/transactions-crud.smoke.test.ts`
Expected: PASS (or skip).

- [ ] **Step 5: Commit**

```bash
git add src/server/services/transactions.ts src/server/__tests__/transactions-crud.smoke.test.ts
git commit -m "feat(services): transaction create/update/guarded-delete" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" \
  -m "Claude-Session: https://claude.ai/code/session_01DqS31xA4r9wZ3Fy2rpg3rT"
```

---

### Task 9: GraphQL input types

**Files:**
- Create: `src/graphql/inputs.ts`
- Modify: `src/graphql/schema.ts` (add `import "./inputs"` so the side-effect registers — match how `types`/`queries`/`mutations` are imported)

**Interfaces:**
- Consumes: enums from `builder.ts`; the `DateTime` scalar.
- Produces: `InvestorInput`, `ClientInput`, `MandateInput`, `TransactionInput`, `PartnerInput` input refs (exported), each mirroring its Zod create schema. (`create` mutations use the full input; `update` mutations reuse the same input ref — every field on these input types is already nullable/optional, so partial updates validate at the Zod layer.)

- [ ] **Step 1: Write `src/graphql/inputs.ts`**

```ts
// Pothos input types for entity create/update mutations.
// Field optionality mirrors the Zod schemas in src/lib/schemas/*. Only `name`
// (and clientId on Mandate/Transaction) is required; everything else is optional
// so the same input type serves both create and (partial) update.

import {
  builder,
  SectorEnum, InvestorTypeEnum, InvestorStatusEnum, InstrumentEnum, InvestmentStageEnum,
  GeographyEnum, SourceEnum, DocStatusEnum, DealTypeEnum, PartnerTypeEnum, PartnerStatusEnum,
  FounderGenderEnum,
} from "./builder";

export const InvestorInput = builder.inputType("InvestorInput", {
  fields: (t) => ({
    name: t.string({ required: true }),
    investorType: t.field({ type: InvestorTypeEnum, required: false }),
    website: t.string({ required: false }),
    status: t.field({ type: InvestorStatusEnum, required: false }),
    sectorFocus: t.field({ type: [SectorEnum], required: false }),
    geographicFocus: t.field({ type: [GeographyEnum], required: false }),
    instruments: t.field({ type: [InstrumentEnum], required: false }),
    investmentStages: t.field({ type: [InvestmentStageEnum], required: false }),
    aum: t.float({ required: false }),
    ticketMin: t.float({ required: false }),
    ticketMax: t.float({ required: false }),
    currency: t.string({ required: false }),
    targetIrr: t.float({ required: false }),
    countryRestrictions: t.string({ required: false }),
    esgFocus: t.string({ required: false }),
    decisionProcess: t.string({ required: false }),
    notes: t.string({ required: false }),
  }),
});

export const ClientInput = builder.inputType("ClientInput", {
  fields: (t) => ({
    name: t.string({ required: true }),
    yearFounded: t.int({ required: false }),
    hqCity: t.string({ required: false }),
    countries: t.field({ type: [GeographyEnum], required: false }),
    website: t.string({ required: false }),
    sector: t.field({ type: [SectorEnum], required: false }),
    coreProduct: t.string({ required: false }),
    description: t.string({ required: false }),
    founders: t.string({ required: false }),
    founderGender: t.field({ type: FounderGenderEnum, required: false }),
    revenueLastYear: t.float({ required: false }),
    revenueForecast: t.float({ required: false }),
    currency: t.string({ required: false }),
    profitable: t.boolean({ required: false }),
    existingInvestors: t.string({ required: false }),
    source: t.field({ type: SourceEnum, required: false }),
    pitchDeckUrl: t.string({ required: false }),
  }),
});

export const MandateInput = builder.inputType("MandateInput", {
  fields: (t) => ({
    name: t.string({ required: true }),
    clientId: t.id({ required: true }),
    leadId: t.id({ required: false }),
    referredById: t.id({ required: false }),
    dealSize: t.float({ required: false }),
    currency: t.string({ required: false }),
    sector: t.field({ type: [SectorEnum], required: false }),
    source: t.field({ type: SourceEnum, required: false }),
    dateOpened: t.field({ type: "DateTime", required: false }),
    ndaStatus: t.field({ type: DocStatusEnum, required: false }),
    ndaSentDate: t.field({ type: "DateTime", required: false }),
    ndaSignedDate: t.field({ type: "DateTime", required: false }),
    eaStatus: t.field({ type: DocStatusEnum, required: false }),
    eaSentDate: t.field({ type: "DateTime", required: false }),
    eaSignedDate: t.field({ type: "DateTime", required: false }),
    nextAction: t.string({ required: false }),
    notes: t.string({ required: false }),
  }),
});

export const TransactionInput = builder.inputType("TransactionInput", {
  fields: (t) => ({
    name: t.string({ required: true }),
    clientId: t.id({ required: true }),
    mandateId: t.id({ required: false }),
    ownerId: t.id({ required: false }),
    dealType: t.field({ type: DealTypeEnum, required: false }),
    instrument: t.field({ type: [InstrumentEnum], required: false }),
    targetRaise: t.float({ required: false }),
    currency: t.string({ required: false }),
    sector: t.field({ type: [SectorEnum], required: false }),
    dateOpened: t.field({ type: "DateTime", required: false }),
  }),
});

export const PartnerInput = builder.inputType("PartnerInput", {
  fields: (t) => ({
    name: t.string({ required: true }),
    partnerType: t.field({ type: PartnerTypeEnum, required: false }),
    profile: t.string({ required: false }),
    status: t.field({ type: PartnerStatusEnum, required: false }),
    location: t.string({ required: false }),
    amount: t.float({ required: false }),
    currency: t.string({ required: false }),
  }),
});
```

- [ ] **Step 2: Register the module in `src/graphql/schema.ts`**

Add an import line next to the existing `import "./types"` / `import "./mutations"` side-effect imports:
```ts
import "./inputs";
```
(Place it before `./mutations` so the input refs exist when mutations reference them.)

- [ ] **Step 3: Typecheck**

Run: `corepack pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/graphql/inputs.ts src/graphql/schema.ts
git commit -m "feat(graphql): add entity input types for CRUD mutations" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" \
  -m "Claude-Session: https://claude.ai/code/session_01DqS31xA4r9wZ3Fy2rpg3rT"
```

---

### Task 10: CRUD mutations + expose `createdSource`

**Files:**
- Modify: `src/graphql/mutations.ts` (add 15 mutations)
- Modify: `src/graphql/types.ts` (add `createdSource` to the 5 prismaObjects)
- Test: `src/graphql/__tests__/crud-schema.smoke.test.ts`

**Interfaces:**
- Consumes: the input refs from Task 9; the service functions from Tasks 4–8; `ctx.actor` (4th resolver arg).
- Produces GraphQL mutations: `createInvestor/updateInvestor/deleteInvestor`, and the same trio for `Client`, `Mandate`, `Transaction`, `Partner`. Create/Update return the entity; Delete returns the deleted entity (so the client gets the id back).

- [ ] **Step 1: Expose `createdSource` in `src/graphql/types.ts`**

In each of `InvestorRef`, `ClientRef`, `MandateRef`, `TransactionRef`, `PartnerRef`, add this field (next to `createdAt`); `ActorSourceEnum` is already imported in this file:
```ts
    createdSource: t.field({ type: ActorSourceEnum, resolve: (r) => r.createdSource }),
```

- [ ] **Step 2: Write the failing schema test**

`src/graphql/__tests__/crud-schema.smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { printSchema } from "graphql";
import { schema } from "@/graphql/schema";

describe("CRUD schema", () => {
  it("exposes create/update/delete mutations for all 5 entities", () => {
    const sdl = printSchema(schema);
    for (const op of ["create", "update", "delete"]) {
      for (const ent of ["Investor", "Client", "Mandate", "Transaction", "Partner"]) {
        expect(sdl).toContain(`${op}${ent}`);
      }
    }
  });

  it("exposes createdSource on the entity types", () => {
    const sdl = printSchema(schema);
    expect(sdl).toMatch(/createdSource: ActorSource/);
  });
});
```
(Confirm the export name in `src/graphql/schema.ts` — the existing smoke test `src/graphql/__tests__/schema.smoke.test.ts` shows how `schema` is imported; match it.)

- [ ] **Step 3: Run test to verify it fails**

Run: `corepack pnpm exec vitest run src/graphql/__tests__/crud-schema.smoke.test.ts`
Expected: FAIL (mutations not present).

- [ ] **Step 4: Add the 15 mutations to `src/graphql/mutations.ts`**

Add imports at the top:
```ts
import { InvestorInput, ClientInput, MandateInput, TransactionInput, PartnerInput } from "./inputs";
import { createInvestor, updateInvestor, deleteInvestor } from "@/server/services/investors";
import { createClient, updateClient, deleteClient } from "@/server/services/clients";
import { createMandate, updateMandate, deleteMandate } from "@/server/services/mandates";
import { createTransaction, updateTransaction, deleteTransaction } from "@/server/services/transactions";
import { createPartner, updatePartner, deletePartner } from "@/server/services/partners";
```

Then add these fields inside the existing `builder.mutationFields((t) => ({ ... }))` object (alongside the current 3). Note `input` is non-null on create/update; the service's Zod `.parse` enforces required fields and ignores `undefined` optionals. `ctx` is the 4th resolver arg.

```ts
  // ── Investor ──
  createInvestor: t.prismaField({
    type: "Investor", nullable: false,
    args: { input: t.arg({ type: InvestorInput, required: true }) },
    resolve: (_q, _r, args, ctx) => createInvestor(args.input as never, ctx.actor),
  }),
  updateInvestor: t.prismaField({
    type: "Investor", nullable: false,
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: InvestorInput, required: true }) },
    resolve: (_q, _r, args) => updateInvestor(args.id, args.input as never),
  }),
  deleteInvestor: t.prismaField({
    type: "Investor", nullable: false,
    args: { id: t.arg.id({ required: true }) },
    resolve: (_q, _r, args) => deleteInvestor(args.id),
  }),

  // ── Client ──
  createClient: t.prismaField({
    type: "Client", nullable: false,
    args: { input: t.arg({ type: ClientInput, required: true }) },
    resolve: (_q, _r, args, ctx) => createClient(args.input as never, ctx.actor),
  }),
  updateClient: t.prismaField({
    type: "Client", nullable: false,
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: ClientInput, required: true }) },
    resolve: (_q, _r, args) => updateClient(args.id, args.input as never),
  }),
  deleteClient: t.prismaField({
    type: "Client", nullable: false,
    args: { id: t.arg.id({ required: true }) },
    resolve: (_q, _r, args) => deleteClient(args.id),
  }),

  // ── Mandate ──
  createMandate: t.prismaField({
    type: "Mandate", nullable: false,
    args: { input: t.arg({ type: MandateInput, required: true }) },
    resolve: (_q, _r, args, ctx) => createMandate(args.input as never, ctx.actor),
  }),
  updateMandate: t.prismaField({
    type: "Mandate", nullable: false,
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: MandateInput, required: true }) },
    resolve: (_q, _r, args) => updateMandate(args.id, args.input as never),
  }),
  deleteMandate: t.prismaField({
    type: "Mandate", nullable: false,
    args: { id: t.arg.id({ required: true }) },
    resolve: (_q, _r, args) => deleteMandate(args.id),
  }),

  // ── Transaction ──
  createTransaction: t.prismaField({
    type: "Transaction", nullable: false,
    args: { input: t.arg({ type: TransactionInput, required: true }) },
    resolve: (_q, _r, args, ctx) => createTransaction(args.input as never, ctx.actor),
  }),
  updateTransaction: t.prismaField({
    type: "Transaction", nullable: false,
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: TransactionInput, required: true }) },
    resolve: (_q, _r, args) => updateTransaction(args.id, args.input as never),
  }),
  deleteTransaction: t.prismaField({
    type: "Transaction", nullable: false,
    args: { id: t.arg.id({ required: true }) },
    resolve: (_q, _r, args) => deleteTransaction(args.id),
  }),

  // ── Partner ──
  createPartner: t.prismaField({
    type: "Partner", nullable: false,
    args: { input: t.arg({ type: PartnerInput, required: true }) },
    resolve: (_q, _r, args, ctx) => createPartner(args.input as never, ctx.actor),
  }),
  updatePartner: t.prismaField({
    type: "Partner", nullable: false,
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: PartnerInput, required: true }) },
    resolve: (_q, _r, args) => updatePartner(args.id, args.input as never),
  }),
  deletePartner: t.prismaField({
    type: "Partner", nullable: false,
    args: { id: t.arg.id({ required: true }) },
    resolve: (_q, _r, args) => deletePartner(args.id),
  }),
```
**Note on `as never`:** the Pothos `args.input` carries GraphQL nullable types (`string | null`) while the Zod schemas use `string | undefined`. The service's `.parse()` is the real validation boundary, so casting the resolver arg keeps types quiet without weakening runtime safety. If you prefer no cast, add a tiny `nullsToUndefined(input)` mapper — but the Zod parse already drops `null`s via `.optional()` only if they're `undefined`; pass through `.parse` which will reject stray `null`s, so the mapper is the stricter choice. Keep `as never` for this pass.

- [ ] **Step 5: Run test to verify it passes**

Run: `corepack pnpm exec vitest run src/graphql/__tests__/crud-schema.smoke.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Typecheck + full test run**

Run: `corepack pnpm exec tsc --noEmit`
Expected: PASS.
Run: `corepack pnpm test`
Expected: PASS (all suites; DB-dependent smoke tests pass with the DB up on 5544, or skip).

- [ ] **Step 7: Commit**

```bash
git add src/graphql/mutations.ts src/graphql/types.ts src/graphql/__tests__/crud-schema.smoke.test.ts
git commit -m "feat(graphql): CRUD mutations + createdSource exposure for 5 entities" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" \
  -m "Claude-Session: https://claude.ai/code/session_01DqS31xA4r9wZ3Fy2rpg3rT"
```

---

## Plan A Self-Review

- **Spec coverage:** §2 layers 1–3 (Zod → service → GraphQL) ✓ Tasks 3 / 4–8 / 9–10. §5 delete guards ✓ one per entity (Investor=engagements, Client=mandates+transactions, Mandate=transactions, Transaction=engagements, Partner=referredMandates). §6 stage exclusion ✓ (schemas omit stage; services never set it; note in Task 8). §7 provenance ✓ Task 1 + `actorSource` + create resolvers pass `ctx.actor`; exposure in Task 10. §7 validation (client+server) — server half ✓ (services `.parse`); client half is Plan B. §9 testing ✓ helper/schema unit tests + per-entity service smoke tests incl. the Client delete-guard test.
- **Type consistency:** service signatures `createX(input, actor)` / `updateX(id, input)` / `deleteX(id)` are used identically in the mutation resolvers; schema export names (`xCreateSchema`/`xUpdateSchema`) match their imports in the services; input ref names (`XInput`) match imports in mutations.
- **Out of scope for Plan A (→ Plan B):** the slide-over drawer, field components, `useEntityForm`, `DeleteConfirm`, per-entity form drawers, the clients list page, and wiring "+ New"/Edit/Delete into pages.

## Cross-cutting note

Because CRUD is exposed as plain GraphQL mutations with typed inputs, an AI agent (per `docs/agents/03-creating-tools.md`) can call `createInvestor`/`updateMandate`/etc. over HTTP with no extra work, and `createdSource` will record `AGENT` for agent-initiated writes. Plan B adds the human UI on top of this same surface.
