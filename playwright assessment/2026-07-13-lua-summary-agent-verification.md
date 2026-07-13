# Lua Summary Agent — build verification (2026-07-13)

Branch: `feat/lua-summary-agent` (worktree `D:/LuaWork/NobleStride/noble-stride-lua-agent`).
Spec: `docs/superpowers/specs/2026-07-13-lua-summary-agent-design.md` · Plan: `docs/superpowers/plans/2026-07-13-lua-summary-agent.md` (both on the branch).
Built via subagent-driven development: 13 tasks, Sonnet implementing, Fable reviewing each task.

## What was built

**CRM side (`noblestride-crm/`):**
- `x-agent-key` service identity in the GraphQL context (constant-time compare, fail-closed).
- **401 auth gate on `/api/graphql`** — anonymous requests can only run pure introspection; closes the previously wide-open endpoint (verified live: anonymous `{ investors { name } }` returned real data before this branch).
- `Engagement.milestones` exposed in the schema.
- LuaPop chat widget in the authenticated `(crm)` shell, env-gated on `NEXT_PUBLIC_LUA_AGENT_ID`, with unmount teardown (`LuaPop.destroy()` + shadow-root removal).

**Lua agent (`lua_agent/`, lua-cli 3.18):**
- `crm-client` (GraphQL-only, `x-agent-key` header, friendly CrmError mapping incl. non-JSON responses).
- `summarize_record` tool: globalSearch → deterministic resolution (candidates on ambiguity, never guesses) → typed detail query → document *metadata* → AI briefing with no-LLM fallback → CRM deep link.
- `pipeline_digest` tool + shared runner: moved/new/stalled/totals computed in code from DB timestamps (LLM only words it); `useStored` reads the stored weekly digest.
- Passphrase preprocessor gate (fail-closed, staff_users registry) — wired into the agent.
- Weekly digest LuaJob: cron `0 9 * * 1` **Africa/Nairobi** (NobleStride home timezone), stores to `digests`, webchat delivery to registered staff with per-user failure isolation + dedupe.
- Persona: NobleStride deal-ops analyst (never invent, no raw IDs, read-only, internal-only).

## Test results

- CRM suite: **845/845 pass** (130 files) with `DATABASE_URL` exported. NOTE: without the export, 23 DB-dependent tests FAIL rather than skip — known vitest env quirk, not a regression.
- Lua agent suite: **29/29 pass** (7 files); `tsc --noEmit` clean in `lua_agent/`.
- Every task was TDD (RED→GREEN evidence in `.superpowers/sdd/task-N-report.md` on the branch).

## Live-endpoint smoke (deployed vercel.app)

All agent GraphQL documents pass against production **except**:
- `Engagement.milestones` — expected; ships with this branch, works locally, live after next CRM deploy.
- **BUG (pre-existing, CRM-side): Pothos `relationCount` fields return masked "Unexpected error" on the deployed endpoint** — `Investor.engagementCount`, `Transaction.investorsContacted`, `Partner.referredMandateCount` all fail live (custom-count `activeConversations` works). Not caused by this branch; agent queries no longer use these fields (counts derived from fetched relation arrays). Needs team investigation → suggest logging as next BUG number.

## Local gate verification (worktree dev server, port 3100)

- Anonymous `{ clients { id } }` → **401** ✔
- Anonymous introspection → 200 ✔
- `x-agent-key` header → 200 with real pipeline data ✔
- `Engagement.milestones` present in local schema ✔

## Browser pass (Playwright)

- Widget button + "NobleStride Assistant" panel render on `/dashboard`, panel opens with welcome message. Screenshots: `2026-07-13-lua-widget-dashboard.png`, `2026-07-13-lua-widget-open.png`.
- **Found & fixed during verification:** widget persisted on `/login` after logout (LuaPop mounts into document.body). Fixed with effect cleanup (`LuaPop.destroy()`); re-verified: `/login` clean after logout, widget re-mounts on re-login. Commit `182d52e`.
- Console: 3 errors, all Lua-platform-side and expected until `lua push`/`lua deploy` + webchat channel config (webchat/config 400 for localhost origin; chat/welcome 401). Nothing from the embed itself.

## Live conversation test (2026-07-14, production environment)

Platform env vars set on **production and sandbox** (`CRM_API_URL` → vercel.app GraphQL, `CRM_AGENT_KEY` = dev-agent-key-change-me, `TEAM_PASSPHRASE` = noblestride2026). First real `lua chat -e production` session:

- **Passphrase gate ✔** — `"noblestride2026"` → "✅ You're verified. Ask me to summarize any client, investor, mandate, transaction, engagement, or partner…" (preprocessor intercepts the passphrase message itself and replies directly — by design; CLI shows this as "Message blocked").
- **`pipeline_digest` ✔ live** — "what moved this week?" returned a correct full digest against production data: LOLC → Negotiation, City Health Hospital (Prodigy) → Closed-Won, 3 new mandate leads (incl. "Busoga Flowers – Advisory Mandate"), 13 stalled transactions, stage totals.
- **`summarize_record` ✘ live — expected, same root cause as `milestones`.** Every lookup returns clean `not_found` (skill logs confirm: parallel client/transaction/mandate searches, no GraphQL errors, empty results). Root cause: `src/server/search/global-search.ts` returns `[]` for unauthenticated actors, and the agent is anonymous on prod because the `x-agent-key` context change isn't deployed and Vercel lacks `AGENT_API_KEY`. The digest only works because the pipeline queries sit on the still-open part of the endpoint. **`summarize_record` will start working (and the digest will keep working) the moment the CRM branch deploys with `AGENT_API_KEY` set** — no agent-side change needed.
- Agent behavior on the failure was graceful: reported "couldn't find", asked for spelling, cross-referenced the digest ("it appeared in this week's digest — may not be fully indexed") rather than inventing data.

## Local end-to-end tool test (2026-07-14, `lua test` against local CRM)

Pushed integration/all-features to origin + upstream; **PR #4 open** (https://github.com/dev1-lua/noble-stride/pull/4, conflict-free vs upstream main). Before that deploys, the full post-deploy behavior was proven locally: worktree `lua_agent/.env` pointed at `http://localhost:3000/api/graphql` with the dev agent key, tools executed via `npx lua test skill --name <tool>`:

- Local gate sanity: `x-agent-key` → globalSearch resolves Busoga Flowers (Client + Mandate); anonymous query → **401**. ✔
- `summarize_record` mandate ("Busoga Flowers") → `status: ok`, full AI briefing (stage, NDA/EA, risks, next steps) + deep link. ✔
- `summarize_record` engagement ("Spear Capital – Study Buddy – Series B") → `status: ok` **including the `milestones` field that errors on prod today**. ✔
- `pipeline_digest` → `status: ok`, correct totals; movement/stalled empty (local seed timestamps all recent — expected). ✔
- Ambiguity path ("Advisory Mandate" as mandate) → `status: ambiguous` with id'd candidates list. ✔

Conclusion: every live failure is environmental (missing `AGENT_API_KEY` on Vercel + un-deployed context/auth-gate/milestones changes), not code. Merging PR #4 + setting the two Vercel env vars is the complete fix. Not run locally: the weekly digest LuaJob (`lua test job` would deliver real webchat messages to registered staff — skipped deliberately).

## Deferred / user actions

1. `lua push` → sandbox `lua chat` → `lua env` (prod CRM_API_URL / CRM_AGENT_KEY / TEAM_PASSPHRASE) → `lua deploy` — interactive, user-run.
2. CRM changes must merge upstream + deploy for the live endpoint to be protected (`AGENT_API_KEY` env in Vercel) and for `milestones` to resolve live. **Until then the deployed endpoint remains publicly open — flagged 2026-07-13.**
3. Webchat channel config for the CRM's domain at admin.heylua.ai.
4. relationCount prod bug → CRM team.
