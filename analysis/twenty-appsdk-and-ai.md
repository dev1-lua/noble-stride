# Twenty CRM — Application-as-Code SDK & Native AI/Agent Features

Reference for a team building a bespoke CRM. Documents how Twenty models a CRM
"application" as TypeScript code, how that code is synced into a running server,
how custom UI panels are authored/rendered, and what native AI/agent/workflow
machinery ships in the monorepo. All file paths are absolute.

Validated against: `twenty-sdk@2.13.0` (SDK) and the example consuming app
`/Users/devashishthapliyal/Documents/work/Lua/NOBLESTRIDE/my-twenty-app`.

---

## 0. The mental model

Twenty has two layers:

1. **The product** — a multi-tenant NestJS + React CRM (`twenty-server`,
   `twenty-front`) backed by a *metadata engine*. Objects, fields, views, roles
   etc. are not hardcoded; they are rows in metadata tables that the server reads
   to generate GraphQL schema and UI at runtime.

2. **The "application-as-code" SDK** — a way to author that metadata as
   declarative TypeScript files in a separate npm package (the "app"), then
   **sync** them into a workspace's metadata over an authenticated API. An "app"
   is a versioned bundle of object/field/view/role/menu/logic-function/agent/skill
   /front-component definitions, each keyed by a stable `universalIdentifier` UUID.

So building "an app" = writing `define*()` calls that produce a **manifest**, then
running `yarn twenty dev` to push that manifest to the server, which diffs it
against existing metadata and applies create/update/delete actions.

Key packages:

- `packages/twenty-sdk` — the `define*` API, the CLI (`yarn twenty …`), the
  manifest builder, the front-component bundler.
- `packages/twenty-shared/src/application` — the canonical `*Manifest` TypeScript
  shapes that `define*` configs map onto (the SDK `*Config` types are thin
  wrappers over these).
- `packages/twenty-front-component-renderer` — the host/worker runtime that
  renders custom React panels inside the Twenty UI.
- `packages/create-twenty-app` — scaffolder (`npm create twenty-app`).
- `packages/twenty-apps` — first-party example apps.
- `packages/twenty-claude-skills`, `packages/twenty-codex-plugin` — AI-assistant
  tooling for *authoring* Twenty apps.

---

## 1. The `define*` API surface

All `define*` functions are exported from one barrel:
`/Users/devashishthapliyal/Documents/work/Lua/NOBLESTRIDE/twenty-main/packages/twenty-sdk/src/sdk/define/index.ts`

```ts
export { defineObject }            from '@/sdk/define/objects/define-object';
export { defineField }            from '@/sdk/define/fields/define-field';
export { defineView }             from '@/sdk/define/views/define-view';
export { defineViewField }        from '@/sdk/define/view-fields/define-view-field';
export { defineNavigationMenuItem } from '@/sdk/define/navigation-menu-items/define-navigation-menu-item';
export { defineRole }             from '@/sdk/define/roles/define-role';
export { defineApplicationRole }  from '@/sdk/define/roles/define-application-role';
export { defineApplication }      from '@/sdk/define/application/define-application';
export { defineFrontComponent }   from '@/sdk/define/front-component/define-front-component';
export { definePageLayout }       from '@/sdk/define/page-layouts/define-page-layout';
export { definePageLayoutTab }    from '@/sdk/define/page-layouts/define-page-layout-tab';
export { defineCommandMenuItem }  from '@/sdk/define/command-menu-items/define-command-menu-item';
export { defineIndex }            from '@/sdk/define/indexes/define-index';
export { definePermissionFlag }   from '@/sdk/define/permission-flags/define-permission-flag';
export { defineConnectionProvider } from '@/sdk/define/connection-providers/define-connection-provider';
export { defineLogicFunction }    from '@/sdk/define/logic-functions/define-logic-function';
export { definePostInstallLogicFunction } / { definePreInstallLogicFunction };
export { defineAgent }            from '@/sdk/define/agents/define-agent';
export { defineSkill }            from '@/sdk/define/skills/define-skill';
// plus enums: FieldType, RelationType, OnDeleteAction, ViewType, NavigationMenuItemType, …
```

### 1.1 The uniform pattern

Every `define*` is `DefineEntity<TManifest>`: it takes a config object, runs
**validation only** (no side effects), and returns a `ValidationResult`
wrapping the original config plus `errors[]`/`warnings[]`. The config is later
collected by the manifest builder. Every entity carries a `universalIdentifier`
(see §2). Example — `defineObject`
(`…/twenty-sdk/src/sdk/define/objects/define-object.ts`):

```ts
export const defineObject: DefineEntity<ObjectConfig> = (config) => {
  const errors = [];
  if (!config.universalIdentifier) errors.push('Object must have a universalIdentifier');
  if (!config.nameSingular)        errors.push('Object must have a nameSingular');
  if (!config.namePlural)          errors.push('Object must have a namePlural');
  // …labelSingular, labelPlural…
  const fieldErrors = validateFields(config.fields);
  errors.push(...fieldErrors);
  // labelIdentifier must reference a field in fields[]
  const warnings = getFieldDefaultValueWarnings(config.fields);
  return createValidationResult({ config, errors, warnings });
};
```

`defineView` (`…/define/views/define-view.ts`) validates that every nested
viewField/filter/group/sort has a `universalIdentifier` and a
`fieldMetadataUniversalIdentifier`, and that sort directions are `ASC`/`DESC`.

`defineFrontComponent` (`…/define/front-component/define-front-component.ts`)
requires `universalIdentifier` and that `component` is a function (a React
component).

`defineAgent` (`…/define/agents/define-agent.ts`) requires
`universalIdentifier`, `name`, `label`, `prompt`; warns if `responseFormat` is
omitted (defaults to `{ type: 'text' }`).

### 1.2 Exact TypeScript shapes

The SDK `*Config` types are `twenty-shared/application` `*Manifest` types,
usually with `universalIdentifier` auto-derivable fields made optional.

**Object** — `ObjectManifest`
(`/Users/devashishthapliyal/Documents/work/Lua/NOBLESTRIDE/twenty-main/packages/twenty-shared/src/application/objectManifestType.ts`):

```ts
export type ObjectManifest = SyncableEntityOptions & {   // { universalIdentifier: string }
  nameSingular: string;
  namePlural: string;
  labelSingular: string;
  labelPlural: string;
  description?: string;
  icon?: string;                 // Tabler icon name string, e.g. 'IconBuilding'
  isSearchable?: boolean;
  isUICreatable?: boolean;       // false ⇒ no "create" affordance in generic UI
  isUIEditable?: boolean;
  fields: ObjectFieldManifest[]; // scalar/composite fields defined INLINE
  labelIdentifierFieldMetadataUniversalIdentifier: string;
};
```

**Field** — `FieldManifest` is a discriminated union of `RegularFieldManifest`
and `RelationFieldManifest`
(`/Users/devashishthapliyal/Documents/work/Lua/NOBLESTRIDE/twenty-main/packages/twenty-shared/src/application/fieldManifestType.ts`):

```ts
export type RegularFieldManifest<T> = SyncableEntityOptions & {
  type: T;                       // FieldType.TEXT | NUMBER | SELECT | CURRENCY | …
  name: string;
  label: string;
  description?: string;
  icon?: string;
  defaultValue?: FieldMetadataDefaultValue<T>;
  options?: FieldMetadataOptions<T>;          // SELECT / MULTI_SELECT options
  universalSettings?: FieldMetadataUniversalSettings<T>;
  isNullable?: boolean;
  isUIEditable?: boolean;
  isUnique?: boolean;            // @deprecated — use defineIndex({ isUnique:true })
  objectUniversalIdentifier: string;          // which object this field belongs to
};

export type RelationFieldManifest<T> = Omit<RegularFieldManifest<T>, 'universalSettings'|'type'> & {
  type: T;                                     // FieldType.RELATION | MORPH_RELATION
  relationTargetFieldMetadataUniversalIdentifier: string;   // the inverse field's UUID
  relationTargetObjectMetadataUniversalIdentifier: string;  // the target object's UUID
  universalSettings: FieldMetadataUniversalSettings<T>;     // { relationType, onDelete, joinColumnName }
};
```

> Note on default values (from the field manifest doc-comment): **literal string
> defaults must be wrapped in single quotes inside the string**, e.g.
> `defaultValue: "'Draft'"`, `{ source: "'MANUAL'" }`, SELECT values `"'USD'"`.
> Unquoted strings are reserved for computed defaults (`'uuid'`, `'now'`).

Fields can be defined **inline** in the object's `fields` array (scalars), or in
their **own file** via `defineField` (relations and cross-object fields need the
standalone form because they reference two objects).

**View** — `ViewManifest`
(`/Users/devashishthapliyal/Documents/work/Lua/NOBLESTRIDE/twenty-main/packages/twenty-shared/src/application/viewManifestType.ts`):

```ts
export type ViewManifest = SyncableEntityOptions & {
  name: string;
  objectUniversalIdentifier: string;
  type?: ViewType;               // TABLE | KANBAN | CALENDAR | …
  icon?: string;
  position?: number;
  visibility?: ViewVisibility;
  openRecordIn?: ViewOpenRecordIn;
  mainGroupByFieldMetadataUniversalIdentifier?: string;   // Kanban group-by column
  kanbanAggregateOperation?: AggregateOperations;
  fields?: ViewFieldManifest[];      // { universalIdentifier, fieldMetadataUniversalIdentifier, position, isVisible, size }
  filters?: ViewFilterManifest[];
  filterGroups?: ViewFilterGroupManifest[];
  groups?: ViewGroupManifest[];      // Kanban columns: { universalIdentifier, fieldValue, position, isVisible }
  fieldGroups?: ViewFieldGroupManifest[];
  sorts?: ViewSortManifest[];
};
```

**Navigation menu item** — `NavigationMenuItemManifest`
(`/Users/devashishthapliyal/Documents/work/Lua/NOBLESTRIDE/twenty-main/packages/twenty-shared/src/application/navigationMenuItemManifestType.ts`):

```ts
export type NavigationMenuItemManifest = SyncableEntityOptions & {
  type: NavigationMenuItemType;  // VIEW | LINK | FOLDER | OBJECT | PAGE_LAYOUT
  name?: string;
  icon?: string;
  color?: string;
  position: number;
  viewUniversalIdentifier?: string;            // for type VIEW
  link?: string;
  folderUniversalIdentifier?: string;
  targetObjectUniversalIdentifier?: string;
  pageLayoutUniversalIdentifier?: string;
};
```

**Role** — `RoleManifest`
(`/Users/devashishthapliyal/Documents/work/Lua/NOBLESTRIDE/twenty-main/packages/twenty-shared/src/application/roleManifestType.ts`):

```ts
export type RoleManifest = SyncableEntityOptions & {
  label: string;
  description?: string;
  icon?: string;
  canUpdateAllSettings?: boolean;
  canAccessAllTools?: boolean;
  canReadAllObjectRecords?: boolean;
  canUpdateAllObjectRecords?: boolean;
  canSoftDeleteAllObjectRecords?: boolean;
  canDestroyAllObjectRecords?: boolean;
  canBeAssignedToUsers?: boolean;
  canBeAssignedToAgents?: boolean;       // roles can be granted to AI agents
  canBeAssignedToApiKeys?: boolean;
  objectPermissions?: ObjectPermissionManifest[];   // per-object read/update/delete
  fieldPermissions?: FieldPermissionManifest[];      // per-field read/update
  permissionFlagUniversalIdentifiers?: string[];
};
```
`defineApplicationRole` is just `defineRole` (alias) for app-scoped default roles.

**Front component** — `FrontComponentConfig`
(`…/twenty-sdk/src/sdk/define/front-component/front-component-config.ts`). The
manifest has build-output fields (`builtComponentPath`, `builtComponentChecksum`,
`componentName`, `usesSdkClient`) that the SDK *omits* from the author-facing
config and replaces with a live `component`:

```ts
export type FrontComponentType = React.ComponentType<any>;

export type FrontComponentConfig = Omit<
  FrontComponentManifest,
  'sourceComponentPath' | 'builtComponentPath' | 'builtComponentChecksum'
  | 'componentName' | 'usesSdkClient'
> & { component: FrontComponentType };
// remaining manifest fields: { universalIdentifier, name?, description?, isHeadless? }
```

**Page layout** — `PageLayoutManifest`
(`/Users/devashishthapliyal/Documents/work/Lua/NOBLESTRIDE/twenty-main/packages/twenty-shared/src/application/pageLayoutManifestType.ts`):
a record page composed of `tabs[]`, each with `widgets[]`. A widget has
`{ title, type, objectUniversalIdentifier?, gridPosition?, conditionalDisplay?,
configuration }`. `definePageLayoutTab` defines tabs separately. This is how a
record detail page (and dashboard widgets) are described as data.

### 1.3 How `my-twenty-app` uses them

The example app (`/Users/devashishthapliyal/Documents/work/Lua/NOBLESTRIDE/my-twenty-app`)
is organized by entity kind, each file a single default-exported `define*` call:

```
src/objects/*.object.ts                  defineObject (6 files)
src/fields/*.field.ts                    defineField  (22 relation files)
src/views/*.view.ts                      defineView   (6 files)
src/navigation-menu-items/*.ts           defineNavigationMenuItem (6 files)
src/constants/noblestride-identifiers.ts ~168 UUID constants (one source of truth)
src/constants/*-options.ts               shared SELECT/MULTI_SELECT option lists
src/application-config.ts                defineApplication
src/default-role.ts                      defineApplicationRole
```

Representative object (`src/objects/client.object.ts`) — note scalar fields
defined **inline** and every id referencing a constant from
`noblestride-identifiers.ts`:

```ts
export default defineObject({
  universalIdentifier: CLIENT_OBJECT,
  nameSingular: 'client',
  namePlural: 'clients',
  labelSingular: 'Client',
  labelPlural: 'Clients',
  description: 'Companies NobleStride represents to raise capital',
  icon: 'IconBuilding',
  isSearchable: true,
  fields: [
    { universalIdentifier: CLIENT_YEAR_FOUNDED_FIELD, name: 'yearFounded',
      label: 'Year Founded', type: FieldType.NUMBER, icon: 'IconCalendar', isNullable: true },
    { universalIdentifier: CLIENT_SECTOR_FIELD, name: 'sector', label: 'Sector',
      type: FieldType.MULTI_SELECT, icon: 'IconBuildingFactory',
      options: SECTOR_OPTIONS, isNullable: true },
    { universalIdentifier: CLIENT_REVENUE_LAST_YEAR_FIELD, name: 'revenueLastYear',
      label: 'Last Year Revenue', type: FieldType.CURRENCY, icon: 'IconReportMoney',
      isNullable: true, defaultValue: { amountMicros: null, currencyCode: "'USD'" } },
    // …+12 more scalar/composite fields…
  ],
});
```

Representative relation (`src/fields/mandate-client.field.ts`) — the MANY_TO_ONE
side, cross-referencing its inverse ONE_TO_MANY field's UUID:

```ts
import { defineField, FieldType, RelationType, OnDeleteAction } from 'twenty-sdk/define';
import { CLIENT_MANDATES_FIELD, CLIENT_OBJECT, MANDATE_CLIENT_FIELD, MANDATE_OBJECT }
  from 'src/constants/noblestride-identifiers';

// Mandate.client (many-to-one) — inverse of client.mandates.
export default defineField({
  universalIdentifier: MANDATE_CLIENT_FIELD,
  objectUniversalIdentifier: MANDATE_OBJECT,
  type: FieldType.RELATION,
  name: 'client',
  label: 'Client',
  icon: 'IconBuilding',
  isNullable: true,
  relationTargetObjectMetadataUniversalIdentifier: CLIENT_OBJECT,
  relationTargetFieldMetadataUniversalIdentifier: CLIENT_MANDATES_FIELD,
  universalSettings: {
    relationType: RelationType.MANY_TO_ONE,
    onDelete: OnDeleteAction.SET_NULL,
    joinColumnName: 'clientId',
  },
});
```

Representative view (`src/views/mandate.view.ts`) — a Kanban grouped by `stage`,
with explicit group columns and shown fields:

```ts
export default defineView({
  universalIdentifier: MANDATE_VIEW,
  name: 'Mandates Pipeline',
  objectUniversalIdentifier: MANDATE_OBJECT,
  type: ViewType.KANBAN,
  icon: 'IconLayoutKanban',
  position: 0,
  mainGroupByFieldMetadataUniversalIdentifier: MANDATE_STAGE_FIELD,
  groups: [
    { universalIdentifier: VG_MANDATE_NEW_LEAD, fieldValue: 'NEW_LEAD', position: 0, isVisible: true },
    // …QUALIFICATION, PITCH, PROPOSAL, NEGOTIATION, SIGNED, LOST…
  ],
  fields: [
    { universalIdentifier: VF_MANDATE_CLIENT, fieldMetadataUniversalIdentifier: MANDATE_CLIENT_FIELD,
      position: 1, isVisible: true, size: 180 },
    // …sector, dealSize, lead, nextAction…
  ],
});
```

Representative nav item (`src/navigation-menu-items/mandate.navigation-menu-item.ts`):

```ts
export default defineNavigationMenuItem({
  universalIdentifier: MANDATE_NAV,
  name: 'Mandates',
  icon: 'IconBriefcase',
  position: 1,
  type: NavigationMenuItemType.VIEW,
  viewUniversalIdentifier: MANDATE_VIEW,
});
```

App + role (verbatim):

```ts
// src/application-config.ts
export default defineApplication({
  universalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,  // 82de1d26-85d0-43ff-918b-aa6bf5c8e296
  displayName: APP_DISPLAY_NAME,                          // "NobleStride Capital"
  description: APP_DESCRIPTION,
});

// src/default-role.ts
export default defineApplicationRole({
  universalIdentifier: DEFAULT_ROLE_UNIVERSAL_IDENTIFIER, // 1b61e052-7a65-475b-a542-8fc968bcbe90
  label: `${APP_DISPLAY_NAME} default function role`,
  description: `${APP_DISPLAY_NAME} default function role`,
  canReadAllObjectRecords: true,
  canUpdateAllObjectRecords: true,
  canSoftDeleteAllObjectRecords: true,
  canDestroyAllObjectRecords: false,
});
```

**Two helper Python scripts** in the app root automate the boilerplate:
- `gen-identifiers.py` — one-shot generator that emits ~168 UUID v4 constants into
  `src/constants/noblestride-identifiers.ts` (objects, both sides of each
  relation, views, nav items, view-field columns, kanban groups). **Run once;
  never regenerate** — these UUIDs are the stable sync keys (see §2). Add new IDs
  by hand.
- `gen-relations.py` — scaffolds the bidirectional `defineField` files from object
  definitions. Takes a batch arg: `'core'` (8 relations among custom objects +
  Person) or `'member'` (3 relations to the standard `WorkspaceMember`). Emits
  two files per relation (ONE_TO_MANY parent + MANY_TO_ONE child) that
  cross-reference each other's UUID. Safe to re-run.

`package.json`: `twenty-sdk@2.13.0` (dev), `twenty-client-sdk@2.13.0`,
`react@^19`, Node `^24.5`, `yarn@4.9.2`. The `twenty` script wraps the CLI.

---

## 2. `universalIdentifier` UUIDs and the `yarn twenty dev` sync

### 2.1 Why UUIDs

Every syncable entity extends `SyncableEntityOptions = { universalIdentifier:
string }`
(`/Users/devashishthapliyal/Documents/work/Lua/NOBLESTRIDE/twenty-main/packages/twenty-sdk/src/sdk/define/common/types/syncable-entity-options.type.ts`).
The `universalIdentifier` is a UUID v4 chosen **once** by the app author and kept
forever. It is the **primary key the server uses to correlate a definition in
your code with a metadata row in the workspace**. Because correlation is by UUID
(not by name/position), you can rename an object's label, reorder fields, or
change a column type and the server still knows it's the *same* entity → it issues
an UPDATE, not a DELETE+CREATE (which would drop data). Relations are wired by
referencing the *other* field's and object's UUIDs
(`relationTargetFieldMetadataUniversalIdentifier`,
`relationTargetObjectMetadataUniversalIdentifier`), so both sides resolve
deterministically regardless of file/build order.

This is why `gen-identifiers.py` is run once and the constants file is treated as
the immutable registry: regenerating it would mint new UUIDs, and the next sync
would interpret every entity as "new" (and the old ones as "deleted").

### 2.2 The sync pipeline (`yarn twenty dev`)

CLI entry: `…/twenty-sdk/src/cli/commands/dev/index.ts` registers
`dev [appPath]` with `--once`, `--dry-run`, `--verbose`, `--debounceMs`. Plain
`yarn twenty dev` runs **watch mode** (`AppDevCommand`,
`…/cli/commands/dev/dev.ts`): it checks SDK/server version compatibility,
ensures auth, then starts a `DevModeOrchestrator` that watches `src/` and re-syncs
on change. `--once` runs `appDevOnce` a single time (for CI/pre-commit).

The single-pass logic is in
`/Users/devashishthapliyal/Documents/work/Lua/NOBLESTRIDE/twenty-main/packages/twenty-sdk/src/cli/operations/dev-once.ts`.
Ordered steps:

1. **Check server reachable + auth valid** (`ApiService.validateAuth()`); if not
   authed, prompt re-auth. Server is reached via the active "remote" (a named
   server URL + OAuth tokens stored by `yarn twenty remote:add`).
2. **`buildAndValidateManifest(appPath)`** — load every `src/**` file, run each
   `define*` validator, and assemble the full `Manifest` object (application +
   arrays of objects/fields/views/roles/menu items/agents/skills/front
   components/…). Validation errors abort here.
3. **`buildApplication(...)`** — compile/bundle the build artifacts (logic
   functions → node bundles; front components → `.mjs` worker bundles; see §3).
4. **`runTypecheck(appPath)`** — full TS typecheck; failures abort.
5. **`manifestUpdateChecksums(...)`** — record content checksums of built files
   into the manifest, then `writeManifestToOutput` (writes `.twenty/output/…`).
6. **If `--dry-run`:** `apiService.syncApplication(manifest, { dryRun: true })`
   and print the diff (`formatSyncActionsSummary`) — list of create/update/delete
   `SyncAction`s — without applying.
7. **Otherwise:** `ensureAppRegistration` (register the app as an OAuth client),
   `createDevelopmentApplication`, **upload built files** (`FileUploader`, in
   parallel), then **`apiService.syncApplication(manifest)`** — the server diffs
   the manifest against stored metadata *by `universalIdentifier`* and applies
   the resulting actions (this is what actually mutates DB metadata, regenerates
   the GraphQL schema, and makes new objects/views appear in the UI).
8. **`generateCoreClient(...)`** — regenerate the typed `twenty-client-sdk` for
   the app so logic functions/front components get typed access to the new
   schema.

So: **code → manifest (validated) → built artifacts uploaded → manifest synced
(UUID diff) → server metadata mutated → schema/UI regenerated.** Apps are also
packable into a `.tgz` (`dev:build --tarball`) and deployed to a remote with
`appDeploy` (`…/cli/operations/deploy.ts`) for production rather than dev sync.

`yarn twenty dev:add <entityType>` scaffolds a new entity file from a template
(`…/cli/utilities/entity/entity-*-template.ts`) with a fresh UUID — entity types
include object, field, view, navigationMenuItem, role, skill, agent,
logicFunction, frontComponent, pageLayout.

---

## 3. `defineFrontComponent` + `twenty-front-component-renderer`

### 3.1 Authoring

A front component is a normal React component wrapped in `defineFrontComponent`.
Scaffold template
(`…/twenty-sdk/src/cli/utilities/entity/entity-front-component-template.ts`):

```tsx
import { defineFrontComponent } from 'twenty-sdk/define';

const Component = () => (
  <div style={{ padding: '20px' }}>
    <h1>My new component!</h1>
  </div>
);

export default defineFrontComponent({
  universalIdentifier: '…uuid…',
  name: 'my-component',
  description: '…',
  component: Component,
});
```

Inside a component, the SDK exposes a host-communication surface from
`twenty-sdk/front-component`
(`…/twenty-sdk/src/sdk/front-component/index.ts`): functions
`navigate`, `openSidePanelPage`, `closeSidePanel`, `copyToClipboard`,
`enqueueSnackbar`, `openCommandConfirmationModal`, `updateProgress`,
`getApplicationVariable`, `unmountFrontComponent`; and hooks `useRecordId`,
`useSelectedRecordIds`, `useUserId`, `useColorScheme`,
`useFrontComponentExecutionContext`. Components are surfaced in the UI by binding
them to a **command menu item** (`defineCommandMenuItem`, with
`frontComponentUniversalIdentifier`) or a **page-layout widget**.

### 3.2 Bundling (the important part)

Front components are bundled by esbuild via plugins in
`…/twenty-sdk/src/cli/utilities/build/common/front-component-build/`. Base build
options (`utils/get-base-front-component-build-options.ts`):

```ts
{ bundle: true, format: 'esm', outExtension: { '.js': '.mjs' },
  external: FRONT_COMPONENT_EXTERNAL_MODULES,   // ['twenty-client-sdk/core','twenty-client-sdk/metadata']
  jsx: 'automatic', minify: true,
  define: { 'process.env.NODE_ENV': '"production"' }, … }
```

The build does **not** run your JSX directly in the browser. Twenty renders
custom components through a **remote-DOM-over-Web-Worker** sandbox: the component
runs in a worker, and DOM mutations are mirrored into the host React tree. The
`jsxTransformToRemoteDomWorkerFormatPlugin`
(`…/front-component-build/jsx-transform-to-remote-dom-worker-format-plugin.ts`)
intercepts `*.tsx` and rewrites them via
`unwrapDefineFrontComponentToDirectExport`
(`…/front-component-build/utils/unwrap-define-front-component-to-direct-export.ts`):
it strips the `defineFrontComponent({...})` wrapper, then **prepends React
imports and emits a render function**:

```ts
transformedSource =
  `import { createRoot as __createRoot } from 'react-dom/client';\n` +
  `import { jsx as __frontComponentJsx } from 'react/jsx-runtime';\n` +
  transformedSource;
// …
`export default function __renderFrontComponent(__container) {
   __createRoot(__container).render(__frontComponentJsx(${ComponentName}, {}));
 }`
```

The host side lives in `packages/twenty-front-component-renderer`
(`src/index.ts`): `FrontComponentRenderer` (host component),
`createRemoteWorker`, a generated **registry of allowed remote elements**
(`HtmlDiv`, `HtmlButton`, … and their `*Element` definitions), `exposeGlobals`,
`installStyleBridge`, and effect components that bridge context/host-API/errors
between worker and host. In short: author writes plain React → SDK rewrites it to
a worker-rendered remote-DOM module → the renderer mirrors it into the Twenty UI
through an allow-listed element set.

### 3.3 Known limitation: dynamic-require-of-react / version skew

In `my-twenty-app` (scaffolded 2026-06-15) custom front components fail at runtime
with:

```
FrontComponent error: Dynamic require of "react" is not supported
```

The built bundle (`.twenty/output/src/front-components/*.mjs`) contains esbuild's
dynamic-require-of-react shim. **Root cause is a version skew**: the dev Docker
image runs **server v2.13.2**, but the latest published **`twenty-sdk`/CLI is
v2.13.0** (no 2.13.2 on npm). The 2.13.0 bundler externalizes/expects React one
way (it injects `import … from 'react-dom/client'` / `'react/jsx-runtime'`, §3.2)
while the 2.13.2 worker runtime provides React differently, so the shim throws.

Impact is **narrow**: only **custom front components** (custom dashboards, agent
panels, custom buttons) are affected. Native objects, fields, relations,
TABLE/KANBAN views, filters, import/export, and externally-driven (Lua) agents all
work. Expected to self-resolve once `twenty-sdk` publishes a 2.13.x matching the
server. **Verify the published SDK version before assuming it's still broken.**

Practical takeaway for a bespoke CRM: the safe surface is metadata-as-code
(objects/fields/views/roles/menus) + server-side logic functions + agents.
Treat custom front components as bleeding-edge and pin SDK and server to the same
minor/patch.

---

## 4. Native AI / agent / workflow / MCP features

Twenty ships a real AI layer on the server, an automation/workflow engine, and
AI-assistant tooling for authoring apps. All confirmed by source.

### 4.1 Agents (LLM wrappers, first-class metadata)

An **Agent** = a named, versioned LLM configuration (system prompt + model +
response format) that lives in metadata and can be invoked from GraphQL, the SDK,
or a workflow.

- **SDK shape** — `AgentManifest`
  (`/Users/devashishthapliyal/Documents/work/Lua/NOBLESTRIDE/twenty-main/packages/twenty-shared/src/application/agentManifestType.ts`):
  ```ts
  export type AgentManifest = SyncableEntityOptions & {
    name: string; label: string; icon?: string; description?: string;
    prompt: string;                 // system prompt
    modelId?: string;               // defaults to an AUTO_SELECT_SMART model
    responseFormat?: AgentResponseFormat;   // { type: 'text' | 'json', … }
  };
  ```
  `defineAgent` validates `name/label/prompt`; warns if `responseFormat` is
  unset. Scaffold template at `…/cli/utilities/entity/entity-agent-template.ts`.

- **Server entity** —
  `/Users/devashishthapliyal/Documents/work/Lua/NOBLESTRIDE/twenty-main/packages/twenty-server/src/engine/metadata-modules/ai/ai-agent/entities/agent.entity.ts`
  (`AgentEntity`: id, name, label, prompt, `modelId`, `responseFormat`,
  `isCustom`, `modelConfiguration`, `evaluationInputs`).

- **Execution** — GraphQL mutation `runAgent(input: { agentUniversalIdentifier,
  prompt })` resolved by
  `…/ai/ai-agent-execution/resolvers/agent-run.resolver.ts` →
  `agent-run.service.ts` → `agent-async-executor.service.ts`. Result type
  (`…/ai-agent-execution/types/agent-execution-result.type.ts`) returns
  `{ result, usage (tokens), totalCostInDollars, creditsUsedMicro,
  steps (tool calls), modelId, hasNoMoreAvailableCredits }`. So agents support
  tool-calling and have built-in credit/usage metering.

- **Model providers / registry** — multi-provider via the Vercel AI SDK.
  `/Users/devashishthapliyal/Documents/work/Lua/NOBLESTRIDE/twenty-main/packages/twenty-shared/src/ai/constants/ai-sdk-packages.const.ts`:
  ```ts
  export const AI_SDK_PACKAGES = ['@ai-sdk/openai', '@ai-sdk/anthropic',
    '@ai-sdk/google', '@ai-sdk/mistral', '@ai-sdk/xai',
    '@ai-sdk/amazon-bedrock', '@ai-sdk/openai-compatible', '@ai-sdk/azure'];
  ```
  Model families (`…/ai/ai-models/types/model-family.enum.ts`): `GPT, CLAUDE,
  GEMINI, MISTRAL, GROK`. Each model has a role
  (`…/ai-models/types/ai-model-role.enum.ts`): `FAST` | `SMART`, with auto-select.
  Provider config schema (`…/ai-models/types/ai-provider-config.schema.ts`)
  supports `authType: 'key' | 'credentials' | 'role'`, base URL, region, AWS keys,
  data-residency.

- **SDK helper for logic functions** — `runAgent`
  (`/Users/devashishthapliyal/Documents/work/Lua/NOBLESTRIDE/twenty-main/packages/twenty-sdk/src/sdk/logic-function/agents/run-agent.ts`):
  `runAgent({ agentUniversalIdentifier, prompt }) → { result, error, success }`.
  Internally POSTs the `runAgent` GraphQL mutation to `${TWENTY_API_URL}/metadata`
  with a Bearer `TWENTY_APP_ACCESS_TOKEN`. Lets server-side serverless functions
  call an agent and get structured output.

### 4.2 Skills

`SkillManifest`
(`/Users/devashishthapliyal/Documents/work/Lua/NOBLESTRIDE/twenty-main/packages/twenty-shared/src/application/skillManifestType.ts`):

```ts
export type SkillManifest = SyncableEntityOptions & {
  name: string; label: string; icon?: string; description?: string;
  content: string;   // markdown — the skill's instructions/knowledge
};
```
`defineSkill` (`…/define/skills/define-skill.ts`); template
`…/cli/utilities/entity/entity-skill-template.ts`. A skill is reusable
markdown guidance attached to the workspace/agent context.

### 4.3 Workflow engine (`packages/twenty-server/src/modules/workflow`)

A visual automation engine. **Trigger types**
(`…/workflow/workflow-trigger/types/workflow-trigger.type.ts`):

```ts
enum WorkflowTriggerType { DATABASE_EVENT, MANUAL, CRON, WEBHOOK }
```
- `DATABASE_EVENT` — record create/update/delete (update/upsert can filter on
  specific changed fields).
- `MANUAL` — user-triggered (global / single-record / bulk availability).
- `CRON` — minutes/hours/days schedule or a custom cron pattern.
- `WEBHOOK` — inbound HTTP (GET/POST), optional `API_KEY` auth, expected body
  schema.

**Action types** (`/Users/devashishthapliyal/Documents/work/Lua/NOBLESTRIDE/twenty-main/packages/twenty-shared/src/workflow/types/WorkflowActionType.ts`):

```ts
enum WorkflowActionType {
  CODE, LOGIC_FUNCTION, SEND_EMAIL, DRAFT_EMAIL,
  CREATE_RECORD, UPDATE_RECORD, DELETE_RECORD, UPSERT_RECORD, FIND_RECORDS,
  FORM, FILTER, IF_ELSE, HTTP_REQUEST,
  AI_AGENT,            // run an agent as a workflow step
  ITERATOR, EMPTY, DELAY,
}
```
The `AI_AGENT` action
(`…/workflow/workflow-executor/workflow-actions/ai-agent/ai-agent.workflow-action.ts`)
runs an agent (`{ agentId?, prompt? }`) mid-workflow with token/credit tracking
(`UsageOperationType.AI_WORKFLOW_TOKEN`). Execution path: trigger → queued job →
`WorkflowRunner` executes ordered steps → per-action handlers → step logs.

### 4.4 MCP server (Twenty exposes itself as a tool surface)

Twenty serves a **Model Context Protocol** endpoint at `/mcp`
(`/Users/devashishthapliyal/Documents/work/Lua/NOBLESTRIDE/twenty-main/packages/twenty-server/src/engine/api/mcp/mcp.module.ts`):
controllers (`mcp-core.controller.ts`), services (`mcp-protocol.service.ts`,
`mcp-tool-executor.service.ts`, `mcp-instruction-builder.service.ts`), an auth
guard (`mcp-auth.guard.ts`), and native tools (`list-skills.tool.ts`,
`list-object-metadata-names.tool.ts`). Native dispatch tools include
`execute_tool`, `learn_tools`, `load_skills`, `search_help_center`; behind
`execute_tool` sit ~250 generated workspace CRUD tools
(`find_many_companies`, `create_one_person`, …). The serverless code interpreter
injects a `TwentyMCP` Python helper
(`…/core-modules/tool/tools/code-interpreter-tool/twenty-mcp-helper.const.ts`)
so code/logic actions can call any tool. Net: external LLM agents (e.g. Claude,
Codex) can read/write the CRM through a standard MCP interface.

### 4.5 AI-assistant tooling for *authoring* apps

- **`packages/twenty-claude-skills`** — Claude skill bundle for working with
  Twenty over MCP. Ships `twenty-record-presentation` (fetch CRM records via the
  connected Twenty MCP server and present them as readable Markdown
  tables/summaries with proper date formatting and record links). Skills live as
  `skills/<name>/SKILL.md`.
- **`packages/twenty-codex-plugin`** — official Codex plugin for the full app
  lifecycle. Five skills: `create-app`, `develop-app` (objects/fields/logic
  functions/layouts/front components/workflows), `manage-app` (remotes/sync/
  build/deploy/logs/CI), `publish-app` (marketplace metadata), `use-twenty-mcp`
  (workspace MCP setup via `scripts/setup-mcp.sh <workspace>.twenty.com`). Has
  `AGENTS.md` operating rules and ~15 reference docs under `references/`.

> For NobleStride: the on-server agent/workflow stack is fully usable
> (declarative agents, multi-provider models, MCP, workflow AI_AGENT action). The
> memory note treats Lua-driven agents as the chosen path; Twenty's native agents
> are an alternative/complement and the MCP server is the cleanest integration
> seam for any external agent.

---

## 5. `my-twenty-app` data model — validated inventory (6 NobleStride objects)

App: **NobleStride Capital** — capital advisory / fundraising CRM for Sub-Saharan
Africa. App UUID `82de1d26-85d0-43ff-918b-aa6bf5c8e296`. All field/relation/view
data below is as actually implemented in code.

### 5.1 Objects + fields (scalar/composite, defined inline)

**Client** `client`/`clients` · icon `IconBuilding` · UUID
`0f0ad1c2-33d4-41b6-a253-f18325cd769d` — *companies NobleStride represents*
| field | type |
|---|---|
| yearFounded | NUMBER |
| hqCity | TEXT |
| countries | MULTI_SELECT (geography) |
| website | LINKS |
| sector | MULTI_SELECT |
| coreProduct | TEXT |
| description | RICH_TEXT |
| founders | TEXT |
| founderGender | SELECT |
| revenueLastYear | CURRENCY (USD) |
| revenueForecast | CURRENCY (USD) |
| profitable | BOOLEAN (default false) |
| existingInvestors | TEXT |
| source | SELECT |
| pitchDeck | LINKS |

**Investor** `investor`/`investors` · icon `IconBuildingBank` · UUID
`11db57de-c38f-471b-a404-ffcf9ec31c23`
| field | type |
|---|---|
| investorType | SELECT |
| website | LINKS |
| status | SELECT |
| sectorFocus | MULTI_SELECT |
| geographicFocus | MULTI_SELECT |
| instruments | MULTI_SELECT |
| investmentStages | MULTI_SELECT |
| aum | CURRENCY |
| ticketMin | CURRENCY |
| ticketMax | CURRENCY |
| targetIrr | NUMBER |
| countryRestrictions | TEXT |
| esgFocus | TEXT |
| decisionProcess | RICH_TEXT |
| notes | RICH_TEXT |

**Mandate** `mandate`/`mandates` · icon `IconBriefcase` · UUID
`77a73a63-dd4a-4919-bd8f-7d7e3b982888` — *an engagement to raise capital for a client*
| field | type |
|---|---|
| stage | SELECT (required, default `NEW_LEAD`) |
| dealSize | CURRENCY |
| sector | MULTI_SELECT |
| source | SELECT |
| dateOpened | DATE_TIME |
| ndaStatus | SELECT (default `NOT_SENT`) |
| ndaSentDate | DATE_TIME |
| ndaSignedDate | DATE_TIME |
| eaStatus | SELECT (default `NOT_SENT`) |
| eaSentDate | DATE_TIME |
| eaSignedDate | DATE_TIME |
| nextAction | TEXT |
| notes | RICH_TEXT |

**Transaction** `transaction`/`transactions` · icon `IconChartArrowsVertical` ·
UUID `120b7684-4f26-430f-9391-614cdde20346` — *an active deal in execution*
| field | type |
|---|---|
| stage | SELECT (required, default `DEAL_PREPARATION`) |
| dealType | SELECT |
| instrument | MULTI_SELECT |
| targetRaise | CURRENCY |
| sector | MULTI_SELECT |
| dateOpened | DATE_TIME |

**Engagement** `engagement`/`engagements` · icon `IconMessage` · UUID
`63d9d617-720c-451f-82a4-2e2ee119f1fb` — *contact between a transaction and an investor*
| field | type |
|---|---|
| status | SELECT (required, default `NOT_CONTACTED`) |
| lastContact | DATE_TIME |
| notes | RICH_TEXT |

**Partner** `partner`/`partners` · icon `IconScale` · UUID
`c4e9365b-c3d3-430d-b537-72a3676561c8` — *law firms / auditors / advisors / banks*
| field | type |
|---|---|
| partnerType | SELECT (default `LAW_FIRM`) |
| profile | RICH_TEXT |
| status | SELECT (default `ACTIVE`) |
| amount | CURRENCY |

### 5.2 Relationship graph (22 `defineField` files = 11 bidirectional relations)

All relations are ONE_TO_MANY (parent) ↔ MANY_TO_ONE (child), `onDelete:
SET_NULL`. Joins to two standard objects: **Person** (contacts) and
**WorkspaceMember** (deal team).

| Parent.field (1) | ↔ | Child.field (M) | join column |
|---|---|---|---|
| Client.contacts | ↔ | Person.client | clientId |
| Client.mandates | ↔ | Mandate.client | clientId |
| Client.transactions | ↔ | Transaction.client | clientId |
| Investor.contacts | ↔ | Person.investor | investorId |
| Investor.engagements | ↔ | Engagement.investor | investorId |
| Mandate.transactions | ↔ | Transaction.mandate | mandateId |
| Transaction.engagements | ↔ | Engagement.transaction | transactionId |
| Partner.contacts | ↔ | Person.partner | partnerId |
| WorkspaceMember.ledMandates | ↔ | Mandate.lead | leadId |
| WorkspaceMember.ownedTransactions | ↔ | Transaction.owner | ownerId |
| WorkspaceMember.ownedEngagements | ↔ | Engagement.owner | ownerId |

Deal flow modeled by the graph: **Client → Mandate → Transaction → Engagement →
Investor**, with Person as the contact spine across Client/Investor/Partner and
WorkspaceMember as the internal owner/lead.

### 5.3 Views (6)

| view | object | type | notes |
|---|---|---|---|
| All Clients | client | TABLE | sector, hqCity, source |
| All Investors | investor | TABLE | investorType, status, sectorFocus, geographicFocus, aum, ticketMin, ticketMax |
| Mandates Pipeline | mandate | KANBAN | group-by `stage` (NEW_LEAD→…→SIGNED/LOST); fields client, sector, dealSize, lead, nextAction |
| Active Transactions | transaction | KANBAN | group-by `stage` (DEAL_PREPARATION→…→CLOSED_WON/LOST); fields client, sector, targetRaise, owner, dealType |
| All Engagements | engagement | TABLE | investor, transaction, status, lastContact |
| All Partners | partner | TABLE | partnerType, status |

### 5.4 Navigation (6 `defineNavigationMenuItem`, type VIEW)

Order: **Mandates (1) · Transactions (2) · Investors (3) · Engagement (4) ·
Partners (5) · Clients (6)** — icons `IconBriefcase`,
`IconChartArrowsVertical`, `IconBuildingBank`, `IconMessage`, `IconScale`,
`IconBuilding`.

### 5.5 Shared option vocabularies (`src/constants/*-options.ts`)

- **SECTOR** (11): AGRIBUSINESS, FINANCIAL_SERVICES, FMCG, MANUFACTURING,
  RENEWABLE_ENERGY, TECHNOLOGY, HEALTHCARE, BANKING, REAL_ESTATE, EDUCATION,
  INFRASTRUCTURE
- **INVESTOR_TYPE** (8): PRIVATE_EQUITY, VENTURE_CAPITAL, DFI, DEBT_PROVIDER,
  FAMILY_OFFICE, ANGEL, CORPORATE_VC, GRANT_DONOR
- **INVESTOR_STATUS** (5): ACTIVELY_DEPLOYING, FUNDRAISING, FINAL_CLOSE,
  FULLY_DEPLOYED, DORMANT
- **INSTRUMENT** (5): EQUITY, DEBT, MEZZANINE, GRANT, CONVERTIBLE
- **INVESTMENT_STAGE** (6): PRE_SEED, SEED, SERIES_A, SERIES_B, GROWTH,
  MATURE_BUYOUT
- **GEOGRAPHY** (11): EAST_AFRICA, WEST_AFRICA, SOUTHERN_AFRICA,
  SUB_SAHARAN_AFRICA, PAN_AFRICA, NORTH_AFRICA, FRANCOPHONE_AFRICA, MENA, EUROPE,
  USA, GLOBAL
- **MANDATE_STAGE** (7): NEW_LEAD, QUALIFICATION, PITCH, PROPOSAL, NEGOTIATION,
  SIGNED, LOST
- **TRANSACTION_STAGE** (7): DEAL_PREPARATION, INVESTOR_OUTREACH, DUE_DILIGENCE,
  TERM_SHEET, CLOSING, CLOSED_WON, CLOSED_LOST
- **ENGAGEMENT_STATUS** (6): NOT_CONTACTED, CONTACTED, IN_CONVERSATION,
  INTERESTED, PASSED, COMMITTED
- **SOURCE** (9): MONDAY_MEETING, WHATSAPP, EMAIL, VERBAL, REFERRAL, INBOUND,
  OUTREACH, EVENT, WEBSITE
- **DOC_STATUS** (3): NOT_SENT, SENT, SIGNED (NDA/EA)
- **FOUNDER_GENDER** (3): MALE, FEMALE, MIXED
- **PARTNER_TYPE** (5): LAW_FIRM, AUDITOR, ADVISOR, BANK, OTHER
- **PARTNER_STATUS** (3): ACTIVE, PREFERRED, INACTIVE
- **DEAL_TYPE** (5): SERIES_A, SERIES_B, GROWTH, EXPANSION, ACQUISITION_FINANCE

### 5.6 Default role

`defineApplicationRole` "NobleStride Capital default function role"
(`1b61e052-7a65-475b-a542-8fc968bcbe90`): read/update/soft-delete all records =
true; destroy = false.

---

## 6. Lessons for a bespoke CRM build

1. **Metadata-as-code with stable UUIDs is the durable pattern.** Correlating
   definitions to DB rows by an author-chosen `universalIdentifier` (never by
   name/order) is what makes non-destructive schema evolution possible. Mint the
   UUID once, store it in one constants registry, never regenerate.
2. **Separate "validate" from "apply."** Each `define*` only validates and returns
   a config; a separate builder assembles a manifest and a separate sync step
   diffs+applies. This makes dry-run, CI checks, and watch-mode cheap.
3. **Relations need both sides, each pointing at the other's UUID + a join
   column.** A small generator script for the bidirectional boilerplate pays off.
4. **A worker/remote-DOM sandbox for custom UI is powerful but version-fragile.**
   Pin the authoring SDK and the host server to the same version; custom front
   components are the one place a minor skew breaks at runtime
   (the "Dynamic require of react" bug).
5. **AI is first-class metadata, not a bolt-on:** declarative agents (multi-
   provider via Vercel AI SDK), a workflow engine with an `AI_AGENT` action and
   token metering, and an MCP server that exposes the whole CRM as tools to
   external LLM agents. For an external orchestrator, the **MCP `/mcp` endpoint**
   is the cleanest seam.

---

### Appendix — key file paths

| Topic | Path |
|---|---|
| define barrel | `…/twenty-sdk/src/sdk/define/index.ts` |
| defineObject | `…/twenty-sdk/src/sdk/define/objects/define-object.ts` |
| defineField | `…/twenty-sdk/src/sdk/define/fields/define-field.ts` |
| defineView | `…/twenty-sdk/src/sdk/define/views/define-view.ts` |
| defineFrontComponent | `…/twenty-sdk/src/sdk/define/front-component/define-front-component.ts` |
| defineAgent | `…/twenty-sdk/src/sdk/define/agents/define-agent.ts` |
| Object/Field/View/Role/Agent manifest types | `…/twenty-shared/src/application/*ManifestType.ts` |
| dev sync (once) | `…/twenty-sdk/src/cli/operations/dev-once.ts` |
| dev watch command | `…/twenty-sdk/src/cli/commands/dev/dev.ts` |
| FC bundler base opts | `…/twenty-sdk/src/cli/utilities/build/common/front-component-build/utils/get-base-front-component-build-options.ts` |
| FC react-injection (bug root) | `…/front-component-build/utils/unwrap-define-front-component-to-direct-export.ts` |
| FC host renderer | `…/twenty-front-component-renderer/src/index.ts` |
| runAgent SDK helper | `…/twenty-sdk/src/sdk/logic-function/agents/run-agent.ts` |
| AI providers list | `…/twenty-shared/src/ai/constants/ai-sdk-packages.const.ts` |
| Agent server entity | `…/twenty-server/src/engine/metadata-modules/ai/ai-agent/entities/agent.entity.ts` |
| Workflow trigger types | `…/twenty-server/src/modules/workflow/workflow-trigger/types/workflow-trigger.type.ts` |
| Workflow action types | `…/twenty-shared/src/workflow/types/WorkflowActionType.ts` |
| AI_AGENT workflow action | `…/twenty-server/src/modules/workflow/workflow-executor/workflow-actions/ai-agent/ai-agent.workflow-action.ts` |
| MCP server module | `…/twenty-server/src/engine/api/mcp/mcp.module.ts` |
| Claude skills | `packages/twenty-claude-skills` |
| Codex plugin | `packages/twenty-codex-plugin` |
| Example app | `/Users/devashishthapliyal/Documents/work/Lua/NOBLESTRIDE/my-twenty-app` |

*(`…` = `/Users/devashishthapliyal/Documents/work/Lua/NOBLESTRIDE/twenty-main/packages`)*
