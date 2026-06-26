# Investor & Partner Data Layer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Investor and Partner domains spec-complete at the data layer — new `ServiceProvider` and `Document` models, a reworked `Engagement` (stages + disbursement), extended `Investor`/`Partner`/`Person`, and the full controlled-vocabulary set — all wired through Prisma → Pothos GraphQL → services → seed.

**Architecture:** This is **Plan 1 of 3** for the investor/partner build. It delivers only the data layer (the foundation everything else depends on). Plan 2 = the §11 visibility engine (heavy TDD). Plan 3 = portals + viewpoint switcher + admin access matrix. Follow the existing layering exactly: one Prisma model ↔ one `builder.prismaObject` ↔ one `inputType` ↔ thin mutation → service → Zod schema; display labels in `vocab.ts`.

**Tech Stack:** Next.js, Prisma 6 (`@prisma/client`), Pothos GraphQL (`@pothos/core` + `@pothos/plugin-prisma`), graphql-yoga, vitest, tsx seed. Postgres via `docker compose` (`npm run db:up`).

## Global Constraints

- **Spec authority:** `noblestride-crm/docs/superpowers/specs/2026-06-26-investor-partner-portals-design.md` (§3–§4 field tables are verbatim source of truth). Field names and enum values below are copied from it.
- **No AI/agents in this plan.** Data layer only.
- **Task model stays excluded from GraphQL** (existing rule in `types.ts` line 3). Do not expose `Task` or `tasks` relations.
- **Enum identifiers are PascalCase** in Prisma; every enum gets a human label in `src/lib/vocab.ts` `LABELS`.
- **Money** = Prisma `Decimal @db.Decimal(20, 2)`, exposed in GraphQL as `t.float` via `Number(...)` (see `types.ts` Investor `aum`).
- **Provenance:** every new top-level model carries `createdSource ActorSource @default(HUMAN)` (existing pattern).
- **Demo DB:** seed data is disposable. Schema changes are applied with `npm run migrate` (= `prisma migrate dev`); if an enum/field change conflicts with existing rows, `npm run db:reset` (drop + recreate + reseed) is acceptable — this is a demo database, not production.
- **Commit** after every task. Branch first if on `main`.
- **Test runner:** `npm run test` (vitest). Schema smoke tests live in `src/graphql/__tests__/`.

---

## File Structure

**Modified (every task touches a subset):**
- `prisma/schema.prisma` — models + enums
- `src/graphql/builder.ts` — enum registrations
- `src/graphql/types.ts` — `prismaObject` field exposure
- `src/graphql/inputs.ts` — `inputType` create/update fields
- `src/graphql/mutations.ts` — thin resolvers
- `src/lib/vocab.ts` — display labels
- `prisma/seed.ts` + `prisma/seed-data.json` — populate new fields

**Created:**
- `src/server/services/service-providers.ts` — ServiceProvider CRUD
- `src/server/services/documents.ts` — Document CRUD
- `src/lib/schemas/service-provider.ts`, `src/lib/schemas/document.ts` — Zod
- `src/server/services/engagements-crud.ts` — Engagement create/update (separate from the existing `engagements.ts` log helper)
- `src/graphql/__tests__/investor-partner-data-layer.smoke.test.ts` — coverage smoke tests
- `src/server/domain/__tests__/disbursement.test.ts` — disbursement math unit tests

---

### Task 1: Controlled vocabularies — new + corrected enums

**Files:**
- Modify: `prisma/schema.prisma` (enum blocks)
- Modify: `src/graphql/builder.ts:5-25,47-66`
- Modify: `src/lib/vocab.ts`
- Test: `src/lib/__tests__/vocab.test.ts` (create)

**Interfaces:**
- Produces (Prisma runtime enums, used by all later tasks): `EngagementStage`, `InterestLevel`, `NdaType`, `DisbursementStatus`, `InvestorEngagementClassification`, `InvestorNdaStatus`, `AdvisorType`, `ServiceProviderType`, `DocumentType`, `DocumentAccessLevel`, `DocumentStatus`, `PartnerAgreementStatus`; widened `Sector`, `InvestorType`.
- Produces (Pothos enum refs): `EngagementStageEnum`, `InterestLevelEnum`, `NdaTypeEnum`, `DisbursementStatusEnum`, `InvestorEngagementClassificationEnum`, `InvestorNdaStatusEnum`, `AdvisorTypeEnum`, `ServiceProviderTypeEnum`, `DocumentTypeEnum`, `DocumentAccessLevelEnum`, `DocumentStatusEnum`, `PartnerAgreementStatusEnum`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/vocab.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { EngagementStage, InvestorEngagementClassification, Sector, InvestorType } from "@prisma/client";
import { LABELS } from "@/lib/vocab";

describe("new controlled vocabularies", () => {
  it("defines the 12 engagement stages", () => {
    expect(Object.values(EngagementStage)).toEqual([
      "Shared","TeaserSent","NDASigned","IMShared","VDRAccess","Meeting",
      "InfoRequest","DueDiligence","TermSheet","Offer","Invested","Declined",
    ]);
  });
  it("defines the 5 investor engagement classifications", () => {
    expect(Object.values(InvestorEngagementClassification)).toContain("Greylisted");
    expect(Object.values(InvestorEngagementClassification)).toContain("Excluded");
  });
  it("widens Sector and InvestorType per spec", () => {
    expect(Object.values(Sector)).toContain("Aviation");
    expect(Object.values(Sector)).toContain("WaterSanitation");
    expect(Object.values(InvestorType)).toContain("Corporate");
    expect(Object.values(InvestorType)).toContain("Individual");
  });
  it("labels every EngagementStage value", () => {
    for (const v of Object.values(EngagementStage)) {
      expect(LABELS.EngagementStage[v]).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- vocab`
Expected: FAIL — `EngagementStage` undefined / not exported from `@prisma/client`.

- [ ] **Step 3: Add the enums to `prisma/schema.prisma`**

Append these enum blocks (anywhere among the existing enums):
```prisma
enum EngagementStage {
  Shared
  TeaserSent
  NDASigned
  IMShared
  VDRAccess
  Meeting
  InfoRequest
  DueDiligence
  TermSheet
  Offer
  Invested
  Declined
}

enum InterestLevel { Low Medium High }

enum NdaType { Open Closed }

enum DisbursementStatus { Disbursed Ongoing FellOff Dropped }

enum InvestorEngagementClassification { Active Inactive OnHold Excluded Greylisted }

enum InvestorNdaStatus { None OpenNDA ClosedNDA }

enum AdvisorType { Lawyer Investor Consultant TransactionAdvisor AdvisoryFirm Other }

enum ServiceProviderType { LawFirm Audit Tax ESG Technical Other }

enum DocumentType {
  NDA
  EngagementContract
  Teaser
  IM
  FinancialModel
  Valuation
  PitchDeck
  AuditedAccounts
  CR12
  TermSheet
  LoanAgreement
  SPA
  SHA
  Other
}

enum DocumentAccessLevel { Internal ClientShared InvestorShared VDR }

enum DocumentStatus { Draft UnderReview Approved Shared Executed }

enum PartnerAgreementStatus { None Sent Signed }
```

Then extend the two existing enums:
```prisma
// In `enum Sector { ... }` add these values:
  Aviation
  Construction
  Hospitality
  Leasing
  MediaEntertainment
  Services
  TransportLogistics
  WaterSanitation
```
```prisma
// In `enum InvestorType { ... }` add these values:
  Corporate
  Individual
```

- [ ] **Step 4: Regenerate the Prisma client**

Run: `npm run generate`
Expected: "Generated Prisma Client" with no schema errors.

- [ ] **Step 5: Register the enums in `src/graphql/builder.ts`**

Add to the import from `@prisma/client` (the block at lines 5–25): `EngagementStage, InterestLevel, NdaType, DisbursementStatus, InvestorEngagementClassification, InvestorNdaStatus, AdvisorType, ServiceProviderType, DocumentType, DocumentAccessLevel, DocumentStatus, PartnerAgreementStatus`.

Add after line 65:
```typescript
export const EngagementStageEnum = builder.enumType(EngagementStage, { name: "EngagementStage" });
export const InterestLevelEnum = builder.enumType(InterestLevel, { name: "InterestLevel" });
export const NdaTypeEnum = builder.enumType(NdaType, { name: "NdaType" });
export const DisbursementStatusEnum = builder.enumType(DisbursementStatus, { name: "DisbursementStatus" });
export const InvestorEngagementClassificationEnum = builder.enumType(InvestorEngagementClassification, { name: "InvestorEngagementClassification" });
export const InvestorNdaStatusEnum = builder.enumType(InvestorNdaStatus, { name: "InvestorNdaStatus" });
export const AdvisorTypeEnum = builder.enumType(AdvisorType, { name: "AdvisorType" });
export const ServiceProviderTypeEnum = builder.enumType(ServiceProviderType, { name: "ServiceProviderType" });
export const DocumentTypeEnum = builder.enumType(DocumentType, { name: "DocumentType" });
export const DocumentAccessLevelEnum = builder.enumType(DocumentAccessLevel, { name: "DocumentAccessLevel" });
export const DocumentStatusEnum = builder.enumType(DocumentStatus, { name: "DocumentStatus" });
export const PartnerAgreementStatusEnum = builder.enumType(PartnerAgreementStatus, { name: "PartnerAgreementStatus" });
```

- [ ] **Step 6: Add labels in `src/lib/vocab.ts`**

Add these keys to the `LABELS` object, and the 8 new `Sector` + 2 new `InvestorType` labels to their existing blocks:
```typescript
  EngagementStage: {
    Shared: "Shared", TeaserSent: "Teaser Sent", NDASigned: "NDA Signed",
    IMShared: "IM Shared", VDRAccess: "VDR Access", Meeting: "Meeting",
    InfoRequest: "Info Request", DueDiligence: "Due Diligence",
    TermSheet: "Term Sheet", Offer: "Offer", Invested: "Invested", Declined: "Declined",
  },
  InterestLevel: { Low: "Low", Medium: "Medium", High: "High" },
  NdaType: { Open: "Open", Closed: "Closed" },
  DisbursementStatus: { Disbursed: "Disbursed", Ongoing: "Ongoing", FellOff: "Fell Off", Dropped: "Dropped" },
  InvestorEngagementClassification: { Active: "Active", Inactive: "Inactive", OnHold: "On Hold", Excluded: "Excluded", Greylisted: "Greylisted" },
  InvestorNdaStatus: { None: "None", OpenNDA: "Open NDA", ClosedNDA: "Closed NDA" },
  AdvisorType: { Lawyer: "Lawyer", Investor: "Investor", Consultant: "Consultant", TransactionAdvisor: "Transaction Advisor", AdvisoryFirm: "Advisory Firm", Other: "Other" },
  ServiceProviderType: { LawFirm: "Law Firm", Audit: "Audit (Big 4)", Tax: "Tax", ESG: "ESG", Technical: "Technical", Other: "Other" },
  DocumentType: {
    NDA: "NDA", EngagementContract: "Engagement Contract", Teaser: "Teaser", IM: "Information Memorandum",
    FinancialModel: "Financial Model", Valuation: "Valuation", PitchDeck: "Pitch Deck", AuditedAccounts: "Audited Accounts",
    CR12: "CR12", TermSheet: "Term Sheet", LoanAgreement: "Loan Agreement", SPA: "SPA", SHA: "SHA", Other: "Other",
  },
  DocumentAccessLevel: { Internal: "Internal", ClientShared: "Client-Shared", InvestorShared: "Investor-Shared", VDR: "VDR" },
  DocumentStatus: { Draft: "Draft", UnderReview: "Under Review", Approved: "Approved", Shared: "Shared", Executed: "Executed" },
  PartnerAgreementStatus: { None: "None", Sent: "Sent", Signed: "Signed" },
```
Add to the existing `Sector` block: `Aviation: "Aviation", Construction: "Construction", Hospitality: "Hospitality", Leasing: "Leasing", MediaEntertainment: "Media & Entertainment", Services: "Services", TransportLogistics: "Transport & Logistics", WaterSanitation: "Water & Sanitation"`.
Add to the existing `InvestorType` block: `Corporate: "Corporate", Individual: "Individual"`.

- [ ] **Step 7: Run test to verify it passes**

Run: `npm run test -- vocab`
Expected: PASS (4 tests).

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma src/graphql/builder.ts src/lib/vocab.ts src/lib/__tests__/vocab.test.ts
git commit -m "feat(crm): add investor/partner controlled vocabularies (spec §4)"
```

---

### Task 2: Rework `Engagement` — stages + disbursement

**Files:**
- Modify: `prisma/schema.prisma` (`model Engagement` ~389-410)
- Modify: `src/graphql/types.ts` (`EngagementRef` ~226-246)
- Modify: `src/graphql/inputs.ts` (add `EngagementInput`)
- Modify: `src/graphql/mutations.ts` (add create/update)
- Create: `src/server/services/engagements-crud.ts`
- Create: `src/lib/schemas/engagement.ts`
- Create: `src/server/domain/disbursement.ts` + `src/server/domain/__tests__/disbursement.test.ts`

**Interfaces:**
- Consumes: enum refs from Task 1 (`EngagementStageEnum`, `InterestLevelEnum`, `NdaTypeEnum`, `DisbursementStatusEnum`).
- Produces: `deriveYearQuarter(date: Date): { year: number; quarter: number }`, `amountPending(total?: number|null, disbursed?: number|null): number|null` in `disbursement.ts`; `createEngagement(input, actor)` / `updateEngagement(id, input)` in `engagements-crud.ts`.

> **Decision (deviates slightly from spec §4.1):** keep the legacy `status EngagementStatus` field for now and ADD `engagementStage` alongside it, to avoid breaking existing engagement views/`ACTIVE_CONVERSATION_STATUSES` in this data-layer step. Legacy `status` removal happens in Plan 3 once UI reads `engagementStage`. Seed (Task 8) sets `engagementStage` consistently with `status`.

- [ ] **Step 1: Write the failing test (disbursement math)**

Create `src/server/domain/__tests__/disbursement.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { amountPending, deriveYearQuarter } from "@/server/domain/disbursement";

describe("disbursement math", () => {
  it("computes pending = total - disbursed", () => {
    expect(amountPending(10, 4)).toBe(6);
  });
  it("returns null pending when total is null", () => {
    expect(amountPending(null, 4)).toBeNull();
  });
  it("treats missing disbursed as zero", () => {
    expect(amountPending(10, null)).toBe(10);
  });
  it("derives year and quarter from a date", () => {
    expect(deriveYearQuarter(new Date("2026-05-15"))).toEqual({ year: 2026, quarter: 2 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- disbursement`
Expected: FAIL — module `@/server/domain/disbursement` not found.

- [ ] **Step 3: Implement `src/server/domain/disbursement.ts`**

```typescript
/** USD-Mn pending = total − disbursed. Null total → null. Null disbursed → 0. */
export function amountPending(total?: number | null, disbursed?: number | null): number | null {
  if (total == null) return null;
  return total - (disbursed ?? 0);
}

/** Calendar year + quarter (1–4) from a date. */
export function deriveYearQuarter(date: Date): { year: number; quarter: number } {
  return { year: date.getUTCFullYear(), quarter: Math.floor(date.getUTCMonth() / 3) + 1 };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- disbursement`
Expected: PASS (4 tests).

- [ ] **Step 5: Add fields to `model Engagement` in `prisma/schema.prisma`**

Insert after the `notes` field (keep existing fields):
```prisma
  engagementStage    EngagementStage     @default(Shared)
  interestLevel      InterestLevel?
  ndaType            NdaType?
  termSheetIssued    Boolean             @default(false)
  termSheetDate      DateTime?
  totalAmount        Decimal?            @db.Decimal(20, 2)
  amountDisbursed    Decimal?            @db.Decimal(20, 2)
  amountPending      Decimal?            @db.Decimal(20, 2)
  disbursementStatus DisbursementStatus?
  dateReceived       DateTime?
  year               Int?
  quarter            Int?
  probability        Int?
  feedback           String?
```
Add to the model's index block: `@@index([engagementStage])`. Run `npm run generate`.

- [ ] **Step 6: Expose fields in `EngagementRef` (`src/graphql/types.ts`)**

Add inside `EngagementRef.fields` (after `notes`):
```typescript
    engagementStage: t.field({ type: EngagementStageEnum, resolve: (e) => e.engagementStage }),
    interestLevel: t.field({ type: InterestLevelEnum, nullable: true, resolve: (e) => e.interestLevel }),
    ndaType: t.field({ type: NdaTypeEnum, nullable: true, resolve: (e) => e.ndaType }),
    termSheetIssued: t.exposeBoolean("termSheetIssued"),
    termSheetDate: t.field({ type: "DateTime", nullable: true, resolve: (e) => e.termSheetDate }),
    totalAmount: t.float({ nullable: true, resolve: (e) => (e.totalAmount == null ? null : Number(e.totalAmount)) }),
    amountDisbursed: t.float({ nullable: true, resolve: (e) => (e.amountDisbursed == null ? null : Number(e.amountDisbursed)) }),
    amountPending: t.float({ nullable: true, resolve: (e) => (e.amountPending == null ? null : Number(e.amountPending)) }),
    disbursementStatus: t.field({ type: DisbursementStatusEnum, nullable: true, resolve: (e) => e.disbursementStatus }),
    dateReceived: t.field({ type: "DateTime", nullable: true, resolve: (e) => e.dateReceived }),
    year: t.exposeInt("year", { nullable: true }),
    quarter: t.exposeInt("quarter", { nullable: true }),
    probability: t.exposeInt("probability", { nullable: true }),
    feedback: t.exposeString("feedback", { nullable: true }),
```
Add the enum imports (`EngagementStageEnum, InterestLevelEnum, NdaTypeEnum, DisbursementStatusEnum`) to the `./builder` import block at the top of `types.ts`.

- [ ] **Step 7: Add `EngagementInput`, Zod schema, service, and mutations**

`src/lib/schemas/engagement.ts`:
```typescript
import { z } from "zod";
export const engagementCreateSchema = z.object({
  transactionId: z.string(), investorId: z.string(), name: z.string().optional(),
  engagementStage: z.string().optional(), interestLevel: z.string().optional(), ndaType: z.string().optional(),
  termSheetIssued: z.boolean().optional(), termSheetDate: z.date().optional(),
  totalAmount: z.number().optional(), amountDisbursed: z.number().optional(),
  disbursementStatus: z.string().optional(), dateReceived: z.date().optional(),
  probability: z.number().optional(), feedback: z.string().optional(), notes: z.string().optional(),
});
export const engagementUpdateSchema = engagementCreateSchema.partial();
export type EngagementCreateInput = z.infer<typeof engagementCreateSchema>;
export type EngagementUpdateInput = z.infer<typeof engagementUpdateSchema>;
```

`src/server/services/engagements-crud.ts`:
```typescript
import { prisma } from "@/lib/db";
import { actorSource } from "./crud";
import type { Actor } from "@/graphql/context";
import { amountPending, deriveYearQuarter } from "@/server/domain/disbursement";
import { engagementCreateSchema, engagementUpdateSchema } from "@/lib/schemas/engagement";

function derived(input: { totalAmount?: number; amountDisbursed?: number; dateReceived?: Date }) {
  const pending = amountPending(input.totalAmount ?? null, input.amountDisbursed ?? null);
  const yq = input.dateReceived ? deriveYearQuarter(input.dateReceived) : null;
  return { amountPending: pending ?? undefined, year: yq?.year, quarter: yq?.quarter };
}

export async function createEngagement(raw: unknown, actor: Actor) {
  const input = engagementCreateSchema.parse(raw);
  return prisma.engagement.create({
    data: { ...input, name: input.name ?? "Engagement", ...derived(input), createdSource: actorSource(actor) } as never,
  });
}

export async function updateEngagement(id: string, raw: unknown) {
  const input = engagementUpdateSchema.parse(raw);
  return prisma.engagement.update({ where: { id }, data: { ...input, ...derived(input) } as never });
}
```

`src/graphql/inputs.ts` — add `EngagementInput` (mirror existing inputs; enum fields use the Task 1 refs):
```typescript
export const EngagementInput = builder.inputType("EngagementInput", {
  fields: (t) => ({
    transactionId: t.id({ required: true }),
    investorId: t.id({ required: true }),
    name: t.string({ required: false }),
    engagementStage: t.field({ type: EngagementStageEnum, required: false }),
    interestLevel: t.field({ type: InterestLevelEnum, required: false }),
    ndaType: t.field({ type: NdaTypeEnum, required: false }),
    termSheetIssued: t.boolean({ required: false }),
    termSheetDate: t.field({ type: "DateTime", required: false }),
    totalAmount: t.float({ required: false }),
    amountDisbursed: t.float({ required: false }),
    disbursementStatus: t.field({ type: DisbursementStatusEnum, required: false }),
    dateReceived: t.field({ type: "DateTime", required: false }),
    probability: t.int({ required: false }),
    feedback: t.string({ required: false }),
    notes: t.string({ required: false }),
  }),
});
```
(Add the four enum refs to the `./builder` import block in `inputs.ts`.)

`src/graphql/mutations.ts` — add imports and two mutations next to the others:
```typescript
import { createEngagement, updateEngagement } from "@/server/services/engagements-crud";
import { EngagementInput } from "./inputs";
// ...inside builder.mutationFields:
  createEngagement: t.prismaField({
    type: "Engagement", nullable: false,
    args: { input: t.arg({ type: EngagementInput, required: true }) },
    resolve: (_q, _r, args, ctx) => createEngagement(args.input as never, ctx.actor),
  }),
  updateEngagement: t.prismaField({
    type: "Engagement", nullable: false,
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: EngagementInput, required: true }) },
    resolve: (_q, _r, args) => updateEngagement(args.id, args.input as never),
  }),
```

- [ ] **Step 8: Migrate, then run the full suite**

Run: `npm run db:up && npm run migrate -- --name engagement_stages_disbursement`
Then: `npm run test`
Expected: migration applies; all tests PASS (including existing smoke tests — `EngagementRef` still compiles).

- [ ] **Step 9: Commit**

```bash
git add prisma/ src/graphql/ src/server/ src/lib/schemas/engagement.ts
git commit -m "feat(crm): engagement stages + disbursement tracking (spec §3.5)"
```

---

### Task 3: `ServiceProvider` model end-to-end

**Files:**
- Modify: `prisma/schema.prisma` (new model + `Transaction` back-relation)
- Create: `src/server/services/service-providers.ts`, `src/lib/schemas/service-provider.ts`
- Modify: `src/graphql/types.ts` (ref + `Transaction.serviceProviders` relation), `inputs.ts`, `mutations.ts`

**Interfaces:**
- Consumes: `ServiceProviderTypeEnum` (Task 1).
- Produces: `createServiceProvider(input, actor)`, `updateServiceProvider(id, input)`, `deleteServiceProvider(id)`, `listServiceProviders()`, `getServiceProvider(id)`.

- [ ] **Step 1: Write the failing test**

Add to `src/graphql/__tests__/investor-partner-data-layer.smoke.test.ts` (create the file):
```typescript
import { describe, it, expect } from "vitest";

describe("investor/partner data layer schema", () => {
  it("exposes ServiceProvider CRUD + type", async () => {
    const { schema } = await import("@/graphql/schema");
    const mut = Object.keys(schema.getMutationType()?.getFields() ?? {});
    expect(mut).toContain("createServiceProvider");
    expect(mut).toContain("updateServiceProvider");
    expect(mut).toContain("deleteServiceProvider");
    expect(schema.getTypeMap()["ServiceProvider"]).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- investor-partner-data-layer`
Expected: FAIL — `createServiceProvider` not in mutation fields.

- [ ] **Step 3: Add the Prisma model + back-relation**

In `prisma/schema.prisma`:
```prisma
model ServiceProvider {
  id            String              @id @default(cuid())
  name          String
  type          ServiceProviderType
  contactPerson String?
  email         String?
  phone         String?
  profile       String?
  fee           Decimal?            @db.Decimal(20, 2)
  currency      String              @default("USD")
  status        String?
  createdSource ActorSource         @default(HUMAN)
  createdAt     DateTime            @default(now())
  updatedAt     DateTime            @updatedAt

  engagedOn     Transaction[]       @relation("TransactionServiceProviders")

  @@index([type])
}
```
Add to `model Transaction`: `serviceProviders ServiceProvider[] @relation("TransactionServiceProviders")`. Run `npm run generate`.

- [ ] **Step 4: Zod + service**

`src/lib/schemas/service-provider.ts`:
```typescript
import { z } from "zod";
export const serviceProviderCreateSchema = z.object({
  name: z.string(), type: z.string(), contactPerson: z.string().optional(),
  email: z.string().optional(), phone: z.string().optional(), profile: z.string().optional(),
  fee: z.number().optional(), currency: z.string().optional(), status: z.string().optional(),
});
export const serviceProviderUpdateSchema = serviceProviderCreateSchema.partial();
```
`src/server/services/service-providers.ts` (mirror `partners.ts` create/update/delete using `actorSource`, `CrudError`):
```typescript
import { prisma } from "@/lib/db";
import { actorSource, CrudError } from "./crud";
import type { Actor } from "@/graphql/context";
import { serviceProviderCreateSchema, serviceProviderUpdateSchema } from "@/lib/schemas/service-provider";

export const listServiceProviders = () => prisma.serviceProvider.findMany({ orderBy: { name: "asc" } });
export const getServiceProvider = (id: string) =>
  prisma.serviceProvider.findUnique({ where: { id }, include: { engagedOn: true } });

export async function createServiceProvider(raw: unknown, actor: Actor) {
  const input = serviceProviderCreateSchema.parse(raw);
  return prisma.serviceProvider.create({ data: { ...input, createdSource: actorSource(actor) } as never });
}
export async function updateServiceProvider(id: string, raw: unknown) {
  const input = serviceProviderUpdateSchema.parse(raw);
  return prisma.serviceProvider.update({ where: { id }, data: input as never });
}
export async function deleteServiceProvider(id: string) {
  try { return await prisma.serviceProvider.delete({ where: { id } }); }
  catch { throw new CrudError("ServiceProvider not found"); }
}
```

- [ ] **Step 5: GraphQL object, input, mutations**

`types.ts` — add `ServiceProviderRef` (mirror `PartnerRef`; expose all scalars + `engagedOn: t.relation("engagedOn")` + `fee` as float) and add `serviceProviders: t.relation("serviceProviders")` to `TransactionRef`.
`inputs.ts` — add `ServiceProviderInput` (name required; `type` uses `ServiceProviderTypeEnum`; rest optional).
`mutations.ts` — add `createServiceProvider`/`updateServiceProvider`/`deleteServiceProvider` (mirror Partner block; create passes `ctx.actor`).

- [ ] **Step 6: Migrate + test**

Run: `npm run migrate -- --name add_service_provider && npm run test -- investor-partner-data-layer`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add prisma/ src/ && git commit -m "feat(crm): ServiceProvider model + CRUD (spec §3.7)"
```

---

### Task 4: `Document` model end-to-end

**Files:** `prisma/schema.prisma` (model + back-relations on `User`/`Transaction`/`Client`/`Investor`), `src/server/services/documents.ts`, `src/lib/schemas/document.ts`, `types.ts`, `inputs.ts`, `mutations.ts`.

**Interfaces:**
- Consumes: `DocumentTypeEnum`, `DocumentAccessLevelEnum`, `DocumentStatusEnum` (Task 1).
- Produces: `createDocument(input, actor)`, `updateDocument(id, input)`, `deleteDocument(id)`, `listDocuments(filter?)`, `getDocument(id)`.

- [ ] **Step 1: Write the failing test**

Add to `investor-partner-data-layer.smoke.test.ts`:
```typescript
  it("exposes Document CRUD + access level field", async () => {
    const { schema } = await import("@/graphql/schema");
    const mut = Object.keys(schema.getMutationType()?.getFields() ?? {});
    expect(mut).toContain("createDocument");
    const doc = schema.getTypeMap()["Document"] as { getFields?: () => Record<string, unknown> };
    expect(Object.keys(doc.getFields?.() ?? {})).toContain("accessLevel");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- investor-partner-data-layer`
Expected: FAIL — `createDocument` missing.

- [ ] **Step 3: Add the Prisma model + back-relations**

```prisma
model Document {
  id            String              @id @default(cuid())
  name          String
  type          DocumentType
  version       String?
  accessLevel   DocumentAccessLevel @default(Internal)
  status        DocumentStatus?
  fileUrl       String?
  uploadedById  String?
  uploadedBy    User?               @relation("DocumentUploadedBy", fields: [uploadedById], references: [id], onDelete: SetNull)
  uploadedAt    DateTime            @default(now())
  transactionId String?
  transaction   Transaction?        @relation(fields: [transactionId], references: [id], onDelete: SetNull)
  clientId      String?
  client        Client?             @relation(fields: [clientId], references: [id], onDelete: SetNull)
  investorId    String?
  investor      Investor?           @relation(fields: [investorId], references: [id], onDelete: SetNull)
  createdSource ActorSource         @default(HUMAN)
  createdAt     DateTime            @default(now())

  @@index([type])
  @@index([accessLevel])
  @@index([transactionId])
}
```
Add list back-relations: `User { documents Document[] @relation("DocumentUploadedBy") }`, `Transaction { documents Document[] }`, `Client { documents Document[] }`, `Investor { documents Document[] }`. Run `npm run generate`.

- [ ] **Step 4: Zod + service** — `src/lib/schemas/document.ts` (`name`, `type` required; `accessLevel`, `status`, `version`, `fileUrl`, and one of `transactionId`/`clientId`/`investorId` optional) and `src/server/services/documents.ts` (mirror Task 3 service shape: list/get/create/update/delete, `createdSource: actorSource(actor)`).

- [ ] **Step 5: GraphQL** — `DocumentRef` in `types.ts` (expose all scalars incl. `accessLevel` via `DocumentAccessLevelEnum`, FK scalars, and `uploadedBy`/`transaction`/`client`/`investor` relations); `DocumentInput` in `inputs.ts`; CRUD mutations in `mutations.ts`.

- [ ] **Step 6: Migrate + test**

Run: `npm run migrate -- --name add_document && npm run test -- investor-partner-data-layer`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add prisma/ src/ && git commit -m "feat(crm): Document model + access levels (spec §3.8)"
```

---

### Task 5: Extend `Investor` — classification, NDA status, profile fields

**Files:** `prisma/schema.prisma` (`model Investor`, `model Person` back-relation), `types.ts` (`InvestorRef`), `inputs.ts` (`InvestorInput`), `src/lib/schemas/investor.ts` (if present; else service is schema-light).

**Interfaces:**
- Consumes: `InvestorEngagementClassificationEnum`, `InvestorNdaStatusEnum` (Task 1).
- Produces: widened `Investor` type + input (consumed by existing `createInvestor`/`updateInvestor`).

- [ ] **Step 1: Write the failing test**

Add to `investor-partner-data-layer.smoke.test.ts`:
```typescript
  it("exposes investor classification + ndaStatus", async () => {
    const { schema } = await import("@/graphql/schema");
    const inv = schema.getTypeMap()["Investor"] as { getFields?: () => Record<string, unknown> };
    const fields = Object.keys(inv.getFields?.() ?? {});
    expect(fields).toContain("engagementClassification");
    expect(fields).toContain("ndaStatus");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- investor-partner-data-layer`
Expected: FAIL — `engagementClassification` not on Investor type.

- [ ] **Step 3: Add fields to `model Investor`**

```prisma
  engagementClassification InvestorEngagementClassification @default(Active)
  ndaStatus                InvestorNdaStatus                @default(None)
  shareholdingPreference    String?
  minRevenue                Decimal?  @db.Decimal(20, 2)
  minEbitda                 Decimal?  @db.Decimal(20, 2)
  minLoanBook               Decimal?  @db.Decimal(20, 2)
  pricingPreference         String?
  remainingInvestmentPeriod String?
  ddRequirements            String?
  icApprovalProcess         String?
  trackRecord               String?
  investmentMandate         String?
  nextActionDate            DateTime?
  feedback                  String?
  ssaRegionContactId        String?
  ssaRegionContact          Person?   @relation("InvestorSsaContact", fields: [ssaRegionContactId], references: [id], onDelete: SetNull)
```
Add to `model Person`: `ssaForInvestors Investor[] @relation("InvestorSsaContact")`. Add `@@index([engagementClassification])` to Investor. Run `npm run generate`.

- [ ] **Step 4: Expose in `InvestorRef`** (`types.ts`)

Add (with enum refs imported): `engagementClassification` (`InvestorEngagementClassificationEnum`), `ndaStatus` (`InvestorNdaStatusEnum`), the three `min*` as `t.float` nullable via `Number(...)`, the text fields via `t.exposeString(..., { nullable: true })`, `nextActionDate` as `DateTime` nullable, and `ssaRegionContact: t.relation("ssaRegionContact", { nullable: true })`.

- [ ] **Step 5: Extend `InvestorInput`** (`inputs.ts`)

Add matching optional fields: `engagementClassification`/`ndaStatus` (enum refs), `minRevenue`/`minEbitda`/`minLoanBook` (`t.float`), text fields (`t.string`), `nextActionDate` (`DateTime`), `ssaRegionContactId` (`t.id`). The existing `createInvestor`/`updateInvestor` services spread the input, so no service change is required **if** they spread; verify `src/server/services/investors.ts` create/update spread the whole input — if they whitelist fields, add the new keys there.

- [ ] **Step 6: Migrate + test**

Run: `npm run migrate -- --name extend_investor && npm run test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add prisma/ src/ && git commit -m "feat(crm): extend Investor with classification, NDA status, profile fields (spec §3.1)"
```

---

### Task 6: Extend `Partner` — advisor type, fee-sharing, internal-only

**Files:** `prisma/schema.prisma` (`model Partner`), `types.ts` (`PartnerRef`), `inputs.ts` (`PartnerInput`), `src/lib/schemas/partner.ts` (add fields), `src/server/services/partners.ts` (if create/update whitelist fields).

**Interfaces:**
- Consumes: `AdvisorTypeEnum`, `PartnerAgreementStatusEnum` (Task 1).

- [ ] **Step 1: Write the failing test**

Add to `investor-partner-data-layer.smoke.test.ts`:
```typescript
  it("exposes partner fee-sharing + internalOnly", async () => {
    const { schema } = await import("@/graphql/schema");
    const p = schema.getTypeMap()["Partner"] as { getFields?: () => Record<string, unknown> };
    const fields = Object.keys(p.getFields?.() ?? {});
    expect(fields).toContain("feeSharingAgreement");
    expect(fields).toContain("internalOnly");
    expect(fields).toContain("advisorType");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- investor-partner-data-layer`
Expected: FAIL.

- [ ] **Step 3: Add fields to `model Partner`**

```prisma
  advisorType            AdvisorType?
  organization           String?
  email                  String?
  phone                  String?
  feeSharingAgreement    Boolean                @default(false)
  feeSharingTerms        String?
  partnerAgreementStatus PartnerAgreementStatus @default(None)
  internalOnly           Boolean                @default(true)
```
Run `npm run generate`.

- [ ] **Step 4: Expose in `PartnerRef`** (`types.ts`): `advisorType` (`AdvisorTypeEnum`, nullable), `organization`/`email`/`phone`/`feeSharingTerms` (`t.exposeString` nullable), `feeSharingAgreement`/`internalOnly` (`t.exposeBoolean`), `partnerAgreementStatus` (`PartnerAgreementStatusEnum`). Import the two enum refs.

- [ ] **Step 5: Extend `PartnerInput`** (`inputs.ts`) with the matching optional fields, and add the keys to `partnerCreateSchema`/`partnerUpdateSchema` in `src/lib/schemas/partner.ts`. If `createPartner`/`updatePartner` in `partners.ts` whitelist fields rather than spreading, add the new keys.

- [ ] **Step 6: Migrate + test**

Run: `npm run migrate -- --name extend_partner && npm run test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add prisma/ src/ && git commit -m "feat(crm): partner fee-sharing, advisor type, internal-only (spec §3.6)"
```

---

### Task 7: Extend `Person` — primary + SSA contact flags

**Files:** `prisma/schema.prisma` (`model Person`), `types.ts` (`PersonRef`).

- [ ] **Step 1: Write the failing test**

Add to `investor-partner-data-layer.smoke.test.ts`:
```typescript
  it("exposes person primary/SSA flags", async () => {
    const { schema } = await import("@/graphql/schema");
    const p = schema.getTypeMap()["Person"] as { getFields?: () => Record<string, unknown> };
    const fields = Object.keys(p.getFields?.() ?? {});
    expect(fields).toContain("isPrimaryContact");
    expect(fields).toContain("isSSAContact");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- investor-partner-data-layer`
Expected: FAIL.

- [ ] **Step 3: Add fields + expose**

`model Person`:
```prisma
  isPrimaryContact Boolean @default(false)
  isSSAContact     Boolean @default(false)
```
(The `ssaForInvestors` back-relation was added in Task 5.) Run `npm run generate`.
`PersonRef` (`types.ts`): `isPrimaryContact: t.exposeBoolean("isPrimaryContact")`, `isSSAContact: t.exposeBoolean("isSSAContact")`.

- [ ] **Step 4: Migrate + test**

Run: `npm run migrate -- --name person_contact_flags && npm run test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add prisma/ src/ && git commit -m "feat(crm): person primary/SSA contact flags (spec §3.2)"
```

---

### Task 8: Seed backfill — populate the new fields

**Files:** `prisma/seed.ts`, `prisma/seed-data.json`.

**Goal:** the demo DB shows the new pipelines fully populated — engagements across the 12 stages with disbursement amounts, investors with classifications (incl. one Excluded + one Greylisted), partners with fee-sharing + internalOnly, a few ServiceProviders and Documents.

- [ ] **Step 1: Write the failing test**

Create `src/server/__tests__/seed-shape.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/db";

describe("seed backfill (requires seeded DB)", () => {
  it("has engagements spread across stages with disbursement", async () => {
    const withStage = await prisma.engagement.count({ where: { engagementStage: { not: "Shared" } } });
    expect(withStage).toBeGreaterThan(0);
    const disbursed = await prisma.engagement.count({ where: { amountDisbursed: { not: null } } });
    expect(disbursed).toBeGreaterThan(0);
  });
  it("has at least one excluded/greylisted investor and fee-sharing partner", async () => {
    expect(await prisma.investor.count({ where: { engagementClassification: { in: ["Excluded","Greylisted"] } } })).toBeGreaterThan(0);
    expect(await prisma.partner.count({ where: { feeSharingAgreement: true } })).toBeGreaterThan(0);
  });
  it("has service providers and documents", async () => {
    expect(await prisma.serviceProvider.count()).toBeGreaterThan(0);
    expect(await prisma.document.count()).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run db:reset && npm run test -- seed-shape`
Expected: FAIL — counts are 0 (seed doesn't populate new fields yet).

- [ ] **Step 3: Extend the seed**

In `prisma/seed.ts`: add fixed derivation tables (mirroring the existing `TXN_STAGE`/`INSTRUMENTS` arrays) for `ENGAGEMENT_STAGE`, `DISBURSEMENT`, and per-investor `CLASSIFICATION`; set `engagementStage`, `interestLevel`, `totalAmount`/`amountDisbursed`/`amountPending` (use `amountPending` from `@/server/domain/disbursement`), `dateReceived` + derived `year`/`quarter` when creating engagements. Set `engagementClassification` per investor (make one `Excluded`, one `Greylisted`). On partner creation set `feeSharingAgreement`, `feeSharingTerms`, `partnerAgreementStatus`, `internalOnly: true`, `advisorType`. Add a `prisma.serviceProvider.createMany` block (3–4 rows from the Law Firms tab) and a `prisma.document.createMany` block (NDA, Engagement Contract, Teaser, IM, Term Sheet across a couple of deals with varied `accessLevel`).

- [ ] **Step 4: Reseed + test**

Run: `npm run db:reset && npm run test -- seed-shape`
Expected: PASS (3 tests).

- [ ] **Step 5: Full suite + commit**

Run: `npm run test`
Expected: all PASS.
```bash
git add prisma/seed.ts prisma/seed-data.json src/server/__tests__/seed-shape.test.ts
git commit -m "feat(crm): seed backfill for engagement stages, classifications, providers, documents"
```

---

## Self-Review

- **Spec coverage:** §4 vocabularies → Task 1. §3.5 Engagement → Task 2. §3.7 ServiceProvider → Task 3. §3.8 Document → Task 4. §3.1 Investor → Task 5. §3.6 Partner → Task 6. §3.2 Person → Task 7. Seed/demo data → Task 8. The visibility engine (§11), portals, and switcher are explicitly Plan 2/3 — not gaps in this plan.
- **Type consistency:** `amountPending`/`deriveYearQuarter` defined in Task 2 are reused by name in Task 8. Enum refs created in Task 1 (`EngagementStageEnum` etc.) are consumed by Tasks 2–6 under the exact exported names. `ssaForInvestors` back-relation added in Task 5 is referenced by Task 7's note.
- **Placeholder scan:** Tasks 3–6 describe mirrored GraphQL wiring by reference to the concrete patterns already shown in Task 2/3 rather than re-pasting identical boilerplate; every new field/enum value is spelled out. The one judgment call (keeping legacy `Engagement.status` alongside `engagementStage`) is documented in Task 2 with its removal deferred to Plan 3.
- **Open risk:** if `investors.ts`/`partners.ts` create/update **whitelist** fields instead of spreading the input, Tasks 5/6 must add the new keys there — flagged inline in those tasks.
