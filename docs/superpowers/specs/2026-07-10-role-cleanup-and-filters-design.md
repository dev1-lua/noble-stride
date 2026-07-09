# Design — Role-based visibility cleanup, shell polish & searchable multi-select filters

Date: 2026-07-10
Status: Approved (brainstorming), pending spec review

## Context

The CRM currently ships a **demo "view as" lens**: an admin-only topbar switcher
(`ViewpointSwitcher`) that lets an admin impersonate an investor/partner or view the
CRM through a Deal Lead / Team Member org-role lens. This was built for demos and is
layered on top of the real-role resolution that already exists in
`server/auth/current.ts::resolveViewpointFor`.

We are removing the demo apparatus so that **real login role governs everything**, and
polishing the shell (sign-out placement, sidebar profile block), verifying auth, and
replacing all filter dropdowns with a searchable multi-select component.

Key confirmed facts:
- Real-role resolution already maps: `INTERNAL Admin → admin`, `INTERNAL non-admin →
  admin surface scoped to their role`, `INVESTOR → investor portal`.
- Account kinds are only `INTERNAL` and `INVESTOR`. **There is no partner login.** The
  partner portal is reachable today *only* via the admin lens; removing the lens leaves
  it dormant (code stays, no entry point until real partner auth is built). Accepted.
- Internal non-admin members (Deal Lead, Team Member) see the **same admin/CRM side** as
  Admin, restricted by the RBAC matrix (`server/rbac/matrix.ts`). Enforcement stays
  **UI-level** (hidden controls), matching current design. Confirmed.
- Account/session identity is keyed on `AuthAccount.id`, a **cuid** (not RFC-4122 UUID).
  Login resolves by that stable id via DB sessions, never by email at request time.

## Tasks

### Task 3 — Remove the demo viewing lens
Delete all demo-lens apparatus; real role drives the viewpoint.
- Remove `<ViewpointSwitcher>` usage + the `switcherEnabled`/`activeOrgRole`/`activeUserId`
  props from `components/shell/topbar.tsx`; delete `components/shell/viewpoint-switcher.tsx`.
- Delete `src/app/api/viewpoint/route.ts`.
- In `server/auth/current.ts::resolveViewpointFor`, remove the
  `if (user.role === "Admin" && impersonationJwt)` override so the base (real-role)
  viewpoint is always returned. Remove now-dead `impersonation.ts` verify/sign plumbing
  and the `IMPERSONATION_COOKIE` handling. Keep `resolveViewpointFor`'s signature stable
  where callers still pass an arg, or simplify callers — implementation plan decides.
- Remove the "Viewing as … demo lens" banner block in `(crm)/layout.tsx` and stop passing
  lens props to `Topbar`. Simplify `getOrgLens`/notification logic to use the real user id.
- Remove the portal `viewing-banner.tsx` and its usages.
- Investor portal "view as" switcher gating (`impersonating`) is removed with the lens.

Non-goal: deleting the partner portal code. It stays, dormant.

### Task 2 — Remove demo banner on Access Matrix
- Remove the amber demo banner (`access-matrix.tsx` lines 42–46).
- Make the matrix genuinely read-only: drop the in-session toggle/`Reset to defaults`
  interaction, render the RBAC matrix as static cells. Page remains as a reference.

### Task 6 — Remove Sign out from topbar(s)
- Remove the `logoutAction` form/button from `components/shell/topbar.tsx`.
- Remove any equivalent sign-out control from the investor/partner portal topbars
  (`components/portal/investor-topbar.tsx` and partner equivalent, if present).
- Only the left-sidebar logout remains (upgraded in Task 7).

### Task 7 — Sidebar profile block with logout dropdown
- Replace the sidebar footer "Sign out" row in `components/shell/sidebar.tsx` with a
  **profile block**: avatar + display name, falling back to email when name is absent.
- Clicking it opens an **upward-facing dropdown** (menu above the block) containing the
  logout action (the existing `logoutAction` server action).
- Sidebar becomes a client component with local open/close state + outside-click close.
- Sidebar needs the current user's name/email → pass from `(crm)/layout.tsx` (already
  fetches `getCurrentAuth()`), and mirror for the investor sidebar
  (`components/portal/investor-sidebar.tsx`).
- Remove the standalone avatar from the topbar (moved to sidebar).

### Task 4 — Verify id-based login
- Verification pass: confirm login → session(accountId) → request identity resolves by
  `AuthAccount.id`; email is only the login lookup key, not the request-time identity.
- Run auth test suites (`server/auth/__tests__/*`). Report results.
- Flag cuid-vs-UUID naming; real UUIDs would be a separate migration (out of scope).

### Task 5 — Verify role → route redirects
- Confirm `loginWithPassword` home routing (`INTERNAL → /dashboard`,
  `INVESTOR → /portal/investor`) and that `(crm)/layout.tsx` + portal layouts bounce
  mismatched roles.
- Verify the `next` param cannot land a role on the wrong surface (layout guards catch
  it; confirm and, if needed, constrain `next` per role).

### Task 1 — Searchable multi-select filters
- New shared primitive `components/ui/multi-select.tsx` (name TBD in plan):
  popover trigger showing a chip/label summary; panel with a search input and a
  checkable option list; keyboard + outside-click close; theme-aware; accessible.
- Filter engine contract change: `TableFilter.get` and `applyTableFilters`
  (`components/crm/table-filter.ts`) move from single-string equality to
  **array / OR-matching within a filter** (empty selection = no constraint). Update
  `table-filter.test.ts`.
- Wire the new component into:
  - `components/crm/table-search.tsx` (covers clients, partners, documents, tasks,
    service-providers, users).
  - `components/crm/filter-bar.tsx` (investors: type/sector/geography/status).
  - `components/crm/deals-filter-bar.tsx` (deals: type/status/sector/ticket/**lead**/
    priority/source/group — Lead is the broad set).
  - `components/portal/opportunity-filters.tsx` (migrate off raw `<select>`:
    sector/country/dealType/instrument).
- URL-param encoding for multi-value filters (comma-joined) where filters are
  server-driven (investors, deals); client-only filters keep state locally.
- Every filter becomes multi-select; the in-dropdown search shows on all.

## Execution order (SDD)
3 → 2 → 6 → 7 → 4 → 5 → 1, then a single Opus review of the whole diff, then a
Playwright end-to-end QC pass.
Sonnet implements each task; Opus reviews once at the end for vulnerabilities, bugs,
regressions, and design fidelity.

### Final — Playwright end-to-end QC (in depth)
Run once, after Opus review, when everything is done. Log in as Admin, internal
non-admin (Deal Lead / Team Member), and Investor, and verify:
- Correct landing route per role; no lens UI anywhere.
- Access Matrix: no demo banner, read-only.
- No topbar sign-out; sidebar profile block shows name (email fallback) with a working
  upward logout dropdown.
- Searchable multi-select filters work on every list page (CRM + portal).
Update the `playwright assessment/` living QA log.

## Testing strategy
- Unit: `table-filter.test.ts` updated for array matching; viewpoint tests updated for
  lens removal; auth smoke tests run for Task 4.
- Manual/browser (single pass at the end, per project convention): log in as Admin,
  internal non-admin, and investor; confirm correct landing route, no lens UI, sidebar
  profile + logout dropdown, no topbar sign-out, and multi-select filters on each list.

## Out of scope
- Partner login / partner portal reachability.
- Migrating cuid → RFC-4122 UUID.
- Server-side (non-UI) RBAC enforcement.
