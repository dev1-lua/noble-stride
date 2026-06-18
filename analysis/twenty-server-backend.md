# Twenty CRM — Backend / Data Engine Architecture Reference

A reference for a team building a bespoke, AI-accessible CRM "inspired by Twenty" on their own
stack. Focus: the **server** package only.

Root analyzed: `/Users/devashishthapliyal/Documents/work/Lua/NOBLESTRIDE/twenty-main/packages/twenty-server`

> Note: This is a recent Twenty version. The **standard objects no longer use TypeScript decorators**
> (`@WorkspaceEntity` etc. were removed). Standard objects are plain classes + a declarative metadata
> constant. The "metadata-as-code → DB column" story below reflects this current architecture.

---

## 7. Tech stack (read this first — it frames everything)

| Concern | Choice |
|---|---|
| Framework | **NestJS 11** (modules, DI, guards, `@nestjs/graphql` 13) |
| ORM | **TypeORM 11** (`@nestjs/typeorm`) — used two ways (see below) |
| Database | **PostgreSQL** (schema-per-workspace), plus **ClickHouse** for analytics/telemetry |
| Cache / queue | **Redis** via `cache-manager` and **BullMQ 5** (job queues) |
| GraphQL server | **GraphQL Yoga** (`@graphql-yoga/nestjs`) + `@graphql-tools/schema`; CRUD scaffolding via `@ptc-org/nestjs-query-*` |
| Auth | Passport + `@nestjs/jwt` (JWT), bcrypt, SAML/OAuth (`@node-saml`, `@azure/msal-node`) |
| AI | **Vercel AI SDK** (`ai` 6.x) with `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/google`, `@ai-sdk/mistral`, `@ai-sdk/xai`, Bedrock, Azure; `@e2b/code-interpreter` for sandboxed code |
| Telemetry | OpenTelemetry, Sentry, Prometheus |

Entry points: `src/main.ts` (HTTP API), `src/queue-worker/queue-worker` (BullMQ worker),
`src/command/command` (CLI / migrations). `src/app.module.ts` wires it together.

**Two TypeORM usages — critical to understand:**
1. **Core/metadata DB** (`core` + `public` schemas): normal TypeORM entities with `@Entity`/`@Column`
   decorators. This is where `objectMetadata`, `fieldMetadata`, `workspace`, `apiKey`, `webhook`,
   `agent`, etc. live.
2. **Per-workspace data** (`workspace_<id>` schemas): **dynamic** — there are no static entity
   classes for tenant data. TypeORM `EntitySchema` objects are built **at runtime from metadata**
   (the custom "twenty-orm" layer in `src/engine/twenty-orm`).

---

## 1. The metadata system (the heart of the design)

Twenty is a **metadata-driven, multi-tenant** CRM. Every workspace gets its **own Postgres schema**;
objects/fields are rows in shared `core` metadata tables; those rows are compiled into real tables
and columns inside each workspace schema.

### 1a. Where metadata is stored (core DB)

- **Object definition** — `src/engine/metadata-modules/object-metadata/object-metadata.entity.ts`
  Key columns: `nameSingular`, `namePlural`, `labelSingular`, `labelPlural`, `icon`,
  `dataSourceId`, `workspaceId`, `isCustom`, `isActive`, `isSystem`. One row per object **per
  workspace** (standard objects are duplicated into each workspace).
- **Field definition** — `src/engine/metadata-modules/field-metadata/field-metadata.entity.ts`
  ```ts
  @Column({ type: 'varchar' }) type: TFieldMetadataType;      // the FieldMetadataType enum value
  @Column({ nullable: false })  name: string;                  // column base name
  @Column('jsonb', { nullable: true }) options;                // SELECT/MULTI_SELECT/RATING options
  @Column('jsonb', { nullable: true }) settings;               // per-type config (decimals, format…)
  @Column({ type: 'jsonb', nullable: true }) defaultValue;
  @Column({ nullable: true, default: true }) isNullable;
  @Column({ type: 'uuid' }) relationTargetObjectMetadataId;    // RELATION/MORPH_RELATION only
  @Column({ type: 'uuid' }) relationTargetFieldMetadataId;     // the mirror field on the other side
  ```
  So a field is essentially **(objectId, name, type, options, settings, defaultValue, relation targets)**.

### 1b. How "metadata-as-code" standard objects are declared

Standard objects are plain TS classes extending `BaseWorkspaceEntity` (no decorators):
`src/modules/person/standard-objects/person.workspace-entity.ts`
```ts
export class PersonWorkspaceEntity extends BaseWorkspaceEntity {
  name: FullNameMetadata | null;
  emails: EmailsMetadata;
  company: EntityRelation<CompanyWorkspaceEntity> | null;
  companyId: string | null;          // FK column for the MANY_TO_ONE relation
  searchVector: string;              // TS_VECTOR
}
```
The **authoritative metadata** lives as a declarative constant in twenty-shared:
`packages/twenty-shared/src/metadata/constants/standard-object.constant.ts` — each object/field has a
stable `universalIdentifier` (UUID) used to keep metadata consistent across all workspaces and across
upgrades. Builder utils under
`src/engine/workspace-manager/twenty-standard-application/utils/**` turn these constants into
`FlatObjectMetadata` / `FlatFieldMetadata` and seed the core tables on workspace creation/upgrade.

### 1c. How metadata becomes a REAL Postgres column (the key pipeline)

1. **Per-workspace schema** — created once per workspace:
   `src/engine/workspace-datasource/utils/get-workspace-schema-name.util.ts`
   ```ts
   return `workspace_${uuidToBase36(workspaceId)}`;   // e.g. workspace_1a2b3c...
   ```
   `src/engine/workspace-datasource/workspace-datasource.service.ts` → `createWorkspaceDBSchema()`
   calls `queryRunner.createSchema(schemaName, true)`.

2. **Type mapping** — each `FieldMetadataType` → a Postgres column type:
   `src/engine/workspace-manager/workspace-migration/workspace-migration-runner/utils/field-metadata-type-to-column-type.util.ts`
   ```ts
   UUID→uuid, NUMERIC→numeric, NUMBER/POSITION→float, BOOLEAN→boolean,
   DATE_TIME→timestamptz, DATE→date, RATING/SELECT/MULTI_SELECT→enum,
   FILES/RAW_JSON→jsonb, TS_VECTOR→tsvector, (TEXT-like)→text
   // composite types are NOT here — they are flattened first (see §2)
   ```

3. **Migration runner** issues DDL — `…/workspace-migration/workspace-migration-runner/` (action
   handlers create table / add column / create enum type). The low-level DDL goes through
   `src/engine/twenty-orm/workspace-schema-manager/workspace-schema-manager.service.ts` (and its
   `enumManager` for `CREATE TYPE … AS ENUM`).

4. **Runtime entity schemas** — for querying, metadata is compiled into TypeORM `EntitySchema`
   objects on the fly: `src/engine/twenty-orm/factories/entity-schema-column.factory.ts`. Enum
   columns get their allowed values from `fieldMetadata.options`:
   ```ts
   if (isEnumFieldMetadataType(fieldMetadata.type)) {
     entitySchemaColumnMap[key].enum = fieldMetadata.options?.map(o => o.value);
   }
   ```

5. **Composite column naming** —
   `src/engine/metadata-modules/field-metadata/utils/compute-column-name.util.ts`:
   `computeCompositeColumnName(fieldName, prop)` → `fieldName + PascalCase(prop)`
   (e.g. CURRENCY field `amount` → columns `amountAmountMicros`, `amountCurrencyCode`).

**Takeaway for a bespoke build:** keep `objectMetadata`/`fieldMetadata` tables as the source of
truth; map field type → column type; flatten composites to multiple columns; run idempotent DDL into
a per-tenant schema; build query-time schemas dynamically from the same metadata.

---

## 2. The full field-type catalog (the "AI-accessible data types")

Enum: `packages/twenty-shared/src/types/FieldMetadataType.ts` (**25 values**). Composite type
definitions: `packages/twenty-shared/src/types/composite-types/*.composite-type.ts`.
Composites are **flattened** into multiple physical columns (`<field><PascalSubField>`).

### Simple (single-column) types

| Type | Postgres column | Notes / settings |
|---|---|---|
| `TEXT` | `text` | `settings.displayedMaxRows`. Most string sub-fields reuse this. |
| `NUMBER` | `float` | `settings`: `dataType` (float/int/bigint), `decimals`, `type` (number/percentage). |
| `NUMERIC` | `numeric` | Arbitrary precision (stored as string in JS). |
| `BOOLEAN` | `boolean` | |
| `DATE` | `date` | `settings.displayFormat`; default may be `'now'`. |
| `DATE_TIME` | `timestamptz(3)` | ms precision; default may be `'now'`. |
| `UUID` | `uuid` | default may be `'uuid'` (auto-gen). |
| `RAW_JSON` | `jsonb` | Arbitrary JSON. |
| `FILES` | `jsonb` | `settings.maxNumberOfValues`; array of file refs (not a composite). |
| `TS_VECTOR` | `tsvector` | Generated search column; `settings.asExpression`, `generatedType`. |
| `POSITION` | `float` | Row ordering (drag-and-drop). |
| `ARRAY` | `text` | Simple string array (distinct from MULTI_SELECT). |

### Enum types (options stored as JSONB on `fieldMetadata.options`)

Option shape: `{ id, value, label, color, position }` (color = a Twenty `TagColor`).
A Postgres **`enum` type** is created from the option `value`s.

| Type | Postgres column | Notes |
|---|---|---|
| `SELECT` | `enum` (single) | One value. |
| `MULTI_SELECT` | `enum[]` (array) | Multiple values; column built with `array: true`. |
| `RATING` | `enum` | Fixed values `RATING_1..RATING_5`. |

### Composite types (flattened to multiple columns)

| Type | Sub-columns (suffixes) | Underlying types |
|---|---|---|
| `CURRENCY` | `AmountMicros`, `CurrencyCode` | numeric, text |
| `FULL_NAME` | `FirstName`, `LastName` | text, text |
| `ADDRESS` | `AddressStreet1/2`, `AddressCity`, `AddressPostcode`, `AddressState`, `AddressCountry`, `AddressLat`, `AddressLng` | text ×6, numeric ×2 |
| `EMAILS` | `PrimaryEmail`, `AdditionalEmails` | text (unique-constraint candidate), jsonb array |
| `PHONES` | `PrimaryPhoneNumber`, `PrimaryPhoneCountryCode`, `PrimaryPhoneCallingCode`, `AdditionalPhones` | text ×3, jsonb array |
| `LINKS` | `PrimaryLinkLabel`, `PrimaryLinkUrl`, `SecondaryLinks` | text, text, jsonb array |
| `RICH_TEXT` | `Blocknote`, `Markdown` | text, text (BlockNote JSON + markdown mirror) |
| `ACTOR` | `Source`, `WorkspaceMemberId`, `Name`, `Context` | enum (EMAIL/CALENDAR/WORKFLOW/AGENT/API/IMPORT/MANUAL/SYSTEM/WEBHOOK/APPLICATION), uuid, text, jsonb |

`ACTOR` is Twenty's **audit-provenance** type — every record carries `createdBy`/`updatedBy` of type
ACTOR, recording *who/what* changed it (including `AGENT`, `API`, `WORKFLOW`, `WEBHOOK`). This is
extremely useful for an AI-driven CRM and worth copying.

### Relation types

| Type | Storage |
|---|---|
| `RELATION` | `MANY_TO_ONE`: a `<field>Id` uuid FK column on this side. `ONE_TO_MANY`: no column (inverse only). Relation metadata holds `relationTargetObjectMetadataId` + `relationTargetFieldMetadataId` (mirror field). `settings`: `relationType`, `onDelete` (CASCADE/RESTRICT/SET_NULL/NO_ACTION), `joinColumnName`. |
| `MORPH_RELATION` | Polymorphic — one `<target>Id` FK column per possible target object (e.g. `targetPersonId`, `targetCompanyId`). Grouped by `morphId`. Used by Task/Note targets and Attachment. |

Join-column naming util:
`src/engine/metadata-modules/field-metadata/utils/compute-morph-or-relation-field-join-column-name.util.ts`
(`<fieldName>` → `<fieldName>Id`).

Supporting files: `FieldMetadataOptions.ts`, `FieldMetadataSettings.ts`, `FieldMetadataDefaultValue.ts`
(all under `packages/twenty-shared/src/types/`).

---

## 3. Standard / seeded objects and their relations (reference patterns)

Defined under `src/modules/<domain>/standard-objects/*.workspace-entity.ts`. All extend
`BaseWorkspaceEntity` (`id` uuid, `createdAt`, `updatedAt`, `deletedAt` — soft delete is standard).

| Object | Key fields | Relations |
|---|---|---|
| **Person** | name(FULL_NAME), emails(EMAILS), phones(PHONES), jobTitle, linkedinLink(LINKS), avatarFile | →Company (MANY_TO_ONE `companyId`); ←Opportunity (pointOfContact); has Task/Note targets, attachments, messageParticipants, calendarEventParticipants, timelineActivities |
| **Company** | name, domainName(LINKS), annualRevenue(CURRENCY), address(ADDRESS), employees | →WorkspaceMember (accountOwner); ←people; opportunities; task/note targets; attachments; timelineActivities |
| **Opportunity** | name, amount(CURRENCY), closeDate, stage(SELECT) | →Person(pointOfContact), →Company, →WorkspaceMember(owner); task/note targets; attachments |
| **Task** | title, bodyV2(RICH_TEXT), dueAt, status(SELECT: TODO/IN_PROGRESS/DONE) | →WorkspaceMember(assignee); taskTargets (MORPH to person/company/opportunity); attachments |
| **Note** | title, bodyV2(RICH_TEXT) | noteTargets (MORPH); attachments |
| **Attachment** | name, file, fileCategory | MORPH-style `targetTask/Note/Person/Company/Opportunity/...Id` FKs |
| **WorkspaceMember** | name(FULL_NAME), userEmail, locale, timeZone, color/date/number formats | inverse-owns: assignedTasks, ownedOpportunities, accountOwnerForCompanies; messageParticipants |
| **MessageThread / Message / MessageParticipant** | subject / text+headers / role | thread →messages →participants |
| **Timeline activities, Favorites, Views, Calendar events** | — | system/meta objects |

**Target/Join pattern worth copying:** Task↔Person/Company/Opportunity is not a direct FK; it uses a
`taskTarget` junction object with morph relations, so a task can attach to any record type. Same for
notes. Attachment instead uses one nullable FK per target type.

Stable IDs: `packages/twenty-shared/src/metadata/constants/standard-object.constant.ts`
(`universalIdentifier` per object/field). The seeding/sync lives under
`src/engine/workspace-manager/twenty-standard-application/**`.

---

## 4. API generation — how an external (Lua) agent reads/writes

Twenty exposes **three** surfaces. All under `src/engine/api/`.

### 4a. GraphQL **data API** (per-workspace records)

Schema is **generated at runtime from metadata** — custom objects/fields appear in the API instantly.
- Factory: `src/engine/api/graphql/workspace-schema.factory.ts` (`createGraphQLSchema()`).
- SDL: `…/workspace-graphql-schema-sdl/workspace-graphql-schema-sdl.service.ts`.
- Type/query/mutation generators: `…/workspace-schema-builder/graphql-type-generators/`
  - `query-type.generator.ts` → `findMany`, `findOne`, `findDuplicates`, `groupBy`
  - `mutation-type.generator.ts` → `createOne/createMany`, `updateOne/updateMany`,
    `deleteOne/deleteMany`, `destroyOne/Many` (hard), `restoreOne/Many`, `mergeMany`
- Resolvers auto-built: `…/workspace-resolver-builder/workspace-resolver.factory.ts`.

Example (Relay-style connections):
```graphql
query { companies(first: 10, filter: {name: {ilike: "%Acme%"}}) {
  edges { node { id name } } pageInfo { hasNextPage endCursor } } }
mutation { createCompany(input: { name: "Acme" }) { id } }
```

### 4b. GraphQL **metadata API** (define schema at runtime)

Separate schema for *managing the data model* (create objects/fields). This is the
"object/field-as-API" capability.
- Module: `src/engine/api/graphql/metadata-graphql-api.module.ts`
- Resolvers: `src/engine/metadata-modules/object-metadata/object-metadata.resolver.ts`,
  `…/field-metadata/field-metadata.resolver.ts`
- Mutations: `createOneObject`, `updateOneObject`, `deleteOneObject`,
  `createOneFieldMetadata`, `updateOneFieldMetadata`, `deleteOneFieldMetadata`.
- Guarded by `SettingsPermissionGuard(PermissionFlagType.DATA_MODEL)` (admin only).

### 4c. REST API (`/rest/*`)

- Controller: `src/engine/api/rest/core/controllers/rest-api-core.controller.ts`
- Service/handlers: `src/engine/api/rest/core/services/rest-api-core.service.ts` (+ handler classes).

| Method | Path | Action |
|---|---|---|
| GET | `/rest/{objectNamePlural}` | list (filter, order, pagination) |
| GET | `/rest/{objectNamePlural}/{id}` | find one |
| GET | `/rest/{objectNamePlural}/groupBy` | aggregate |
| POST | `/rest/{objectNamePlural}` | create one |
| POST | `/rest/batch/{objectNamePlural}` | create many |
| PATCH | `/rest/{objectNamePlural}/{id}` | update |
| DELETE | `/rest/{objectNamePlural}/{id}` | soft delete |
| PATCH | `/rest/restore/{objectNamePlural}/{id}` | restore |

REST is a thin adapter over the same metadata/query layer as GraphQL.

### 4d. Authentication & authorization

- **API keys** — `src/engine/core-modules/api-key/api-key.entity.ts`
  (`name`, `expiresAt`, `revokedAt`, `workspaceId`). Created via GraphQL `createApiKey` and assigned a
  **role** (`api-key-role.service.ts`) → role-based record permissions (no granular OAuth scopes).
- **Token** — `api-key.service.ts#generateApiKeyToken` mints a JWT:
  `{ sub: workspaceId, type: 'API_KEY', workspaceId, jti: apiKeyId }`.
- **Header** — `Authorization: Bearer <jwt>`.
- **Verification** — Passport strategy `src/engine/core-modules/auth/strategies/jwt.auth.strategy.ts`
  + `src/engine/core-modules/jwt/services/jwt-wrapper.service.ts` (checks signature, expiry, and
  `revokedAt`); resolves an `ApiKeyWorkspaceAuthContext` (workspace + apiKey). Guards:
  `src/engine/guards/jwt-auth.guard.ts`, `…/workspace-auth.guard.ts`.
- The JWT `workspaceId` is what routes a request to the correct `workspace_<id>` Postgres schema.

**Integration recipe for Lua:** create an API key (admin) → store the JWT → send
`Authorization: Bearer <jwt>` → query/mutate via `/rest/...` or GraphQL. No per-request workspace
selection needed; the token carries it.

---

## 5. Webhooks (sync record changes into an external semantic index)

This is the cleanest path for an external semantic index.

- **Webhook entity** — `src/engine/metadata-modules/webhook/entities/webhook.entity.ts`:
  `targetUrl`, `operations: string[]` (filters like `company.created`, `*.updated`, `*.*`), `secret`.
- **Event source** — record CRUD goes through the twenty-orm/query layer which emits batched domain
  events (`DatabaseEventAction`: CREATED/UPDATED/DELETED/DESTROYED/RESTORED/UPSERTED) via
  `src/engine/workspace-event-emitter/workspace-event-emitter.ts`.
- **Event → webhook bridge** —
  `src/engine/api/graphql/workspace-query-runner/listeners/entity-events-to-db.listener.ts`
  listens with `@OnDatabaseBatchEvent('*', action)` and enqueues a job:
  ```ts
  this.webhookQueueService.add(CallWebhookJobsJob.name, batchEventForWebhook, { retryLimit: 3 });
  ```
- **Job queue (BullMQ on Redis)** — two stages, both `@Processor(MessageQueue.webhookQueue)`:
  1. `…/webhook/jobs/call-webhook-jobs.job.ts` — expands `company.created` to matching operation
     patterns (`company.created`, `*.created`, `company.*`, `*.*`), loads matching webhooks, chunks.
  2. `…/webhook/jobs/call-webhook.job.ts` — does the **HTTP POST** with HMAC signing headers:
     `X-Twenty-Webhook-Signature` (HMAC-SHA256 of payload+timestamp with the webhook `secret`),
     `X-Twenty-Webhook-Timestamp`, `X-Twenty-Webhook-Nonce`. 5s timeout, SSRF-protected client, 3 retries.
- **Payload shape** — `…/webhook/types/webhook-job-data.type.ts`:
  `{ eventName, workspaceId, objectMetadata:{id,nameSingular}, record, updatedFields?, eventDate, ... }`.
- **vs GraphQL subscriptions** — Twenty also publishes real-time events over WebSocket
  (`ObjectRecordEventPublisher`) for live UI; webhooks are the async, durable, external-push path.
  Both fire from the same listener.

**For Lua's index:** register one webhook with `operations: ["*.*"]`, verify the HMAC, upsert `record`
into your vector store, use `updatedFields` to do partial re-embedding.

---

## 6. Built-in AI / agent features (they already exist — map only)

Twenty already ships a substantial AI layer. Relevant for "don't reinvent" decisions.

- **Agent entity** — `src/engine/metadata-modules/ai/ai-agent/entities/agent.entity.ts`
  (`name`, `prompt`, `modelId` (FAST/SMART role), `responseFormat`, `modelConfiguration` jsonb, `isCustom`).
- **Agent executor** — `…/ai/ai-agent-execution/services/agent-async-executor.service.ts`
  uses Vercel AI SDK `generateText`, wires tools via the tool registry, tracks token/credit billing.
- **AI chat** — `…/ai/ai-chat/` (`AgentChatThreadEntity`, `AgentTurnEntity`, `AgentMessageEntity`,
  `AgentMessagePartEntity`), streaming service for conversational assistant.
- **Model registry** — `…/ai/ai-models/services/ai-model-registry.service.ts` builds `LanguageModel`s
  from provider SDKs; roles `FAST`/`SMART` (`…/ai-model-role.enum.ts`).
- **Tool registry (agent capabilities)** — `src/engine/core-modules/tool-provider/` with providers:
  `database-tool.provider.ts` (record CRUD), `metadata-tool.provider.ts`, `workflow-tool.provider.ts`,
  `webhook-tool.provider.ts`, `view-tool.provider.ts`, `logic-function-tool.provider.ts`,
  `dashboard-tool.provider.ts`. Agents call CRM operations through these.
- **MCP server** — Twenty **exposes an MCP endpoint** (`POST /mcp`, JSON-RPC 2.0 + SSE):
  `src/engine/api/mcp/controllers/mcp-core.controller.ts`, `…/mcp/mcp.module.ts`, OAuth2.1/PKCE auth.
  An external AI client (incl. Lua) could speak MCP directly to read metadata + invoke tools.
- **Skills** — `src/engine/metadata-modules/skill/entities/skill.entity.ts` (reusable code/skills).
- **Workflow engine** — `src/modules/workflow/`:
  - Triggers (`…/workflow-trigger/types/workflow-trigger.type.ts`): `DATABASE_EVENT`, `MANUAL`, `CRON`, `WEBHOOK`.
  - Action types (`packages/twenty-shared/src/workflow/types/WorkflowActionType.ts`): `CODE`,
    `LOGIC_FUNCTION`, `SEND_EMAIL`/`DRAFT_EMAIL`, `CREATE/UPDATE/DELETE/UPSERT_RECORD`, `FIND_RECORDS`,
    `FORM`, `FILTER`, `IF_ELSE`, `HTTP_REQUEST`, **`AI_AGENT`**, `ITERATOR`, `DELAY`.
  - Executor: `…/workflow-executor/workspace-services/workflow-executor.workspace-service.ts`;
    AI step: `…/workflow-actions/ai-agent/ai-agent.workflow-action.ts`.
  - `Workflow`/`WorkflowVersion`/`WorkflowRun` are standard objects, code runs in E2B sandbox.

---

## Reusable-pattern checklist (for a from-scratch build)

1. **Metadata tables as source of truth** (`objectMetadata`, `fieldMetadata`) + a typed
   `FieldType` enum mapped to column types; composites flatten to multiple columns.
2. **Schema-per-tenant** (`workspace_<id>`) with an idempotent migration runner generating DDL;
   build query-time schemas dynamically from metadata so the API auto-updates.
3. **Auto-generated API** (GraphQL + REST) derived from metadata, so new objects/fields are queryable
   immediately; a separate **metadata API** to define schema at runtime.
4. **ACTOR provenance** on every record (`createdBy`/`updatedBy` incl. `AGENT`/`API` sources) — ideal
   for auditing AI mutations.
5. **Soft delete + restore** baked into the base entity.
6. **Event → BullMQ → signed-webhook** pipeline for external sync (HMAC, retries, batch).
7. **API-key JWT carrying `workspaceId`** for stateless external auth + role-based permissions.
8. **MCP endpoint + tool-provider registry** if AI agents should act on the CRM natively.
