# NobleStride Summary Agent — Design Spec

**Date:** 2026-07-13
**Branch/worktree:** `feat/lua-summary-agent` at `D:/LuaWork/NobleStride/noble-stride-lua-agent`
**Status:** Approved by Shaurya (2026-07-13), including Monday 09:00 Nairobi digest and passphrase gate.

## 1. Goal

An internal-only AI "summary agent" for the NobleStride CRM, built on the Lua agent
platform (docs.heylua.ai), delivering:

1. **On-demand record summaries** — "summarize this client / investor / mandate /
   transaction / engagement / partner" from the CRM chat widget.
2. **Pipeline digest** — weekly scheduled + on-demand summary of pipeline movement.

Audience: NobleStride staff only. Channel: LuaPop chat widget embedded in the CRM.

## 2. Context & constraints

- The Lua scaffold exists at `lua_agent/` (org NobleStride, agent `summarizerAgent`,
  lua-cli ^3.13, committed as `25b5381` on this branch). `lua.skill.yaml` is
  machine-managed — only the `version` field is hand-edited.
- The CRM is deployed at `https://noble-stride.vercel.app` (upstream `dev1-lua/noble-stride`,
  Vercel). Its GraphQL endpoint `/api/graphql` (Pothos + GraphQL Yoga) is live and
  exposes ~30 query fields incl. `globalSearch`, `client(s)`, `investor(s)`, `mandate(s)`,
  `transaction(s)`, `engagement(sByDeal)`, `pipelineOverview`, `mandatesByStage`,
  `transactionsByStage`, `dashboardStats`.
- **Security finding (must fix):** the deployed endpoint currently serves real investor
  data to fully anonymous requests. The CRM-side guard below closes this.
- **GraphQL-only rule:** all agent data access goes through `/api/graphql`. No REST,
  no direct DB, no server actions. Missing fields get added to the Pothos schema, never
  bypassed.
- Lua agents run in Lua's cloud; tools are plain async TypeScript with zod input
  schemas; `AI.generate` provides LLM calls inside tools; `LuaJob` provides cron;
  `Data` API provides JSON persistence; preprocessors can gate messages.

## 3. Architecture

```
Staff ──▶ LuaPop widget (inside authenticated CRM shell)
              │
         Lua Agent (cloud)  — persona: NobleStride deal-ops analyst
   summarize_record / pipeline_digest tools + weekly-digest cron job
              │  GraphQL over HTTPS, header x-agent-key
              ▼
 https://noble-stride.vercel.app/api/graphql  (new: service-key guard)
              │
           Prisma ──▶ Postgres
```

Data flows one way (agent → GraphQL). Nothing CRM-sourced is persisted in Lua
except generated digests (collection `digests`).

### 3.1 Lua agent layout (`lua_agent/`)

```
src/
  index.ts                     # LuaAgent: persona + skills + jobs + preprocessor
  skills/
    summary.skill.ts           # LuaSkill "crm-summary" bundling both tools
    tools/
      SummarizeRecordTool.ts
      PipelineDigestTool.ts
  jobs/
    weekly-digest.job.ts       # cron LuaJob
  processors/
    passphrase-gate.ts         # PreProcessor: internal-only access gate
  lib/
    crm-client.ts              # fetch helper: CRM_API_URL + x-agent-key, error mapping
    queries.ts                 # all GraphQL documents
```

- Model: `anthropic/claude-sonnet-5` (as scaffolded).
- Persona: internal deal-ops analyst; concise; never invents numbers; never exposes
  raw record IDs; escalates ("check with the deal lead") when data is missing.
- Env vars (local `.env` for sandbox, `lua env` for production):
  `CRM_API_URL`, `CRM_AGENT_KEY`, `TEAM_PASSPHRASE`.

### 3.2 CRM-side changes (`noblestride-crm/`, same branch)

1. **Service-key guard on `/api/graphql`:**
   - New env `AGENT_API_KEY`.
   - Request with header `x-agent-key` equal to it → service identity (read scope
     equivalent to an internal staff lens).
   - Request with a valid session cookie → existing session auth (unchanged for the UI).
   - Neither → 401 for every data operation. Schema introspection stays available
     (it exposes shape, not data); all query/mutation fields require auth.
   - Implemented in the Yoga context/plugin layer so resolvers stay untouched.
2. **LuaPop widget embed** in the authenticated `(crm)` shell layout only
   (`window.LuaPop.init`), agent ID from `NEXT_PUBLIC_LUA_AGENT_ID`. Not rendered in
   portal/public layouts.

Note: the guard protects the live vercel.app deployment only after these changes are
merged upstream and deployed. Until then the open endpoint means the agent works
immediately; the guard hardens it at deploy time.

## 4. Tools

### 4.1 `summarize_record`

- **Input (zod):** `recordType` enum `client|investor|mandate|transaction|engagement|partner`;
  `query` string (name or ID); optional `focus` string (e.g. "risks", "next steps").
- **Flow:**
  1. Resolve `query` via `globalSearch` (filtered by type). Exactly one match → proceed.
     Multiple → return candidate list (name, type, stage) so the agent asks the user;
     never guess. Zero → say so.
  2. Fetch the record with relations: activities, stage-change history, engagements +
     milestones (for deals), tasks, document *metadata only* (never file contents).
  3. `AI.generate` with a fixed template →
     **Headline · Current status · Recent activity · Open items · Risks/stalls · Next steps.**
- **Output:** markdown summary + CRM deep link (`https://noble-stride.vercel.app/...`).

### 4.2 `pipeline_digest`

- **Input:** `days` int 1–90 default 7; `pipeline` enum `mandates|transactions|both` default `both`.
- **Flow:** `pipelineOverview` + `mandatesByStage` + `transactionsByStage` + stage
  changes within the window; stalled = no activity within the window. `AI.generate` →
  **Movement · New entries · Stalled deals · Totals by stage.**
- Serves interactive asks and the cron job (same code path).

## 5. Weekly digest job

- `LuaJob`, cron `0 9 * * 1`, timezone `Africa/Nairobi`, 7-day window, 2 retries.
- Generates via the `pipeline_digest` code path, stores `{ weekOf, markdown }` in Data
  collection `digests`, proactively sends to known widget users.
- "Show this week's digest" reads the stored entry instead of regenerating.
- Job closures receive everything via `metadata` (Lua serializes them in isolation).
- Email delivery: deliberate non-goal for v1; later it is one `Channels.email.send` call.

## 6. Access gate (internal-only)

The widget sits behind CRM login, but the Lua agent ID is not a secret. A
`PreProcessor` blocks all messages from users whose Lua profile lacks `verified: true`,
prompting for the team passphrase (`TEAM_PASSPHRASE` env). Correct answer →
`user.update({ verified: true })`, permanent. Wrong answers get a polite refusal and
no tool access. This prevents CRM-data extraction by outsiders who discover the agent ID.

## 7. Error handling

- CRM unreachable / non-200 / GraphQL errors → tool throws a clear, user-facing message
  ("The CRM didn't respond — try again in a minute"); the agent relays it; no fabricated
  summaries.
- `AI.generate` failure inside a tool → return the fetched facts as plain structured
  markdown (unsummarized) rather than failing the request.
- Ambiguous or missing records → candidates / honest "not found", never a guess.
- Digest job failure → Lua retry config; interactive digest is unaffected (on-demand path).

## 8. Testing

- **Lua side:** `lua test` per tool against the live endpoint (happy path, ambiguous
  name, not-found, CRM-down with a bad URL); `lua chat` sandbox conversation pass.
- **CRM side:** vitest for the guard — 401 anonymous, 200 with `x-agent-key`, 200 with
  session, UI regression (existing smoke-test style in `src/server/__tests__/`).
- **End-of-build Playwright pass** (single pass at the end, per standing QA practice):
  widget renders in the CRM shell; screenshots + notes logged in `playwright assessment/`.

## 9. Rollout

1. Implement on `feat/lua-summary-agent` (this worktree). Commits allowed here.
2. `lua push` → sandbox test → `lua deploy` for the agent.
3. `lua env` to set production `CRM_API_URL` / `CRM_AGENT_KEY` / `TEAM_PASSPHRASE`;
   set `AGENT_API_KEY` in Vercel when the CRM changes deploy.
4. CRM changes stay on the branch for review — no push to origin/upstream without
   explicit go-ahead. Live-endpoint enforcement lands when the team merges upstream.

## 10. Non-goals (v1)

- Client/partner-facing summaries (visibility rules out of scope).
- WhatsApp/email/Slack channels.
- The "data in/out agent" (separate future project; the Data-API sync approach was
  considered and deferred).
- Write operations against the CRM — the agent is strictly read-only.
