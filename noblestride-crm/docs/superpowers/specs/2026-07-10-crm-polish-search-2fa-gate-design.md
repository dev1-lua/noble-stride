# CRM Polish, Global Search & 2FA Gate — Design

**Date:** 2026-07-10
**Branch:** integration/all-features
**Scope:** Four build workstreams (Tasks 1–4). Tasks 5 (Playwright E2E pass) and 6 (scoping-doc audit) are verification/audit passes that run *after* this work lands and are specified separately.

---

## Background & Motivation

Two user-reported problems and two feature requests:

1. **Investor portal looks flat/colorless** vs the admin dashboard — sidebar icons are gray, pages are bright white with borders that are hard to distinguish.
2. **Borders/field boundaries are indistinct across the whole CRM** (admin + investor + onboarding), especially form fields (e.g. Fund Profile inputs).
3. **Topbar "Search…" is decorative** — the user wants to know what it does and to have real in-project search.
4. **2FA is effectively broken for real clients** — it runs on a free personal Resend key that can only email the account owner's own address, so every other investor's OTP fails and they are blocked.

### Root causes (verified in code)

- **Design tokens** live entirely in `src/app/globals.css` (Tailwind v4, `@theme`; there is no `tailwind.config`). Admin and portal share the *same* tokens and even the same shell `NavItem`/`Card` components.
- **Portal icons are gray** because `src/components/portal/investor-sidebar.tsx` never passes an `iconColor` to `NavItem`; the item falls through `iconColor ?? "text-[var(--text-tertiary)]"` (`src/components/shell/sidebar.tsx:88-90`). Admin assigns each nav item a tag-palette color (`src/components/shell/sidebar.tsx:25-35`).
- **Flatness is system-wide**: there are **no elevation/shadow tokens** on base surfaces anywhere in `globals.css`. Separation relies solely on one hairline border, `--border-subtle: #e9ecef`, on white `#ffffff` — a very low-contrast pairing.
- **Portal pages hand-roll surfaces**: the literal `rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)]` appears ~14× across `src/app/portal/investor/**` instead of importing the shared `Card`. The portal imports only `StatCard` from `@/components/ui`, never `Card`.
- **Topbar search** (`src/components/shell/topbar.tsx:113-121` and `src/components/portal/investor-topbar.tsx:25-32`) is a bare uncontrolled `<input>` with no `value`/`onChange`/`onSubmit`/route/API. There is no global search page, no `/api/search`, no command palette anywhere. The working center element in admin is the AI `AskBar` (GraphQL `aiAsk`), a different feature.
- **2FA gating** is decided solely by `mailProvider()` in `src/server/auth/mailer.ts:11-13` (`RESEND_API_KEY` present ⇒ `"resend"`, else `"console"`). Investor login branches to OTP in `src/server/auth/login.ts:56-74`; on delivery failure it returns `otp_unavailable`, which blocks login in production.

---

## Task 1 + 2 — Design Unification (subtle, whole-CRM)

**Decision:** "Subtle global + parity." Fix at the token/component level so admin, investor portal, and the onboarding wizard all improve at once. Keep it calm, not a bold restyle.

### 1a. Elevation token (system-wide)

Add a subtle elevation token to `src/app/globals.css`:

```css
--shadow-card: 0 1px 2px rgba(16, 25, 29, 0.04), 0 1px 3px rgba(16, 25, 29, 0.06);
```

Apply it to the shared `Card` (`src/components/ui/card.tsx`). This gives quiet depth in place of flat white and is the single biggest lever for "I can't distinguish surfaces."

### 1b. Stronger borders (system-wide)

- The shared `Card` moves its border from `--border-subtle` (#e9ecef) to `--border-strong` (#dee2e6).
- The `Input` (`src/components/ui/input.tsx:31-37`) and the `fields.tsx` wrappers move their resting border to `--border-strong` so form-field boundaries are clearly visible — this is the direct fix for the Fund Profile screenshot. Keep the emerald focus ring as-is.
- `--border-subtle` remains the hairline for internal dividers (card headers, table rows) so we don't over-darken everything.

### 1c. Portal sidebar icon colors (Task-1 explicit ask)

In `src/components/portal/investor-sidebar.tsx`, attach a tag-palette `iconColor` to each portal nav item (Opportunities, My Pipeline, Dashboard, Fund Profile) and pass it into `NavItem` — mirroring the admin `MAIN_NAV` pattern. `NavItem` already supports `iconColor`; only the caller needs to supply it. Inactive icons then render in color; active stays emerald.

### 1d. Portal surfaces adopt the shared Card

Replace the ~14 hand-rolled `<div>` surfaces in `src/app/portal/investor/**` with `Card`/`CardHeader`/`CardBody`. Use colored `StatCard` icon chips on the portal dashboard the way admin does. Net effect: portal reads as visually equivalent to admin with no per-token divergence.

### Non-goals

- No new color scheme, no font changes, no layout restructuring.
- No dark mode work.
- No unrelated refactor of admin pages beyond what the shared token/component changes touch automatically.

### Testing

- Visual: Playwright MCP screenshots of admin dashboard, an admin detail page, investor portal dashboard, investor Fund Profile, and the onboarding wizard — before/after, confirming visible borders, subtle elevation, and colored portal icons.
- Existing Vitest component tests for `Card`/`Input` must still pass; update snapshots/assertions if they pin the old border token.

---

## Task 3 — Global In-Project Search

**Decision:** Build a real global search on **both** sides; portal scoped to what the investor may see.

### Backend

Add a GraphQL query `globalSearch(query: String!, limit: Int): [SearchResult!]!` resolving across the user-facing entities: **Investor, Client, Mandate, Transaction (deals), Partner, ServiceProvider, Document, Task, Person, Engagement**.

- Each result: `{ id, type, title, subtitle, href }`.
- **Security is the core requirement:** every branch runs through the existing visibility layer (`src/server/visibility/project.ts` and the same RBAC used by the list resolvers) so results never leak codename-masked client identities (cf. BUG-01 in the assessment log). Investor-kind users only match records they are permitted to see. This is verified by tests, not assumed.
- Case-insensitive substring match on the natural name/title fields per entity; capped result count per type to bound cost.

### Frontend

- A lightweight command-palette component (no new dependency — build on existing UI primitives). Opens on **Cmd/Ctrl-K** and by clicking the topbar search box.
- Wire the currently-decorative topbar inputs in `src/components/shell/topbar.tsx` and `src/components/portal/investor-topbar.tsx` to open the palette.
- Debounced query → `globalSearch`; results grouped by entity type with icons; Enter/click navigates to the entity's detail route (reuse `ROUTE_META` mapping already in `topbar.tsx`).
- Empty/loading/no-results states.

### Testing

- Resolver unit tests: an internal user sees matches across all types; an investor user sees only permitted records and **never** a masked/pre-interest client's real identity.
- Component test: palette opens on shortcut, debounces, renders grouped results, navigates on selection.
- Playwright MCP: Cmd-K → type a known seed name → click result → lands on the right detail page (admin and portal).

---

## Task 4 — 2FA Gate (Option B: the key is the switch)

**Decision:** No separate flag. 2FA is enforced when `RESEND_API_KEY` is present and bypassed (password-only login) when it is absent.

### Changes

- Add `twoFactorEnabled()` helper (co-located with the mailer, reusing `mailProvider() === "resend"`).
- In `src/server/auth/login.ts:56-74`, only enter the OTP branch when `twoFactorEnabled()` is true. When false, issue the session directly for investor accounts (password-only) instead of ever returning `otp_required`/`otp_unavailable`. This removes the production login block when no key is configured.
- Keep the existing OTP path (create challenge → mail → verify → trust cookie) exactly as-is for when a key *is* present.
- `.env.example`: document that setting a real, domain-verified `RESEND_API_KEY` turns 2FA on; absence turns it off. Mirror the SharePoint gate's comment style.
- Verify page copy unaffected (only reached when 2FA is on).

### Testing

- Unit: with `RESEND_API_KEY` unset, investor `loginWithPassword` returns `ok` with a session and never `otp_required`. With it set, the OTP branch is taken (existing smoke test `login-otp-delivery.smoke.test.ts` still holds).
- Regression: the dev-otp-sink path remains inert when Resend is configured.

---

## Follow-on (specified separately, run after 1–4)

- **Task 5 — Playwright E2E MD scripts + bug/security pass.** Author dated MD test scripts covering every route/role/security surface following the `playwright assessment/` convention, execute via the Playwright MCP, and log findings. Runs after 1–4 so it exercises these changes.
- **Task 6 — Scoping-doc audit.** Read `NobleStride_Full_Scoping_Document.docx` word by word and produce a conformance/gap report against the built CRM. Kept last so it also captures 1–5.

---

## Implementation Process

Per the user's rule: **Sonnet implements each task; Opus reviews at the end** once all four build tasks are complete (one consolidated review, not per-task), with the bar that code quality must not be compromised and everything must work. Build order: (1+2) design → (3) search → (4) 2FA. Then the review, then Task 5, then Task 6.
