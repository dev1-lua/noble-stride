# 03 — Investor Portal

Covers all 5 routes under `src/app/portal/investor/`: Opportunities (`/portal/investor`), deal
detail (`/deals/[id]`), My Pipeline (`/pipeline`), Dashboard (`/dashboard`), Fund Profile
(`/profile`). Sign in as `cmiriti@ifc.org` (IFC), password `NobleStride!Demo2026`. Recommend running
with `RESEND_API_KEY` unset (password-only login) per `00-INDEX.md`'s environment note, unless you're
specifically doing the 2FA-ON pass from `01-auth-and-security.md` §3B.

If a second approved investor login is available (e.g. Norfund/responsAbility), use it for the IDOR
comparisons — those are also covered in `01-auth-and-security.md` §8; don't duplicate the write-up,
just cross-reference.

---

## 1. Opportunities (`/portal/investor`)

Filters (`src/components/portal/opportunity-filters.tsx`): Sector, Country, Deal type, Instrument —
all searchable multi-selects (comma-joined in the URL); 8 numeric range inputs (ticket, revenue,
EBITDA, net-profit min/max, committed on blur/Enter, not live); 2 checkboxes (Women-led, Youth-led);
"Clear filters" appears only when any filter is active.

| # | Step | Expected | Record result |
|---|---|---|---|
| 1.1 | Load `/portal/investor`. | Grid of opportunity cards; "N opportunities match" text above the grid. | Pass/Fail — |
| 1.2 | Open the Sector filter, type a partial term (e.g. "tech") into its search box. | Only matching options remain in the list (e.g. "Technology"). | Pass/Fail — |
| 1.3 | Select a sector, confirm URL updates. | `?sector=Technology` (or similar); grid narrows; match count updates. | Pass/Fail — |
| 1.4 | Select 2 sectors (multi-select). | `?sector=A,B` comma-joined; OR-match across both. | Pass/Fail — |
| 1.5 | Repeat for Country, Deal type, Instrument filters individually. | Each behaves the same way (searchable multi-select, URL param). | Pass/Fail — |
| 1.6 | Enter a ticket-size min/max range, tab out (blur). | Filter commits on blur (not on every keystroke) — confirm no request fires per-character. | Pass/Fail — |
| 1.7 | Check Women-led and/or Youth-led checkboxes. | Grid narrows accordingly. | Pass/Fail — |
| 1.8 | With 2+ filters active, click "Clear filters". | All filters reset, URL params removed, full list returns. | Pass/Fail — |
| 1.9 | Apply a filter combination matching zero deals. | Empty state reads "No opportunities match your filters." (distinct from the no-filters empty state). | Pass/Fail — |
| 1.10 | As an investor with a blocked classification (Excluded/Greylisted/Inactive/OnHold) or non-Approved onboarding — check via an Admin session which test investor qualifies, then attempt this portal as them if credentials exist. | Opportunities list is entirely empty regardless of filters — confirm this is a true empty-set, not an error. | Pass/Fail — SECURE |
| 1.11 | Craft an invalid enum value or a negative number directly in the URL (e.g. `?sector=NotARealSector&ticketMin=-500`). | Silently dropped server-side (`parseOpportunityFilters`) — no crash, no reflected raw value causing an error page. | Pass/Fail — |
| 1.12 | Re-check **BUG-13**: inspect the page's heading structure (accessibility snapshot). | Confirm whether there are still two `<h1>`-level headings ("Opportunities" banner + "Investment Opportunities" main heading) — STILL REPRODUCES or FIXED. | Pass/Fail — |
| 1.13 | Identify a card for a deal at the PRE_INTEREST tier (no engagement yet, or Shared/TeaserSent stage). | Card shows a codename (e.g. "Project Amber Harrier"), not the real company name; sector/instrument tags and target raise ARE shown (not masked). | Pass/Fail — |
| 1.14 | Click into that codenamed card. | Proceeds to deal detail — see §2 for the tiered-visibility checks. | Pass/Fail — |

---

## 2. Deal detail (`/portal/investor/deals/[id]`)

Tiers: `NONE < PRE_INTEREST < AFTER_NDA < DD`, mapped from engagement stage. At PRE_INTEREST,
financials render as coarse USD bands with a "shared after NDA" banner; `advisorClientContacts`
(Company Contacts card) only appears at DD. Milestone checklist shows all 15 steps with completion
dates for done items and an "`X of 15 · {stage}`" summary — only if the investor has an own
engagement.

| # | Step | Expected | Record result |
|---|---|---|---|
| 2.1 | Open a PRE_INTEREST-tier deal. | Deal name = codename; company profile fields masked/limited; financials shown as coarse bands (e.g. "$1M–$5M") with row labels like "Revenue (range)"; banner: "Detailed financials are shared after an NDA is signed." | Pass/Fail — |
| 2.2 | On the same deal, check for a Company Contacts card. | Absent at PRE_INTEREST (only renders at DD tier). | Pass/Fail — |
| 2.3 | **Re-verify BUG-01's fix** — open the Documents section on this PRE_INTEREST deal. | Document titles are masked to `"{DocType} — {Codename}"` (e.g. "Teaser — Project Amber Harrier"), download links are `null`/"On request" — the real company name (e.g. "Chipori Ltd") must NOT appear anywhere in a document title or link. If it does, this is a P1 regression — log immediately, cross-reference `01-BUGS.md` BUG-01. | Pass/Fail — **CRITICAL** |
| 2.4 | Confirm which document TYPES are visible pre-interest. | Only Teaser/PitchDeck types shown; `EngagementContract` never shown at any tier; superseded versions (`isCurrent=false`) always hidden; VDR docs require DD tier AND NDA satisfied — try to find a VDR doc on this deal and confirm it's absent. | Pass/Fail — |
| 2.5 | Open a deal at AFTER_NDA tier (find one via an Admin session, or progress this deal's engagement via Admin restage, then reload as investor). | Real company name now shown (not codename); financials still may show "—" if the underlying Client record has no data (this is BUG-16, a data gap, not a masking bug — don't conflate the two). | Pass/Fail — |
| 2.6 | Open a deal at DD tier if one exists. | Company Contacts card now renders; VDR documents become visible (if NDA satisfied). | Pass/Fail — |
| 2.7 | On the deal detail milestone checklist, count the steps. | 15 milestone items, done ones show a checkmark + completion date, "`X of 15 milestones · {stage label}`" summary line. | Pass/Fail — |
| 2.8 | Re-check **BUG-02**: compare this page's stage badge against the milestone-implied stage, and against the same engagement's stage shown in `/engagement/[id]` (Admin session, `02-admin-crm.md` §8.9). | STILL REPRODUCES (labels disagree) or FIXED (consistent). | Pass/Fail — |
| 2.9 | On a deal with no existing engagement, click "Express interest". | Submits, `?interest=sent` in the URL, confirmation banner appears ABOVE the form. | Pass/Fail — |
| 2.10 | **Re-verify BUG-14's fix**: after the confirmation banner appears, check whether the "Request More Information" form (textarea + submit) is STILL rendered and usable below/alongside the banner. | Per code research, the form should still render unconditionally (button label changes to "Send request") — confirm live: can you actually type a second message and submit again? FIXED if yes, STILL REPRODUCES if the form is gone. | Pass/Fail — |
| 2.11 | Submit a second "Send request" message on the same deal. | Succeeds without a full page reload being required; new Activity/Note logged. | Pass/Fail — |
| 2.12 | Confirm express-interest is human-gated (doesn't auto-advance the pipeline stage). | Engagement created/updated at "Shared"/"Interested" status only — stage does NOT jump ahead automatically (re-confirms Spec §12 guardrail). | Pass/Fail — |
| 2.13 | As Investor, attempt to view a deal id that belongs to another investor's exclusive engagement and isn't independently discoverable by this investor (see `01-auth-and-security.md` §8.1 for the full IDOR script — just confirm the result here too). | 404, not a partial/masked render. | Pass/Fail — SECURE |
| 2.14 | Check the portal footer copy on this page. | Re-check **BUG-12**: "Confidential — shared under the terms of your NDA…" — confirm whether this is now conditioned on actual NDA status (shouldn't show for a no-NDA investor) or still unconditional. | Pass/Fail — |

---

## 3. My Pipeline (`/portal/investor/pipeline`)

Own engagements only (allowlisted fields — enforced by unit tests per research, e.g.
`own-engagement.test.ts`, confirming feedback/probability/notes/amounts/owner/other-investor fields
are never exposed). Declined engagements render at 60% opacity, sorted to the bottom, deal
re-projected at PRE_INTEREST (teaser level) even if the investor had progressed further before
declining.

| # | Step | Expected | Record result |
|---|---|---|---|
| 3.1 | Load `/portal/investor/pipeline` with an investor who has engagements. | Each row: deal name, up to 3 sector chips, stage badge, 15-segment milestone progress bar, "`X of 15 milestones`", last-contact date, "Term sheet issued" chip+date if applicable. | Pass/Fail — |
| 3.2 | If a declined engagement exists for this investor. | Rendered at reduced opacity, still clickable, sorted below active ones; clicking it shows the deal at PRE_INTEREST/teaser level even though progress was further before decline. | Pass/Fail — |
| 3.3 | Compare a specific engagement's stage badge here vs. its badge on the Opportunities card and on the deal-detail page. | Re-check **BUG-02** consistency across all three surfaces. | Pass/Fail — |
| 3.4 | With zero engagements (a freshly approved investor with no interest expressed yet, if available). | "No active engagements yet." + CTA button back to `/portal/investor`. | Pass/Fail — |
| 3.5 | Confirm no cross-investor data ever appears (e.g. another investor's engagement on the same deal). | Only this investor's own rows — verify by comparing row count against what an Admin session shows for this investor specifically. | Pass/Fail — SECURE |

---

## 4. Dashboard (`/portal/investor/dashboard`)

5 KPI tiles: Matching opportunities, Deals engaged, Committed, Disbursed, Pending. **BUG-03 is
confirmed BY DESIGN in the current code** — the dashboard's "Matching opportunities" count is a pure
discovery-match count (`discoverableDealsForInvestor`, unfiltered, EXCLUDING any already-engaged deal
that no longer independently matches the investor's mandate), while the Opportunities-page count
includes discoverable ∪ own-engaged deals. They will legitimately differ whenever an engaged deal
falls outside current mandate/sector/geo/ticket match.

| # | Step | Expected | Record result |
|---|---|---|---|
| 4.1 | Load `/portal/investor/dashboard`. | 5 KPI tiles render with real numbers (not stuck at 0 after animation settles). | Pass/Fail — |
| 4.2 | Compare "Matching opportunities" here against the "N opportunities match" text on `/portal/investor` (§1.1), same investor, same session. | **Reproduce BUG-03's root cause**: find (or create, via Admin restage) an engaged deal that falls outside this investor's current filter/mandate match, then confirm the two counts diverge exactly as the design predicts. Document the two numbers and whether the divergence is explained by the "engaged-but-not-discoverable" mechanism, or is something else (a genuine bug) — this distinction matters for how it gets logged/relabeled. | Pass/Fail — describe both numbers |
| 4.3 | Check "Your Pipeline by Stage" bar chart. | Grouped correctly by `EngagementStage`, own non-declined engagements only, vocabulary order matches `LABELS.EngagementStage`. | Pass/Fail — |
| 4.4 | Check "Your Disbursements by Quarter" table. | Own disbursements only, grouped by year+quarter. | Pass/Fail — |
| 4.5 | As a blocked-classification investor (if testable). | All KPIs/charts render as zero/empty, not an error page. | Pass/Fail — |

---

## 5. Fund Profile (`/portal/investor/profile`)

7 sections: Fund Strategy & Preferences, Geographic Focus, Track Record & Portfolio, Fund Life Cycle
& Capital, Decision-Making Process & Timelines, Engagement Logistics, Ethical & Impact
Considerations. Save action redirects to `?saved=1` with a green confirmation banner. Contact fields
edit `investor.contacts[0]` (ordered `isPrimaryContact desc, createdAt asc, id asc` — same ordering
used on save, so the form always edits the right contact).

| # | Step | Expected | Record result |
|---|---|---|---|
| 5.1 | Load `/portal/investor/profile`. | All 7 sections render with their documented fields (Investment Mandate textarea, Target Sectors/Deal Stages/Preferred Instruments chip multi-selects, Ticket Min/Max, Target IRR%, Primary Regions chips + Country Restrictions textarea, Notable Investments/Portfolio/Case Studies textareas, AUM + Reinvestment Period, DD Requirements, Governance, Contact Name/Email/Phone, Team Composition, Collaboration Terms, ESG Policies, Impact Metrics, Reputational Risks). | Pass/Fail — |
| 5.2 | **Design-unification check**: inspect an input's border via the accessibility/DOM snapshot or visual screenshot. | Confirm the strengthened `border-[var(--border-strong)]` + `focus:ring-1 focus:ring-[var(--accent)]` treatment is visibly present (a clearly bounded field, not a faint hairline) — this is the flagship example the design change targeted. Screenshot: `verify-fund-profile-borders.png`. | Pass/Fail — |
| 5.3 | Confirm each of the 7 sections renders as a shared `Card` (visible border + subtle shadow), not a hand-rolled div. | All 7 sections have consistent card chrome. | Pass/Fail — |
| 5.4 | Edit a field in each section (one edit per section is enough), click Save. | Redirects with `?saved=1`; green "Profile saved. Your deal matching preferences are now up to date." banner. | Pass/Fail — |
| 5.5 | Reload the page (hard refresh). | All edits from 5.4 persisted — confirm actual DB save, not just optimistic client state. | Pass/Fail — |
| 5.6 | Edit the Contact Name/Email/Phone fields specifically, save, reload. | Correct contact record updated — if this investor somehow has multiple contacts, confirm the FIRST (primary) one is what's edited, per the ordering rule, not a random one. | Pass/Fail — |
| 5.7 | Trigger a validation error (if any exists — e.g. malformed email in Contact Email field) via `ContactEmailField`. | Clear inline error, not a full-page crash. | Pass/Fail — |
| 5.8 | Leave the page with unsaved changes (navigate away without clicking Save). | Confirm actual behavior — no warning is fine if that's the design, but note whether data silently discards (acceptable for a QA note, not necessarily a bug). | Pass/Fail — describe |

---

## 6. Design parity checks (cross-reference `06-cross-cutting.md` §6)

| # | Step | Expected | Record result |
|---|---|---|---|
| 6.1 | Look at the investor sidebar (all 4 nav items: Opportunities/Pipeline/Dashboard/Fund Profile). | Each has a distinct colored icon: emerald (Opportunities), amber (Pipeline), sky (Dashboard), violet (Fund Profile) — NOT uniform gray. Active item switches to accent color. | Pass/Fail — |
| 6.2 | Look at the topbar. | `CommandPalette` "Search…" pill (see `05-global-search.md`), notification bell, NO viewpoint/portal switcher of any kind (confirms BLOCKER-A closure — the old impersonation dropdown is gone). | Pass/Fail — |
| 6.3 | Click the sidebar-bottom profile block. | Upward dropdown with avatar+name/email and a single "Log out" item; closes on outside-click/Escape. | Pass/Fail — |
| 6.4 | Compare card styling on Dashboard/Pipeline/Opportunities against the Fund Profile page. | Consistent Card treatment (border+shadow) across ALL investor-portal pages, not just Profile — research flagged ~14 hand-rolled divs across dashboard/deals-detail/layout/page/pipeline were converted to shared Card; spot-check at least one card per page. | Pass/Fail — |

---

## Summary

- 5 routes, 6 subsections, ~40 test cases.
- Flagship re-checks: BUG-01 (§2.3, CRITICAL), BUG-02 (§2.8, §3.3), BUG-03 (§4.2, root-cause
  reproduction), BUG-12 (§2.14), BUG-13 (§1.12), BUG-14 (§2.10).
- Design-unification flagship check: §5.2–5.3 (Fund Profile borders), §6 (sidebar icons, card parity).
