# NobleStride Capital CRM

A demo-ready, bespoke CRM for **NobleStride Capital** — a Sub-Saharan Africa capital-advisory and fundraising firm. Built from scratch as a Next.js 16 + React 19 + TypeScript + Prisma 6 + Pothos/GraphQL Yoga + urql + Tailwind v4 application on realistic seed data. The app covers all six sections (Dashboard, Mandates Kanban, Transactions Kanban, Investors, Engagement, Partners) plus record detail pages, two persisted writes (drag-to-restage on both Kanban boards; log an engagement), and canned-but-data-aware AI surfaces (Overview Agent insights, Match Investors, Find Prospects, the Ask bar) — all wired to a real GraphQL API at `/api/graphql` so swapping in live Lua agents is a drop-in.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI | React 19, TypeScript 5 |
| Styling | Tailwind v4 — `@theme` tokens, hand-built shadcn-style primitives, dark-green brand |
| Database | PostgreSQL 16 (Docker, host port **5544**) |
| ORM | **Prisma 6** — pinned at `^6.19.3`. **Do NOT upgrade to v7** — v7's query-compiler breaks the Pothos plugin-prisma integration. |
| API | Pothos v4 + GraphQL Yoga at `/api/graphql` (GraphiQL available in dev) |
| Client fetches | urql (writes + canned-AI queries only; all reads are React Server Components) |
| Drag-and-drop | @hello-pangea/dnd (Kanban boards) |
| Testing | Vitest |
| Package manager | pnpm |
| Node | 24 |

---

## Prerequisites

- **Node 24** (`node -v` should print `v24.x.x`)
- **pnpm** (`npm install -g pnpm` if missing)
- **Docker** (used to run the Postgres 16 container)

---

## Run Steps

### 1. Install dependencies

```bash
pnpm install
```

### 2. Start Postgres

```bash
pnpm db:up
```

Starts the `noblestride-postgres` Docker container (Postgres 16, host port **5544**) via `docker compose up -d --wait`. The compose healthcheck ensures the DB is accepting connections before the command returns.

### 3. Copy env file

```bash
cp .env.example .env
```

The `.env` already points `DATABASE_URL` at the Docker Postgres (`postgresql://noblestride:noblestride@localhost:5544/noblestride`) and sets `API_JWT_SECRET`. Edit if your setup differs.

### 4. Apply migrations

```bash
pnpm migrate
```

Runs `prisma migrate dev` — applies all schema migrations to the local DB.

### 5. Seed realistic demo data

```bash
pnpm exec prisma db seed
```

Populates the DB with a realistic SSA dataset (idempotent — clears and re-seeds):
- 14 team users (the real NobleStride team names)
- 40 investors (mixed PE / VC / DFI / Debt, varied sector, geography, ticket size)
- 20 clients
- 15 partners
- 20 mandates across all Kanban stages
- 12 transactions across all Kanban stages (some Closed-Won with `closedAt`)
- 60 engagements
- 130 activities (interaction log)

> **Important gotcha — use `pnpm exec prisma db seed`, NOT `pnpm seed`.**
>
> `pnpm seed` invokes `tsx prisma/seed.ts` directly and does **not** load `.env`, so `DATABASE_URL` is `undefined` and the seed process crashes immediately. The correct command `pnpm exec prisma db seed` uses the `prisma.seed` entry in `package.json` (`"seed": "tsx prisma/seed.ts"`), which Prisma CLI wraps — loading `.env` first, then running the same script. Always use the `prisma db seed` path.

### 6. Start the dev server

```bash
pnpm dev
```

Opens at **http://localhost:3000**. Navigate to `/dashboard` to begin.

---

## Other Commands

| Command | What it does |
|---|---|
| `pnpm test` | Vitest unit tests (expect 40/40 green) |
| `pnpm build` | Production Next.js build (typechecks + compiles all routes) |
| `pnpm lint` | ESLint (0 errors; one pre-existing `no-unused-vars` warning in `prisma/seed.ts` is expected) |
| `pnpm exec tsc --noEmit` | Standalone TypeScript check |
| `pnpm db:reset` | `prisma migrate reset --force` — drops + re-migrates (re-seed afterwards) |
| `pnpm generate` | `prisma generate` — regenerates the Prisma client after schema changes |
| `pnpm db:down` | Stops the Postgres Docker container |

---

## Architecture — Approach B (Shared Service Layer)

Business logic is computed exactly once — in the service layer — and consumed by both GraphQL resolvers and React Server Components. No logic lives in resolvers or components; they are thin wrappers that render or forward.

```
            ┌─────────────────────── Next.js 16 (App Router, TypeScript) ──────────────────────┐
 Lua agents │  React Server Components ──┐                    Client Components (urql) ──┐      │
  (HTTP) ───┼─> /api/graphql ──┐         │ (in-process calls)                            │      │
            │  (Pothos + Yoga) │         ▼                                                ▼      │
            │         └────────┴──> src/server/services/*  <──── GraphQL resolvers + RSC reads  │
            │                   (single source of truth: Prisma + domain metrics/ranking)        │
            └───────────────────────────────────┬──────────────────────────────────────────────-┘
                                                ▼
                                      PostgreSQL 16 (Prisma 6)
```

Key rules:
- **`src/server/domain/*`** — pure, unit-tested functions (metrics, ranking, filters). No Prisma.
- **`src/server/services/*`** — the single source of truth. Calls Prisma and the domain helpers. ALL computed metrics (dashboard stats, investor segments, partner referrals, AI ranking) live here.
- **GraphQL** (`src/graphql/`) — Pothos code-first schema; resolvers call service functions by the same name. This is the external API (Lua) and the client write/AI path.
- **Server Components** — call services directly (no self-HTTP roundtrip) for fast SSR reads.
- **Client Components** — urql → `/api/graphql` for the two writes (restage, log engagement) and canned-AI queries only.
- **Money** — `GraphQL Float` (USD). **Dates** — `DateTime` scalar (ISO string). **Enum identifiers** — PascalCase (Prisma); humans see labels via `src/lib/vocab.ts`.

---

## GraphQL Endpoint

Available at **`/api/graphql`**. GraphiQL explorer is enabled in dev mode.

### Sample query — dashboard stats

```graphql
query {
  dashboardStats {
    activeMandates  { value delta }
    activeTransactions { value delta }
    investorsEngagedQtr { value delta }
    capitalRaisedYtd { value delta }
  }
}
```

### Sample AI query (Lua-tool seam)

The AI service functions are **canned and data-aware** — they compute from seed data and return the same shape a live Lua tool call would return. Swapping to live Lua requires only reimplementing `src/server/services/ai.ts`; the GraphQL schema and all consumers are unchanged.

```graphql
query {
  aiMatchInvestors(transactionId: "<transaction-id>") {
    id
    name
    score
    reasons
  }
}
```

```graphql
query {
  aiOverviewInsights {
    kind
    title
    detail
  }
}
```

```graphql
query {
  aiAsk(question: "Which mandates are most at risk this quarter?") {
    answer
    sources
  }
}
```

---

## Project Layout

```
noblestride-crm/
├── prisma/
│   ├── schema.prisma          # Authoritative data model (Investor, Client, Mandate,
│   │                          #   Transaction, Engagement, Partner, Person, User, Activity)
│   ├── seed.ts                # Realistic SSA seed data (idempotent)
│   └── migrations/
│
├── src/
│   ├── lib/
│   │   ├── db.ts              # Prisma client singleton
│   │   ├── vocab.ts           # label(group, value) — single source for human-readable enum labels
│   │   ├── money.ts           # formatMoney(amount): "$18.4M", "$680K"
│   │   ├── format.ts          # formatDate, daysAgoLabel, formatCompact
│   │   └── cn.ts              # clsx + tailwind-merge
│   │
│   ├── server/
│   │   ├── domain/            # Pure, unit-tested logic (no Prisma)
│   │   │   ├── types.ts
│   │   │   ├── metrics.ts     # activeMandates, capitalRaisedYtd, investorSegments, …
│   │   │   ├── ranking.ts     # matchInvestors scoring (sector ∩ geo ∩ ticket overlap)
│   │   │   └── filters.ts     # investorFilter, mandateFilter, transactionFilter
│   │   ├── services/          # Prisma queries + domain calls (single source of truth)
│   │   │   ├── investors.ts   # investors(), investorSegments(), investor(id)
│   │   │   ├── clients.ts
│   │   │   ├── mandates.ts    # mandates(), mandatesByStage(), setMandateStage()
│   │   │   ├── transactions.ts# transactions(), transactionsByStage(), setTransactionStage()
│   │   │   ├── engagements.ts # engagements(), logEngagement(), createEngagement()
│   │   │   ├── partners.ts    # partners(), partnerReferralRollup()
│   │   │   ├── dashboard.ts   # dashboardStats(), pipelineOverview(), dealPipelineTrend()
│   │   │   ├── activities.ts  # logActivity(), activitiesByRecord()
│   │   │   └── ai.ts          # SEAM: aiMatchInvestors, aiOverviewInsights, aiFindProspects, aiAsk
│   │   └── __tests__/         # Vitest unit tests (metrics, ranking, smoke tests)
│   │
│   ├── graphql/
│   │   ├── builder.ts         # Pothos SchemaBuilder + plugins
│   │   ├── context.ts         # GraphQL context (actor, db)
│   │   ├── types.ts           # Pothos object types (Investor, Mandate, Transaction, …)
│   │   ├── queries.ts         # All query resolvers (thin wrappers over services)
│   │   ├── mutations.ts       # updateMandateStage, updateTransactionStage, logActivity, …
│   │   └── schema.ts          # Assembled schema export
│   │
│   ├── app/
│   │   ├── api/graphql/route.ts    # GraphQL Yoga handler (runtime: nodejs)
│   │   ├── providers.tsx           # urql client provider (client component)
│   │   └── (crm)/
│   │       ├── layout.tsx          # App shell: Sidebar + Topbar
│   │       ├── dashboard/page.tsx
│   │       ├── mandates/
│   │       │   ├── page.tsx        # Kanban board
│   │       │   └── [id]/page.tsx   # Mandate detail
│   │       ├── transactions/
│   │       │   ├── page.tsx        # Kanban board
│   │       │   └── [id]/page.tsx
│   │       ├── investors/
│   │       │   ├── page.tsx        # Table + segment filters
│   │       │   └── [id]/page.tsx
│   │       ├── clients/[id]/page.tsx
│   │       ├── engagement/
│   │       │   ├── page.tsx        # Engagement tracker
│   │       │   └── [id]/page.tsx
│   │       └── partners/
│   │           ├── page.tsx        # Referral table + stats
│   │           └── [id]/page.tsx
│   │
│   └── components/
│       ├── ui/                # Primitives: Tag, Chip, Avatar, Button, Card, StatCard,
│       │                      #   Table, Badge, Input, Select, Dropdown
│       ├── shell/             # Sidebar, Topbar, AskBar, AgentNav
│       └── crm/               # KanbanBoard, KanbanCard, RecordTable, FilterBar,
│                              #   ActivityTimeline, OverviewAgentCard, MatchInvestorsButton,
│                              #   StatRow, PipelineChart, SegmentRow
```

---

## Navigation

Six sections, in sidebar order:

| Route | Section | View type |
|---|---|---|
| `/dashboard` | Dashboard | Stat cards + charts + Overview Agent |
| `/mandates` | Mandates Pipeline | Kanban (drag-to-restage write) |
| `/transactions` | Active Transactions | Kanban (drag-to-restage write) |
| `/investors` | Investor Database | Table + segment filter bar |
| `/engagement` | Engagement Tracker | Table + log-engagement write |
| `/partners` | Partners | Referral table + stats |

All sections have record detail pages at `/<section>/<id>` with an overview panel, related records, and an activity timeline.

---

## Deferred Roadmap — Not Built (Seams in Place)

The following are explicitly **out of scope** for this demo-ready foundation. Seams (frozen function signatures behind `// SEAM:` comments) are left in place so integration is a drop-in.

| Deferred item | Where the seam lives |
|---|---|
| **Live Lua agents** (Data API semantic search, LuaTool calls, webhooks) | `src/server/services/ai.ts` — all four functions (`aiMatchInvestors`, `aiOverviewInsights`, `aiFindProspects`, `aiAsk`) are canned but data-aware; replace with live Lua calls, same signature |
| **Investor self-service portal** (OTP login, scoped fund-profile editing) | No seam yet — needs a separate auth surface outside the CRM |
| **Full create / edit / delete CRUD forms** | Mutations for the two writes (`updateMandateStage`, `updateTransactionStage`, `logActivity`, `createEngagement`) are live; full CRUD mutations are scaffolded stubs in `src/graphql/mutations.ts` |
| **Auth, roles & permissions** | Single implicit admin actor in `src/graphql/context.ts`; `ActorSource` provenance enum on Engagement/Activity is already in the schema for when roles land |
| **Real-time subscriptions, file uploads, email sending** | Not scaffolded |

---

## References

- Data model & vocabulary authority: [`../data/NOBLESTRIDE-CRM-SPEC.md`](../data/NOBLESTRIDE-CRM-SPEC.md)
- Build design spec: [`docs/superpowers/specs/2026-06-19-noblestride-crm-build-design.md`](docs/superpowers/specs/2026-06-19-noblestride-crm-build-design.md)
- Implementation plan: [`docs/superpowers/plans/2026-06-19-noblestride-crm-demo-foundation.md`](docs/superpowers/plans/2026-06-19-noblestride-crm-demo-foundation.md)
- Wireframes: [`../context-screens/`](../context-screens/)
