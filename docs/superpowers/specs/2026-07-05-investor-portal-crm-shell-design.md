# Investor Portal — CRM Design Language (Design Spec)

**Date:** 2026-07-05
**Branch:** `feat/InvestorsPage`
**Goal:** The investor portal (`/portal/investor/*`) must share the CRM design language of the admin app (`/(crm)/*`): dark emerald sidebar with brand mark, sticky white topbar with page title/subtitle and right-side controls, zinc-50 content canvas. The partner portal (`/portal/partner/*`) must remain **pixel-identical** to today.

## Current state

- `src/app/portal/layout.tsx` — shared "external portal" shell for BOTH investor and partner: amber "Viewing as" demo-lens banner (with `PortalSwitcher` + "Return to Admin"), dark emerald page header ("NobleStride Capital / Investor|Partner Portal"), centered `max-w-5xl` main, confidentiality footer.
- `src/app/portal/investor/layout.tsx` — adds `InvestorNav` tab pills (Opportunities / My Pipeline / Fund Profile).
- `src/app/portal/partner/layout.tsx` — adds `PartnerTabs`.
- Admin shell: `src/app/(crm)/layout.tsx` + `src/components/shell/sidebar.tsx` (dark `#0b1a14` sidebar, `BrandMark`, `NavItem` with emerald active accent, section labels) + `src/components/shell/topbar.tsx` (sticky h-16 white topbar: title block w-52, center AskBar, right controls: viewpoint switcher, search pill, bell with badge, avatar).

## Decision (Approach 3 — split shells at the nested-layout level)

1. **`src/app/portal/layout.tsx`** becomes a pass-through (`children` only, keep `export const dynamic = "force-dynamic"` so both sub-trees stay dynamic). All shell markup and data fetching moves down a level.

2. **New shared server component `src/components/portal/viewing-banner.tsx`** — the amber demo-lens banner extracted **verbatim** from today's `portal/layout.tsx` (fetches investors/partners, resolves viewpoint, renders `PortalSwitcher`, classification hint, "Return to Admin"). Used by both portal shells so the demo lens stays consistent.

3. **`src/app/portal/partner/layout.tsx`** — absorbs the old external shell unchanged: `min-h-screen bg-zinc-50` wrapper → `ViewingBanner` → emerald header (hardcoded "Partner Portal") → `max-w-5xl` main containing `PartnerTabs` + children → confidentiality footer. Partner output must be byte-identical (verified by HTML diff).

4. **`src/app/portal/investor/layout.tsx`** — new CRM-style shell:
   - Outer: `flex h-screen flex-col overflow-hidden`.
   - Row 1: `ViewingBanner` (flex-shrink-0).
   - Row 2: `flex flex-1 overflow-hidden` → `InvestorSidebar` + content column (`flex flex-1 flex-col min-w-0 overflow-hidden`) → `InvestorTopbar` (sticky) → `main` = `flex-1 overflow-y-auto bg-zinc-50 p-6`, children followed by the confidentiality line (`pt-8 text-xs text-zinc-400`).
   - Keeps investor-role gating exactly as pages already do (pages redirect; layout does not need to).

5. **`src/components/shell/sidebar.tsx`** — export existing internals (`BrandMark`, `NavItem`, `SIDEBAR_FG`) so they can be reused. **No visual/behavioral change to the admin sidebar.**

6. **New `src/components/portal/investor-sidebar.tsx`** (`"use client"`) — same visual system as admin sidebar (`#0b1a14`, w-64, BrandMark at top) but:
   - Section label **"Portal"** with nav: Opportunities (`LayoutGrid`, href `/portal/investor`, active also for `/deals/*`), My Pipeline (`TrendingUp`, `/portal/investor/pipeline`), Fund Profile (`Building2`, `/portal/investor/profile`). Active-state logic mirrors today's `InvestorNav.isActive`.
   - No AGENTS grid, no Settings (internal-only affordances).
   - Bottom: collapse chevron section (visual parity with admin) preceded by a small uppercase "Investor Portal" label block (replaces the old emerald header's role tag).
   - Height: `h-full` (NOT `h-screen sticky` — banner sits above in a flex column).

7. **New `src/components/portal/investor-topbar.tsx`** (`"use client"`) — same structure/classes as admin topbar (sticky h-16, border-b, white):
   - Title block (w-52): route→meta map — `/portal/investor` → "Opportunities / Deals matching your mandate"; `/portal/investor/deals/*` → "Opportunities"; `/pipeline` → "My Pipeline / Your journey on each opportunity"; `/profile` → "Fund Profile / Preferences that drive deal matching".
   - Center: flex-1 spacer (no AskBar — agents are internal-only).
   - Right: search pill, notification bell **without** the fake count badge, `Avatar` with the investor fund's initials (name passed as prop from the layout, which already knows the viewpoint) in `bg-emerald-600`.

8. **Delete `src/components/portal/investor-nav.tsx`** — tab pills are replaced by sidebar nav. `portal/investor/layout.tsx` was its only consumer.

9. **Page-level tweaks (investor pages only):**
   - `portal/investor/page.tsx`: opportunity grid gains `lg:grid-cols-3` (full-width canvas).
   - Pages keep their in-content `h1` blocks — the admin dashboard does the same (title in topbar AND content).
   - No other page changes.

## Not in scope
- Partner portal (`/portal/partner/*`, `PartnerTabs`) — untouched, byte-identical output.
- Admin shell behavior — only additive exports in `sidebar.tsx`.
- Auth/visibility logic — no changes to `getViewpoint`, visibility engine, or actions.

## Error handling
- Non-investor viewpoints hitting `/portal/investor/*` are already redirected by each page; the new layout renders shell-only in that instant — same as today.
- `ViewingBanner` inherits today's behavior for org-role viewpoints (renders role name capitalized, no switcher).

## Testing / verification
1. `npm run lint`, `npm run test`, `npm run build` all pass.
2. **Partner regression proof:** capture `/portal/partner` HTML (partner viewpoint cookie) before and after; diff must show no structural change.
3. **Investor smoke:** with dev server + investor viewpoint cookie, `/portal/investor`, `/pipeline`, `/profile`, and a `/deals/[id]` page render the sidebar (`NobleStride`, `Portal` section, three nav items), topbar title block, amber banner, and page content.
4. Admin `/dashboard` unchanged (sidebar exports are additive).
