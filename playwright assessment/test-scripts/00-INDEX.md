# NobleStride CRM — Playwright QA Test Scripts (Index)

**Purpose.** This folder contains step-by-step, manual/MCP-drivable browser test **scripts** — not
automated `@playwright/test` code. A tester (human, or an agent driving the Playwright MCP browser
tools) follows each numbered step, performs the exact action, checks the exact expected result, and
records Pass/Fail with evidence (screenshot filename, console/network note, or a one-line
observation). These scripts exist to exercise **every** part of the CRM end-to-end and surface bugs,
broken flows, and security issues — they are the execution layer for the findings that get written
up in the parent folder's living QA log (`../00-SUMMARY.md`, `../01-BUGS.md`, `../03-COVERAGE-MAP.md`).

When a script step finds a new defect, log it in `../01-BUGS.md` (assign the next `BUG-NN`), and if it
changes the picture in the coverage map, update `../03-COVERAGE-MAP.md`. When a step re-confirms (or
contradicts) a previously fixed/open bug, note that inline in the script's "record result" line AND
append a note to the bug's entry in `01-BUGS.md`.

## How to run

- **Target:** `http://localhost:3000` (dev server must already be running — do not start it as part of
  running these scripts unless the environment doc says otherwise).
- **Driver:** Playwright MCP tools (`browser_navigate`, `browser_click`, `browser_type`,
  `browser_snapshot`, `browser_console_messages`, `browser_network_requests`,
  `browser_take_screenshot`, etc.) or a human using a real browser. Every step below is written as an
  action + an expected result so either driver can execute it.
- **Evidence:** save screenshots to the repo root or a `test-scripts/evidence/` folder using the
  naming convention already used elsewhere in this folder (`verify-<area>-<n>-<slug>.png`). Console
  and network checks: use `browser_console_messages` / `browser_network_requests` after each page
  load on at least one pass per script; note "no console errors / no failed requests" or the specific
  failure.
- **State discipline:** several scripts create or edit records (tasks, referrals, documents, profile
  saves, express-interest). That's expected — log what you created in
  `../04-TEST-ARTIFACTS-LEFT-IN-DB.md` so it can be cleaned up, same convention as prior passes.
- **Do not commit** anything as part of running these scripts. Leave the working tree as you found it
  (these are read/verify scripts; the app code should not need touching to execute them).

## Environment prerequisites — READ BEFORE STARTING

| Variable | Effect | Recommendation for this pass |
|---|---|---|
| `RESEND_API_KEY` | **2FA gate (Option B).** Set (a real, domain-verified key) → investor login requires password **+ email OTP** (`/login/verify`). **Unset/empty** → investor 2FA is OFF; investor login is **password-only**, straight to `/portal/investor`. Internal/staff logins are **never** gated by this — they never see 2FA regardless of the key. | For `03-investor-portal.md`, `04-partner-portal.md`, `05-global-search.md` and most of `02-admin-crm.md`, it is much easier to QA with the key **unset** (password-only investor login). Reserve the key-set case for the dedicated 2FA-ON scenarios in `01-auth-and-security.md` — if you can toggle the env and restart the dev server, do the 2FA-ON pass separately; if you cannot, explicitly mark those steps "not exercised — env fixed for this pass" rather than guessing. |
| `STORAGE_PROVIDER` | `local` (default) writes uploaded files to `./.storage`; `sharepoint` requires Azure AD app creds. | Expect `local`. Document upload/download/versioning/delete steps in `02-admin-crm.md` assume local disk storage. |
| Dev DB | Seeded via `pnpm run seed`. | Do not reseed mid-pass — it will wipe artifacts created by earlier scripts in the same session and change record ids referenced below. |

## Credentials (seed DB, shared password `NobleStride!Demo2026`)

| Role | Email | Lands on | Notes |
|---|---|---|---|
| Admin (internal) | `evans@noblestride.capital` | `/dashboard` | Full CRM access, `/settings/users`, all RBAC-gated actions |
| Team Member (internal) | `irine@noblestride.capital` | `/dashboard` | Same CRM shell as Admin, no "Users" nav item, fewer capabilities (own-scope RBAC) |
| Team Member (internal, alt) | `ivy@noblestride.capital` | `/dashboard` | Second team-member account, useful for own-scope RBAC comparisons |
| Investor | `cmiriti@ifc.org` | `/portal/investor` (IFC) | Approved investor; used for pre-interest/masking checks. 2FA gate applies per table above. |

Additional accounts referenced in prior passes for specific security cases (see per-script tables):
excluded investor **IncoFin**, greylisted investor **Afrexim**, pending/unapproved investor
(register a fresh one to get a live pending account), a second approved investor (e.g. Norfund or
responsAbility) for IDOR cross-investor checks, and partner logins for `04-partner-portal.md`.

## Known-bug cross-reference (re-check these; note STILL REPRODUCES or FIXED CONFIRMED)

| Bug | Summary | Where it's re-tested |
|---|---|---|
| BUG-01 (P1, confidentiality) | Pre-interest document titles leak real company name (e.g. "Teaser — Chipori Ltd") despite codename masking | `03-investor-portal.md` §3, `05-global-search.md` §5 |
| BUG-02 (P2) | Same engagement shows different stage labels across pages (engagement.stage vs milestone-derived stage) | `03-investor-portal.md`, `02-admin-crm.md` (Engagement) |
| BUG-03 (P2) | "Matching opportunities" count disagrees between Opportunities page and investor dashboard | `03-investor-portal.md` |
| BUG-04 (P2) | Org-role lens switcher shows wrong active lens — **note:** the viewpoint/demo switcher itself was reportedly removed in the 2026-07-10 role-cleanup pass; confirm it is gone, not just visually wrong | `01-auth-and-security.md` |
| BUG-05 (P2) | Mojibake (`�`) in deal names on the edit/save path | `02-admin-crm.md` (Deals/Mandates/Transactions, Dashboard) |
| BUG-06 (P2) | Dashboard KPI headline numbers don't reconcile with their own breakdowns | `02-admin-crm.md` (Dashboard) |
| BUG-07 (P3) | Partner "Advisor type" inconsistent between CRM and portal | `04-partner-portal.md` |
| BUG-08 (P3) | Register form wipes all fields on validation error | `01-auth-and-security.md` |
| BUG-09 (P3) | Picklist drift vs spec sector/instrument lists | `02-admin-crm.md`, `01-auth-and-security.md` (register) |
| BUG-10 (P3) | Task can be saved with no linked record | `02-admin-crm.md` (Tasks) |
| BUG-11 (P3) | Pluralization: "1 action points" | `02-admin-crm.md` (Tasks) |
| BUG-12 (P3) | Portal footer implies an NDA that may not exist | `03-investor-portal.md` |
| BUG-13 (P3) | Duplicate `<h1>` on investor Opportunities page | `03-investor-portal.md`, `06-cross-cutting.md` (a11y) |
| BUG-14 (P3) | Express-interest confirmation destroys the request form | `03-investor-portal.md` |
| BUG-15 (P3) | Test/junk data visible in lists | `02-admin-crm.md` (Investors), `06-cross-cutting.md` |
| BUG-16 (P3) | Client/company records almost empty (blocks §11 reveal) | `02-admin-crm.md` (Clients) |
| BUG-17 | ✅ Fixed — GraphQL masked all domain errors to "Unexpected error." | `01-auth-and-security.md` (mutation-bypass / error-surfacing checks) |
| BUG-18 | ✅ Fixed — no UI path to restage an engagement | `02-admin-crm.md` (Engagement) |

## Script index

| # | File | Scope |
|---|---|---|
| 01 | [`01-auth-and-security.md`](01-auth-and-security.md) | Login (valid/invalid/lockout), 2FA gate ON vs OFF, registration wizard, forgot/reset password, logout, session/RBAC enforcement, GraphQL mutation-bypass attempts, secrets-not-in-URL/console, direct-URL access to forbidden routes per role, IDOR attempts |
| 02 | [`02-admin-crm.md`](02-admin-crm.md) | Every `(crm)` route: dashboard, deals (list/board/saved views/export), mandates & transactions (+detail), investors (+detail incl. onboarding gate), clients (+detail), partners (+detail), engagement (by deal/by investor/detail), documents (upload/download/version/delete), tasks, service-providers, access-matrix, settings/users |
| 03 | [`03-investor-portal.md`](03-investor-portal.md) | Opportunities discovery, My Pipeline, dashboard, Fund Profile (save/load), opportunity detail, express interest, milestone stepper, confidentiality/masking checks, design parity |
| 04 | [`04-partner-portal.md`](04-partner-portal.md) | Partner portal overview, Submit Referral, My Details, referral tracking |
| 05 | [`05-global-search.md`](05-global-search.md) | Command palette (Cmd/Ctrl-K + topbar click) on both admin and investor sides; grouped results; navigation; debounce; keyboard nav; **critical security cases** — investor search must never reveal masked client identities, partners, other investors, or internal documents |
| 06 | [`06-cross-cutting.md`](06-cross-cutting.md) | Responsive/layout, notifications, AskBar, accessibility basics, console-error sweep per page, visual-regression checkpoints for the new design (colored icons, visible borders/shadows) |

## Route/flow coverage claimed by these scripts

- Public/auth: `/`, `/login`, `/login/verify`, `/register` (+ wizard steps), `/forgot-password`,
  `/reset-password/[token]`, `/logout`, `/intake`.
- Admin/CRM (20 page routes under `(crm)/`): `/dashboard`, `/deals` (list+board+export+saved views),
  `/mandates`, `/mandates/[id]`, `/transactions`, `/transactions/[id]`, `/investors`,
  `/investors/[id]`, `/clients`, `/clients/[id]`, `/partners`, `/partners/[id]`,
  `/service-providers`, `/engagement`, `/engagement/deals`, `/engagement/investors`,
  `/engagement/[id]`, `/documents`, `/tasks`, `/access-matrix`, `/settings/users`.
- Investor portal (5 routes): `/portal/investor`, `/portal/investor/deals/[id]`,
  `/portal/investor/pipeline`, `/portal/investor/dashboard`, `/portal/investor/profile`.
- Partner portal (3 routes + layout): `/portal/partner`, `/portal/partner/refer`,
  `/portal/partner/details`.
- Cross-cutting: global search (both topbars), notifications, help panel, responsive breakpoints,
  console/network hygiene, RBAC/security matrix across all of the above.

**Total: ~34 distinct page routes** (many with list+detail+create/edit sub-flows counted as separate
test cases within their script) **+ global search + auth flows + security/IDOR matrix**, organized
into 6 script files.

## Recent-change coverage (explicit, per the current task brief)

1. **Design unification** (colored investor-sidebar icons, shared Card borders/shadow on portal
   surfaces, strengthened CRM form-field borders esp. Fund Profile) → dedicated checks in
   `03-investor-portal.md` §"Design parity" and `06-cross-cutting.md` §"Visual regression checkpoints".
2. **Global search / command palette** (Cmd/Ctrl-K, GraphQL `globalSearch`, permission-scoped results)
   → fully dedicated `05-global-search.md`, cross-referenced from `01-auth-and-security.md`'s IDOR
   section and `03-investor-portal.md`'s confidentiality section.
3. **2FA gate (Option B, `RESEND_API_KEY`-conditional)** → fully dedicated section in
   `01-auth-and-security.md` §"2FA gate", covering both the key-set (OTP required) and key-unset
   (password-only) states, plus the env-prerequisites note above.

---
_Authored 2026-07-10 as a writing-only task (no browser run performed while authoring). Scripts are
ready to execute; results are NOT yet filled in — every "record result" line should read as a
template until a tester runs the pass._
