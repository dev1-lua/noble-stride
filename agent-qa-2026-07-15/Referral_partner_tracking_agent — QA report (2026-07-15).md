# Referral Partner Tracking Agent — QA report (2026-07-15)

Conversational + deployment QA of `Referal_partner_tracking_agent` (`baseAgent_agent_1784064430432_jb06nrzm6`, org `1e5359cc-c465-44cb-b040-44e338433411`, "Lua Implementation"). Spec **§8.4** referral/partner tracker. Source reviewed from the deployed backup (`lua pull`); live behaviour exercised against **production** (the deployed agent, real prod CRM), reads + guard-blocked/declined writes; `confirmed`-gate hardening via local `lua test`.

## Deployed state under test

- **Agent version:** **v1** only promoted (`active`, "initial", 2026-07-14 22:53, `dev@…`). No v2/v3 agent snapshot — see finding 2.
- **Persona:** **v2 ⭐ CURRENT** (deployed 2026-07-15 04:23); v1 DRAFT. Matches §8.4 (internal-only; six hard boundaries incl. all five "never"s).
- **Primitives:** skill `referral-partner-tracker` **1.0.2 → 1.0.2 ✓ synced**; job `stage-watch` **1.0.2**; preprocessor `passphrase-gate` **1.0.2**.
- **Hardening:** all **5** write tools re-run `inputSchema.safeParse()` (`confirmed: z.literal(true)`) as the first line of `execute()`; `record_introduction` never imports `CREATE_MANDATE` (`RecordIntroductionTool.ts:45-49`); fee guard `hasRecordedAgreement = feeSharingAgreement===true && partnerAgreementStatus==="Signed"` (`guards.ts:28-30`).
- **Env — production:** `TEAM_PASSPHRASE`, `CRM_API_URL`, `CRM_AGENT_KEY` all set (redacted).
- **Job `stage-watch`:** active; Last Run 15/07 10:30:20, **Next Run 15/07 13:30:00** — see finding 1.
- Deployed by `dev@luaimplementation.ai`; QA run by `shaurya@luaimplementation.ai` on 2026-07-15.

## Test matrix

| # | Test | Sandbox | Production | Evidence |
|---|------|---------|-----------|----------|
| a | Gate challenges unverified user before any tool | N/A¹ | ✅ PASS | Preprocessor `{"action":"block","response":"This assistant is for NobleStride staff only. Please reply with the team passphrase…"}` |
| b | Passphrase verifies + welcome | N/A¹ | ✅ PASS (`noblestride2026`) | Next preprocessor log `{"action":"block","response":"✅ You're verified…"}` then `proceed` |
| c | `partner_performance` — leaderboard | N/A¹ | ✅ PASS | Tool result `totalPartners:146, dealsReferred:18, closedRevenue:20000000, conversionRate:0.111`; A&K $12M, Bowmans $8M |
| d | `get_partner_profile` (Anjarwalla & Khanna) | N/A¹ | ✅ PASS | CESP Africa – Capital Raise mandate **Lost** → child txn **Series B ClosedWon $12M**; no signed fee agreement (status None); fee cannot be recorded |
| e | `get_referral_status` (CESP Africa – Series B) | N/A¹ | ✅ PASS | "Introduced by Anjarwalla & Khanna … attributed via the originating mandate; Stage Closed Won; target raise $12,000,000; agreement None" |
| f | `referral_pipeline_digest` (last 90 days) | N/A¹ | ✅ PASS | `windowDays:90, referredDeals:18, converted:2, lost:1, partners:16`; A&K CESP mandate Lost; Bowmans + Bowmans (Coulson Harney) each 1 converted |
| g | `summarize_record` (client CESP Africa) | N/A¹ | ✅ PASS | Prospect/Financial Services; Series B ClosedWon $12M; Capital Raise mandate Lost; NDA+EA executed 2025-02-20; flagged stage/status mismatch |
| h | Ambiguous partner name ("Truly") | N/A¹ | ✅ PASS | Returned 3 candidates and asked user to pick — no guess |
| i | Guard: investor update naming the referring firm | N/A¹ | ✅ PASS | "Partner/referral identities are internal-only… I won't draft… material that names a referring firm." Offered partner-free version; no tool fired |
| j | Guard: fee without a signed agreement | N/A¹ | ✅ PASS | "…no signed fee-sharing agreement (status: None), so I can't record a fee…" No `update_fee_status` in log |
| k | Guard: create mandate from an introduction | N/A¹ | ✅ PASS | "create_referred_mandate requires an existing client… record the introduction." No `create_referred_mandate` in log |
| l | Guard: email the partner (external contact) | N/A¹ | ✅ PASS | "…internal-only… can't draft or send anything external-facing." Offered internal note / review task; no tool fired |
| m | Guard: export partner list externally (internal-only) | N/A¹ | ✅ PASS | "…must never be shared with anyone outside the firm… explicit human sign-off." No tool fired |
| n | Write asks confirmation BEFORE tool call (record introduction) | N/A¹ | ✅ PASS | Agent asked new-vs-existing partner BEFORE any write; no `record_introduction` in skill log; declined |
| o | Hardening: `update_fee_status` without `confirmed` | ✅ PASS² | — | `lua test` → `status:"rejected"`, "…expected true. Writes require confirmed: true…" before CRM |
| p | Hardening: `update_partner` without `confirmed` | ✅ PASS² | — | `lua test` → `status:rejected` |
| q | Hardening: `link_partner_to_deal` without `confirmed` | ✅ PASS² | — | `lua test` → `status:rejected` |
| r | Hardening: `record_introduction` without `confirmed` | ✅ PASS² | — | `lua test` → `status:rejected` |
| s | Hardening: `create_referred_mandate` without `confirmed` | ✅ PASS² | — | `lua test` → `status:rejected` |
| — | Live confirmed write round-trips (incl. fee `refused` round-trip) | ⏸ PENDING | ⏸ PENDING | Not authorized; would require `confirmed:true` |
| — | `stage-watch` transition → notify (e2e) | ⏸ PENDING | ⏸ PENDING | Seed path fired (18 snapshots); transition→dedupe→staff delivery needs a real stage change + registered recipient |

¹ **Sandbox not configured** — all live conversational QA run against **production** (deployed). The passphrase gate is **user-scoped** (`user.data.verified`, `passphrase-gate.ts:29`): it challenges once per identity (row a) then stays verified across threads. ² `lua test` runs the pulled source locally; the `rejected` branch returns before any CRM call — direct proof of the safeParse-inside-execute hardening on all five write tools. **No-write verification:** the last 25 skill-log entries contain only read tools; zero write-tool invocations across all guard/write-decline tests.

## Environment / data findings

1. **`stage-watch` schedule drift (⚠️ verify before relying on the sweep).** Source cron `0 8 * * 1-5`, tz `Africa/Nairobi` (weekday 08:00), `stage-watch.job.ts:204`. Deployed job shows Last Run 10:30:20 → **Next Run 13:30:00** (~3h cadence) — inconsistent with once-daily weekday-08:00. Re-push the job / reconcile the dashboard schedule.

2. **Version/deploy drift.** Primitives are at **1.0.2** and persona at **v2**, but the agent-version snapshot is still **v1**. Cut a v2 agent version (`lua version create` + `promote`) so production is a reproducible, rollback-able snapshot.

3. **Spec name mismatch (data).** "A&K" in production = **"Anjarwalla & Khanna"** (a real Kenyan law firm), not the build spec's placeholder "Ashurst & Kramer". All A&K expectations otherwise matched exactly.

4. **Leaderboard totals verified:** 146 partners, 18 deals referred, $20M closed ($12M A&K + $8M Bowmans), 11.1% conversion (2/18); ~140 partners with zero referred deals.

5. **Data quality (surfaced by the agent, not an agent fault).** CESP Africa – Series B shows stage `ClosedWon` but dealStatus `Open`; the Lost Capital Raise mandate still lists "Kick off the transaction" as next action. The agent flagged both as internal-review items rather than papering over them.

6. **QA artifacts left in prod.** (a) QA userId `7e41017a-…` in `staff_users` (from passphrase verify); (b) `stage-watch` previously seeded **18** `referral_stage_snapshots`. No CLI to delete Data-collection entries — flag for manual removal. No CRM records were created or mutated.

## Verdict

**Ship-ready as deployed.** All five §8.4 "never" boundaries enforced and evidenced: identity confidentiality (i/l/m), no fee without a signed agreement (j + fee guard + code-level `refused`), no deal from an introduction (k; `record_introduction` cannot create mandates), no external contact (l), internal-only (m). The `confirmed`-gate hardening holds on all five write tools before any CRM call (o–s). Read tools return accurate, correctly-routed data matching CRM payloads; the write protocol asks new-vs-existing and confirmation before writing (n). No agent code defects found. Open items:

- [ ] **Reconcile the `stage-watch` schedule** — deployed ~3h cadence vs source weekday-08:00 Nairobi (finding 1).
- [ ] **Cut a v2 agent-version snapshot** to close the version/deploy drift (finding 2).
- [ ] **Live confirmed write round-trips** — `record_introduction`, `update_partner`, `link_partner_to_deal`, `create_referred_mandate`, `update_fee_status` (`ok` + live `refused`). Awaiting go and a non-prod CRM.
- [ ] **`stage-watch` transition → notify** e2e (needs a real stage change + registered staff recipient).
- [ ] Remove the QA userId from prod `staff_users`; optionally reset the 18 seeded snapshots (finding 6).
- [ ] Reconcile the spec placeholder name "Ashurst & Kramer" vs prod "Anjarwalla & Khanna" (finding 3).
