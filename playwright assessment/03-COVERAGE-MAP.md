# Coverage Map — what was tested & what works (2026-07-07)

A full inventory of everything walked through, mapped to the spec, so you can see coverage at a glance.
✅ works · ⚠️ works with a bug (see `01-BUGS.md`) · ➖ not built (scope gap) · 🔒 confidentiality-relevant

## Routes exercised

### Public / auth
| Route | Result |
|-------|--------|
| `/` (landing) | ✅ Clean; "How onboarding works" 4-step, CTAs to register/login |
| `/register` (investor onboarding) | ✅ 6 fields + type/sector/dealtype/size; free-provider rejection works; ⚠️ wipes fields on error (BUG-08) |
| `/register` OTP verify (demo `000000`) | ✅ Both codes required; advances to "under review" |
| `/login` (demo, any password) | ✅ Email→viewpoint; 🔒 unknown email rejected; preserves email on error |

### Investor portal (`/portal/investor/*`)
| Route | Result |
|-------|--------|
| Opportunities (list + filters) | ⚠️ Works; codename masking on pre-NDA cards ✅; duplicate `<h1>` (BUG-13); count vs dashboard (BUG-03) |
| Deal detail | 🔒 ⚠️ Tiered masking works for profile/financials, milestone stepper (15 steps) ✅; **document title leak (BUG-01)**; stage label inconsistency (BUG-02); express-interest works but form disappears (BUG-14) |
| My Pipeline | ✅ 4 engagements, 15-milestone progress bars, term-sheet dates |
| Dashboard | ✅ KPIs, pipeline-by-stage, disbursements-by-quarter; ⚠️ matching count (BUG-03) |
| Fund Profile | ✅ Full preferences form (mandate, sectors, stages, tickets, instruments, geo, track record, fund lifecycle, DD/governance, ESG, contact); **Save persists** ✅ |

### Partner portal (`/portal/partner/*`)
| Route | Result |
|-------|--------|
| Overview | ✅ Referral funnel, referrals-by-stage, expected fee, referred-deals table; ⚠️ advisor type (BUG-07) |
| Submit Referral | ✅ **Write path works** — created a Client + Mandate ("QA Referral Co – Referral") and incremented the funnel |
| My Details | ✅ Contact edit + **Save persists**; ⚠️ advisor type shows "Investor" (BUG-07) |

### Internal CRM (`/(crm)/*`)
| Route | Result |
|-------|--------|
| Dashboard | ⚠️ Very complete (all §13 dashboards); KPI reconciliation (BUG-06); mojibake (BUG-05) |
| Mandates (Kanban) | ✅ Stages New Lead→Signed→Lost, counts, filters; new referral appears |
| Transactions (Kanban) | ✅ Deal Prep→Closed, contacted/active counts |
| Clients | ✅ 21 clients; ⚠️ mostly empty financials (BUG-16) |
| Client detail | ✅ Profile, mandates, transactions, comms, change history |
| Investors | ✅ 48 investors, filters, review-queue callout |
| Investor detail | ✅ 🔒 Onboarding gate (Approve/Reject/Greylist **works**), Key Facts, Contacts, NDA (Record Open NDA), Engagements, Activity, Change History |
| Engagement Tracker | ✅ Stage board Shared→Declined w/ match %; ⚠️ mojibake (BUG-05) |
| Documents | ✅ 34-doc register, access levels Internal/VDR/Investor-Shared/Client-shared, statuses |
| Tasks | ✅ **Create works** (all §3.8 fields); ⚠️ no linked-record validation (BUG-10), pluralization (BUG-11) |
| Partners | ✅ 15 partners, funnel metrics; ⚠️ type mapping (BUG-07) |
| Service Providers | ✅ 4 providers (Law/Audit/Tax/ESG) — matches §3.7 |
| Access Matrix | ✅ Renders §7.2 CRUD grid per lens (display-only, self-declared) |

## Queue rework (2026-07-08) — new & changed surfaces

Verified live via Playwright (browser MCP), logged in as `demo@noblestride.com` (admin/internal lens) unless noted. Screenshots at repo root as `verify-Q-*.png`. Gates: `npx vitest run` 472/472 pass (64 files); `npx tsc --noEmit` clean; `npx next build` clean.

| Surface | Result |
|---------|--------|
| `/` landing (anonymous) — internal-first | ✅ Rewritten (Task 15): hero "Your pipeline, documents, and investor engagement in one place", primary CTA "Sign in to your workspace" → `/login`; investor CTAs ("Login as an investor" / "Sign up as an investor") secondary; feature grid (deal queue, NDA-gated docs, investor engagement, dashboards). `verify-Q-landing-internal-first.png` |
| `/login?as=investor` | ✅ "Investor sign in" / "Investor & partner portal access" variant copy. `verify-Q-login-as-investor.png` |
| `/deals` unified queue (list default) | ✅ Mandates + transactions in one queue; sortable column headers (param-preserving hrefs), type/status/sector/ticket/lead filters, group-by (stage/lead/sector/type/status). 20 mandates / 12 transactions / 32 all. |
| `/deals` filtered + grouped | ✅ `?status=Open&group=stage` renders grouped sections. `verify-Q-deals-grouped-by-stage.png` |
| `/deals` board (Kanban) toggle | ✅ List⇄Board toggle; Mandates\|Transactions sub-toggle; transaction board columns Deal Preparation→Closed-Lost with per-card contacted/active counts. `verify-Q-deals-board-transactions.png`. (T10 fixes: `key={boardType}` remount + column-popover `left-0` — `verify-Q-board-mandate-subtoggle-fixed.png`, `verify-Q-columns-popover-fixed.png`) |
| `/deals` column chooser | ✅ Columns popover toggles table columns → `cols=` URL param (T10). |
| Saved views (team-shared) | ✅ Full CRUD round-trip GraphQL-persisted (CREATE→APPLY→RENAME→DELETE) verified in T10; 3 seeded starter views (Active mandates / Live transactions / Closing this quarter). |
| Export CSV | ✅ `/deals/export` link honors active filters (filtered 11 / full 33 rows), `text/csv`. |
| `/mandates`, `/transactions` (list) | ✅ 307-redirect to `/deals?type=mandate` / `?type=transaction` (Task 12 nav consolidation); sidebar/topbar updated. Detail routes `/mandates/[id]`, `/transactions/[id]` still 200. |
| Mandate detail — Deal Summary + Documents by Stage | ✅ Summary header panel (Task 13) + Documents-by-Stage (Task 14): Onboarding NDA/EA from mandate date-pairs, Fee-Share=Missing; Deal-Prep/Term-Sheet/DD/Closing/Data-Room slots show linked-doc status or "Missing". `verify-Q-mandate-docs-by-stage.png` |
| Transaction detail — Deal Summary + Documents by Stage | ✅ NDA/EA **derived from linked mandate**; engagement rollup (investors/total/disbursed/pending); doc-matched rows render as clickable VDR links (Teaser="Approved"); Data Room from `vdrLink`. `verify-Q-transaction-docs-by-stage.png` |
| Fee-share add path (document drawer) | ✅ Type dropdown lists "Fee-Share Agreement"; selecting it reveals a Partner combobox from `relationOptions().partners` (15 partners), hidden for other types. Server `partnerId` persistence wired (not saved in test — kept demo DB clean). `verify-Q-feeshare-partner-selector.png` |

Note: the historical "Mandates (Kanban)" / "Transactions (Kanban)" rows above (2026-07-07) are superseded by the unified `/deals` queue; the standalone list routes now redirect.

## Spec coverage (Build Spec §-by-§)

| § | Area | Status |
|---|------|--------|
| §2–3 | Entities & data dictionary | ✅ Company, Deal(Mandate/Transaction), Investor, Investor Contact, Partner, Service Provider, Task, Document, Communication(Activity), Investor-Deal Engagement all present; ⚠️ Client fields sparsely populated (BUG-16); ➖ Advisory Engagement not built (correct) |
| §4–5 | Picklists & sector taxonomy | ✅ Present; ⚠️ drift (BUG-09) |
| §6 | Milestone framework | ✅ 15-step investor milestone model in portal + engagement |
| §7 | Audit / immutability / RBAC | ✅ Change history + stage-change feed; RBAC lenses enforced; ⚠️ switcher display (BUG-04); demo-only enforcement caveat |
| §8 | 4 agents | ➖ Not built (BLOCKER-C) |
| §9 | WhatsApp integration | ➖ Not built (BLOCKER-C) |
| §10 | Website intake & qualification | ➖ Built for wrong actor / no qual logic (BLOCKER-D) |
| §11 | 🔒 Investor deal visibility | ⚠️ Tiers, filters, excluded/greylisted gate all work; **document leak (BUG-01)**; post-NDA reveal unexercised (BLOCKER-B) |
| §12 | Automation guardrails | ✅ Human gates respected (express-interest doesn't auto-advance; approvals manual; excluded/greylisted blocked) |
| §13 | Reporting & dashboards | ✅ Pipeline, deal status, investor engagement, disbursement, referrals, team & tasks, onboarding — all present; ⚠️ (BUG-06) |
| §14 | Systems & integrations | ➖ M365/SharePoint/WhatsApp not built (BLOCKER-C) |

## 🔒 Confidentiality guardrails — verified behaviours
| Guardrail (Spec §11/§12) | Result |
|--------------------------|--------|
| Pending (unapproved) investor sees nothing | ✅ "Registration under review … no information visible" |
| Excluded investor (IncoFin) sees nothing | ✅ Blocked on list **and** direct deal-URL (no IDOR) |
| Greylisted investor (Afrexim) sees nothing | ✅ Blocked identically |
| Pre-interest: financials masked, company profile limited | ✅ `—` for revenue/EBITDA/HQ/founded; "shared after NDA" copy |
| Pre-interest: company identity masked with codename | ⚠️ Deal + profile masked ✅ — **but document titles leak it (BUG-01)** |
| Post-NDA: real company name shown | ✅ (e.g. City Health shown by name once NDA signed) |
| Express interest is human-gated (no auto-advance) | ✅ Milestone did not move on the investor's action |

## Environment notes
- App: Next.js 16 / React 19 / Prisma 6 / GraphQL (Pothos + graphql-yoga + urql) / Tailwind 4 / `jose` / `motion`.
- No client-side JS console errors and no failed network requests observed across the entire session. Data fetching is server-rendered (RSC) — GraphQL runs server-side.
- Auth model: `ns_viewpoint` cookie is the "session" (demo).

## Engagement restage restore (2026-07-08 PM) — BUG-18 fix verification

Verified live via Playwright (browser MCP) on `integration/all-features` at `0c5d86e`. Gates before this pass: tsc 0 errors, lint pre-existing-only (8E/3W, none in touched files), vitest 491/491 (489 + 2 new helper tests). Screenshot at repo root: `verify-RS1-board-inline-restage.png`.

| Scenario | Result |
|----------|--------|
| Investor expresses interest (responsAbility → masked "Project Jade Marula" = Chipori Ltd – Series A) | ✅ Redirects with `?interest=sent`; engagement created at **Shared / Interested**; portal note ("Investor expressed interest via portal" + message) on the activity timeline |
| By Deal board reflects new engagement | ✅ Chipori group went 5→6 investors, Shared·1→Shared·2; expanded row shows 12-option stage select at Shared with InterestLevel chips and Open → link intact |
| Restage from board row (Shared → Teaser Sent) | ✅ Select fires `updateEngagement`; after refresh the group distribution bar/pills recompute (Shared·1, Teaser Sent·2) |
| Restage from detail page (Teaser Sent → Meeting) | ✅ New "Stage" entry is the FIRST Details item; Stage History records both changes ("Shared → Teaser Sent", "Teaser Sent → Meeting", today · Team); milestone checklist auto-advanced 1/15 → 3/15 via stage-implied entries |
| NDA guard (Uqalo Capital × Chipori, investor NDA = None, Shared → NDA Signed) | ✅ Inline rose error `Stage "NDASigned" requires a signed NDA…` rendered under the select; select reverted to Shared; no data written |
| Read-only lenses | ✅ TeamMember (Irine M, non-owner): detail page shows static Shared chip, no stage select, no Edit drawer. DealLead (Brenda C): board rows she owns (5/6 in Chipori group) show selects; the unowned responsAbility row shows a static chip — own-scope split matches DB ownership exactly |

Data changed by this pass (intentional, demo-safe): new engagement responsAbility × Chipori Ltd (Shared→TeaserSent→Meeting, status Interested) + its portal-interest activity; no other rows mutated (guard attempt reverted).

---

## 2026-07-08 — new/changed surfaces (gap-closure + simplification SDD run)

✅ verified live this pass · 🧪 covered by unit/smoke tests + `next build` (not re-driven live) · ➖ known limitation

### New routes / features
| Surface | Result |
|---------|--------|
| `/home` "Today" page (4 lens-scoped sections, all-clear card, welcome checklist) | ✅ Sections render; empty sections omitted; "Going quiet" listed a real stale deal; checklist present + dismissible |
| Sidebar "Today" first (Sun icon) + team login/root redirect `/dashboard`→`/home` | ✅ Today active-first; redirect via single `viewpointHome()` change |
| Nav: "Investor Outreach" dropdown → single **"Engagements"** item (user-requested revert) | ✅ Single item → `/engagement` (→ By Deal); "Investor Outreach" **transaction stage** label preserved |
| Help panel (topbar "?" drawer: 17-step journey + glossary + access-matrix link) | ✅ Opens; `?help=journey` deep-link works on both hard-load and client-nav |
| Deal Journey spine (mandate / client / transaction detail) | ✅ Mandate detail verified (17 steps, 4 states, evidence-based out-of-order); client/txn placements 🧪 |
| Deals queue Priority column + filter (Task 8), Source filter (Task 12) | ✅ Filters present in the deals filter bar |
| Notification bell + emissions (Task 14) | ➖ Bell present; empty for default demo-Admin lens (userId undefined) — real targeting needs `feat/real-auth` |

### Covered by tests + build (not re-driven live this pass)
| Flow | Coverage |
|------|----------|
| `/intake` full submit (Qualified/Deprioritized) → neutral confirmation → dashboard callout → review-panel Accept-requires-lead / Deprioritize | 🧪 `/intake` renders live; submit→review path via `intake-steps.test`, `intake-review.smoke`, verdict-confidentiality tests |
| Match popover (exclusions, warning chips, contact line), ranking freshness/staleness | 🧪 `ranking.test`, `ai-match-investors.test` |
| Portal EBITDA / net-profit range filters | 🧪 `filters.test` (incl. null-exclusion) |
| Client compliance/ops fields round-trip; deal fields (retainer/priority/fee-status) | 🧪 `new-fields.test`, `use-entity-form.test`; live-verified in the 2026-07-07 pass |
| Restage → in-app notification (stage-change emission, actor-skip, exact title) | 🧪 `notifications.smoke` (mandate restage emits to lead, self-skip) |
