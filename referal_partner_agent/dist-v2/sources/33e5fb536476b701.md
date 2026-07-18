# Referral / Partner Tracking Agent — build record (2026-07-15)

Spec §8.4. Fourth Lua agent, agentId `baseAgent_agent_1784064430432_jb06nrzm6` (same org as the other three).

## Deployed state

- **Deployed 2026-07-15** by Devashish: skill `referral-partner-tracker` v1.0.2, job `stage-watch` v1.0.2, preprocessor `passphrase-gate` v1.0.2, persona v2; `lua version create -m "initial"` → `lua version promote v1`.
- Production env: `CRM_API_URL` (prod), `CRM_AGENT_KEY` (same rotated key as the tracker, matches Vercel `AGENT_API_KEY`), `TEAM_PASSPHRASE` — all set ✅.
- Sandbox env: local CRM URL + dev key + same passphrase.

## ⚠️ BLOCKER at time of writing

**The CRM's Phase-1 GraphQL additions are NOT yet deployed to `noble-stride.vercel.app`** (verified: `byPartner.id` fails GraphQL validation in prod). Until the CRM is deployed, every read tool except `record_introduction`/`create_referred_mandate` fails in production (queries reference `stageChanges`, `referredTransactions`, `byPartner.id`). **Zero Prisma migrations needed** — plain code deploy. CRM changes live uncommitted on branch `feat/investor-tracker-agent`:
- `src/graphql/types.ts` — `StageChangeRef`; `stageChanges` on Mandate/Transaction/Partner; `referredTransactions` + count on Partner
- `src/graphql/queries.ts` — `PartnerReferralRow.id`
- `src/server/services/partners.ts` — direct-transaction referrals in `partnerReferralStats` (deduped vs mandate children) + `id` in rows
- `src/server/domain/{metrics,types}.ts` — `directTransactions` in the rollup
- `src/server/__tests__/metrics.test.ts` — new rollup test

## Architecture (mirrors the investor tracker)

- `src/lib/`: `crm-client` + `resolve` (verbatim from tracker), `record-lookup` (id fallbacks for partner/mandate/client/transaction), `queries` (referral documents + mutations), `guards` (fee guard), `referral-scan` (flatten referred deals; dedupes same-partner mandate-child transactions), `format` (record prompt + `weekOf` + `addBusinessDays`).
- Reads: `get_partner_profile`, `get_referral_status` (mandate|transaction, both searched when type omitted), `referral_pipeline_digest`, `partner_performance`, `summarize_record` (ported unchanged).
- Writes (all `confirmed: z.literal(true)` + runtime `safeParse` re-check — the lua-test-bypasses-zod regression): `record_introduction` (partner upsert + review task, +3 business days; **structurally cannot create deals**; `partnerAction: create_new|use_existing`, duplicate guard via `possible_duplicate`/`createAnyway`), `create_referred_mandate` (explicit instruction only; requires existing client; `source: Referral`), `link_partner_to_deal` (conflict → naming current originator unless `overrideExisting`), `update_partner` (also how agreements get recorded; warns agreement-without-terms), `update_fee_status` (fee guard: `feeSharingAgreement && partnerAgreementStatus === "Signed"`, else `refused` with how-to-fix).
- Fee guard is **agent-side only** — the CRM has no server-side rule (recommended follow-up).
- Audit limitation: `LogActivityInput` has no `partnerId` — partner-only writes anchor the note to a referred deal when one exists, else return `auditLogged: false` honestly.
- Job `stage-watch` (cron 0 8 * * 1-5 Africa/Nairobi): snapshot collection `referral_stage_snapshots`, notice dedupe `referral_stage_notices` (`dealKey:toStage:ISOweek`), one grouped webchat message to `staff_users`; snapshot/notice written only AFTER ≥1 successful send (retry-safe). First run seeds silently.

## Verification done

- CRM: `tsc` clean in touched areas; vitest 796 passed (38 pre-existing DB-smoke failures identical pre/post change); SDL probe shows all new fields.
- Agent: 78 vitest tests passed (confirmed-gate matrix over all 5 write tools, fee-guard matrix, scan dedupe, job ordering/dedupe/failure-isolation); `tsc` clean; `lua compile` 14 primitives.
- Read-only smoke vs local CRM (`scripts/smoke.ts`): all tools ok — 46 referred deals, 15 partners, conversion 4%.
- `lua test`: reads ok by name and by exact id; all 5 writes return `rejected` on `confirmed:false`/missing with zero CRM calls.
- Production chat: passphrase gate flow ✅; identity-rail probe ("draft investor email naming the introducer") refused ✅; read tool correctly surfaces CRM error pending the CRM deploy.

## Remaining

1. **Deploy noblestride-crm to Vercel prod** (commit + push; no migrations), then re-verify: prod probe `{ partnerReferralStats { byPartner { id } } }` and `lua chat -e production -m "what has <partner> referred?"`.
2. Conversational QA pass (introduction default → partner+task, NO mandate; explicit create-mandate; fee refusal → record agreement → fee ok; digest; ambiguity flows).
3. Watch first `stage-watch` run (`lua logs --type job --limit 10`) — expect silent seeding of ~46 snapshots.
4. Follow-up (out of scope): CRM-side fee guard; `partnerId` on `LogActivityInput`/`TaskInput`.

## Gotchas carried forward

- `lua test`/`lua chat` load env from local `.env` — never run write tools with `confirmed:true` there while `.env` points at prod.
- Raw `lua push`/`lua deploy` are hook-gated; use `/lua-push` / `/lua-deploy` (compound shell commands containing `lua` may false-positive the deploy hook — run simple commands).
- The env store alone isn't enough for local runs; the local `.env` (gitignored) is what `lua test` reads.
