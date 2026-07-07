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
