# Twenty CRM — Frontend Architecture Reference

A reference for a team building a bespoke CRM from scratch on a modern React stack, derived from the open-source Twenty monorepo.

Roots analyzed:
- `packages/twenty-front` — the React application
- `packages/twenty-ui` — the shared design-system component library
- `packages/twenty-front-component-renderer` — the sandboxed custom-component runtime

> All paths below are relative to `/Users/devashishthapliyal/Documents/work/Lua/NOBLESTRIDE/twenty-main`.

---

## 1. Overall Frontend Stack & Architecture

### Stack (from `packages/twenty-front/package.json` and root `CLAUDE.md`)

| Concern | Choice | Notes |
|---|---|---|
| Framework | **React 19** | `react@^19.2.0`, functional components only, named exports only |
| Build tool | **Vite** | `vite build`; SWC (`@vitejs/plugin-react-swc`); Nx monorepo (Yarn 4) |
| Routing | **react-router-dom v6** | `react-router-dom@^6.4.4` |
| Server state / data | **Apollo Client v4** | `@apollo/client@^4.0.0`; GraphQL via `graphql@16.8.1`; codegen with `@graphql-codegen` |
| Client state | **Jotai** (NOT Recoil) | `jotai@^2.17.1`. **Verified: 0 Recoil imports, ~517 Jotai-importing files.** Twenty migrated off Recoil to Jotai. |
| Styling (app) | **Linaria** (zero-runtime CSS-in-JS) | `@linaria/react`, `@linaria/core`, `@wyw-in-js/vite`. **~1046 files use Linaria `styled`; 0 emotion imports.** |
| Styling (design system) | **SCSS Modules** | `twenty-ui` uses `*.module.scss` (121 files), 0 CSS-in-JS. See §2. |
| i18n | **Lingui** | `@lingui/*` with SWC plugin and `.po` catalogs in `src/locales` |
| Forms | react-hook-form + zod | `@hookform/resolvers`, `zod@^4` |
| Drag & drop | `@hello-pangea/dnd` (board) + `@dnd-kit/react` | |
| Rich text | Tiptap + BlockNote | |
| Real-time | GraphQL SSE | `graphql-sse`, SSE provider in app shell |

### Boot sequence

`src/index.tsx` → hydrates a metadata store from IndexedDB (`hydrateMetadataStore`), then mounts `<App />`. CSS is loaded statically here:

```tsx
import 'twenty-ui/style.css';
import 'twenty-ui/theme-light.css';
import 'twenty-ui/theme-dark.css';
```

### Provider tree

`src/modules/app/components/App.tsx` is the outer shell — note **Jotai's `<Provider store={jotaiStore}>` is the root state provider**, with error boundary, Lingui `I18nProvider`, `IconsProvider`, Helmet, then `<AppRouter />`.

`src/modules/app/components/AppRouterProviders.tsx` is the nested provider stack rendered per-route:
`ApolloProvider` → `BaseThemeProvider` → effect components for client config / metadata loading → `ClientConfigProvider` → `AuthProvider` → `ApolloCoreProvider` (the workspace/core GraphQL client) → `SSEProvider` → `PreComputedChipGeneratorsProvider` → `SnackBarProvider` → `DialogManager` → `<Outlet />`.

Key architectural takeaways:
- **Two Apollo clients**: a base/auth client and `ApolloCoreProvider` (workspace data) + `ApolloAdminProvider`.
- **Metadata is loaded at boot** before record screens render (`MinimalMetadataLoadEffect`, `MinimalMetadataGater`) — the entire UI is metadata-driven (§5).
- **Effect components** pattern: side-effects (loading, subscriptions, theme) are isolated into render-less `*Effect.tsx` components mounted in the tree, instead of scattered `useEffect`s.

### App shell / layout / left navigation

- Layout module: `src/modules/ui/layout` (page containers, side panel, right drawer).
- Left navigation: `src/modules/navigation/components/`:
  - `MainNavigationDrawer.tsx` — the primary left nav drawer (collapsible).
  - `AppNavigationDrawer.tsx`, `MainNavigationDrawerNavigationContent.tsx`, `MainNavigationDrawerScrollableItems.tsx`, `NavigationDrawerOtherSection.tsx` — sections / scrollable workspace + favorites + objects list.
  - `SettingsNavigationDrawer.tsx` — settings-area nav.
  - State: `src/modules/navigation/states/` (e.g. `currentMobileNavigationDrawerState.ts`), hook `useNavigationDrawerExpanded.ts`.
- The reusable drawer **primitives** live in `twenty-ui/src/navigation` (NavigationDrawer items, sections).

---

## 2. Design System (`twenty-ui`)

`twenty-ui` is published as `twenty-ui` (workspace dep). It is organized by category: `data-display`, `input`, `navigation`, `layout`, `feedback`, `surfaces`, `icon`, `theme`, `theme-constants`, `typography`, `utilities`.

### Styling approach — SCSS Modules + CSS variables (NOT emotion/linaria)

**Verified**: `twenty-ui` has **0 emotion imports**, **121 `*.module.scss` files**, and sass deps. Components are styled with co-located `.module.scss` + `clsx`, e.g. `src/input/Button/Button.tsx` + `Button.module.scss`. SCSS references theme tokens through CSS custom properties (`var(--t-...)`), so styling is **zero-runtime / static CSS**.

> Important distinction for a new build: `twenty-ui` (design system) = **SCSS Modules**; `twenty-front` (app) = **Linaria** `styled`. They share tokens through CSS variables, not a JS theme object passed via props.

### Theme tokens

- Token source of truth (TS objects): `src/theme/constants/` — e.g. `ThemeLight.ts`, `ThemeCommon`, `MainColorsLight.ts`, `GrayScaleLight.ts`, `FontCommon.ts`, `BorderCommon.ts`, `Animation.ts`.
- CSS-variable accessors: `src/theme-constants/themeCssVariables.ts` (mirrors the theme object as `var(--t-...)` strings).
- Compiled variable sets: `src/theme-constants/theme-light.css` and `theme-dark.css`. Theme switching = toggling a `.light`/`.dark` class on `<html>`; `BaseThemeProvider`/`UserThemeProviderEffect` in the app drive it.
- TS theme object is still exposed at runtime via a `ThemeContext` (`src/theme-constants/ThemeProvider.tsx`) for components that need values in JS.

Token structure (theme object): `accent`, `background` (primary/secondary/tertiary/quaternary), `border` (`color` + `radius`), `boxShadow`, `font` (`color`, `size`, `weight`, `family`), `tag` (text+bg per named color), `grayScale` (gray1–12), `color` (24 named hues × 12 shades), `snackBar`, `blur`.

Concrete values:
- **Spacing**: 4px base unit. `spacing(n) => n*4 px`. CSS vars `--t-spacing-0..32` (+ half steps).
- **Font**: family **Inter**, weights 400/500/600; sizes xxs 10px → md 16px (body) → xxl ~29.6px.
- **Border radius**: `xs 2px`, `sm 4px` (canonical), `md 8px`, `xl 20px`, `xxl 40px`, `pill 999px`, `rounded 100%`.
- **Color**: Radix UI Display-P3 palette (`@radix-ui/colors`), 24 hues × 12 shades + a 12-step gray scale.
- **Animation**: instant 75ms, fast 150ms, normal 300ms, slow 1500ms.

### Key reusable components

| Component | Path (`twenty-ui/src/...`) | Variants / props |
|---|---|---|
| **Chip** | `data-display/Chip/Chip.tsx` | `size` (Large/Small), `variant` (highlighted/regular/transparent/rounded/static), `accent`, `clickable`, `left/rightComponent` |
| **Tag** (colored pill for SELECT) | `data-display/Tag/Tag.tsx` | `color: ThemeColor` (24 named), `text`, `variant` (solid/outline/border), `weight`, `Icon`; colors via `--t-tag-background-{color}` / `--t-tag-text-{color}` |
| **Avatar / AvatarChip** | `data-display/Avatar/Avatar.tsx` | `size` xs–xl, `type` (squared/rounded/icon/app), `placeholder`, `avatarUrl`, deterministic color seed |
| **Button** | `input/Button/Button.tsx` | `size` (medium 32px/small 24px), `variant` (primary/secondary/tertiary), `accent` (default/blue/danger), `position` (standalone/left/middle/right for groups), `inverted`, `Icon`, `fullWidth` |
| **IconButton** | `input/IconButton/IconButton.tsx` | same variant/accent/position/size axes as Button |
| Icons | `icon/` + `@tabler/icons-react` | `IconsProvider` context |

Dropdowns/menus are largely composed in `twenty-front` (`src/modules/ui/layout/dropdown`) on top of `@floating-ui/react` and `@base-ui/react`, using `twenty-ui` menu-item primitives.

### Design language

Minimal, high-density, **Notion/Linear-adjacent**: Inter typeface, a strict **4px spacing grid**, **4px (sm) default radius**, subtle 12-step grays for hierarchy, and a large 24-hue palette reserved for tags/status. Zero-runtime CSS keeps dense table/board screens fast. Components expose a consistent 3-tier `variant` × `accent` × `size` matrix.

---

## 3. The Three Core Record Views

All three live under `src/modules/object-record`. The page entries are in `src/pages/object-record/` (`RecordIndexPage.tsx`, `RecordShowPage.tsx`). The index page hosts BOTH table and board; the active view type is held in Jotai (`recordIndexViewType`) and `RecordIndexContainer` switches between them.

Shared data hooks live in `src/modules/object-record/hooks/`:
- `useFindManyRecords.ts` — paginated list (cursor-based: `first`/`after`, `pageInfo.endCursor`/`hasNextPage`).
- `useFindOneRecord.ts` — single record by id.
- `useCreateOneRecord.ts`, `useUpdateOneRecord.ts`, `useDeleteOneRecord.ts`, plus `useFetchMoreRecordsWithPagination.ts`.
- GraphQL queries are **generated dynamically from metadata**: `generateFindManyRecordsQuery.ts`, `generateGroupByRecordsQuery.ts`, `useGenerateDepthRecordGqlFieldsFromObject` (selects fields/depth based on object metadata + view + permissions). Results are written into Apollo cache **and** mirrored into a Jotai `recordStore` for field-level reactive reads.

### (a) Record Table / index view — `record-table` + `record-index`

- Entry: `record-index/components/RecordIndexContainer.tsx` → `RecordIndexTableContainer` → `RecordTableWithWrappers` → `record-table/components/RecordTable.tsx` → `RecordTableContent.tsx` (header + body + `DragSelect`).
- Body: `record-table/record-table-body/components/RecordTableNoRecordGroupBody.tsx` (flat) or `RecordTableRecordGroupsBody` (grouped).
- **Virtualization is custom** (a "treadmill" of Jotai index→recordId selectors), NOT `react-data-grid` for the main grid: `record-table/virtualization/components/RecordTableRowVirtualizedFullData.tsx` maps a virtual `realIndex` → `recordId` via `recordIdByRealIndexComponentFamilySelector`; `RecordTableVirtualizedRowTreadmillEffect` tracks viewport + triggers fetch-more. (`react-data-grid` is a dependency used for the spreadsheet importer, not the record grid.)
- Cells: `record-table/record-table-row/components/RecordTableRowCells.tsx` iterates `visibleRecordFields`; each cell wraps a generic `FieldDisplay`/`FieldInput` (§5) inside a `FieldContext` provider supporting inline edit.
- Data: `useFindManyRecords` with filter/sort/limit derived from Jotai view state; infinite scroll via `useFetchMoreRecordsWithPagination` (cursor keyset).

### (b) Record Board / Kanban — `record-board`

- Entry: `RecordIndexContainer` → `RecordBoardContainer` → `record-board/components/RecordBoard.tsx`.
- DnD: **`@hello-pangea/dnd`** (`record-board/components/RecordBoardDragDropContext.tsx`) — `DragDropContext` + `Droppable` per column + draggable `RecordBoardCard`. On drop it updates the **SELECT/group field** value on the record (moving it between columns) and repositions; if a sort is active, drop is blocked.
- Columns are grouped by a SELECT field: the group field is in `recordIndexGroupFieldMetadataItemComponentState`; columns come from `recordGroupDefinitionsComponentSelector` (the select field's options). Record-ids per column live in `recordIndexRecordIdsByGroupComponentFamilyState` (atom family keyed by columnId).
- Data: a single **groupBy GraphQL query** (`generateGroupByRecordsQuery` via `useRecordIndexGroupsRecordsLazyGroupBy` / `useTriggerRecordBoardInitialQuery`) returns `{ groupByDimensionValues, edges }` per group; per-column fetch-more is cursor-based (`useTriggerRecordBoardFetchMore`, last-cursor tracked per columnId).
- Cards: `record-board/record-board-card/components/RecordBoardCard.tsx` renders a header (label-identifier field) + collapsible body of summary fields.

### (c) Record Show / detail page — `record-show` + `page-layout`

- Route `/object/:objectNameSingular/:objectRecordId` → `src/pages/object-record/RecordShowPage.tsx`.
- Hierarchy: `RecordShowPage` → `RecordComponentInstanceContextsWrapper` → `RecordShowPageHeader` + `PageLayoutRecordPageRenderer` (`record-show/components/PageLayoutRecordPageRenderer.tsx`) → `RecordShowEffect` (fires `useFindOneRecord`) + `PageLayoutRenderer` (renders the **DB-driven page layout**: tabs/sections/relation lists/timeline/custom widgets) + SSE subscribe effect for live updates.
- The detail layout is **data-driven**: a `PageLayout` entity (see `src/modules/page-layout`) defines tabs and widgets, so detail pages are configurable per object rather than hard-coded.
- Data: `useFindOneRecord({ objectNameSingular, objectRecordId, recordGqlFields })` (depth-1 by default; relation widgets fetch their own related records via `useFindManyRecords`). Real-time updates merge into Apollo cache via the SSE provider.

---

## 4. Filters, Sorts & View Management

- **View management module**: `src/modules/views/` — a "View" is a saved configuration (columns, filters, sorts, group-by, view type table/board) persisted server-side per object. Subdirs: `view-picker/` (switch/create views), `view-filter-value/`, `advanced-filter-chip/`, `editable-chip/`, plus `states/`, `hooks/`, `graphql/`, `schemas/`.
- **Filters**: `src/modules/object-record/record-filter/`, `object-filter-dropdown/`, `record-filter-group/`, and `advanced-filter/` (nested AND/OR groups; uses `json-logic-js`). Active filters live in Jotai component-state (`currentRecordFiltersComponentState`, `currentRecordFilterGroupsComponentState`) and are compiled into the GraphQL `filter` variable.
- **Sorts**: `src/modules/object-record/record-sort/` and `object-sort-dropdown/`. Active sorts (`currentRecordSortsComponentState`) compile into GraphQL `orderBy`.
- Pattern: the **view defines defaults**, an in-memory "current" layer (Jotai) holds unsaved edits, and a save flow persists changes back to the View. The same filter/sort state feeds table, board groupBy, and counts — one source of truth per object instance.
- These are built with **component state** scoped by an instance context (Jotai-based `componentState`/`componentFamilyState` from `src/modules/ui/utilities/state`), so the same UI works for multiple object instances on one screen.

---

## 5. Generic Metadata-Driven Field/Relation Rendering

This is the architectural heart: **every object, field, table column, board card, and detail field is rendered generically from metadata** — there is no per-object hand-written UI.

### Metadata model & loading

- Types: `src/modules/object-metadata/types/` — `ObjectMetadataItem`, `FieldMetadataItem.ts` (Field with per-type `settings`, `options`, `relation`, `morphRelations`), `EnrichedObjectMetadataItem.ts` (adds `readableFields`/`updatableFields` after permission filtering).
- Field UI types: `src/modules/object-record/record-field/ui/types/FieldMetadata.ts` (discriminated union over `FieldMetadataType`: TEXT, NUMBER, SELECT, MULTI_SELECT, RELATION, MORPH_RELATION, DATE, DATE_TIME, BOOLEAN, CURRENCY, ADDRESS, FULL_NAME, EMAILS, PHONES, LINKS, RICH_TEXT, FILES, …) and `FieldDefinition.ts` (UI wrapper: `{ fieldMetadataId, label, iconName, type, metadata, isUIEditable }`).
- Loaded at boot via GraphQL `FIND_MINIMAL_METADATA` (`metadata-store/hooks/useLoadMinimalMetadata.ts`, mounted by `metadata-store/effect-components/MinimalMetadataLoadEffect.tsx`), stored in Jotai; consumed via `object-metadata/hooks/useObjectMetadataItems.ts` / `useObjectMetadataItem.ts`.
- Bridge metadata→UI: `object-metadata/utils/formatFieldMetadataItemAsFieldDefinition.ts` turns a `FieldMetadataItem` into a typed `FieldDefinition`.

### Display / Input dispatchers (the abstraction)

- **Display dispatcher**: `record-field/ui/components/FieldDisplay.tsx` — a switch over `isFieldX(fieldDefinition)` type guards that renders the right per-type component (`TextFieldDisplay`, `SelectFieldDisplay`, `RelationToOneFieldDisplay`, `DateFieldDisplay`, `CurrencyFieldDisplay`, …). Per-type components in `record-field/ui/meta-types/display/components/`.
- **Input dispatcher**: `record-field/ui/components/FieldInput.tsx` — symmetric switch rendering `TextFieldInput`, `SelectFieldInput`, `RelationManyToOneFieldInput`, etc. (`.../meta-types/input/components/`).
- **Context**: `record-field/ui/contexts/FieldContext.ts` (`GenericFieldContextType`: `recordId`, `fieldDefinition`, `isRecordFieldReadOnly`, `isLabelIdentifier`, `useUpdateRecord`…). Each cell/field wraps children in a `FieldContext.Provider` (e.g. `record-table/record-table-cell/components/RecordTableCellFieldContextGeneric.tsx`).
- **Value read**: `record-store/hooks/useRecordFieldValue.ts` → `recordStoreFieldValueSelector` (Jotai family keyed by `{recordId, fieldName}`). Per-type hooks like `meta-types/hooks/useTextField.ts` assert the field type, pull the value, and manage a separate **draft value** while editing.
- **Persistence**: `record-field/ui/hooks/usePersistField.ts` validates `isFieldXValue(value)` matches the field type, then calls `updateOneRecord` and writes the value into the Jotai store (optimistic). Editing lifecycle (enter/escape/click-outside) flows through `FieldInputEventContext`.

**Extending field types** therefore requires only: a type guard + value validator + one display component + one input component. Everything else (cells, persistence, context, board cards) reuses the same path.

### Relations

- Relation metadata is embedded in `FieldMetadataItem.relation` (`type` MANY_TO_ONE/ONE_TO_MANY, nested `targetObjectMetadata`, `targetFieldMetadata`, join column). MORPH_RELATION carries an array `morphRelations` of polymorphic targets.
- To-one display: `meta-types/display/components/RelationToOneFieldDisplay.tsx` + `useRelationToOneFieldDisplay.ts` read both the related record value and its foreign key, then render a `RecordChip` (label/avatar produced by `PreComputedChipGeneratorsContext`, set up in the provider tree).
- To-one input: `RelationManyToOneFieldInput.tsx` renders a `SingleRecordPicker` scoped to the target object; to-many uses `MultiRecordPicker`.

---

## 6. The "Front-Component" / App-Block Extension Mechanism — and Why It's Constrained

This is the part where extensibility hits a wall. A "front-component" is a **custom UI block** an installed Application can contribute (to a page-layout widget, command menu, or side panel). It is **NOT arbitrary React running in the app** — it runs sandboxed in a Web Worker and renders through a serialization bridge with a fixed allowlist of primitives.

### Runtime: `packages/twenty-front-component-renderer`

Runtime deps (verified in its `package.json`): `@remote-dom/core`, `@remote-dom/react`, `@quilted/threads` (plus react/zod). (Chakra/MUI/emotion/styled-components appear only as **devDependencies** for Storybook — they are not available to authored components.)

Architecture = **Web Worker + Remote DOM**:
- **Host side**: `src/host/...` + `FrontComponentRenderer` create a `RemoteReceiver` and a `ThreadWebWorker`, then render the worker's serialized tree as real React via `@remote-dom/react/host`.
- **Worker side**: `src/remote/worker/remote-worker.ts` — fetches the built component source from the server, creates a blob URL, dynamically `import()`s it, and renders into a `remote-root`/`remote-fragment` whose mutations are serialized back to the host over the thread connection. Component code runs in a **separate JS realm with no access to the host scope, Jotai, Apollo, or React context.**

### The allowlist (the load-bearing constraint)

- `src/constants/AllowedHtmlElements.ts` — `ALLOWED_HTML_ELEMENTS`: ~120 approved HTML/SVG tags (`div`, `span`, `button`, `input`, `img`, `svg`, `path`, table tags…), each with a **typed property schema** (`src/constants/PropertySchema.ts`: `{ type: 'string'|'number'|'boolean', optional }`). Anything outside this list cannot be created.
- `src/host/generated/host-component-registry.ts` — a generated `Map<tag, renderer>` mapping each allowed tag to a React host wrapper. It is generated by a build script, not hand-maintained.

### Host communication API (the only bridge)

`src/types/FrontComponentHostCommunicationApi.ts` exposes a **fixed, small set** of host functions a component may call: `navigate`, `requestAccessTokenRefresh`, `openSidePanelPage`, `openCommandConfirmationModal`, `unmountFrontComponent`, `enqueueSnackbar`, `closeSidePanel`, `updateProgress`, `copyToClipboard`. There is no general-purpose escape hatch. Data flows in through an execution context (`FrontComponentExecutionContext`: selected record ids, user, color scheme, application variables) — not via shared state.

### How it's rendered in the app

- `twenty-front/src/modules/front-components/components/FrontComponentRenderer.tsx` resolves the `FrontComponent` metadata (built bundle URL + checksum + `usesSdkClient`) and mounts the renderer; `SdkClientBlobUrlsEffect.tsx` fetches the **host-controlled SDK bundles** as blob URLs and rewrites the component's `twenty-client-sdk/*` imports so the worker uses the host's SDK version.
- As a page widget: `twenty-front/src/modules/page-layout/widgets/front-component/components/FrontComponentWidgetRenderer.tsx` lazy-loads the renderer for a `FRONT_COMPONENT` page-layout widget, passing `frontComponentId` + `selectedRecordIds`.

### Build pipeline (where authoring is constrained)

Custom components are authored in JSX but must be **pre-built by the `twenty-sdk` CLI**, which transforms JSX into Remote-DOM calls and inlines dependencies. The only permitted external modules are the Twenty SDK packages (`twenty-client-sdk/core`, `twenty-client-sdk/metadata`) — see `twenty-sdk/.../front-component-build/constants/front-component-external-modules.ts`. Arbitrary npm packages are bundled or unavailable; arbitrary React hooks / host context are not reachable.

### WHY it's constrained (architectural reasons — the wall the client hit)

1. **Serialization model**: Remote-DOM only transmits DOM-tree mutations, not running JS — so a component can only express what serializes (no function props passed to host, no live objects/observables).
2. **Worker isolation**: code runs in a different realm → no access to the host's Jotai atoms, Apollo cache, React context, theme JS, or any app hook. You build from primitives + the explicit API only.
3. **Fixed primitive allowlist**: ~120 HTML/SVG tags with typed prop schemas; you cannot use Twenty's own design-system React components (Button/Chip/Tag/etc.) directly — you re-implement appearance from raw elements (styled via the style bridge).
4. **No arbitrary dependencies**: only the Twenty SDK is an allowed external; everything else must be bundled.
5. **Tiny host API surface**: 9 explicit functions; no general data fetching/mutations except through the SDK client the host injects.
6. **Version coupling**: the host injects the SDK as blob URLs and rewrites imports to avoid version skew — meaning a component built against one SDK version is sensitive to the host/server version. (This matches the team's prior memory note about SDK 2.13.0 vs server 2.13.2 skew breaking custom front-components.)

**Net implication for a bespoke build**: Twenty's extension model is deliberately security/sandbox-first, which makes it poor for rich, deeply-integrated custom UI that needs the design system, app state, or arbitrary libraries. A team building its own CRM that wants first-class custom views should instead make custom screens **first-party React** (composing the design system and data hooks directly) rather than recreate this sandboxed, allowlist-limited renderer.

---

## Quick "borrow this / avoid that" summary for a new build

Borrow: metadata-driven `FieldDisplay`/`FieldInput` dispatcher + `FieldContext`; one cursor-paginated `useFindManyRecords` hook with metadata-generated GraphQL; Jotai component-scoped state for view/filter/sort; SCSS-module or token-CSS-variable design system (Inter, 4px grid, 4px radius, 24-hue tag palette); render-less `*Effect` components for side-effects; DB-driven page-layout for detail screens.

Reconsider: the heavy Remote-DOM/Worker sandbox for in-house custom components (overkill unless you run untrusted third-party code) — prefer first-party React screens that reuse the design system and data layer.
