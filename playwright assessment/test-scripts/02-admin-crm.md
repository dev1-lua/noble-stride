# 02 — Admin / Internal CRM (`(crm)/*`)

Covers every route under `src/app/(crm)/`. Preconditions: dev server at `localhost:3000`, signed in
as Admin (`evans@noblestride.capital`) unless a step says otherwise. Have a Team Member session
(`irine@noblestride.capital` or `ivy@noblestride.capital`) available for own-scope RBAC comparisons.

For every route below, also run the console/network check and one responsive breakpoint from
`06-cross-cutting.md` §1/§2 — don't duplicate those tables here, just check the box there.

---

## 1. Dashboard (`/dashboard`)

Top-to-bottom section inventory (confirm all render): Onboarding Queue Card + Intake Queue Callout
(above the header), Overview Agent (AI insights), 4-up stat grid (Active Mandates / Active
Transactions / Investors Engaged this Qtr / Capital Raised YTD, each with a delta badge), Deal
Pipeline Trend + Pipeline Overview charts, Pipeline Breakdown (By Deal Lead / By Sector / By
Financing Type / By Ticket Size), Deal Status & Activity + Recent Changes feed, Investor Engagement
rollup, Historical Engagement, Referral Conversion funnel, Investor Onboarding stat group (Pending
Review / Approved This Month / NDA Coverage), Team & Tasks (Deal Load by Team Member / Task Status by
Owner / Overdue Actions), Disbursements by Quarter.

| # | Step | Expected | Record result |
|---|---|---|---|
| 1.1 | Load `/dashboard` as Admin. | All sections above render, no section throws/blank-crashes. Stat-card numbers count up via animation, then settle — wait for settle before reading values. | Pass/Fail — |
| 1.2 | Re-check **BUG-06**: compare "Active Mandates" headline vs the Mandates pipeline breakdown sum; compare "Active Transactions" headline vs transaction-stage breakdown sum; compare the three capital figures (Capital Raised YTD / Invested-Completed / Disbursements by Quarter). | Record whether the numbers now reconcile (FIXED) or still diverge (STILL REPRODUCES) — note the exact figures seen. | Pass/Fail — |
| 1.3 | Re-check **BUG-05** (mojibake `�` in deal names, e.g. `Ewaka � Growth`): scan Recent Changes feed and any deal-name text on this page. | No `�` replacement characters visible — or note exactly where they still appear. | Pass/Fail — |
| 1.4 | Click "Pending Review" stat / Onboarding Queue link. | Navigates to `/investors?onboarding=PendingReview` with the queue filtered. | Pass/Fail — |
| 1.5 | As Team Member (non-owner of most records), load `/dashboard`. | Page renders without crashing; confirm whether insight cards/feeds are scoped to what the Team Member can see (own-scope) vs identical to Admin's view — record actual behavior. | Pass/Fail — |
| 1.6 | Check the AI "Overview Agent" / Ask box (see `06-cross-cutting.md` §4 for the full test) — quick sanity check here that it renders without obvious lorem-ipsum placeholder text. | Pass/Fail — |

---

## 2. Deals — unified queue (`/deals`)

`/deals` replaced the old separate Mandates/Transactions kanban lists; `/mandates` and
`/transactions` (list routes) now **redirect** to `/deals?type=mandate` / `?type=transaction`
respectively — confirm this redirect still holds (§3 below).

| # | Step | Expected | Record result |
|---|---|---|---|
| 2.1 | Load `/deals`. | List view (table) renders by default; header has view toggle (List/Board), "+ New Mandate" and "+ New Transaction" buttons. | Pass/Fail — |
| 2.2 | Type a search term in the Search filter. | URL updates with `?q=…`, table filters, page resets to 1. | Pass/Fail — |
| 2.3 | Apply Type filter = Mandate. | URL `?type=mandate`; only mandate rows shown. | Pass/Fail — |
| 2.4 | Apply Status, Sector, Ticket band, Lead, Priority, and Source filters one at a time (multi-select, comma-joined). | Each updates the URL and narrows results correctly; combining 2+ filters ANDs across filter types. | Pass/Fail — |
| 2.5 | Click a sortable column header once, then again. | First click sorts ascending, second click flips to descending; page resets to 1. | Pass/Fail — |
| 2.6 | Open "Columns" popover, toggle a column off then on. | Column hides/shows; `?cols=` param updates; popover doesn't clip off-screen (re-check the T10 `left-0` fix). | Pass/Fail — |
| 2.7 | Select "Group by: Stage" (or Lead/Sector/Type/Status). | Table re-renders as grouped sections with correct counts per group. | Pass/Fail — |
| 2.8 | Toggle to Board view. | Kanban renders; sub-toggle between Mandates/Transactions board; switching sub-toggle actually remounts (no stale columns — re-check the `key={boardType}` fix). | Pass/Fail — |
| 2.9 | On Board view, drag a card (or use the per-card restage control) to a new column, as Admin. | Restage succeeds, card moves, counts update. | Pass/Fail — |
| 2.10 | As a Team Member who does NOT own a given mandate/transaction, view the Board. | That record's board row/card is read-only (no drag/restage) — confirm `readOnly` gating is per-kind at minimum, ideally per-record ownership too. | Pass/Fail — |
| 2.11 | Use the Saved Views dropdown: apply filters, "Save current as…" a new view, then reload the page and re-apply it. | View persists via GraphQL (`createSavedView`); reapplying restores the exact filter/sort/group/column state. Rename and Delete the test view afterward (cleanup) and log it in `04-TEST-ARTIFACTS-LEFT-IN-DB.md` if not deleted. | Pass/Fail — |
| 2.12 | Apply 2+ filters, then click "Export CSV". | Downloads/opens a `text/csv` response reflecting the **full filtered set** (not just the current page) — cross-check row count against the filtered table's "Showing N of M" text. | Pass/Fail — |
| 2.13 | Click "+ New Mandate". | Drawer opens with mandate fields; save creates a new row visible in the list. | Pass/Fail — |
| 2.14 | Click "+ New Transaction". | Same, for transaction fields. | Pass/Fail — |
| 2.15 | As a role without `Mandates:C` / `Transactions:C` (e.g. TeamMember, check `/access-matrix` first to confirm), load `/deals`. | The "+ New Mandate"/"+ New Transaction" buttons are hidden or disabled, matching the matrix. | Pass/Fail — |
| 2.16 | Empty state: apply a filter combination that matches zero records (e.g. an absurd ticket band + a rare sector). | Clean "No deals match your filters" state, not a blank table or crash. | Pass/Fail — |

---

## 3. Mandates & Transactions detail

| # | Step | Expected | Record result |
|---|---|---|---|
| 3.1 | Navigate to `/mandates` directly. | 307-redirects to `/deals?type=mandate`. | Pass/Fail — |
| 3.2 | Navigate to `/transactions` directly. | 307-redirects to `/deals?type=transaction`. | Pass/Fail — |
| 3.3 | Open a mandate detail `/mandates/[id]` from the deals list. | Sections render in order: Deal Journey spine, Intake Review Panel (only if website-intake with no lead yet), Deal Summary, Documents-by-Stage, Key Facts, Restage select, Related Transactions, Documents list, Stage History, Activity Timeline. | Pass/Fail — |
| 3.4 | On a mandate you (Admin) can edit, use the Restage select. | Stage updates immediately, Stage History gets a new entry, stage timer resets. | Pass/Fail — |
| 3.5 | As Team Member viewing a mandate led by someone else. | Restage renders as a read-only chip + "Read-only in current view" note (own-scope RBAC via `canUpdateRecord`); Edit drawer button similarly hidden/disabled. | Pass/Fail — |
| 3.6 | Click "Find Prospects" header action. | Confirm actual behavior (opens a matching UI, or note if non-functional/placeholder). | Pass/Fail — describe |
| 3.7 | Click "Export" header action (noted as disabled in code). | Confirm it is indeed disabled/non-functional — if it's clickable and does nothing, that's a minor UX bug worth logging. | Pass/Fail — |
| 3.8 | As Admin, click Delete on a mandate. | Confirmation prompt, then deletion; as Team Member/non-Admin, Delete is hidden entirely (`canDeleteRecord` = Admin-only). | Pass/Fail — |
| 3.9 | Open a transaction detail `/transactions/[id]`. | Sections: Deal Journey (only if linked mandate), Deal Summary, Documents by Stage, Deal Facts, Restage, Investor Engagements list (links to `/engagement/[id]`), Service Providers, Deal Preparation checklist (derived from linked docs), Due Diligence Workstreams, Documents, Stage History, Activity Timeline. | Pass/Fail — |
| 3.10 | Click an Investor Engagement row. | Navigates to `/engagement/[id]` for that pairing. | Pass/Fail — |
| 3.11 | Click "Match Investors" header action. | Confirm actual behavior (matching popover/panel opens, or note placeholder). | Pass/Fail — describe |
| 3.12 | Re-check **BUG-05** mojibake on a mandate/transaction whose name contains an en-dash — edit and re-save the record's name field (append a space and remove it, or make a trivial edit), then reload. | If the en-dash gets mangled to `�` after the save round-trip, this CONFIRMS the write-path corruption theory — log exact before/after values. If it round-trips clean, mark BUG-05 FIXED/NOT REPRODUCIBLE. | Pass/Fail — |

---

## 4. Investors (`/investors`, `/investors/[id]`)

| # | Step | Expected | Record result |
|---|---|---|---|
| 4.1 | Load `/investors`. | Segment counters row, FilterBar (Search, **Investor Type** multi-select, Sector Focus, Geography, Status), amber "Pending Review" callout linking to `?onboarding=PendingReview` (hidden once already filtered to that view). | Pass/Fail — |
| 4.2 | Apply Investor Type multi-select = Venture Capital + DFI (searchable popover per the 2026-07-10 note). | URL `?type=VentureCapital,DFI`; table shows correct OR-matched count (cross-check against a manual count if feasible). | Pass/Fail — |
| 4.3 | Re-check **BUG-15** (junk/test data): scan the list for records like `asd`, `abc23`, `test2`, `Test1`, `E2E Probe Capital`, `Gate Check Capital`, name-baked status suffixes (`Abraaj Group (Inactive)`), or the corrupted `BlueOrchard` entry. | Note whether these are STILL PRESENT (data-hygiene issue, log/refresh in the bugs file) or cleaned up. | Pass/Fail — |
| 4.4 | Open a PendingReview or Rejected investor's detail page. | Onboarding actions (Approve / Reject / Greylist) render. | Pass/Fail — |
| 4.5 | Click **Greylist** on a test/throwaway investor (do NOT use a real seed investor — create a fresh one via `/register` first if you need a safe target). | `greylistInvestor` mutation sets classification to Greylisted (zero portal visibility) AND resolves registration as Rejected; a banner explains "approving alone will not restore access — change classification via Edit." | Pass/Fail — |
| 4.6 | On an Approved investor, open the NDA panel. | Shows Open-NDA status/date if present, else "Record Open NDA" button; Closed-NDA-per-deal list (if any) is read-only here — closed NDAs are recorded per-engagement, not on this page. | Pass/Fail — |
| 4.7 | As Admin, open the **Account access** panel on an investor with a linked login account. | Shows email/contact/status/last-login; Suspend/Reactivate toggle; "Reset link" generates a token URL shown inline. | Pass/Fail — |
| 4.8 | As Team Member (non-admin), open the same investor detail page. | Account access panel is **absent entirely** — confirm the query isn't even fetched for non-admins (check network requests, not just DOM) — this is a PII-protection check, not just a UI hide. | Pass/Fail — |
| 4.9 | Open an investor whose account status is PENDING (registered but not yet approved as a login account). | Account access panel shows "Awaiting approval in User Management" instead of Suspend/Reset actions. | Pass/Fail — |
| 4.10 | Attempt Edit on an investor as Team Member without update rights (per `/access-matrix`). | Edit drawer trigger hidden/disabled per `canUpdateRecord`. | Pass/Fail — |
| 4.11 | Attempt Delete as non-Admin. | Hidden entirely (`canDeleteRecord` Admin-only). | Pass/Fail — |
| 4.12 | Click "Mark Criteria Verified". | Sets/stamps a verified date next to "Criteria Verified". | Pass/Fail — |
| 4.13 | Re-check **BUG-16** (empty client financials — this is really about Clients, but note here if Investor detail shows any related empty-data gaps). | Note current state. | Pass/Fail — |

---

## 5. Clients (`/clients`, `/clients/[id]`)

| # | Step | Expected | Record result |
|---|---|---|---|
| 5.1 | Load `/clients`. | Client-side searchable/sortable table (no URL-driven filters — confirm search doesn't put PII in the URL). "+ New Client" button gated by `Clients:C`. | Pass/Fail — |
| 5.2 | Open a client detail page. | Company Profile card always shown; Financials / Governance / Compliance / Operations cards render **only when populated** (conditional rendering) — confirm empty clients correctly omit these rather than showing empty boxes. | Pass/Fail — |
| 5.3 | Re-check **BUG-16**: open several clients (e.g. City Health Hospital) and confirm whether revenue/EBITDA/HQ/founders/contacts are still sparse/empty across most records. | STILL REPRODUCES or improved — note how many of a sample of 5 clients have real financial data now. | Pass/Fail — |
| 5.4 | Open a client whose declared sector is in the restricted-sector list. | A rose "restricted sector" banner renders at the top of the detail page. | Pass/Fail — |
| 5.5 | Click "Log Communication". | Dialog opens, save creates a new Activity/Communication entry visible on the page. | Pass/Fail — |
| 5.6 | Edit a client's profile field and save. | Persists, visible on reload. | Pass/Fail — |
| 5.7 | On a client with 2+ mandates, check the Deal Journey section. | Most recent mandate's journey expanded by default; older ones collapsed behind a `<details>` toggle. | Pass/Fail — |
| 5.8 | Attempt Delete as non-Admin. | Hidden (`canDeleteRecord`). | Pass/Fail — |

---

## 6. Partners (`/partners`, `/partners/[id]`)

| # | Step | Expected | Record result |
|---|---|---|---|
| 6.1 | Load `/partners`. | 4 stat tiles (Total Partners, Deals Referred, Closed Revenue, Conversion Rate), table, "Referrals by Partner" bar chart. | Pass/Fail — |
| 6.2 | Open a partner detail page. | Profile card (amount, fee-sharing terms, agreement-status chip, profile text), Contacts, Referred Mandates (with linked transactions + partner-fee-status chip where `referredById` is set). No Activity Timeline (documented as not built for Partners). | Pass/Fail — |
| 6.3 | Re-check **BUG-07**: compare this partner's "Advisor type"/type field here vs. the same partner's value in the partner portal (`04-partner-portal.md` §3). | STILL REPRODUCES (mismatch) or FIXED (values agree). | Pass/Fail — |
| 6.4 | Edit / Delete gating. | Edit visible only per `canUpdateRecord`; Delete only per `canDeleteRecord` (Admin). | Pass/Fail — |

---

## 7. Service Providers (`/service-providers`)

| # | Step | Expected | Record result |
|---|---|---|---|
| 7.1 | Load `/service-providers`. | Stat tiles (Total + one per type: Law/Audit/Tax/ESG/etc.), table. | Pass/Fail — |
| 7.2 | As a role with NO `ServiceProviders:C` per the access matrix, check the "+ New Service Provider" button. | **Flag if it is visible/clickable anyway** — per code research this create action is NOT RBAC-gated (unlike every other list page's create button), which may be an intentional gap or an overlooked bug. Log as a new finding if a restricted role can create one. | Pass/Fail — note explicitly |

---

## 8. Engagement (`/engagement`, `/engagement/deals`, `/engagement/investors`, `/engagement/[id]`)

| # | Step | Expected | Record result |
|---|---|---|---|
| 8.1 | Navigate to `/engagement` directly. | Redirects to `/engagement/deals` (By Deal, default focal view). | Pass/Fail — |
| 8.2 | Load `/engagement/deals` (By Deal). | 7 stat tiles (Outreach/NDA Signed/Data Room/Meetings/Feedback/Term Sheets/Deals Rejected), stage legend, board grouped by transaction, plus Disbursements table + By Year/Quarter + Activity Timeline (this view only). | Pass/Fail — |
| 8.3 | Load `/engagement/investors` (By Investor). | 6 stat tiles (no "Deals Rejected"), board grouped by investor; NO disbursements/timeline panels (lighter page — confirm this asymmetry is intentional, not a missing-render bug). | Pass/Fail — |
| 8.4 | Click "Log Engagement" on either view. | Dialog opens (gated `Engagements:C`); creating one adds a new engagement row to the board. | Pass/Fail — |
| 8.5 | Expand a board row you (Admin) can restage; use the restage select. | Move succeeds; verify against an NDA-gated stage (see 8.7) as the negative case. | Pass/Fail — |
| 8.6 | Expand a row owned by a different Team Member while logged in as a non-owning Team Member. | Restage control is a static/read-only chip (`canRestage` false), no select rendered. | Pass/Fail — |
| 8.7 | Re-verify **BUG-17's fix**: attempt to restage an engagement with NO NDA on the investor into an NDA-gated stage (e.g. "NDA Signed" or later). | Inline error: `Stage "NDASigned" requires a signed NDA. Record an Open NDA on the investor, or a Closed NDA on this engagement, first.` — NOT a generic "Unexpected error." Select reverts, no data written. | Pass/Fail — |
| 8.8 | Open `/engagement/[id]` detail for a restageable engagement (re-verify **BUG-18's fix**: this UI path exists). | Restage select present as the first Details entry (if `canRestage`); NDA panel with "Record Closed NDA" button (only if no `ndaType` yet, with note "Stage changes past Teaser require an NDA"); Milestone Checklist, Stage History, Activity Timeline all present. | Pass/Fail — |
| 8.9 | Re-check **BUG-02**: on an engagement where the portal (investor-facing) stage label differs from the milestone-derived stage, compare `/engagement/[id]`'s stage chip against the same engagement viewed from `/portal/investor/pipeline` or the deal detail (see `03-investor-portal.md`). | STILL REPRODUCES or FIXED — note both labels seen. | Pass/Fail — |
| 8.10 | Re-check **BUG-05** mojibake on any engagement/deal name containing an en-dash. | Note presence/absence of `�`. | Pass/Fail — |

---

## 9. Documents (`/documents`)

| # | Step | Expected | Record result |
|---|---|---|---|
| 9.1 | Load `/documents`. | 4 stat tiles (Total, Under Review, Investor-Facing [InvestorShared+VDR], Executed), full register table. | Pass/Fail — |
| 9.2 | Click "+ New Document" (gated `Documents:C`), pick a real file, choose a link (Transaction/Client/Investor/Mandate/Partner), Save. | File uploads to local disk storage (`STORAGE_PROVIDER=local` per env), row appears with a download link and a "New version" action. | Pass/Fail — |
| 9.3 | Click the new document's download link. | 200 response, correct `content-type`/`content-disposition`, byte-identical to the source file. | Pass/Fail — |
| 9.4 | Attempt to save a new document with **no** linked record (leave all relation dropdowns empty). | Note whether this is blocked (matching the Tasks linked-record requirement) or allowed — code research didn't confirm a required-link rule here; log as a finding either way. | Pass/Fail — describe |
| 9.5 | Upload a new version to an existing document ("New version" action). | Version increments; both versions remain associated with the same document row (or confirm actual UI: does it replace or append?). | Pass/Fail — |
| 9.6 | As Admin, delete a document you created in 9.2 (cleanup). | Row disappears; a subsequent direct hit on its old download URL returns 403/404, not a stale file. | Pass/Fail — |
| 9.7 | As an Investor session, attempt to directly hit the download URL of a document whose access level is **Internal** (copy the URL/id from the Admin session). | **403** `{"error":"Not authorized"}` — no bytes leaked. This is the IDOR/authorization check for file storage — critical to re-verify. | Pass/Fail — SECURE if 403 |
| 9.8 | As Investor, download a document correctly scoped to them (Investor-Shared/VDR on a deal they're engaged with). | 200, correct file. | Pass/Fail — |
| 9.9 | Re-check **BUG-01** from the documents register itself (not just the portal): find the Teaser doc for a PRE_INTEREST-tier deal and confirm whether its title in this internal register still embeds the real client name (expected — internal viewers SHOULD see real names) vs. what the SAME document's title renders as in the investor portal (`03-investor-portal.md` §3 — should be masked there). | Internal register: real name expected (correct). Investor portal: STILL LEAKS or FIXED — cross-reference. | Pass/Fail — |

---

## 10. Tasks (`/tasks`)

| # | Step | Expected | Record result |
|---|---|---|---|
| 10.1 | Load `/tasks`. | 5 status tiles (Ongoing/Pending/NotStarted/Done) + red "Overdue" tile (escalated-task count). Auto-escalation runs on page load. | Pass/Fail — |
| 10.2 | Click "+ New Task", fill Title only, leave Mandate/Transaction/Investor/Client all unselected, Save. | Re-check **BUG-10**: research indicates a `.refine()` now requires at least one linked record both client- and server-side, with error "Link the task to at least one record (mandate, transaction, investor, or client)." Confirm this blocks the save (FIXED) or still allows it (STILL REPRODUCES). | Pass/Fail — |
| 10.3 | Create a valid task with Title + one linked record + Owner + Deadline + Notes, Save. | Task appears in the list with "Related to: <record>". | Pass/Fail — |
| 10.4 | Edit an existing task and attempt to **remove** its only linked record (leaving zero links) via the edit drawer, Save. | Research flagged `taskUpdateSchema` as `.partial()` with no refine — this may allow saving a task down to zero links even though creation blocks it. Confirm actual behavior; if it succeeds, log as a gap (the validation is create-only, not invariant-preserving on update). | Pass/Fail — describe |
| 10.5 | Set a task's deadline in the past without marking it Done, reload the page. | Task appears in the Overdue tile/escalated set (auto-escalation). | Pass/Fail — |
| 10.6 | Re-check **BUG-11** ("1 action points" pluralization) — find any task-count copy at count=1. | STILL REPRODUCES or FIXED. | Pass/Fail — |
| 10.7 | Look for a task search/filter bar. | Record whether one exists inside the table itself (not confirmed by code research) — note actual UI. | Pass/Fail — describe |

---

## 11. Access Matrix (`/access-matrix`)

| # | Step | Expected | Record result |
|---|---|---|---|
| 11.1 | Load `/access-matrix`. | Fully static/read-only per the 2026-07-10 role-cleanup: a role `<select>` (Admin/DealLead/TeamMember) driving a green-check/dash grid sourced from `RBAC_MATRIX`. **No** demo banner, **no** "Reset to defaults" button, no editable cells of any kind. | Pass/Fail — |
| 11.2 | Switch the role selector to each of Admin / DealLead / TeamMember. | Grid updates to reflect that role's actual CRUD permissions per entity — spot-check at least 2 cells against real behavior observed elsewhere (e.g. TeamMember should show no Delete on most entities, matching §3–§10 RBAC checks above). | Pass/Fail — |
| 11.3 | Confirm no way to actually change a real user's permissions from this page. | This page is reference-only; changing anything here must NOT persist or affect real RBAC enforcement elsewhere. | Pass/Fail — |

---

## 12. Settings → Users (`/settings/users`)

Internal-accounts-only; investor accounts are managed from the investor detail page (§4.7), not here.

| # | Step | Expected | Record result |
|---|---|---|---|
| 12.1 | As Admin, load `/settings/users`. | Pending-approval table (email/kind/name/requested date) + All-accounts table (internal only). | Pass/Fail — |
| 12.2 | On a pending **internal** account, use the inline role select (Admin/DealLead/TeamMember) then click Approve. | Account activates with the chosen role; can now log in per that role's permissions. | Pass/Fail — |
| 12.3 | On a pending **investor** account (if any appear here — expected NOT to, per research; investor approvals happen on `/investors`), check whether investor rows appear at all. | Confirm investor pending accounts do NOT show up in this Users pending queue (they belong on `/investors`) — if they do appear here too, that's a duplication/consistency finding. | Pass/Fail — |
| 12.4 | In "All accounts", type a partial email into the search box. | Client-side filter narrows rows; **URL does not change to include the search term or any PII** (re-verify the 2026-07-09 finding "Showing 1 of 14", no `?q=` with an email in the address bar). | Pass/Fail — |
| 12.5 | Apply Role filter and Status filter (Active/Suspended). | Table narrows correctly on each axis and combined. | Pass/Fail — |
| 12.6 | Click "Change role" on a row, then Suspend, then Reactivate, then "Reset link". | Each mutates and re-renders correctly; Reset link displays a token URL inline (do not need to follow it here — covered in `01-auth-and-security.md`). | Pass/Fail — |
| 12.7 | As Team Member, navigate directly to `/settings/users`. | Redirected to `/dashboard` — page is guarded server-side against the **real** role via `getCurrentAuth()`, not any impersonation/lens state. | Pass/Fail — |
| 12.8 | As Team Member, attempt the underlying server actions directly if feasible (e.g. replay a `changeRole`/`suspendAccount` request with a Team Member session). | Denied — `requireRealAdmin()` re-checked independently inside each action, not just at the page level. | Pass/Fail — |

---

## Summary

- Routes covered: 20 (`/dashboard`, `/deals`, `/mandates`(+redirect), `/mandates/[id]`,
  `/transactions`(+redirect), `/transactions/[id]`, `/investors`, `/investors/[id]`, `/clients`,
  `/clients/[id]`, `/partners`, `/partners/[id]`, `/service-providers`, `/engagement`(+redirect),
  `/engagement/deals`, `/engagement/investors`, `/engagement/[id]`, `/documents`, `/tasks`,
  `/access-matrix`, `/settings/users`).
- Re-checks bundled in: BUG-01 (doc register cross-check), 02, 05, 06, 07, 10, 11, 15, 16, 17
  (fixed), 18 (fixed).
