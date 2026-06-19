# CRUD System — Design Spec

**Date:** 2026-06-19
**Status:** Approved (design) — pending spec review
**Branch:** build/demo-foundation

## 1. Goal & context

The bespoke CRM (`noblestride-crm/`) is read-only beyond three stage/log mutations.
Every "+ New" / "Edit" / "Delete" affordance is disabled. This spec defines a
**Create / Edit / guarded-Delete** system for the five list entities, presented in a
right-side slide-over drawer, built so the **same write path serves both the human UI
and AI tools** through one GraphQL seam.

Closes gap #1 from the requirements analysis (no in-app CRUD).

### Decisions (locked via brainstorming)
- **Entities:** Mandate, Transaction, Investor, Client, Partner.
- **Operations:** Create, Update, guarded Delete. **No** import/export.
- **Form UX:** right-side slide-over drawer.
- **Scope:** core scalar + relation fields only. **No** nested contacts (Person).
- **Architecture:** Hybrid — shared plumbing (drawer, field components, form hook,
  delete-confirm) + **per-entity** Zod schemas and typed Pothos mutations.
- **AI provenance:** add `createdSource: ActorSource @default(HUMAN)` to the five
  entity models; mutations stamp it from `ctx.actor`.

### Out of scope (explicit)
Nested contacts (Person), import/export, auth/role enforcement, CRUD for
Person/Task/Activity/User, optimistic UI (we use `router.refresh()`),
editing pipeline `stage` (stays under the existing stage mutations — see §6).

## 2. Architecture

```
Zod schema (src/lib/schemas/*)          ← single source of truth, isomorphic
        │ used by
        ├─ client drawer (field validation + submit guard)
        └─ server service (re-parse before Prisma write)

Service fn (src/server/services/*)  →  Pothos mutation (src/graphql/*)  →  urql in drawer  →  router.refresh()
```

Three consumers share one contract: the human form, the GraphQL API, and a future
Lua/MCP `create_X` tool (Lua tools use Zod `inputSchema`, so the schema shape ports
directly — see `docs/agents/03-creating-tools.md`).

### Layers
1. **Zod schemas** — `src/lib/schemas/{mandate,transaction,investor,client,partner}.ts`.
   Pure (no Prisma import). Each exports a `create` schema and `update = create.partial()`,
   plus inferred TS types. Enum fields use `z.enum([...])`/`z.array(z.enum([...]))` mirroring
   the Prisma enums; money fields are `z.number()`.
2. **Services** — extend `src/server/services/*.ts` with `createX(input, actor)`,
   `updateX(id, input)`, `deleteX(id)`. Each: `schema.parse(input)` → map to Prisma →
   write. `createX` sets `createdSource` from `actor`. `deleteX` runs the guard (§5).
3. **GraphQL** — Pothos `inputType` per entity in a new `src/graphql/inputs.ts`;
   15 mutations (5 × create/update/delete) in `src/graphql/mutations.ts`, thin resolvers
   passing `ctx.actor` into the create services. Enum-array args reuse the Pothos enums
   already registered in `builder.ts`. Money exposed as `Float` (matching `types.ts`).
4. **Client plumbing** (built once):
   - `src/components/ui/drawer.tsx` — right slide-over (overlay, ESC-close, `motion`
     slide-in, header/body/footer). Consistent with the premium animation pass.
   - `src/components/ui/fields.tsx` — `TextField`, `TextAreaField`, `NumberField`,
     `MoneyField`, `SelectField` (single enum/relation), `MultiSelectField` (enum arrays),
     `DateField`, `CheckboxField`. Each = label + control + inline error; wraps existing
     `Input`/`Select`.
   - `src/components/ui/use-entity-form.ts` — hook: holds value state, `safeParse` for
     field errors, fires the urql mutation, on success `router.refresh()` + close; exposes
     `pending`/`error`. Generic over the entity value type.
   - `src/components/crm/delete-confirm.tsx` — confirm modal; surfaces the guard message
     when a delete is blocked.
5. **Per-entity drawers** — `src/components/crm/{mandate,transaction,investor,client,partner}-form-drawer.tsx`.
   Compose field components for that entity's fields (§4), bound to its Zod schema and
   create/update mutations. One component serves create (empty) and edit (prefilled `initial`).

### Wiring
- **List pages** (mandates, transactions, investors, partners): enable the disabled
  "+ New" button → opens the create drawer. The RSC page loads relation `SelectOption[]`
  (clients, users, partners, mandates) and passes them down — the existing
  `LogEngagementDialog` pattern.
- **Detail pages** (all five): add **Edit** (prefilled drawer) and **Delete**
  (DeleteConfirm). After a successful delete, `router.push(listRoute)` + refresh.
- **Client entry point (open item, see §8):** Client has **no list page** today, so its
  create is surfaced via a "+ New Client" affordance inside the Client relation picker in
  the Mandate/Transaction drawers (create-and-select inline) and Edit/Delete on the client
  detail page.

## 3. Data flow

- **Create:** "+ New" (RSC already has relation options) → empty drawer → fill →
  `useEntityForm` Zod-validates → urql `createX` → resolver passes `ctx.actor` → service
  re-validates + Prisma `create` (`createdSource` stamped) → `router.refresh()` re-renders
  the RSC list with the new row → drawer closes.
- **Edit:** detail "Edit" → drawer prefilled from current record → `updateX` (no
  `createdSource` change) → refresh.
- **Delete:** detail "Delete" → DeleteConfirm → `deleteX` → guard (§5) → block (typed error
  → message) or hard-delete → on success route to list + refresh.

## 4. Per-entity fields (from `prisma/schema.prisma`)

Required = enforced by Zod + GraphQL non-null. `[]` = enum array (MultiSelect). `→` = relation
(SelectField of existing records). `stage`/`stageEnteredAt`/`closedAt` are **excluded** (see §6).

- **Investor** — *required:* `name`, `investorType`. *optional:* `website`, `status`,
  `sectorFocus[]`, `geographicFocus[]`, `instruments[]`, `investmentStages[]`, `aum`,
  `ticketMin`, `ticketMax`, `currency`(default USD), `targetIrr`, `countryRestrictions`,
  `esgFocus`, `decisionProcess`, `notes`.
- **Client** — *required:* `name`. *optional:* `yearFounded`, `hqCity`, `countries[]`,
  `website`, `sector[]`, `coreProduct`, `description`, `founders`, `founderGender`,
  `revenueLastYear`, `revenueForecast`, `currency`, `profitable`, `existingInvestors`,
  `source`, `pitchDeckUrl`.
- **Mandate** — *required:* `name`, `clientId →Client`. *optional:* `dealSize`, `currency`,
  `sector[]`, `source`, `dateOpened`, `ndaStatus`, `ndaSentDate`, `ndaSignedDate`, `eaStatus`,
  `eaSentDate`, `eaSignedDate`, `nextAction`, `notes`, `leadId →User`, `referredById →Partner`.
- **Transaction** — *required:* `name`, `clientId →Client`. *optional:* `dealType`,
  `instrument[]`, `targetRaise`, `currency`, `sector[]`, `dateOpened`, `mandateId →Mandate`,
  `ownerId →User`.
- **Partner** — *required:* `name`. *optional:* `partnerType`, `profile`, `status`(default
  Active), `location`, `amount`, `currency`.

## 5. Delete-guard policy

`deleteX` counts blocking dependents; if > 0 it throws a typed `CrudError` with counts
(e.g. "Cannot delete: 3 transactions reference this mandate"), surfaced in DeleteConfirm.
Otherwise hard-delete. Auxiliary relations (`contacts`/Person, `activities`, `tasks` — all
`onDelete: SetNull`) do **not** block.

| Entity | Blocks delete when… | Rationale |
|---|---|---|
| **Investor** | `engagements > 0` | Engagement FK is `Cascade` — would silently delete deal engagements |
| **Client** | `mandates > 0` **or** `transactions > 0` | DB `onDelete: Restrict` — Prisma would throw anyway; we pre-check for a friendly message |
| **Mandate** | `transactions > 0` | Would detach (`SetNull`) live transactions from their mandate |
| **Transaction** | `engagements > 0` | Engagement FK is `Cascade` — would silently delete engagements |
| **Partner** | `referredMandates > 0` | Would detach (`SetNull`) referral provenance |

## 6. Stage / managed fields

`stage`, `stageEnteredAt`, and `closedAt` are **not** editable through these forms. Stage
transitions remain the responsibility of the existing `updateMandateStage` /
`updateTransactionStage` mutations (Kanban drag + `restage-select`), which already reset
`stageEnteredAt` and set/clear `closedAt`. On **create**, `stage` takes its Prisma default
(`NewLead` / `DealPreparation`). This keeps a single source of truth for stage logic.

## 7. Provenance, validation, errors, auth

- **Provenance:** add `createdSource ActorSource @default(HUMAN)` to Mandate, Transaction,
  Investor, Client, Partner (one Prisma migration). `createX` sets it from `ctx.actor.type`
  (`AGENT`/`API`/`HUMAN`). `updateX` leaves it untouched. Surface it in GraphQL `types.ts`
  so AI-created records are queryable/filterable.
- **Validation:** client `safeParse` → inline per-field errors + submit disabled until
  required present; server re-parses with the same schema (never trust the client) → throws
  on invalid → urql `result.error` → drawer top-level message.
- **Auth:** unchanged — mutations stay open like the existing three. `ctx.actor` is read for
  provenance only, not enforcement. (Production gating is a separate pass.)

## 8. Open item for review

**Client has no list page.** The agreed scope was "all five list entities," but Client is
reachable only via `/clients/[id]`. This spec surfaces Client create via the relation picker
(create-and-select) + detail Edit/Delete, and does **not** add a clients list page. If a
browseable clients list is wanted, that's a small add — flag it during spec review.

## 9. Testing

Vitest is configured (`src/server/__tests__`, `src/graphql/__tests__`, `src/lib/__tests__`).

- **Services:** each `createX` (valid → row + correct `createdSource`), `updateX` (partial
  update), `deleteX` (deletes when no dependents; **throws when dependents exist** — one test
  per guard row in §5).
- **Schemas:** accept a valid payload; reject missing-required and bad-enum cases.
- **Provenance:** `createX` with an `AGENT` actor writes `createdSource = AGENT`.
- Light/optional component tests for the drawer + a representative form.

## 10. File-level plan

- `prisma/schema.prisma` — add `createdSource` to the 5 entity models; new migration.
- `src/lib/schemas/{mandate,transaction,investor,client,partner}.ts` — Zod create/update + types.
- `src/server/services/{mandates,transactions,investors,clients,partners}.ts` — add create/update/delete (+ guard).
- `src/graphql/inputs.ts` — Pothos input types per entity.
- `src/graphql/mutations.ts` — 15 new mutations.
- `src/graphql/types.ts` — expose `createdSource`.
- `src/components/ui/{drawer.tsx,fields.tsx,use-entity-form.ts}` + barrel export in `index.ts`.
- `src/components/crm/delete-confirm.tsx`.
- `src/components/crm/{mandate,transaction,investor,client,partner}-form-drawer.tsx`.
- List pages (mandates/transactions/investors/partners) — enable "+ New".
- Detail pages (all five) — add Edit/Delete; load relation options.
