# 06 — Cross-Cutting: Responsive, Notifications, AskBar, Accessibility, Console Hygiene, Visual Regression

Applies across every route in `02`–`05`. Run this script's checks opportunistically while executing
the other scripts (note results inline there), OR run it as a standalone sweep at the end. Either way,
fill in this file's tables so there is one place that shows "did we check every page for these things."

Preconditions: dev server up at `http://localhost:3000`. Have both an Admin session (`evans@noblestride.capital`)
and an Investor session (`cmiriti@ifc.org`) available (separate browser contexts/incognito windows so
you can compare side by side).

---

## 1. Console-error / failed-network sweep

Prior passes (2026-07-07 through 2026-07-09) recorded **zero client console errors and zero failed
network requests** across the whole app — a very clean baseline. This sweep exists to catch any
regression introduced by the design-unification, global-search, and 2FA-gate changes.

For each route, load it, then call `browser_console_messages` and `browser_network_requests` (or open
DevTools if human-driven). Record: any `error`-level console message, any request with status ≥ 400
(excluding deliberate 401/403 security-test requests, which are expected), and any request that never
resolves.

| # | Route | Persona | Console errors? | Failed/4xx-5xx requests (unexpected)? | Record result |
|---|---|---|---|---|---|
| 1.1 | `/` | anonymous | | | Pass/Fail — |
| 1.2 | `/login` | anonymous | | | Pass/Fail — |
| 1.3 | `/register` | anonymous | | | Pass/Fail — |
| 1.4 | `/dashboard` | Admin | | | Pass/Fail — |
| 1.5 | `/deals` (list + board view) | Admin | | | Pass/Fail — |
| 1.6 | `/investors` | Admin | | | Pass/Fail — |
| 1.7 | `/investors/[id]` | Admin | | | Pass/Fail — |
| 1.8 | `/clients` | Admin | | | Pass/Fail — |
| 1.9 | `/partners` | Admin | | | Pass/Fail — |
| 1.10 | `/engagement` (+ `/engagement/deals`, `/engagement/investors`) | Admin | | | Pass/Fail — |
| 1.11 | `/documents` | Admin | | | Pass/Fail — |
| 1.12 | `/tasks` | Admin | | | Pass/Fail — |
| 1.13 | `/access-matrix` | Admin | | | Pass/Fail — |
| 1.14 | `/settings/users` | Admin | | | Pass/Fail — |
| 1.15 | `/portal/investor` | Investor | | | Pass/Fail — |
| 1.16 | `/portal/investor/deals/[id]` | Investor | | | Pass/Fail — |
| 1.17 | `/portal/investor/pipeline` | Investor | | | Pass/Fail — |
| 1.18 | `/portal/investor/dashboard` | Investor | | | Pass/Fail — |
| 1.19 | `/portal/investor/profile` | Investor | | | Pass/Fail — |
| 1.20 | `/portal/partner` (+ `/refer`, `/details`) | Partner | | | Pass/Fail — |

**Special watch:** the global-search command palette fires GraphQL `globalSearch` queries as you type
— confirm these don't 400/500 on empty query, single-char query, or special characters (`%`, `'`,
`<script>`). See `05-global-search.md` for the dedicated XSS/injection cases; log any console/network
anomaly found there back into this table too.

---

## 2. Responsive / layout sweep

Test at three breakpoints using `browser_resize`: **mobile** (390×844), **tablet** (834×1194),
**desktop** (1440×900). For each, confirm: sidebar collapses to a drawer/hamburger (or the app's
documented mobile pattern) rather than overlapping content; tables scroll horizontally inside their
own container rather than breaking page layout; the topbar search box and notification bell remain
reachable; no horizontal scrollbar on the `<body>` itself.

| # | Route | Breakpoint | Sidebar/nav behaves | Tables/cards don't overflow body | Record result |
|---|---|---|---|---|---|
| 2.1 | `/dashboard` | mobile | | | Pass/Fail — |
| 2.2 | `/dashboard` | tablet | | | Pass/Fail — |
| 2.3 | `/deals` (list view, widest table in the app) | mobile | | | Pass/Fail — |
| 2.4 | `/deals` (list view) | tablet | | | Pass/Fail — |
| 2.5 | `/portal/investor` | mobile | | | Pass/Fail — |
| 2.6 | `/portal/investor/profile` (long form) | mobile | | | Pass/Fail — |
| 2.7 | Command palette (Cmd/Ctrl-K) open | mobile | modal fits viewport, no clipped edges | | Pass/Fail — |
| 2.8 | `/settings/users` (table + filters) | tablet | | | Pass/Fail — |

---

## 3. Notification bell

| # | Step | Expected | Record result |
|---|---|---|---|
| 3.1 | As Admin, open `/dashboard`, click the topbar bell icon. | A dropdown/panel opens listing notifications (or an explicit empty state — a prior pass noted the bell can be empty for a demo lens with no real `userId`; with real auth (`feat/real-auth` merged in) confirm whether Admin/team-member notifications are now populated, e.g. from an engagement restage). | Pass/Fail — |
| 3.2 | Trigger an action known to emit a notification (e.g. restage an engagement you own, per `02-admin-crm.md` §Engagement) with a **different** logged-in user as the record's lead/owner, then check that user's bell. | Notification appears, actor-skip respected (the actor who performed the action does not notify themselves). | Pass/Fail — |
| 3.3 | As Investor, open `/portal/investor`, click the topbar bell. | Panel opens; contains only investor-relevant notifications (never internal/admin-only content). | Pass/Fail — |
| 3.4 | Click a notification item (if any exist). | Navigates to the relevant record; bell unread-count decrements. | Pass/Fail — |

---

## 4. AskBar / dashboard insight agents

The CRM dashboard includes an "Overview/Prospecting/CRM" insights panel with an "Ask" box (a
lighter-weight cosmetic surface — NOT the full spec §8 channel agents, which are out of scope /
not built; see `../02-BLOCKERS.md` BLOCKER-C). Test only what exists today.

| # | Step | Expected | Record result |
|---|---|---|---|
| 4.1 | Go to `/dashboard` as Admin. Locate the insights/agent card(s). | Cards render with real data-derived copy (e.g. "Going quiet" stale-deal callouts), not obvious lorem-ipsum placeholders. | Pass/Fail — |
| 4.2 | If an "Ask" input box is present, type a natural-language question (e.g. "which deals are stale?") and submit. | Note actual behavior honestly — this may be a non-functional/cosmetic input; do not assume it's wired to an LLM. Record exactly what happens (nothing / static suggestions / a real answer). | Pass/Fail — describe actual behavior |
| 4.3 | Confirm the insights panel does not leak masked/confidential data intended for other roles when viewed by a Team Member with narrower own-scope RBAC. | Team Member's insight cards only reference records they can see. | Pass/Fail — |

---

## 5. Accessibility basics

Not a full WCAG audit — spot-check the basics that are cheap to catch and that the spec/prior bugs
already flagged.

| # | Check | Route(s) | Expected | Record result |
|---|---|---|---|---|
| 5.1 | Exactly one `<h1>` per page | `/portal/investor` (Opportunities) | Re-check **BUG-13** (duplicate `<h1>`: "Opportunities" banner + "Investment Opportunities" heading) — STILL REPRODUCES or FIXED. | Pass/Fail — |
| 5.2 | Exactly one `<h1>` per page | Spot-check 4 more: `/dashboard`, `/deals`, `/portal/investor/profile`, `/portal/partner` | | Pass/Fail — |
| 5.3 | Keyboard-only navigation reaches all primary actions | `/login` (tab order: email → password → show/hide toggle → submit) | All reachable via Tab, focus ring visible | Pass/Fail — |
| 5.4 | Keyboard-only navigation | Command palette (open via Ctrl/Cmd-K, arrow through results, Enter to navigate, Escape to close) | Full keyboard operability — see `05-global-search.md` §"Keyboard nav" for the detailed version of this case | Pass/Fail — |
| 5.5 | Color contrast / icon-only buttons have accessible names | Investor sidebar (newly colored icons) | Icon buttons still expose an `aria-label` or visible text, not just color, for screen readers | Pass/Fail — |
| 5.6 | Form labels | `/portal/investor/profile` (Fund Profile — long form, many fields) | Every input has a programmatically associated `<label>` (check via snapshot/accessibility tree, not just visual placement) | Pass/Fail — |
| 5.7 | Focus not trapped incorrectly | Any modal/drawer (document upload drawer, task creation, command palette) | Escape closes; focus returns to the triggering element | Pass/Fail — |

---

## 6. Visual-regression checkpoints — new design (2026-07-10 design unification)

Take a screenshot at each checkpoint. Compare qualitatively against the description; if unsure whether
a color/border change is "before" or "after," diff against a screenshot from an older pass if one
exists in the repo root (`verify-*.png` files), otherwise just describe what you see precisely enough
that a reviewer can judge it without re-running the browser.

| # | Checkpoint | What to look for | Screenshot | Record result |
|---|---|---|---|---|
| 6.1 | `/portal/investor` sidebar | Icons are **colored** (not uniform gray/monochrome) — each nav item's icon should have a distinct accent color, not just the active item. | `verify-design-investor-sidebar-icons.png` | Pass/Fail — |
| 6.2 | `/portal/investor/dashboard` | Cards use the shared `Card` component with a **visible border** and a **subtle shadow** (not a flat borderless block). | `verify-design-portal-card-borders.png` | Pass/Fail — |
| 6.3 | `/portal/investor/profile` (Fund Profile) | Form-field borders are **visibly stronger/darker** than a faint 1px hairline — inputs should read as clearly bounded fields, especially against the card background. | `verify-design-fund-profile-borders.png` | Pass/Fail — |
| 6.4 | Any CRM form (e.g. `/tasks` new-task dialog, or an edit drawer on `/investors/[id]`) | Confirm the strengthened form-field border treatment is applied **CRM-wide**, not only in the investor portal. | `verify-design-crm-form-borders.png` | Pass/Fail — |
| 6.5 | `/portal/partner` overview | Shared Card styling matches the investor-portal treatment (parity across both portals). | `verify-design-partner-card-borders.png` | Pass/Fail — |
| 6.6 | Dark mode (if the app supports a theme toggle) | Re-check 6.1–6.3 in dark mode — borders/shadows/icon colors should still be legible, not disappear or invert oddly. If no theme toggle exists, record "N/A — no dark mode in this build." | | Pass/Fail — |

---

## 7. Cross-portal design parity

| # | Step | Expected | Record result |
|---|---|---|---|
| 7.1 | Open `/portal/investor` and `/portal/partner` side by side (two windows). Compare topbar layout, search box placement, notification bell, card styling, spacing/typography scale. | The two portals read as the same design system/product, not visibly different builds. | Pass/Fail — |
| 7.2 | Compare the CRM `(crm)` shell topbar/sidebar against both portals. | Consistent brand header treatment, consistent search-box affordance (see `05-global-search.md`), consistent spacing scale — differences should be intentional (e.g. CRM has more nav items) not accidental drift. | Pass/Fail — |

---

## Summary roll-up (fill in after running the sweep)

- Total routes swept for console/network: ___ / 20
- Responsive breakpoints checked: ___ / 8 checkpoints
- New bugs found this pass: list `BUG-NN` ids here, or "none"
- Confirmed-still-open from prior list: list ids here
- Confirmed-fixed from prior list: list ids here
