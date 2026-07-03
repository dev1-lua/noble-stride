# 04 — NobleStride Agents, Skills & Tools

The concrete agent set NobleStride should ship, mapped onto the CRM's existing
AI surface (`src/server/services/ai.ts` + the four AI components) and data model
(`prisma/schema.prisma`). Each entry gives purpose, inputs/outputs, and data
dependencies. A recommended build order is at the end.

Data objects in play: **Investor, Client, Mandate, Transaction, Engagement,
Partner, Activity, User** (see `prisma/schema.prisma`). The deal flow is
**Client → Mandate → Transaction → Engagement → Investor**.

---

## Agent 1 — Overview Agent

**Purpose.** The pipeline analyst behind the dashboard card
(`overview-agent-card.tsx`) and the global `ask-bar.tsx`. Summarizes pipeline
health, flags what needs attention, and answers free-text questions.

**Skill: `crm-insights`**

| Tool | Purpose | Input | Output | Data dependency |
|---|---|---|---|---|
| `get_pipeline_overview` | Headline stats + counts by stage | `{ focus?: 'mandates'\|'transactions'\|'all' }` | `{ stats, mandatesByStage[], transactionsByStage[] }` | `dashboardStats`, `pipelineOverview` resolvers (Mandate, Transaction, Activity) |
| `get_overview_insights` | The 3 insight cards (convert / attention / match) | `{}` | `Insight[] = { kind, title, detail }` | `aiOverviewInsights` resolver (Mandate stage, stale Transactions, top investor match) |
| `answer_crm_question` | Natural-language Q&A over the CRM | `{ question: string }` | `{ answer: string, sources: string[] }` | `aiAsk` resolver (pipeline + stats; optionally `Data.search` over a knowledge layer) |

**Seams replaced:** `aiOverviewInsights()`, `aiAsk()`.
**Persona:** concise analyst; always cite `sources` (the `ask-bar` UI renders
them).

---

## Agent 2 — Deal Agent (matching)

**Purpose.** Connects deals to capital. One agent can host both matching tools;
they share the deal-flow data.

**Skill: `deal-matching`**

| Tool | Purpose | Input | Output | Data dependency |
|---|---|---|---|---|
| `match_investors_to_transaction` | Rank investors for a deal | `{ transactionId: string, limit?: int }` | `{ matches: [{ investorId, name, scorePct, reasons[] }] }` | `aiMatchInvestors` → `ranking.ts` (Investor, Transaction, Client.countries) |
| `find_prospects_for_mandate` | Surface candidate clients for a mandate | `{ mandateId: string }` | `{ prospects: [{ name, sector, rationale }] }` | `aiFindProspects` (Mandate.sector, Client) |

**Seams replaced:** `aiMatchInvestors()`, `aiFindProspects()`.
**UI:** `match-investors-button.tsx`, `find-prospects-button.tsx`.
**Build detail:** full spec for `match_investors_to_transaction` in
`03-creating-tools.md`.

---

## Agent 3 — Engagement Logger (the write agent)

**Purpose.** The only agent that *mutates* the CRM. Logs interactions to the
`Activity` timeline and advances `Engagement.status` — backing
`log-engagement-dialog.tsx`. This is the first capability **not** already in
`ai.ts`, so it's net-new and the most valuable to add.

**Skill: `engagement`** (needs a CRM **mutation** endpoint — today `queries.ts`
is read-only, so this requires adding mutations or a write tool seam.)

| Tool | Purpose | Input | Output | Data dependency |
|---|---|---|---|---|
| `log_engagement` | Record an interaction on a deal/investor | `{ engagementId?: string, transactionId?: string, investorId?: string, type: InteractionType, subject?: string, body?: string, occurredAt?: string }` | `{ activityId, status: 'logged' }` | `Activity` model; sets `createdSource = AGENT` (provenance!) |
| `advance_engagement` | Move an engagement to a new status | `{ engagementId: string, status: EngagementStatus }` | `{ engagementId, status }` | `Engagement.status` |

**Critical: provenance.** `Activity` and `Engagement` have a `createdSource`
(`ActorSource` enum: `HUMAN | AGENT | API | IMPORT | SYSTEM`). Agent-written
records **must** set `createdSource = AGENT` so the UI can distinguish AI activity
from human activity. (The read-only `ai.ts` functions never set provenance — by
design; the write path must.)

`InteractionType` values to use: `Outreach, NDASent, NDASigned, DataRoomAccess,
Meeting, Call, Email, Feedback, TermSheet, Note, Other`.
`EngagementStatus` values: `NotContacted, Contacted, InConversation, Interested,
Passed, Committed`.

---

## Agent 4 (optional, later) — Proactive Digest

**Purpose.** No UI today; runs on a schedule. A `LuaJob` (cron `0 9 * * *`) that
reuses `get_overview_insights` and messages the deal owner with stale-deal and
ready-to-convert alerts. Maps onto the "attention" insight already computed in
`aiOverviewInsights()` (active transactions with no `Activity` in 14 days).

**Primitive:** `LuaJob` (see `01-lua-primitives.md` §5), `metadata.userId` =
owner, `User.get(...)` to message.

---

## Cross-cutting: one agent or several?

Lua agents compose skills, so you have a choice:

- **Simplest:** one **`noblestride-assistant`** agent holding all three skills
  (`crm-insights`, `deal-matching`, `engagement`). The model routes by tool
  `description` + skill `context`. Recommended for the demo and most production
  cases (the docs advise multiple skills, not multiple agents, until tools exceed
  ~20 or teams diverge).
- **Split** only if you want distinct personas/governance (e.g. a read-only
  analyst vs. a write-capable operator) — then the read agent can delegate to the
  write agent via `Agents.invoke(...)` (see `01-lua-primitives.md` / `03`).

Recommendation: **one agent, three skills** to start.

---

## Recommended build order

1. **`crm-insights` / `get_pipeline_overview`** — pure read over existing
   `dashboardStats` + `pipelineOverview` resolvers. Smallest, no new CRM code;
   proves the GraphQL-from-tool pattern end-to-end. (`02-creating-skills.md`)
2. **`deal-matching` / `match_investors_to_transaction`** — read over the
   existing `aiMatchInvestors` resolver; high-visibility (the Match Investors
   button). (`03-creating-tools.md`)
3. **`deal-matching` / `find_prospects_for_mandate`** — same pattern, second
   resolver.
4. **`crm-insights` / `answer_crm_question` + `get_overview_insights`** — wires
   up the Ask bar and the Overview card; add `Data.search` later for richer Q&A.
5. **`engagement` / `log_engagement` + `advance_engagement`** — the write agent.
   **Blocked on** adding CRM **mutations** (today `queries.ts` is read-only) and
   on enforcing `createdSource = AGENT`. Highest value, most new surface — do it
   once reads are solid.
6. **Proactive Digest job** — optional, after the read/write tools exist.

Each step: write tool → register in skill → `lua compile` → `lua test` /
`lua chat` → set `env` → `lua sync --check` → `lua push` → `lua deploy`.

---

## Quick reference: seam → tool → resolver → data

| `ai.ts` seam | Lua tool | GraphQL resolver | Prisma models |
|---|---|---|---|
| `aiOverviewInsights()` | `get_overview_insights` | `aiOverviewInsights` | Mandate, Transaction, Activity, Investor |
| `aiMatchInvestors(txnId)` | `match_investors_to_transaction` | `aiMatchInvestors` | Investor, Transaction, Client |
| `aiFindProspects(mandateId)` | `find_prospects_for_mandate` | `aiFindProspects` | Mandate, Client |
| `aiAsk(question)` | `answer_crm_question` | `aiAsk` | dashboard + pipeline (+ Data.search) |
| *(none yet)* | `log_engagement`, `advance_engagement` | *(needs new mutations)* | Activity, Engagement |
