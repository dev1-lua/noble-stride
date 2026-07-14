# Investor Tracker Agent — build record (2026-07-14)

The third of the four Build-Spec agents (§8.3), built as a standalone Lua agent that also
carries the summarizerAgent's read powers. **Purpose:** track the investor-to-deal
relationship through to close and disbursement — maintain engagement stage per investor
per deal, track term sheets / DD / disbursement, surface which investors fit a live
mandate, flag stalled engagements, create follow-up Tasks. People decide; the agent
records and flags.

- **Agent:** `investor_tracker` — `baseAgent_agent_1784032867846_7j9q1ht9n`, org `1e5359cc-c465-44cb-b040-44e338433411` (same org as clientAgent / summarizerAgent), model `anthropic/claude-sonnet-5`.
- **Data access:** GraphQL only, same contract as the other two agents — POST to `CRM_API_URL` with header `x-agent-key: CRM_AGENT_KEY`. The CRM's AGENT actor bypasses RBAC (`src/server/rbac/enforce.ts`), so **zero CRM-side changes were needed**.
- **Deployed 2026-07-14** by Devashish: skill `investor-tracker` v1.0.1, job `followup-check` v1.0.1, preprocessor `passphrase-gate` v1.0.1, persona v1; `lua version promote v1`.

## What it can do

One skill, nine tools:

| Tool | Kind | What it does |
|---|---|---|
| `get_engagement_status` | read | Full picture of one investor × one deal: stage, NDA, term sheet, amounts/disbursement, 15-key milestone checklist, DD tracks, recent activity, staleness verdict, deep link |
| `scan_stalled_engagements` | read | Flags idle-beyond-threshold engagements, outstanding disbursements, undated term sheets; optional deal/investor scope |
| `find_fit_investors` | read | `aiMatchInvestors` ranking (max 8) + marks which matches already have an engagement on the deal |
| `update_engagement` | write | Stage / interest / NDA type / term-sheet status+date / amounts / disbursement / probability / feedback |
| `record_milestone` | write | Record or unrecord any of the 15 investor-process milestones |
| `update_dd_status` | write | Upsert one of the 5 DD tracks (Financial/Tax/Commercial/ESG/Legal), returns all tracks |
| `create_followup_task` | write | Linked Task for the deal lead, dueAt defaults to +3 business days |
| `summarize_record` | read | Carried over from summarizerAgent (AI briefing of any record) |
| `pipeline_digest` | read | Carried over, minus the `useStored` branch (Data collections are agent-scoped) |

Plus:

- **`followup-check` job** — cron `0 8 * * 1-5` Africa/Nairobi: scans all live-deal engagements, dedupes flags per engagement+reason per ISO week (`tracker_flags` Data collection; dedupe record written only after the task creation succeeds, so retries are idempotent), creates linked follow-up Tasks, sends one aggregated webchat message to each `staff_users` member.
- **`passphrase-gate` preprocessor** — staff-only gate copied from summarizerAgent; verified users are registered into `staff_users` (the digest/notification roster).

## Guard rails (spec §8.3 "Never" list)

| Rule | Enforcement |
|---|---|
| Never grant VDR access | Structural — no transaction/document mutation tool exists; tools only *record* human-granted access. The CRM's NDA guard independently blocks `VDRAccess` stage without an NDA. |
| Never share a deal with an excluded investor | No `createEngagement` tool at all (introductions are the Investor Agent's job); `checkExcludedGuard` in `src/lib/guards.ts` blocks any advance on Excluded/Greylisted investors (wind-down only); `find_fit_investors` re-filters classifications on top of the server's Active+Approved filter; persona refusal rule. |
| Never issue/accept commercial terms | Only `termSheetIssued`/`termSheetDate`/amounts are writable; persona hard rule. |
| Human gate | Every write tool requires `confirmed: z.literal(true)` — the schema physically rejects unconfirmed calls; skill context + persona demand explicit per-write confirmation. |
| Every write logged | CRM stamps `createdSource: AGENT` + StageChange rows; each write tool also files a `logActivity` Note (audit failure returns `auditLogged: false`, never a silent miss). Tasks carry "Created by Investor Tracker Agent" in the body (Task has no `createdSource` column). |

## Design decisions & gotchas encountered

1. **`EngagementInput` requires `transactionId`+`investorId` even on update** (`inputs.ts:293`) — `update_engagement` fetches the engagement first and echoes its own ids back.
2. **Server NDA guard**: advancing `engagementStage` past NDA-gated stages throws unless an NDA is recorded — tools catch the `CrmError` and return `{status:"blocked", message}` so the model can explain instead of erroring.
3. **`globalSearch` matches names only, never ids** — added `src/lib/record-lookup.ts` (`resolveByNameOrId`) with a direct by-id fallback for cuid-shaped queries. *(The same latent issue exists in summariser_agent's "re-call with the id" flow — worth backporting.)*
4. **Lua Data collections are agent-scoped** — the copied `PipelineDigestTool` dropped its `useStored` branch (can't read summarizerAgent's stored digests).
5. **Staleness thresholds** live in `src/lib/staleness.ts` (per-stage days: Offer 7 … VDRAccess/DueDiligence 21; Invested only flagged while `disbursementStatus=Ongoing && amountPending>0`); overridable via `TRACKER_STALE_DAYS` JSON env. `Declined` and non-live deals (`dealStatus ∉ {Open, ClosedReopened}`) are never flagged.
6. **`tracker-runner.ts` exposes per-engagement `evaluateEngagement()`** — the seam for the phase-2 CRM→agent webhook ("any change to an Investor-Deal Engagement" trigger). v1 covers the spec's scheduled-checks trigger via the cron job only.
7. Local CRM DB was 5 migrations behind the Prisma schema (broke `engagementsByDeal`); applied via `prisma migrate dev` + dev-server restart (Turbopack stale-client gotcha).

## Verification done

- **99 vitest tests / 18 files pass** (staleness boundaries, guard matrix, resolution unions, scan fixtures, job dedupe/failure paths, per-tool suites incl. confirmed-schema rejection and NDA-guard relay).
- `npx tsc --noEmit` clean; `lua compile --ci` → 13 primitives.
- **End-to-end smoke green** (`scripts/smoke.ts`) against local CRM with seeded data: read path (status, scan → 48 flags, fit → 8 matches) + write round-trip (interest flip, milestone record+unrecord, DD upsert, task create) — all with audit notes. Run: `CRM_AGENT_KEY=<key> npx tsx scripts/smoke.ts`.
- Prod CRM probe: `x-agent-key` accepted by `https://noble-stride.vercel.app/api/graphql`.

## Environment state

| Where | Key | State (2026-07-14) |
|---|---|---|
| Lua production env | `CRM_API_URL` | `https://noble-stride.vercel.app/api/graphql` ✅ |
| Lua production env | `CRM_AGENT_KEY` | rotated key (matches Vercel `AGENT_API_KEY`) ✅ |
| Lua production env | `TEAM_PASSPHRASE` | **NOT SET** — gate answers "not fully configured" until set (`npx lua env production -k TEAM_PASSPHRASE -v <phrase>`; use the same phrase as summarizerAgent for staff sanity) |
| Lua sandbox env | all three | set (`TEAM_PASSPHRASE=tracker-sandbox-pass`) |
| Local `.env` | all three | present, gitignored (sandbox `lua chat`/`lua test` reads this) |

## Post-deploy testing (2026-07-14 evening)

Deployed by Devashish (`lua deploy all --force`, `lua version promote v1`). Sandbox testing findings:

1. **Sandbox tools work against production data.** `lua test skill --name scan_stalled_engagements --input '{}'` returns real flags (e.g. Vantage Capital × City Health Hospital, 21d idle at Shared); `get_engagement_status` resolves by names and returns the full picture with `isStale: true` and prod deep links. `lua test`/`lua chat` load env from the local `.env` (gitignored) — the `lua env sandbox` store alone was not enough.
2. **Sandbox `lua chat` is blocked by the passphrase gate saying "not fully configured"** — the *deployed* preprocessor (v1.0.1) predates the env vars. A fresh `passphrase-gate` v1.0.3 is **pushed/staged but NOT deployed** (deploy is the human step). After the next `lua deploy`, chat should challenge for `tracker-sandbox-pass` (sandbox) / the prod passphrase.
3. **INCIDENT + FIX — `lua test` bypasses zod schemas.** `lua test` calls `execute()` directly without validating against `inputSchema`, so a test call with `confirmed: false` **actually wrote to production**: engagement `cmqqcri8600bf42ctcev2aox3` (Vantage Capital × City Health Hospital) got `probability: 50` (was almost certainly null) plus an audit Note "test". 
   - **Fix (in working tree, NOT yet pushed):** all four write tools now re-validate with `inputSchema.safeParse()` inside `execute()` and return `rejected` without any CRM call (`confirmed-gate.test.ts`, 104 tests pass).
   - **Pending data revert (needs human-reviewed prod write):** set that engagement's probability back to null — `updateEngagement(id: "cmqqcri8600bf42ctcev2aox3", input: { transactionId: <its own>, investorId: <its own>, probability: null })`, or clear it in the CRM UI at `/engagement/cmqqcri8600bf42ctcev2aox3`; optionally delete the "test" audit Note.
4. Production `TEAM_PASSPHRASE` remains unset (agent-chosen secret was denied in auto mode — set it yourself: `npx lua env production -k TEAM_PASSPHRASE -v <phrase>`).

## Still open

- **Production `TEAM_PASSPHRASE`** (above).
- **Webchat channel wiring** if the tracker should render in the CRM shell like the summarizer (new channel + allowed-website `https://noble-stride.vercel.app` on admin.heylua.ai; the platform "out of credits" webchat blocker may still apply — `lua chat -e production` is the reliable verification path).
- **Phase 2:** CRM emits an engagement-change webhook (seam: `engagements-crud.ts`) → new `LuaWebhook` here calling `evaluateEngagement()` for per-change triggering.
- Backport `record-lookup.ts` id-fallback to summariser_agent.
