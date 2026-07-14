# Referral / Partner Tracking Agent (Build Spec §8.4)

## Context

Fourth and final Lua agent for the NobleStride CRM. Spec §8.4: capture partner introductions, relationships, fee-sharing and conversion; read partner records, linked deals, deal stage history; write Partner records and partner-to-deal links; human gate on advisor-to-NobleStride deal sharing; never expose partner identity to investors, never act on fee-sharing without a recorded agreement.

Scaffold exists at `noblestride-crm/referal_partner_agent/` (bare `lua init`, agentId `baseAgent_agent_1784064430432_jb06nrzm6`, same org as the other three). The investor tracker at `noblestride-crm/investor-tracker-agent/` is the proven template (crm-client, record-lookup, confirmed-gate writes, passphrase gate, cron job with Data-collection dedupe).

**User decisions (locked):**
1. CRM-side read-only GraphQL additions approved (stage history exposure + `referredTransactions`).
2. Cron stage-watch job: yes.
3. Introductions: default = Partner upsert + review Task (never auto-create deals); a separate explicit tool `create_referred_mandate` when staff say "create the mandate".
4. Webchat + `TEAM_PASSPHRASE` gate now; email/WhatsApp platform channels later.

**Key design decisions:**
- **Fee guard (agent-side; CRM has none):** "recorded agreement" = `feeSharingAgreement === true && partnerAgreementStatus === "Signed"` on the Partner. Guard applies to writing `partnerFeeStatus` (≠ NotDue) / `partnerFeeAmount`. Recording the agreement itself via `update_partner` is allowed. Warn (don't block) if `feeSharingTerms` empty.
- **Conversion:** referred Mandate onboarded at stage `Signed`; referred Transaction converts at `ClosedWon` (matches `partnerReferralRollup`).
- **Audit limitation:** `LogActivityInput`/`TaskInput` have no `partnerId` — partner-only writes log against a linked deal when one exists, else return `auditLogged: false` honestly. No Prisma migration (out of scope).

## Phase 1 — CRM GraphQL additions (read-only, ZERO migrations)

Files: `noblestride-crm/src/graphql/types.ts`, `src/server/services/partners.ts` (85–131), `src/server/domain/metrics.ts`, `src/graphql/queries.ts` (PartnerReferralRow).

1. New `StageChangeRef` prisma object: `id, field, fromValue, toValue, changedAt, createdSource, changedBy` + nullable FK scalars.
2. Add `stageChanges` relation (orderBy changedAt desc) to `MandateRef` (~line 240), `TransactionRef` (~292), `PartnerRef` (~402).
3. `PartnerRef`: add `referredTransactions` relation + `referredTransactionCount` (relation exists in Prisma, just not exposed).
4. Fix `partnerReferralStats` to include direct `Transaction.referredById` referrals, deduping transactions already counted via a referred mandate; add `id` to `byPartner` rows. Update domain/service tests.
5. Verify: `tsc --noEmit`, `vitest run`, local GraphQL probes. **Deploy to Vercel before production agent deploy** (agent queries these fields). No `prisma migrate` needed.

## Phase 2 — Agent lib (`referal_partner_agent/src/lib/`)

Copy verbatim from investor-tracker: `crm-client.ts`, `resolve.ts`. Copy+extend `record-lookup.ts` — add `partner` (`/partners`), `mandate` (`/mandates`), `client` (`/clients`) to `ID_LOOKUPS`. Copy/trim `format.ts` (+ `weekOf`).

New `queries.ts` documents: `GLOBAL_SEARCH`; slim id lookups (`PARTNER_BY_ID`, `MANDATE_BY_ID`, `CLIENT_BY_ID`, `TRANSACTION_BY_ID`); `PARTNER_REFERRAL_DETAIL` (partner + fee fields + contacts + referredMandates w/ stages + referredTransactions + stageChanges); `MANDATE_REFERRAL_STATUS` / `TRANSACTION_REFERRAL_STATUS` (deal + referredBy w/ agreement fields + stageChanges + fee fields; echo `name`/`clientId` for update round-trips); `REFERRED_DEALS_SCAN`; `PARTNER_REFERRAL_STATS`; mutations `CREATE_PARTNER`, `UPDATE_PARTNER`, `CREATE_MANDATE`, `UPDATE_MANDATE`, `UPDATE_TRANSACTION`, `CREATE_TASK`, `LOG_ACTIVITY`. (Inputs require `name`/`clientId` even on update → fetch-then-echo, same as UpdateEngagementTool.)

New `guards.ts`: `hasRecordedAgreement(partner)`, `checkFeeGuard(partner|null, set)` → `{allowed, message, warning?}`.
New `referral-scan.ts`: flatten scan → `ReferredDeal[] {dealKey, dealName, dealType, partnerId, partnerName, stage, dealStatus, link, converted}` (shared by digest tool + job).

Copy `processors/passphrase-gate.ts` (reword welcome; same `staff_users` collection — Data is agent-scoped, no collision).

## Phase 3 — Tools (`src/skills/tools/`)

Write tools MUST reproduce the critical pattern: `confirmed: z.literal(true)` + `reason` in schema; `execute()` re-runs `inputSchema.safeParse(input)` FIRST → `"rejected"` (lua test bypasses platform zod — prod-write incident regression); guards → `"refused"`; relayed CrmError → `"blocked"`; success → `{status:"ok", link, auditLogged}` + best-effort LOG_ACTIVITY.

Reads (discriminated unions, deep links, no raw ids in prose):
| Tool | Input | Notes |
|---|---|---|
| `get_partner_profile` | `{partner}` | search→detail; fee/agreement state, referred deals, stage history |
| `get_referral_status` | `{deal, dealType?}` | originator, stage timeline, conversion state, fee status |
| `referral_pipeline_digest` | `{partner?, days?}` | all referred deals grouped by partner |
| `partner_performance` | `{partner?}` | PARTNER_REFERRAL_STATS or single-partner rollup |
| `summarize_record` | port from tracker unchanged | |

Writes:
| Tool | Behavior |
|---|---|
| `record_introduction` | Partner upsert (confirmation must state create-new vs update-existing) + review Task "Review referral introduction: X (introduced by Y)" due +3 business days; deal FKs only if `existingDealId`. **Structurally never calls CREATE_MANDATE.** |
| `create_referred_mandate` | Only on explicit staff instruction (description says so). Requires existing client (`client_not_found` otherwise) + resolved partnerId; CREATE_MANDATE with `referredById` set. |
| `link_partner_to_deal` | `{partner, deal, dealType, overrideExisting?, ...}`; if deal already has a different `referredBy` → `status:"conflict"` naming current originator unless override. |
| `update_partner` | `{partnerId, set{...all partner fields incl. fee/agreement/internalOnly}, ...}` + refine ≥1 field; warn when agreement=true without terms. |
| `update_fee_status` | `{transaction, set{partnerFeeStatus?, partnerFeeAmount?}, ...}`; partner = `transaction.referredBy ?? mandate.referredBy`; **fee guard → `"refused"` with instructions on how to record the agreement first.** |

## Phase 4 — Skill + persona + wiring

- `src/skills/referral.skill.ts`: LuaSkill modeled on `tracker.skill.ts` — routing lines per tool, mandatory write protocol, plus: (1) introductions default to record+review-task, `create_referred_mandate` only on explicit instruction; (2) fee `refused` → no workarounds, agreement must be recorded first; (3) partner identity is internal-only — refuse anything investor-facing naming an originator.
- `src/index.ts`: PERSONA (modeled on tracker) with hard boundaries = the two spec Nevers + never auto-create deals from introductions + never contact external parties. `model: "anthropic/claude-sonnet-5"`, skills/jobs/preProcessors wired.

## Phase 5 — `stage-watch` cron job (`src/jobs/stage-watch.job.ts`)

Cron `0 8 * * 1-5` Africa/Nairobi, timeout 300, retry 3×120s. Deps-injected `runStageWatch(deps)`:
1. Scan referred deals (referral-scan).
2. Snapshot collection `referral_stage_snapshots` `{dealKey: "mandate:<id>"|"transaction:<id>", partnerId, partnerName, dealName, stage, dealStatus}` — first sighting seeds silently; unchanged skips; changed = transition.
3. Dedupe collection `referral_stage_notices` `{noticeKey: dealKey:toStage:ISOweek}`.
4. One grouped webchat message to `staff_users` roster: "Referral watch — N referred deals moved: • Deal (Partner): Old → New <link> [converted!/lost]".
5. Snapshot `Data.update` + notice `Data.create` AFTER successful send (action-before-dedupe, tracker's proven ordering; verify `Data.update` entry-id shape at implementation time — fallback: append-only snapshots, read latest).
6. Return counters; one bad deal/recipient never sinks the run.

## Phase 6 — Config + tests + smoke

- `env.example`: add `CRM_API_URL`, `CRM_AGENT_KEY`, `TEAM_PASSPHRASE` block from tracker.
- `package.json`: `test: vitest run`, `smoke: tsx scripts/smoke.ts`, add vitest devDep; copy `vitest.config.ts`.
- Tests: lib (crm-client, resolve, record-lookup partner-id fallback, guards matrix, referral-scan), job (seed-silent, transition→notify, dedupe, update-after-notify ordering, failure isolation), tools (shared `confirmed-gate.test.ts` covering EVERY write tool; record_introduction asserts CREATE_MANDATE never called; link conflict; fee refusal; create_referred_mandate client_not_found).
- `scripts/smoke.ts` (read-only vs local CRM): search partner, PARTNER_REFERRAL_DETAIL (proves Phase-1 fields), mandate stageChanges, partnerReferralStats.

## Phase 7 — Verification + deploy

1. CRM: tests + tsc + local probes → Vercel deploy (preview → prod).
2. Agent: `npm test` → `tsc --noEmit` → `lua compile --ci` → smoke vs local CRM.
3. Sandbox: `lua push all --force`; `lua test` read tools + rejected-path of writes only. **NEVER pass `confirmed:true` in `lua test` — writes hit PROD CRM via .env** (prior incident). Use /lua-push skill, not raw push (auto-mode classifier).
4. Conversational QA: gate flow; profile by name; ambiguous partner; introduction default (partner+task, NO mandate); explicit create-mandate flow; fee update w/o agreement → refused; w/ Signed → ok+link; performance digest; identity-rail probe ("draft investor email naming the introducer" → refuse).
5. Ship: `lua push all --force` → `lua deploy` → `npx lua env production` set `CRM_API_URL` (prod), `CRM_AGENT_KEY`, `TEAM_PASSPHRASE` → verify stage-watch registered, watch first run via `lua logs`. Write `AGENT-BUILD-<date>.md` build record like the tracker's.

## Risks
- Partner upsert-by-name duplication (globalSearch is contains-only) — mitigated by confirmation stating create-new vs update-existing.
- `partnerReferralStats` fix must dedupe mandate-child transactions vs direct referrals.
- Agent-side fee guard is the SOLE enforcement of the fee rail (CRM-side guard = recommended follow-up, out of scope).
- No `partnerId` on activity/task inputs — accepted, surfaced via `auditLogged:false`.

## Key reference files
- `noblestride-crm/investor-tracker-agent/src/skills/tools/UpdateEngagementTool.ts` — write-tool pattern
- `noblestride-crm/investor-tracker-agent/src/jobs/followup-check.job.ts` — job/dedupe/fanout pattern
- `noblestride-crm/investor-tracker-agent/src/lib/{crm-client,record-lookup,queries}.ts` — lib to port
- `noblestride-crm/src/graphql/types.ts`, `src/server/services/partners.ts` — CRM additions
- `noblestride-crm/investor-tracker-agent/AGENT-BUILD-2026-07-14.md` — build record format + gotchas
