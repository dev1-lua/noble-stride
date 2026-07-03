# NobleStride CRM — Build Status (2026-07-03)

One-page record of what was built in the 2026-07-03 session, on top of the Plan-1 data layer
(2026-06-26). App: `noblestride-crm/` (Next.js 16 + Prisma 6 + Postgres + Pothos GraphQL).
**State: all committed on local `main`, NOT pushed to origin. 270/270 tests green.**

---

## What is DONE

### 1. Visibility engine — spec §11 (commit `fe1333a`)
`src/server/visibility/` — the single gating authority for everything external roles see.
- Tier resolution: investor classification + engagement stage → `NONE / PRE_INTEREST / AFTER_NDA / DD`
- §5.2 field matrix encoded as data; financials shown as coarse bands pre-NDA
- Hard rules tested at every tier: other investors' identities, partner identities, internal
  notes, and engagement contracts are **never** in any projected output
- 193 pure table-driven tests (no DB)

### 2. Internal pipeline UI — M4 (commits `ff32577`, `9196d78`)
- `/engagement` reworked around the real **12-stage** pipeline (Shared → … → Invested/Declined)
  with restage controls + **disbursement table** (total/disbursed/pending)
- `/documents` register + create drawer: type, version, access level
  (Internal/Client-shared/Investor-shared/VDR), status, **review chain**
  (reviewer → MD approver → client review dates)
- `/tasks` page (view-only table)
- Form drawers extended: investor classification + NDA status; partner fee-sharing/advisor
  type/internal-only; transaction success-fee fields
- Workflow-doc gap fields added: `BusinessPlan` doc type, document reviewer/approver, success fee

### 3. Portals + viewpoint switcher + access matrix — Plan 3 (commits `3ec2817`, `80fc30e`)
- Topbar **view-as switcher** (Admin / Investor / Partner + record picker); cookie-based demo
  lens via `/api/viewpoint`; external viewpoints are redirected out of the internal shell
- Portal banner names the impersonated record, shows classification (a Greylisted fund's empty
  portal is self-explaining), and has an **inline picker** to hop between records
- `/access-matrix`: display-only in-org CRUD grid (Admin / Deal Lead / Team Member)

### 4. Investor portal as a CRM (commit `832938c`)
Grounded in **"Data collected from potential investors_ CRM.docx"** + **"Sectors and Milestones_ CRM.docx"**:
- **Fund Profile tab** — editable per-fund form with the doc's 7 sections verbatim (strategy &
  preferences dropdowns, ticket min/max, target IRR, geographic focus + country restrictions,
  track record & portfolio, fund lifecycle & capital, decision process, engagement logistics
  with Gmail/Yahoo warning, ethical & impact). Saves via server action keyed to the server-side
  viewpoint cookie (client can never act as another fund). NobleStride admins can edit the same
  fields internally.
- **My Pipeline tab** — own engagements with **15-step milestone steppers** (the fixed investor
  cycle: teaser review → NDA → EOI → data room → prelim DD → IC paper → 1st IC → non-binding TS
  → executed TS → onsite DD → 2nd IC → binding offer → loan/SPA → CAK/COMESA → success fee)
- **Deal page** — "Your progress" checklist + **Express Interest / Request Info** write-back
  (upserts own engagement, logs an Activity the internal team sees)
- Visibility extension `projectOwnEngagement`: an investor sees only their OWN
  stage/milestones/lastContact/termSheet — never feedback, probability, amounts, notes (+32 tests)

### 5. Partner portal as a CRM (commit `87cbad9`)
- **Submit Referral tab** — creates a real Mandate (NewLead, source Referral, `referredById`
  from cookie) with client match-or-create + Activity log; shows up in their overview instantly
- **Overview** — referral funnel (Introduced → In Progress → Signed / Lost) + expected-fee card
- **My Details tab** — partner edits own email/phone/organization
- Internal: **Deal Preparation checklist** on transaction detail (teaser / financial model / IM /
  valuation / business plan, derived from the document register)

### 6. Real data from the client's trackers (commits `c35cf8c`, `112da15`, `80fc30e`, `04f6dd0`)
- `npm run import:real` — parses `data/decrypted/Engagement contract Tracker _ CRM.xlsx` and
  `Tasks Tracker Whatsapp 2026_ CRM.xlsx` (gitignored) → **106 mandates** with real NDA/EA dates
  + leads, **387 real tasks**, **104 clients**, NDA/EA document records from signed dates
- `scripts/plant-portal-data.ts` — every Active investor has 2–4 staged engagements; 6 extra
  transactions promoted from real signed mandates (13 active deals); all partners have referrals
  + fee-sharing terms; teaser/IM/VDR docs per active deal
- `scripts/seed-milestones.ts` — 558 `EngagementMilestone` rows backfilled from stages
- Data fix: investor "changed emails to…" (spreadsheet note) → **Lightrock**

### Data model additions this session
`MilestoneKey` enum (15) + `EngagementMilestone` model · 8 investor fund-profile fields
(notableInvestments, portfolioComposition, caseStudies, reinvestmentPolicy, teamComposition,
collaborationTerms, impactMetrics, reputationalRisks) · Document reviewer/approver + dates ·
Transaction success-fee fields · `DocumentType.BusinessPlan` · shared lib `src/lib/milestones.ts`

---

## Demo script (5 minutes)
1. `/dashboard` → KPIs; `/mandates` → real client pipeline (A G Energies, Danjade, Farmacie…)
2. `/engagement` → 12-stage board + disbursements; `/documents` → register with access levels
3. Topbar eye icon → **Investor → Lightrock**: Opportunities (tier badges) → My Pipeline
   (milestone steppers) → Fund Profile (edit + save) → a deal → Express Interest
4. Switch to a **Greylisted** fund (banner explains the empty portal — confidentiality working)
5. **Partner → DLA Piper**: funnel + expected fee → Submit Referral → back to Admin `/mandates`,
   the referral is in New Lead
6. `/access-matrix` → in-org who-sees-what

## How to run
- `docker compose up -d` (Postgres on **5544**) → `npm run dev` → http://localhost:3000
- Tests: `npm run test` (270) · Reseed: `npm run seed` then `npm run import:real`,
  `npx tsx scripts/plant-portal-data.ts`, `npx tsx scripts/seed-milestones.ts`

## Known gotchas
- After `prisma migrate/generate`, the dev server holds a **stale Prisma client** — kill port
  3000, `rm -rf .next/dev`, restart
- Zod schemas in `src/lib/schemas/*.ts` **strip undeclared keys** — new model fields must be
  added there or they silently don't persist
- `tsx` scripts can't use the `@/` alias — relative imports in `scripts/`
- vitest: `fileParallelism: false`; DB smoke tests must create their own rows

## What REMAINS (not built)
- **The 4 Lua agents** (Client, Investor, Investor Tracker, Referral) — `src/server/services/ai.ts`
  functions are heuristic stubs with `SEAM` comments; agent guides in `noblestride-crm/docs/agents/`
- WhatsApp + Email (Outlook) capture; website intake/qualification agent (SOW components 6–8)
- Real authentication + enforced RBAC + audit trail (switcher is a demo lens; matrix display-only)
- File upload/storage (Document = metadata + URL)
- Guided flows on top of existing fields: document review chain UI, DD workstream checklist
  (fin/tax/commercial/ESG/legal as separate tracks), IC-approval + CAK/COMESA fields on deals
- Sub-sector taxonomy (4 levels, "Sectors and Milestones" doc) — deliberately deferred (spec §11)
- Client/company gaps: project codename field, EBITDA/debt/assets, women-led/youth-led impact flags
- Tasks are view-only (no create/edit UI); success-fee invoice generation
- `noblestride-crm/docs/GAP-ANALYSIS-vs-SOW.md` is **stale** (2026-06-26, pre–this-session)
- **Push to origin** (triggers Vercel deploy) — everything is local-only
