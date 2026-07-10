# CRM Polish, Global Search & 2FA Gate — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax. **Do NOT commit** — the user wants the working tree left dirty for review. Replace commit steps with the verification block at the end of each task.

**Goal:** Unify the whole CRM onto the admin design language (visible borders, subtle elevation, colored portal icons), add a real permission-scoped global search, and gate 2FA behind the presence of `RESEND_API_KEY`.

**Architecture:** Token/component-level design changes in `globals.css` + shared `ui/` components so admin + portal + onboarding all update at once. A GraphQL `globalSearch` resolver (routed through the existing visibility layer) feeding a lightweight command palette wired to the topbar boxes. A `twoFactorEnabled()` gate short-circuiting the OTP branch in the login flow.

**Tech Stack:** Next.js 16 (App Router), React, Tailwind v4 (`@theme` in `globals.css`), GraphQL (Yoga/Pothos-style schema under `src/server` + `src/graphql`), Prisma + PostgreSQL, Vitest.

## Global Constraints

- **No commits.** Leave the working tree dirty. Verify with `pnpm tsc --noEmit` (or `pnpm typecheck` if defined), `pnpm test` (Vitest), and a running dev server; do not `git add`/`git commit`.
- Design tokens live only in `src/app/globals.css` (no `tailwind.config`). Consume tokens via `var(--…)`; do not hardcode hex.
- Follow existing patterns: shared surfaces use `@/components/ui` `Card`/`CardHeader`/`CardBody`; nav uses the shared `NavItem`.
- All search results MUST pass through the existing visibility/RBAC layer (`src/server/visibility/project.ts`) — never leak codename-masked client identities.
- Verify OTP env: `pnpm exec prisma db seed` (NOT `pnpm seed`). Dev server default port 3000 (use another if occupied).
- Seed creds: admin `evans@noblestride.capital`, investor `cmiriti@ifc.org`, password `NobleStride!Demo2026`.

---

### Task A: Design tokens + shared components (whole-CRM foundation)

**Files:**
- Modify: `src/app/globals.css` (add `--shadow-card` to the `@theme` token block near lines 30–55)
- Modify: `src/components/ui/card.tsx` (add shadow + border-strong to the base `Card`)
- Modify: `src/components/ui/input.tsx` (resting border → border-strong)
- Modify: `src/components/ui/fields.tsx` (field wrappers → border-strong)

**Interfaces:**
- Produces: CSS var `--shadow-card`; `Card` now renders `shadow-[var(--shadow-card)] border-[var(--border-strong)]`; `Input`/fields resting border is `--border-strong`, focus ring unchanged (emerald).

- [ ] Add `--shadow-card: 0 1px 2px rgba(16,25,29,0.04), 0 1px 3px rgba(16,25,29,0.06);` to the token block in `globals.css`.
- [ ] In `card.tsx`, change the base class from `border-[var(--border-subtle)]` to `border-[var(--border-strong)]` and append `shadow-[var(--shadow-card)]`.
- [ ] In `input.tsx` and `fields.tsx`, change resting `border-[var(--border-subtle)]` → `border-[var(--border-strong)]`. Keep the emerald focus ring.
- [ ] **Verify:** `pnpm tsc --noEmit` clean; `pnpm test` — update any snapshot/class assertion in `ui/__tests__` that pinned the old token; all green.

---

### Task B: Portal parity — colored sidebar icons + Card adoption

**Files:**
- Modify: `src/components/portal/investor-sidebar.tsx` (add `iconColor` per nav item)
- Modify: `src/app/portal/investor/page.tsx`, `pipeline/page.tsx`, `dashboard/page.tsx`, `profile/page.tsx`, `deals/[id]/page.tsx` (swap raw-div surfaces → `Card`)

**Interfaces:**
- Consumes: `NavItem` `iconColor` prop (already exists, `src/components/shell/sidebar.tsx:88-90`); `Card`/`CardHeader`/`CardBody` from `@/components/ui/card`.

- [ ] In `investor-sidebar.tsx`, give each nav item a tag-palette `iconColor` (e.g. Opportunities→emerald, My Pipeline→amber, Dashboard→sky, Fund Profile→violet — match admin's semantics) and pass it into `NavItem`.
- [ ] Replace the ~14 inline `rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)]` surfaces across the portal pages with `Card`/`CardHeader`/`CardBody`. Preserve existing padding/content; use `CardHeader` where a div had a title row.
- [ ] On `portal/investor/dashboard/page.tsx`, ensure the KPI `StatCard`s use colored icon chips (tag-palette), matching admin.
- [ ] **Verify:** `pnpm tsc --noEmit` clean; dev server → screenshot portal dashboard + Fund Profile: icons colored, surfaces have visible borders + subtle elevation, field boundaries clear.

---

### Task C: Global search backend (GraphQL, visibility-scoped)

**Files:**
- Create: `src/server/search/global-search.ts` (search service)
- Modify: GraphQL schema + resolver files under `src/graphql` / `src/server/graphql` (add `globalSearch` query + `SearchResult` type — follow the existing resolver registration pattern)
- Test: `src/server/search/__tests__/global-search.test.ts`

**Interfaces:**
- Produces: GraphQL `globalSearch(query: String!, limit: Int = 8): [SearchResult!]!`; `SearchResult { id: ID!, type: String!, title: String!, subtitle: String, href: String! }`.
- Consumes: existing visibility/RBAC helpers (`src/server/visibility/project.ts`) and the authenticated context (viewer).

- [ ] Write failing test: an INTERNAL viewer searching a known seed term gets results spanning multiple entity types; an INVESTOR viewer gets only permitted records and NEVER a pre-interest client's real identity (assert the masked codename is returned, not the real name).
- [ ] Implement `globalSearch`: case-insensitive `contains` match per entity (Investor, Client, Mandate, Transaction, Partner, ServiceProvider, Document, Task, Person, Engagement), each capped at `limit`, each filtered through the same visibility predicate the list resolvers use. Map to `{id,type,title,subtitle,href}` using `ROUTE_META` route conventions.
- [ ] Register the query in the schema/resolver map following the existing pattern (mirror how e.g. the investors list query is wired).
- [ ] **Verify:** `pnpm test src/server/search` green; `pnpm tsc --noEmit` clean.

---

### Task D: Command palette + topbar wiring

**Files:**
- Create: `src/components/search/command-palette.tsx`
- Modify: `src/components/shell/topbar.tsx:113-121` (wire admin search box)
- Modify: `src/components/portal/investor-topbar.tsx:25-32` (wire portal search box)
- Test: `src/components/search/__tests__/command-palette.test.tsx`

**Interfaces:**
- Consumes: `globalSearch` GraphQL query (Task C).
- Produces: `<CommandPalette />` (self-contained, manages open state + Cmd/Ctrl-K listener) and a `SearchTrigger` button used by both topbars.

- [ ] Write failing component test: palette opens on Cmd/Ctrl-K and on trigger click; debounced query calls `globalSearch`; results render grouped by `type`; selecting a result navigates to its `href`.
- [ ] Implement `CommandPalette`: modal overlay (reuse existing dialog/drawer primitives + `--shadow-*` overlay tokens), debounced input, grouped results with entity icons, keyboard nav, empty/loading/no-result states. Global Cmd/Ctrl-K listener.
- [ ] Replace the decorative `<input>` in both topbars with the `SearchTrigger` that opens the palette. Portal instance uses the same query (server scopes results to the investor).
- [ ] **Verify:** `pnpm test src/components/search` green; dev server → Cmd-K, type a seed name (admin + investor), select → lands on correct detail route.

---

### Task E: 2FA gate (Option B — key is the switch)

**Files:**
- Modify: `src/server/auth/mailer.ts` (export `twoFactorEnabled()`)
- Modify: `src/server/auth/login.ts:56-74` (guard the OTP branch)
- Modify: `.env.example` (document the gate)
- Test: `src/server/auth/__tests__/login-otp-delivery.smoke.test.ts` (+ a gate-off case)

**Interfaces:**
- Produces: `twoFactorEnabled(): boolean` = `mailProvider() === "resend"`.
- Consumes: existing `issueLoginOtp`, `verifyTrust`, session creation.

- [ ] Write failing test: with `RESEND_API_KEY` unset, investor `loginWithPassword` returns `{ ok: true }` with a real session and never `otp_required`/`otp_unavailable`. With it set, the OTP branch is still taken.
- [ ] Add `twoFactorEnabled()` to `mailer.ts`.
- [ ] In `login.ts`, wrap the `account.kind === "INVESTOR"` OTP block in `if (twoFactorEnabled())`. When false, fall through to normal session issuance (password-only).
- [ ] Update `.env.example`: comment that a real domain-verified `RESEND_API_KEY` turns 2FA on; absence turns it off (mirror the SharePoint gate comment style).
- [ ] **Verify:** `pnpm test src/server/auth` green; `pnpm tsc --noEmit` clean.

---

## Consolidated verification (after A–E, before QA)

- [ ] `pnpm tsc --noEmit` — zero errors.
- [ ] `pnpm test` — full Vitest suite green (note pre-existing baseline count).
- [ ] `pnpm build` — succeeds.
- [ ] Opus review of the full diff for quality + correctness; fix findings.

## Self-Review (plan vs spec)

- Spec 1a/1b (elevation + borders) → Task A. Spec 1c (portal icons) + 1d (Card adoption) → Task B. Spec Task 3 backend → Task C, frontend → Task D. Spec Task 4 → Task E. No spec requirement is unaddressed.
- No placeholders: every task names exact files and a concrete verify command.
- Type consistency: `globalSearch`/`SearchResult` shape and `twoFactorEnabled()` signature are identical across Tasks C/D/E.
