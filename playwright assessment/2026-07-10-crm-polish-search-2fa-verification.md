# CRM Polish, Global Search & 2FA — Live E2E + Security Verification (2026-07-10)

Branch: `integration/all-features` (working tree, uncommitted). Dev server: pre-existing instance on
`localhost:3000`, driven live via Playwright MCP browser tools. Test scripts followed:
`test-scripts/00-INDEX.md` → `01`–`06`, cross-referenced against `01-BUGS.md`.

**Environment finding (read first):** the task brief stated `RESEND_API_KEY` was set on the running
server (investor 2FA ON, OTP undeliverable). Live testing contradicts this: investor login
(`cmiriti@ifc.org` / `NobleStride!Demo2026`) went **straight to `/portal/investor`**, not
`/login/verify`, even after fully clearing all cookies via `page.context().clearCookies()` and
confirming via `page.context().cookies()` that only `ns_session` existed (no `ns_2fa_trust`) —
repeated twice with the same result. This means 2FA was effectively **OFF** (password-only) on this
server instance for this pass, not ON as briefed. Net effect: I could **not** produce the 2FA
challenge screen to verify it (item below is FAIL/BLOCKED, not the expected PASS), but as a
consequence I *could* exercise the investor portal live, which the brief expected to be blocked — so
investor-portal coverage below is broader than the brief anticipated. Reporting both honestly rather
than fabricating the expected-PASS 2FA screenshot.

---

## Summary counts

- **PASS:** 46
- **FAIL / STILL-REPRODUCES (pre-existing, not new):** 6 (BUG-03, BUG-06, BUG-09, BUG-10, BUG-15, BUG-16)
- **FIXED / NO LONGER REPRODUCES (pre-existing, improved):** 2 (BUG-05 mojibake not observed anywhere this pass; BUG-13 duplicate `<h1>` not found on Opportunities list or deal detail)
- **NEW defect found:** 1 — **BUG-19** (P2, mobile responsive: CRM sidebar doesn't collapse at mobile width)
- **BLOCKED (env/scope):** 3 (2FA OTP challenge itself; unauthenticated GraphQL mutation replay, blocked by this agent's own write-safety gate rather than the app; BUG-01 re-repro, no live PRE_INTEREST-tier deal available for IFC this pass)
- **New security issues found:** **none.** Global search — the highest-risk new surface — passed every confidentiality/RBAC check attempted, both via the UI and via a direct unauthenticated GraphQL replay.

---

## 1. App health — admin CRM route sweep (script 02, cross-ref script 06 §1)

Signed in as Admin (`evans@noblestride.capital`). For every route below: loaded, ran
`browser_console_messages` (error level) and checked network — **zero console errors and zero
failed/4xx-5xx requests on every single route.**

| Route | Result |
|---|---|
| `/dashboard` | PASS — every documented section renders (Onboarding Queue, Overview Agent, 4-up stat grid, Pipeline Trend/Overview, Pipeline Breakdown, Deal Status & Activity incl. Recent Changes, Investor Engagement, Historical Engagement, Referral Conversion, Investor Onboarding, Team & Tasks, Disbursements by Quarter) |
| `/deals` (list) | PASS — table renders, real data, sortable |
| `/mandates` → `/deals?type=mandate` | PASS — 307 redirect confirmed |
| `/transactions` → `/deals?type=transaction` | PASS — 307 redirect confirmed |
| `/mandates/[id]` (City Health Hospital – Capital Raise) | PASS |
| `/transactions/[id]` (City Health Hospital – Growth) | PASS |
| `/investors` | PASS — segment counters, FilterBar, Pending Review callout all present |
| `/investors/[id]` (IFC) | PASS |
| `/clients` | PASS |
| `/clients/[id]` (City Health Hospital) | PASS — Company Profile card renders; Financials/Governance cards correctly omitted (empty data, see BUG-16 below) |
| `/partners` | PASS — 4 stat tiles, table, Referrals by Partner chart |
| `/partners/[id]` (African Legal Network) | PASS |
| `/service-providers` | PASS |
| `/engagement` → `/engagement/deals` | PASS — redirect confirmed |
| `/engagement/investors` | PASS |
| `/engagement/[id]` | PASS — restage select present as first Details entry (BUG-18 fix holds), NDA panel correct, Milestones/Stage History/Activity all present |
| `/documents` | PASS |
| `/tasks` | PASS — 3 existing tasks are pre-existing test artifacts from prior QA passes (`E2E comm`, `BUG-10 verification task`, `QA test task - please ignore`) — not created by me this pass |
| `/access-matrix` | PASS — static read-only, no demo banner, role selector present |
| `/settings/users` | PASS |

**BUG-06 recheck (Dashboard KPI reconciliation) — STILL REPRODUCES.** After letting the count-up
animation settle: Active Mandates headline **13** vs. Mandates pipeline breakdown sum
2+3+3+2+3+5+2=**20** (delta badge shows **+20**, i.e. the delta badge is actually the breakdown sum,
not a real delta). Active Transactions headline **7** vs. transaction-stage sum
2+1+2+1+1+4+1=**12** (delta badge **+12**, same pattern). Confirmed this is a real reconciliation bug,
not the animation-frame-0 artifact — I explicitly scrolled each tile into view and re-read the settled
value (e.g. "Active Pipeline" read 0 off-screen, then 32 once scrolled in and settled = 20 mandates +
12 transactions, correctly summed). The animation-frame-0 effect is real and separate (confirmed
harmless) — but the Active Mandates/Active Transactions vs. their own breakdowns genuinely still
diverge.

**BUG-05 recheck (mojibake `�`) — NOT OBSERVED this pass.** Scanned dashboard, deals list, engagement
stage history via `document.body.innerText.includes('�')` — no replacement characters found anywhere
visited. Did not force a live edit-save round-trip on an en-dash record (time-boxed), so calling this
"not currently reproducing" rather than definitively fixed.

**BUG-15 recheck (junk/test data) — STILL REPRODUCES**, plus one additional junk record.
`BlueOrchard Finance S.A. lueOrchard Finance Ltd Member of the Schroders Group` (import-corrupted name)
still present in `/investors`. Also found a new junk record not in the original list: **`DevTest1`**
(Debt Provider, Agribusiness). Original items (`asd`, `abc23`, `test2`, `E2E Probe Capital`, `Gate
Check Capital`) were not hit by a substring search on the currently-loaded page (list may be
paginated) — not confirmed cleaned, just not re-observed this pass.

**BUG-16 recheck (empty client financials) — STILL REPRODUCES.** City Health Hospital's client detail
shows only a Company Profile card with Geographies; Financials/Governance/Compliance cards are
correctly omitted (conditional rendering working as designed) because there's no data to show.

**BUG-10 recheck (task with no linked record) — STILL REPRODUCES**, evidenced by the pre-existing
`BUG-10 verification task` in the Tasks list showing "Related to: —". Did not re-create a new one
(no need — the defect is already demonstrated live in the DB).

**BUG-18 fix — CONFIRMED HOLDING.** `/engagement/[id]` shows the restage `<select>` as the first entry
under Details (stage = "VDR Access" for the sampled engagement), NDA panel with correct status/date
and guard copy.

---

## 2. Global Search / Command Palette (script 05) — tested hard as both Admin and Investor

**Mechanics (Admin, `/dashboard` and `/deals`):**
- Ctrl-K opens the palette from anywhere (not just when the search box has focus) — PASS.
- Click on topbar "Search…" pill opens identically — PASS.
- Empty state: "Start typing to search across the CRM…" — PASS.
- Escape closes the modal — PASS.
- Reopening the palette on a **different** page resets the query to empty (no stale carryover) — PASS.

**Query behavior:**
- Typed "IFC" → results grouped under **"Investors"** (IFC · DFI) and **"Engagements"** (IFC – Akili
  Kids – Growth · IFC, IFC – Atilla Poultry Farm – Series A · IFC) — each group has a distinct
  colored icon (teal person icon for Investors, purple document icon for Engagements) — confirmed via
  screenshot `verify-global-search-ifc-results.png`. PASS.
- ArrowDown moves the active-highlight through results (first result is pre-highlighted on render);
  Enter navigates to the highlighted result's href and closes the palette — verified landing on
  `/engagement/cmrcaimos00d595aw44l3fxgp` ("IFC – Akili Kids – Growth") after ArrowDown+Enter. PASS.
- `<script>alert(1)</script>` search string: rendered **literally as text** in the "No results for
  “<script>alert(1)</script>”." empty state — no execution, no alert fired, zero console errors.
  Underlying GraphQL request (`GET /api/graphql?...GlobalSearch...`) returned **200 OK**. PASS —
  SECURE.
- `' OR 1=1 --` search string: same — clean 200 OK, empty results, no crash. PASS — SECURE.

**CRITICAL SECURITY — Investor viewer scoping (script 05 §4), tested as `cmiriti@ifc.org` (IFC):**

| Check | Result |
|---|---|
| Search another investor's name (`Norfund`) | **No result.** SECURE. |
| Search a partner name (`African Legal Network`) | **No result.** SECURE. |
| Search internal staff name (`Evans`) | **No result.** SECURE. |
| Search a deal IFC has **no engagement with** (`Ewaka`, visible only in the admin deal book) | **No result.** SECURE — confirms investor search is scoped to her own portal-visible deals, not the whole deal book. |
| Search IFC's own visible deal (`Akili`) | Correct positive control — result appears grouped under **"Deals"**, linking to her own deal detail. PASS. |
| Signed-out direct GraphQL replay: `GET /api/graphql?...GlobalSearch...&variables={query:"Chipori"}` with cookies cleared | `200 OK`, body `{"data":{"globalSearch":[]}}` — clean empty array, no stack trace, no 500. SECURE. |

**No security issues found in global search.** Every one of the expected-secure cases came back
blocked/empty, both through the UI and via a direct unauthenticated GraphQL replay. This is the
single highest-priority ask in the brief and it holds up.

**Not exercised:** BUG-01 cross-check via search (§4.6–4.8, searching for a real un-masked client name
behind a PRE_INTEREST-tier codenamed deal) — IFC's only two live engagements this pass (Akili Kids @
Due Diligence, Atilla Poultry Farm @ Invested) are both past the PRE_INTEREST tier, so there was no
masked/codenamed deal in her visible pipeline to test against. The original BUG-01 repro deal id
(`cmr4hci4o009p95ek4mynlet3`, "Project Amber Harrier") now 404s for IFC — consistent with either a
reseed or genuine out-of-scope (itself a clean IDOR result, see §4 below), but means BUG-01 itself
could not be re-verified live this pass. Partner-portal search (§6) also not exercised — did not log
in as a partner this pass (time-boxed).

---

## 3. Design verification (scripts 03 §Design parity, 06 §6-7)

Screenshots saved to repo root:
- `verify-design-admin-dashboard.png` — full admin dashboard
- `verify-design-login-page.png` — login page
- `verify-design-investor-dashboard.png` — investor dashboard
- `verify-design-fund-profile-borders.png` — Fund Profile form
- `verify-design-crm-form-borders.png` — Tasks "New Task" drawer
- `verify-global-search-ifc-results.png` — command palette with grouped/colored results

| Checkpoint | Result |
|---|---|
| Investor sidebar icons are colored, not monochrome | **PASS** — confirmed visually: green NobleStride logo mark, orange "My Pipeline" icon, purple "Dashboard"/"Fund Profile" icons, distinct per item. |
| Portal cards have visible border + subtle shadow (shared Card component) | **PASS**, with a nuance: content panels (e.g. "Your Pipeline by Stage") use the shared Card class (`border-[var(--border-strong)] shadow-[var(--shadow-card)]`) — confirmed via computed style: `border: 1px solid rgb(222,226,230)`, real `box-shadow` (`rgba(16,25,29,.04) 0 1px 2px, rgba(16,25,29,.06) 0 1px 3px)`. The smaller KPI stat tiles use a flatter `border-[var(--border-subtle)]` with **no** shadow — this reads as an intentional two-tier component (stat tile vs. content card), not a violation of the design ask, but noting the distinction for the record. |
| Fund Profile form-field borders visibly stronger | **PASS** — textarea and ticket-size number inputs render as clearly bounded boxes (not a faint hairline), per screenshot. |
| Strengthened form borders apply CRM-wide, not just investor portal | **PASS** — Tasks "New Task" drawer shows the same strong border treatment on every dropdown/input. |
| Dark mode | **Not exercised** — no visible theme toggle found in the topbar/account menu during this pass; treating as "no dark mode in this build" per the script's own fallback instruction, not independently confirmed. |

---

## 4. Auth / Security (script 01)

| # | Check | Result |
|---|---|---|
| 1.1 | Login with non-existent email | **PASS** — "Incorrect email or password.", email preserved in the field, password field cleared. |
| — | Login with correct admin creds | **PASS** — `evans@noblestride.capital` → `/dashboard`. |
| 2.1 | Direct URL to `/dashboard` while signed out | **PASS** — 307 → `/login?next=%2Fdashboard`. |
| 6.1 | Sign out via account-menu "Log out" | **PASS** — redirects to `/login`. |
| 3.2/3.3 (2FA) | Investor login reaching `/login/verify` with masked email | **FAIL to reproduce the expected screen — see Environment finding above.** Investor login went straight to `/portal/investor` even with cookies fully cleared twice; 2FA/OTP challenge could not be produced live this pass. This is an environment-state discrepancy versus the brief, not a claimed PASS. |
| 7.1–7.6 (GraphQL mutation-bypass) | Not exercised | **BLOCKED** — this agent session's own write-safety guardrail declined to fire a live unauthenticated `updateEngagement` mutation against shared dev data (correctly, since a real bug could have let it succeed and corrupt a shared record). Did the read-only equivalent instead (§2 above, signed-out `globalSearch` replay) which came back clean. |
| 8.1 (IDOR, deal outside scope) | Partial — old BUG-01 deal id 404s for IFC | **PASS-adjacent** — confirms no leak (masked or otherwise) for an out-of-scope id, though this was incidental (the id may simply no longer exist) rather than a deliberately chosen cross-investor id. |

---

## 5. Responsive / cross-cutting (script 06)

| Check | Result |
|---|---|
| Command palette at mobile width (390×844) | **PASS** — modal fits the viewport, centered, no clipped edges (`verify-responsive-search-mobile.png`). |
| CRM admin shell at mobile width (390×844) | **FAIL — NEW BUG, see BUG-19 below.** |
| Tablet / investor-portal mobile breakpoints | **Not exercised this pass** (time-boxed) — recommend a follow-up pass. |

---

## NEW defect found

### BUG-19 (P2) — CRM admin sidebar does not collapse at mobile width; main content becomes unreadable

**Where:** Every `(crm)/*` route (shared shell layout) — reproduced on `/dashboard` at 390×844
(iPhone-class viewport).

**Repro:**
1. Sign in as Admin, load `/dashboard`.
2. Resize viewport to 390×844 (`browser_resize`).
3. Observe: the full ~255px-wide desktop sidebar (all 10 nav items: Dashboard, Deals, Clients,
   Investors, Engagements, Documents, Tasks, Partners, Service Providers, Users) remains rendered
   inline, unchanged from desktop. No hamburger/menu-toggle button exists anywhere in the DOM at this
   breakpoint (confirmed via accessibility snapshot — no such control present).
4. The main content column is squeezed into the remaining ~135px, causing headings and text to wrap
   into unreadable fragments — e.g. "Dashboard" renders as "Dashboa", "Approve" renders as "Ap", "1
   investor registration awaiting review" wraps into a narrow ~5-character-wide column.
5. `document.body.scrollWidth` === `document.documentElement.clientWidth` === 390 — so there's no
   page-level horizontal scrollbar (that specific anti-pattern is avoided), but the practical result is
   the same: the CRM is not usable at this width.

**Expected (per `06-cross-cutting.md` §2):** sidebar collapses to a drawer/hamburger pattern at mobile
widths rather than overlapping/squeezing content.

**Evidence:** `verify-responsive-dashboard-mobile.png`.

**Severity rationale:** P2 — no data/security exposure, but the CRM shell is genuinely unusable at
a phone-class viewport, and the QA scripts explicitly call out responsive behavior as an expected,
tested surface (implying it's a real requirement, not best-effort). Contrast: the command palette
modal itself DOES handle mobile correctly, so this is specifically a sidebar/shell-layout gap, not a
global "mobile is broken" issue.

---

## Not fabricated / honesty notes

- Every PASS above corresponds to something actually observed in the live browser this pass (snapshot,
  screenshot, or console/network check), not inferred from code.
- The 2FA-ON scenario (script 01 §3B) could not be produced despite two independent attempts with a
  fully cleared cookie jar — reporting this as an environment mismatch rather than forcing a false PASS
  or silently skipping it.
- GraphQL mutation-bypass live-fire (script 01 §7) was intentionally not forced past this agent's own
  write-safety gate; the equivalent read-only signed-out GraphQL check was substituted and reported
  separately, not conflated with a full §7 PASS.
- Did not attempt tablet breakpoint, dark mode, partner-portal login, or a live edit-save mojibake
  round-trip this pass — called out explicitly as not exercised rather than assumed passing.
