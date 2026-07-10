# 05 — Global Search (Command Palette)

**What this tests.** A new command palette (`src/components/search/command-palette.tsx`) reachable
via **Cmd/Ctrl-K** or by clicking the topbar "Search…" pill, on both the admin CRM topbar
(`src/components/shell/topbar.tsx`) and the investor topbar
(`src/components/portal/investor-topbar.tsx`) — it is the **same component** rendered in both
places; all permission scoping happens server-side in the GraphQL resolver
(`src/server/search/global-search.ts`), not in the client component. Query:

```graphql
query GlobalSearch($query: String!, $limit: Int) {
  globalSearch(query: $query, limit: $limit) { id type title subtitle href }
}
```

**Why this script matters most.** This is a brand-new cross-entity surface. A search box is exactly
the kind of feature that accidentally bypasses row-level visibility rules that every other page in
the app respects (masking, RBAC, tier gating) — because it's easy to write "search everything" logic
that forgets to reuse the existing projection/masking layer. The resolver reportedly reuses
`loadInvestorPortalData` (the same loader the investor portal's own deal list uses) for investor
viewers specifically so masked fields never even reach the searchable string set. **Verify this
holds in the live app, not just in the code** — that's what this script is for.

Preconditions: dev server at `localhost:3000`. Have an Admin session (`evans@noblestride.capital`)
and an Investor session (`cmiriti@ifc.org`, IFC) in separate browser contexts.

---

## 1. Discoverability and open/close mechanics

| # | Step | Expected | Record result |
|---|---|---|---|
| 1.1 | As Admin, load `/dashboard`. Locate the topbar search affordance. | A pill reading "Search…" with a `⌘K` (or `Ctrl K`) hint is visible in the topbar. | Pass/Fail — |
| 1.2 | Click the search pill. | Command palette modal opens, input focused, empty state reads "Start typing to search across the CRM…". | Pass/Fail — |
| 1.3 | Press `Escape`. | Modal closes, focus returns to the trigger. | Pass/Fail — |
| 1.4 | Press `Ctrl-K` (Windows) or `Cmd-K` (Mac) from anywhere on the page (not focused in the search box). | Modal opens regardless of current focus (global listener). | Pass/Fail — |
| 1.5 | With the modal open, press `Ctrl-K`/`Cmd-K` again. | Modal toggles closed (the listener toggles open state). | Pass/Fail — |
| 1.6 | Click outside the modal (backdrop). | Modal closes. | Pass/Fail — |
| 1.7 | Repeat 1.1–1.6 as Investor on `/portal/investor`. | Identical mechanics/visual treatment — same component. | Pass/Fail — |

---

## 2. Query behavior — debounce, loading, empty states

Reported implementation: `DEBOUNCE_MS = 250`, `RESULT_LIMIT = 8` per entity type, a request-sequence
guard against out-of-order responses.

| # | Step | Expected | Record result |
|---|---|---|---|
| 2.1 | Open palette (Admin). Type a single character (e.g. `a`) and immediately check network activity. | No `globalSearch` request fires instantly — it waits ~250ms after the last keystroke before querying (use `browser_network_requests` timestamps, or type fast and confirm only one request fires per pause). | Pass/Fail — |
| 2.2 | Type a query matching many records (e.g. `a`), let debounce settle. | A loading spinner appears briefly, then grouped results render. | Pass/Fail — |
| 2.3 | Type a query matching nothing (e.g. `zzzzznotarealthing`). | Empty state: `No results for "zzzzznotarealthing".` | Pass/Fail — |
| 2.4 | Clear the input back to empty. | Reverts to the "Start typing…" empty state (not stuck on old results, not stuck on "no results"). | Pass/Fail — |
| 2.5 | Type quickly, then quickly change the query several times (e.g. `chip` → `chipo` → `chipori`), before results can return for the earlier queries. | Only results for the FINAL query render — no flicker of stale results from an earlier keystroke overwriting the latest (tests the request-sequence guard). | Pass/Fail — |

---

## 3. Grouping, result content, and navigation (Admin/internal viewer)

Internal viewers search the full entity set: Investor, Client, Mandate, Transaction, Partner,
ServiceProvider, Document, Task, Person, Engagement.

| # | Step | Expected | Record result |
|---|---|---|---|
| 3.1 | As Admin, search for a known investor name (e.g. `IFC`). | Result appears grouped under an "Investor" heading with its own color/icon. | Pass/Fail — |
| 3.2 | Search for a known client/company name (e.g. `Chipori`). | Results include Client AND/OR Mandate/Transaction groups referencing it (real, un-masked name — correct for an internal viewer). | Pass/Fail — |
| 3.3 | Search for a partner name. | Result appears under "Partner". | Pass/Fail — |
| 3.4 | Search for a document title. | Result appears under "Document". | Pass/Fail — |
| 3.5 | Search a term matching 3+ entity types at once (e.g. a common word appearing in a task title, a client name, and a person name). | Multiple group headings render, each in first-appearance order; each group visually distinct (icon/color per `TYPE_META`). | Pass/Fail — |
| 3.6 | Use `ArrowDown`/`ArrowUp` to move through results. | Active-result highlight moves accordingly, clamped at top/bottom (doesn't wrap past the ends unexpectedly — note actual behavior). | Pass/Fail — |
| 3.7 | Press `Enter` on a highlighted result. | Navigates to that result's `href` (e.g. investor detail, client detail, mandate/transaction detail). Palette closes. | Pass/Fail — |
| 3.8 | Click a result directly with the mouse instead of Enter. | Same navigation behavior as 3.7. | Pass/Fail — |
| 3.9 | Search then navigate to a result, then reopen the palette (Ctrl-K) on the new page. | Query resets to empty (does not carry over stale query/results from the previous page). | Pass/Fail — |

---

## 4. CRITICAL SECURITY — Investor viewer must never see scoped-out entities

**Design claim to verify live:** the investor-search code path (`searchForInvestor`) only ever queries
`Transaction` and `Document` result types (via the same masked/projected loader the investor's own
deal list uses) — Partner, other Investor, Client, ServiceProvider, Task, Person, and Engagement
models are reportedly **never queried at all** for an investor viewer, not merely filtered after the
fact. These steps are EXPECTED-SECURE — every one should come back "blocked/absent," and any result
that leaks is a P1 confidentiality bug (log as a new `BUG-NN`, cross-reference `01-BUGS.md` BUG-01
which is the same class of leak in the documents list).

| # | Step (as Investor `cmiriti@ifc.org`) | Expected (SECURE) | Record result |
|---|---|---|---|
| 4.1 | Open palette, search for the name of **another investor** you know exists in the seed data (e.g. `Norfund`, `responsAbility`, or any name visible only from an internal list). | **No result.** Investor entities are never returned to an investor viewer, regardless of match. | Pass/Fail — SECURE if no result |
| 4.2 | Search for a **partner** name (e.g. `African Legal Network`). | **No result.** | Pass/Fail — SECURE if no result |
| 4.3 | Search for a **service provider** name. | **No result.** | Pass/Fail — SECURE if no result |
| 4.4 | Search for a **task title** you know exists internally (ask an Admin session what a task is titled, or use a generic word like "Follow up"). | **No result** (Task is not a search-eligible type for investors). | Pass/Fail — SECURE if no result |
| 4.5 | Search for a **person/contact name** who is internal staff (e.g. `Evans`, `Irine`). | **No result.** | Pass/Fail — SECURE if no result |
| 4.6 | Identify a deal where this investor is at the **PRE_INTEREST** tier (masked, shown under a codename like "Project Amber Harrier" per BUG-01's repro). Search for the **REAL company/client name** (e.g. `Chipori`). | **No result** — the raw name string should not exist anywhere in this investor's searchable index; only the codename form is indexable. | Pass/Fail — SECURE if no result. **If a result DOES appear, this is a P1 finding — log immediately.** |
| 4.7 | Now search for the **codename** itself (e.g. `Amber Harrier` or `Project Amber`). | Result appears under "Transaction", showing the codename — correct, this is the investor's own visible-but-masked deal. | Pass/Fail — |
| 4.8 | Open the Documents section of that same pre-interest deal (per BUG-01) to see what document titles currently render there, then search for any distinctive word from a **real (un-masked) document title** if one is currently leaking (e.g. `Chipori` from `"Teaser — Chipori Ltd (Sabor A' Mexico)"`). | Ideally **no result** (name never in the index) — but if BUG-01 is still open, this is exactly where it could resurface via search too. Note explicitly whether this compounds BUG-01 (a second surface leaking the same identity) or whether search is independently safe even though the documents list leaks. | Pass/Fail — describe precisely which is true |
| 4.9 | Search for an **internal-only document** (a document you know from the Admin session has access level "Internal", not Investor-Shared/VDR). | **No result.** | Pass/Fail — SECURE if no result |
| 4.10 | Search for a deal this investor has **no engagement with at all** (never expressed interest, not in their matched list) — e.g. copy a deal name/codename visible only in the Admin session's full deal list. | **No result** — investor search should only surface deals in their own portal scope (matched/engaged), same as their Opportunities list, not the entire deal book. | Pass/Fail — SECURE if no result |
| 4.11 | Attempt a raw GraphQL request directly (bypass the UI): as the investor's authenticated session, POST `globalSearch(query: "Chipori")` to `/api/graphql` (use `browser_network_request` or devtools to replay with the investor's cookies). | Same result as 4.6 — the resolver keys off `ctx.actor` (server-derived identity), not any client-supplied id, so bypassing the UI must not change the outcome. | Pass/Fail — |
| 4.12 | While signed out (no session), attempt the same GraphQL query directly against `/api/graphql`. | Empty array `[]` — resolver short-circuits on `!actor.authenticated` before touching the DB. Confirm no 500 / stack trace either (should be a clean empty response, not an error). | Pass/Fail — |

---

## 5. Injection / malformed-query hygiene

| # | Step | Expected | Record result |
|---|---|---|---|
| 5.1 | Search for a SQL-ish string: `' OR 1=1 --` | No error, no unexpected result set (Prisma parameterizes queries — this should just return zero matches, treated as a literal substring). | Pass/Fail — |
| 5.2 | Search for an HTML/script string: `<script>alert(1)</script>` | Rendered literally as text in the (empty) results/empty-state, not executed — no alert dialog, no unescaped HTML in the DOM. | Pass/Fail — |
| 5.3 | Search a very long string (500+ chars). | No crash/500; either truncated gracefully or empty results. | Pass/Fail — |
| 5.4 | Search unicode/RTL/emoji content (e.g. `😀🚀` or Arabic script). | No crash; renders empty state cleanly. | Pass/Fail — |
| 5.5 | Rapidly open/close the palette 10+ times while a query is in flight. | No console errors, no duplicate/leaked modals, no orphaned network requests causing visible jank. | Pass/Fail — |

---

## 6. Partner-portal check

The task brief scopes the palette to "both admin and investor topbars." Confirm partner portal
behavior explicitly rather than assuming.

| # | Step | Expected | Record result |
|---|---|---|---|
| 6.1 | Log in as a partner contact, load `/portal/partner`. Check the topbar for a search pill. | Record whether the command palette is present on the partner portal too, or whether (per the brief) it is admin+investor only. If present, repeat a subset of §4's security cases scoped to what a partner should/shouldn't see (should never see other partners, other investors' engagements, or internal-only documents). | Pass/Fail — describe what's actually present |

---

## Summary

- Total cases: 32 (7 mechanics + 5 query-behavior + 9 admin-nav + 12 investor-security + 5 injection
  + 1 partner-scope, minor overlap in counting groups above).
- **Any single Fail in §4 is a P1 confidentiality bug** — stop and log it in `../01-BUGS.md` before
  continuing, and flag it in the handoff summary as equivalent-severity to BUG-01.
