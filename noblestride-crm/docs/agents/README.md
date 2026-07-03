# NobleStride Agent System

How NobleStride's AI agents are built on **Lua** (`lua-cli`, docs at
<https://docs.heylua.ai>) and wired to the CRM's data. Read this first, then the
numbered guides for the mechanics.

> Scope: these guides cover the **Lua** layer (agents/skills/tools that run on
> Lua's platform). They do **not** cover Twenty's native on-server agents — Lua
> is the chosen orchestration path for NobleStride. If you ever need the Twenty
> side, see `analysis/twenty-appsdk-and-ai.md`.

## The mental model: Agent → Skill → Tool

Lua has a strict three-tier hierarchy. Get this right and everything else
follows.

```
LuaAgent            one assistant: a persona + a model + the skills it can use
  └── LuaSkill      a named bundle of related tools + a `context` that tells the
        │           model WHEN to use them
        └── LuaTool a single callable function: name + Zod inputSchema + execute()
```

- A **tool** is the only thing that actually *does* work. It declares a Zod
  `inputSchema`, and its `execute()` returns JSON. Tools are where CRM data is
  read/written.
- A **skill** groups tools that belong together and carries the natural-language
  `context` the model reads to decide which tool to call.
- An **agent** picks a persona, a model, and an array of skills (plus optional
  webhooks, jobs, processors, MCP servers). It's what a user talks to.

Other primitives (webhooks, jobs, pre/postprocessors, MCP servers) hang off the
agent and are covered in `01-lua-primitives.md`.

## How agents connect to CRM data

The CRM already exposes every read path the agents need through **GraphQL** at
`/api/graphql` (see `src/graphql/queries.ts`). The four AI entry points in
`src/server/services/ai.ts` are deliberately written as **seams**: each function
has a comment —

```ts
// SEAM: replace body with Lua (Data API / LuaTool) — see SPEC §8. Signature stays identical.
```

— meaning the *body* is a canned, data-aware placeholder today, and at
integration time the logic moves into a Lua **tool**. The GraphQL resolver
signatures (`aiMatchInvestors`, `aiFindProspects`, `aiAsk`, `aiOverviewInsights`)
do not change.

So a NobleStride tool reaches CRM data one of two ways:

1. **Call the CRM's own GraphQL API over HTTP** from inside the tool's
   `execute()` (recommended — reuses the resolvers/services that already exist).
2. **Use Lua's `Data` API** (`Data.create/get/update/search`) for state the agent
   owns itself (conversation memory, saved searches, semantic indexes) that
   doesn't belong in the CRM's Postgres.

`03-creating-tools.md` shows the concrete GraphQL-from-a-tool pattern.

## Agents NobleStride has / should have

Mapped directly onto the existing AI surface (the components that already call
these resolvers):

| Agent / capability | Today (canned, in `ai.ts`) | UI that calls it | Becomes (Lua) |
|---|---|---|---|
| **Overview Agent** | `aiOverviewInsights()`, `aiAsk()` | `overview-agent-card.tsx`, `ask-bar.tsx` | An agent with a `crm-insights` skill: tools `get_pipeline_overview`, `answer_crm_question` |
| **Investor Matcher** | `aiMatchInvestors(transactionId)` | `match-investors-button.tsx` | Tool `match_investors_to_transaction` in a `deal-matching` skill |
| **Prospect Finder** | `aiFindProspects(mandateId)` | `find-prospects-button.tsx` | Tool `find_prospects_for_mandate` in `deal-matching` |
| **Engagement Logger** | *(not yet — `Activity` model exists)* | `log-engagement-dialog.tsx` | Write-tool `log_engagement` in an `engagement` skill |

The data these operate on (Investor, Client, Mandate, Transaction, Engagement,
Partner, Activity) is defined in `prisma/schema.prisma`. `04-noblestride-agents.md`
specifies each agent's purpose, inputs/outputs, data dependencies, and a build
order.

## Guide index

| File | What it covers |
|---|---|
| `01-lua-primitives.md` | Every Lua primitive (agent, skill, tool, webhook, job, pre/postprocessor, MCP) with real schema shapes + minimal examples |
| `02-creating-skills.md` | Scaffold → schema → handler → test → push a skill, end-to-end |
| `03-creating-tools.md` | Writing tools; reaching CRM data over GraphQL; a full `match_investors_to_transaction` spec |
| `04-noblestride-agents.md` | The specific NobleStride agents/skills/tools and a recommended build order |

## Prerequisites

- Node.js + `lua-cli` installed globally (`npm install -g lua-cli`)
- Authenticated: `lua auth configure` (email OTP or API key). In CI, set
  `LUA_API_KEY` and use the `--ci` flag.
- The CRM running and reachable, with a GraphQL endpoint URL and (if you add
  auth) a service token available to tools via `env()`.
