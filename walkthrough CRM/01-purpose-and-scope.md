# §1. Purpose and how to use this document

**Spec (Build Specification §1):** Section 1 frames the whole document: it is both the agreed Statement of Work and the engineer-facing configuration specification for the NobleStride CRM and agents. The objectives (§1.1) are to centralise all operating data, speed up investor matching, capture channel signal from WhatsApp/email, qualify inbound leads behind a human gate, give investors controlled visibility, and make the pipeline visible through dashboards. The scope table (§1.2) lists nine components: the CRM itself, four Lua agents (Client, Investor, Investor Tracker, Referral/Partner), WhatsApp integration, a website intake and qualification agent, investor deal visibility, and reporting dashboards.

## Build status

Partially built, with the CRM core essentially complete. Of the nine §1.2 components:

- **Built:** #1 CRM & Deal Management (all core entities with CRUD, audit trail, picklists), #8 Investor Deal Visibility (the best-covered deliverable, with a full field-level gating engine), and #9 Reporting & Dashboards (all non-advisory views).
- **Partially built:** #4 Investor Tracker and #5 Referral/Partner Tracking exist as *manual* equivalents — the data, stages, guards and referral form are in place, but no agent drives them.
- **Not built — tracked in memory/remaining-tasks.md:** #2 Client Agent, #3 Investor Agent (as agents), #6 WhatsApp Integration, #7 Website Intake & Qualification (the `/register` flow serves investors, not target companies).

Real authentication and enforced in-org role-based access are also still pending; the demo uses a viewpoint-lens cookie instead.

## See it in the app

### Flow 1 — Public entry and sign-in
1. Open `http://localhost:3000` — the public landing page.
2. Go to `/login`. Enter `jane@noblestride.co` with any password (demo authentication; the email decides the lens). Any `@noblestride.*` email lands on the admin CRM.
3. You arrive at `/dashboard` — the admin lens.

### Flow 2 — The centralised operating data (objective 1)
1. From `/dashboard`, use the sidebar: Clients, Mandates, Transactions, Investors, Engagement, Partners, Service Providers, Documents, Tasks. Every §1.1 record type has its own managed list.
2. Open any client at `/clients/[id]` — communications, documents and tasks all anchor back to the company, per the spec's "central anchor" rule.

### Flow 3 — Investor matching (objective 2)
1. Open a mandate from `/mandates` and use the "Match investors" action on its detail page — matching runs on sector, geography, ticket size and instrument from the investor database.

### Flow 4 — Controlled investor visibility (objective 5)
1. On any admin page, use the topbar "Viewing as" switcher and pick an investor.
2. You are redirected to `/portal/investor` — the investor sees only mandates that fit their profile, with confidentiality gates (see file 07).

### Flow 5 — Pipeline dashboards (objective 6)
1. Return to the admin lens and open `/dashboard` — pipeline breakdowns by lead, sector, type and ticket band, disbursement summaries, team workload and overdue actions.

## Key source files

- `prisma/schema.prisma` — the full data model behind objective 1.
- `src/app/(crm)/dashboard/page.tsx` and `src/server/services/dashboard.ts` — the dashboards.
- `src/server/visibility/` — the investor-visibility engine (objective 5).
- `src/server/services/ai.ts` — read-only heuristic stubs marking where the four Lua agents will plug in (`// SEAM: replace with Lua`).
- `src/app/portal/` — investor and partner portals.
- `src/server/viewpoint.ts` and `src/lib/viewpoint.ts` — the demo lens mechanism standing in for real authentication.
