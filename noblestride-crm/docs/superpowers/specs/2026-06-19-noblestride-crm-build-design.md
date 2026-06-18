# NobleStride CRM — Build Design (Demo-Ready Foundation)

> Date: 2026-06-19 · Status: **Approved (design)** · Owner: dev
> Companion spec (data model authority): `../../../../data/NOBLESTRIDE-CRM-SPEC.md`
> Timeline: `../../../../data/NOBLESTRIDE-TIMELINE.md` · Wireframe: `../../../../context-screens/` · Twenty/Lua analysis: `../../../../analysis/`

## 1. Context & goal

NobleStride Capital is a Sub-Saharan Africa capital-advisory / fundraising firm. We are building its **bespoke, AI-native CRM from scratch** (Twenty CRM is reference-only; it could not host the branded UI, the portal, or rich custom components). This document specifies the **first build milestone: a demo-ready foundation** — a complete-looking, navigable CRM on realistic seed data that matches the wireframe's capability surface, with AI surfaces present (canned) and the seams for live AI / portal / full CRUD left in place.

## 2. Scope

**In scope (definition of done):**
- Branded dark-green app shell (sidebar MAIN + AGENTS sections, topbar with "Ask your agents anything" + search).
- All six sections rendering **seeded** data: Dashboard, Mandates (Kanban), Transactions (Kanban), Investors (table + filters), Engagement (tracker), Partners (referrals).
- **Record detail pages** for Investor, Client, Mandate, Transaction, Engagement, Partner (overview + related records + activity timeline).
- **Two writes:** drag-to-restage on both Kanban boards; log an engagement/interaction.
- **AI surfaces present + canned:** Overview Agent insight card, "Ask anything" reply, "Match Investors" ranked list, "Find Prospects" — all populated by a local `services/ai` module computing from seed data, exposed via GraphQL so swapping in live Lua later is a drop-in.
- One real **GraphQL API** at `/api/graphql` (for Lua + client writes), wrapping a shared service layer.

**Out of scope (explicitly deferred; seams left in):**
- Live Lua agents, Data API semantic search, sync webhooks.
- Investor self-service portal + OTP.
- Full create/edit/delete CRUD forms.
- Auth, roles & permissions (single implicit admin user for the demo).
- Real-time subscriptions, file uploads, email sending.

## 3. Architecture (Approach B — shared service layer)

```
            ┌─────────────────────────── Next.js (App Router, TS) ───────────────────────────┐
 Lua agents │  Server Components ──┐                         Client Components (urql) ──┐      │
  (HTTP) ───┼─> /api/graphql ─┐    │ (in-process calls)                                 │      │
            │   (Pothos+Yoga) │    ▼                                                     ▼      │
            │        └────────┴─> src/server/services/*  ◄──────────── GraphQL resolvers + RSC │
            │                        (single source of truth: Prisma + business logic)         │
            └────────────────────────────────┬──────────────────────────────────────────────-┘
                                              ▼
                                     PostgreSQL (Prisma)
```

- **Service layer** (`src/server/services/`): plain, typed, independently-testable functions over Prisma. ALL business logic (filters, computed metrics, AI ranking) lives here. No logic in resolvers or components.
- **GraphQL** (`src/graphql/`): Pothos code-first schema; resolvers are thin wrappers over services. This is the external API (Lua) and the client write/AI path.
- **Server Components**: call services directly for fast SSR reads (no self-HTTP).
- **Client Components**: urql → `/api/graphql` for the few writes (restage, log engagement) and canned-AI queries.
- Rationale: one real GraphQL API for AI consumers, no duplicated read logic, no codegen dependency for the demo, and testable units for the Sonnet-writes/Opus-reviews loop.

## 4. Module structure

```
src/
  app/
    (crm)/layout.tsx                     shell (Sidebar + Topbar)
    (crm)/dashboard/page.tsx
    (crm)/mandates/page.tsx              + mandates/[id]/page.tsx
    (crm)/transactions/page.tsx          + transactions/[id]/page.tsx
    (crm)/investors/page.tsx             + investors/[id]/page.tsx
    (crm)/clients/[id]/page.tsx
    (crm)/engagement/page.tsx            + engagement/[id]/page.tsx
    (crm)/partners/page.tsx              + partners/[id]/page.tsx
    api/graphql/route.ts                 Yoga handler (runtime: nodejs)
    providers.tsx                        urql provider (client)
  components/
    ui/        Tag, Chip, Avatar, Button, Card, StatCard, Table, Badge, Input, Select, Dropdown
    shell/     Sidebar, Topbar, AskBar, AgentNav
    crm/       KanbanBoard, KanbanCard, RecordTable, FilterBar, ActivityTimeline,
               OverviewAgentCard, MatchInvestorsButton, StatRow, PipelineChart
  server/
    services/  investors.ts clients.ts mandates.ts transactions.ts engagements.ts
               partners.ts dashboard.ts activities.ts ai.ts
    context.ts (internal service context / actor)
  graphql/     builder.ts context.ts types.ts queries.ts mutations.ts schema.ts
  lib/         db.ts vocab.ts money.ts format.ts cn.ts
  generated/   pothos-types.ts
prisma/        schema.prisma  seed.ts  migrations/
```

## 5. Data model

Authoritative source: `prisma/schema.prisma` (already migrated) — itself a port of `NOBLESTRIDE-CRM-SPEC.md §3/§4`. Objects: **Investor, Client, Mandate, Transaction, Engagement, Partner** + **Person** (contacts), **User** (team), **Activity** (interaction log powering the Engagement timeline + counters), **Task**. 18 enum vocabularies (§4). `ActorSource` provenance enum on Engagement/Activity (AI-native pattern). No schema changes expected in this milestone; if a page needs a field that's missing, add via a Prisma migration and note it in the plan.

## 6. GraphQL / service surface

Resolvers wrap identically-named service functions. Money exposed as `Float` (USD), dates as `DateTime` scalar.

**Queries**
- `investors(filter, search, take, skip)`, `investorsCount(filter)`, `investorSegments` (the 6 counters), `investor(id)`
- `clients`, `client(id)`
- `mandates(filter)`, `mandatesByStage` (Kanban groups), `mandate(id)`
- `transactions(filter)`, `transactionsByStage`, `transaction(id)`
- `engagements(filter)`, `engagementsByDeal` (grouped for the tracker), `engagement(id)`
- `partners(filter)`, `partner(id)`, `partnerReferralStats`
- `dashboardStats`, `pipelineOverview`, `dealPipelineTrend`
- AI (canned, real seam): `aiOverviewInsights`, `aiMatchInvestors(transactionId)`, `aiFindProspects(mandateId)`, `aiAsk(question)`

**Mutations**
- `updateMandateStage(id, stage)` · `updateTransactionStage(id, stage)` — set `stageEnteredAt = now()`; set `closedAt` when Transaction → ClosedWon/ClosedLost.
- `createEngagement(transactionId, investorId, status?)` · `logActivity(input)` — `createdSource` defaults HUMAN.

**Computed metrics (defined once, in services):**
- Transaction *investors contacted* = `engagements.count`; *active conversations* = engagements with status ∈ {InConversation, Interested}; *days in stage* = `now − stageEnteredAt`.
- *Avg time to close* = mean(`closedAt − dateOpened`) over Transactions in ClosedWon.
- Dashboard *Active Mandates* = mandates not in {Signed, Lost}; *Active Transactions* = transactions not in {ClosedWon, ClosedLost}; *Investors Engaged (qtr)* = distinct investors with an engagement/activity this quarter; *Capital Raised YTD* = Σ `targetRaise` of ClosedWon transactions closed this year.
- Investor segments = counts by type (PE, VC, DFI, Debt Provider) + total + active-this-quarter (status = ActivelyDeploying OR the investor has any Activity dated within the current calendar quarter).
- Partner referrals: *referred* = `referredMandates.count`; *active* = referred mandates with a non-closed transaction; *closed* = referred transactions ClosedWon; *revenue* = Σ their `targetRaise`.

## 7. Design system (dark-green brand)

Tailwind v4 `@theme` tokens + hand-built primitives (no shadcn CLI, for version stability).
- **Sidebar** surface: deep green-black `#0B1A14` (near-black with green cast); section labels muted, active item = accent tint + left accent bar.
- **Accent**: emerald `#10B981` / `#059669` (logo mark, active nav, primary buttons, positive deltas).
- **Content**: white / `zinc-50` canvas, `zinc-200` borders, `zinc-900` text.
- **Semantic**: success emerald, danger rose, warning amber, info sky.
- **Chips**: SELECT/MULTI_SELECT → colored pills; category colors deterministic (see `lib/vocab.ts`), stage/status colors semantic.
- **Type**: Inter; **grid**: 4px; **radius**: `rounded-md` (6px) default, `rounded-lg` cards.
- Fidelity: approximate the wireframe; capability-complete is the bar, pixel-match is not.

## 8. AI surfaces (canned, real seam)

`src/server/services/ai.ts` computes plausible content from seed data:
- `aiMatchInvestors(transactionId)` → rank investors by overlap of sector ∩ geography ∩ ticket-range with the transaction; return top N with a score + one-line rationale.
- `aiOverviewInsights()` → derive 3 insights from pipeline state ("N mandates ready to convert", "X needs attention — no engagement in 14d", "new investor match").
- `aiFindProspects(mandateId)` / `aiAsk(question)` → canned but data-aware.
The UI calls these via GraphQL. **The seam is identical to the live design**: later, these service functions are reimplemented to call Lua (Data API semantic search + LuaTool over this same GraphQL API) with no UI/schema change. See `NOBLESTRIDE-CRM-SPEC.md §8`.

## 9. Seed data

`prisma/seed.ts` — realistic SSA dataset, idempotent (clears + reseeds): ~13 team users (the real team names), ~40 investors (mixed PE/VC/DFI/Debt, varied sector/geo/ticket), ~15 clients, ~20 mandates across all stages, ~12 transactions across all stages (some ClosedWon with closedAt), ~60 engagements, ~10 partners with referred mandates, ~120 activities across interaction types. Enough to populate every counter, board column, chart, and timeline.

## 10. Testing & verification (Sonnet/Opus loop)

- **Vitest unit tests** on the logic-bearing units: `services/*` (filters + computed metrics), `lib/vocab` `lib/money` `lib/format`, and `services/ai` ranking. This is where bugs hide; TDD here.
- **GraphQL smoke test**: schema builds; a representative query/mutation executes against a test DB (or seeded dev DB).
- **Visual verification**: Playwright (MCP available) screenshots of each page, compared against `context-screens/` during review.
- **Per-task review gate**: Sonnet writes code + tests → Opus reviews vs this spec + runs `/code-review` on the diff + visual check → fix loop → only then task marked done.

## 11. Build phasing (units for subagent-driven development)

Each is an independent, reviewable unit (the implementation plan will sequence + detail them):
1. **Foundation libs**: `lib/` (vocab done, add money/format/cn), service `context`, urql provider, `runtime` config. + tests.
2. **GraphQL API**: builder (done), types, queries, mutations, schema, route — wrapping services. + smoke test.
3. **Service layer**: all `services/*` incl. computed metrics + AI canned. + unit tests.
4. **Design system**: `components/ui/*` primitives + tokens.
5. **App shell**: `(crm)/layout`, Sidebar, Topbar/AskBar.
6. **Investors** section (table + filters + segments) + detail page.
7. **Mandates** + **Transactions** Kanban (drag-restage write) + detail pages.
8. **Engagement** tracker (timeline + log-engagement write) + **Partners** (referrals) + detail pages.
9. **Dashboard** (stats + charts + Overview Agent + AskBar canned).
10. **Seed data** + end-to-end visual verification pass.
11. **README + run docs**.

## 12. References
- Data model & vocab: `../../../../data/NOBLESTRIDE-CRM-SPEC.md`
- Timeline/phasing: `../../../../data/NOBLESTRIDE-TIMELINE.md`
- Twenty source analysis: `../../../../analysis/{twenty-server-backend,twenty-frontend,twenty-appsdk-and-ai}.md`
- Wireframe: `../../../../context-screens/{home,mandates,transactions,investors,engagement,partners,settings}.png`
- Lua: Data API (`Data.search/create/get`), LuaTool (Zod + fetch), LuaWebhook — `https://docs.heylua.ai/llms.txt`
