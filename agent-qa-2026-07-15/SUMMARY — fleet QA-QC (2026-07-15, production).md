# NobleStride Agent Fleet — Production QA/QC Summary (2026-07-15)

Org **Lua Implementation** (`1e5359cc-c465-44cb-b040-44e338433411`). QA/QC of all agents **except** the Lua Desktop Assistant, run against **production** (deployed agents, real prod CRM `https://noble-stride.vercel.app`) by `shaurya@luaimplementation.ai`, CLI 3.18.0. Method: `lua chat -e production` per scenario, tool-call correctness verified from `lua logs --type skill --json` (tool name + exact input + full output vs. rendered answer), guard rails exercised conversationally, `confirmed`-gate hardening via `lua test`, deployed state via `lua version/jobs/persona/env/status`. **Read-only + decline-only:** no prod CRM records were created or mutated by any pass.

## Verdicts

| Agent | Deployed | Verdict | Headline |
|---|---|---|---|
| **investor_tracker** | v2 / persona v3 | ✅ **Ship-ready** (2 open) | All guards + confirmed-gate (4 tools) pass; stalled-scan noise + job-schedule drift to fix |
| **investorAgent** | v1 / persona v1 | ✅ **Ship-ready** | Capture-only boundary holds; secret-gated draft-only outreach, no send path |
| **clientAgent** | v2 / persona v2 | ✅ **Ship-ready** (1 design Q) | OTP self-service gate + confidentiality solid; no `confirmed`-gate by design |
| **summarizerAgent / crmAgent** | v2 / persona v2 | ✅ **Ship-ready** (caveats) | Propose→commit write model sound; reads + guardrails correct |
| **Referal_partner_tracking_agent** | v1 / persona v2 | ✅ **Ship-ready** | All 5 §8.4 "never"s enforced; confirmed-gate (5 tools) pass; job-schedule + version drift |

**No agent code defects that break shipping were found.** Every safety-critical behavior tested holds in production. Open items below are hygiene, one quality bug, and authorization-gated live-write coverage.

## Cross-cutting findings

1. **Job-schedule drift on the two scheduled sweeps (⚠️ verify before relying on crons).** `followup-check` (investor_tracker) and `stage-watch` (partner) both show a **~3-hour / 13:30 next-run** cadence, but their source cron is `0 8 * * 1-5` (weekday 08:00 Africa/Nairobi). Deployed schedule ≠ committed source — reconcile (re-push job) before trusting the morning sweep. `weekly-digest` (crmAgent) source `0 9 * * 1` matches by day; only a tz time-of-day display nit.

2. **One real quality bug — investor_tracker stalled-scan flags closed deals.** The scan gates on `transaction.dealStatus ∈ {Open,ClosedReopened}`, but prod `ClosedWon`/`ClosedLost` deals keep `dealStatus:"Open"`. So the 59-flag scan (and the cron that would file follow-up Tasks) includes already-closed deals. Recommend a pipeline-`stage`-based exclusion. (Root cause is partly CRM hygiene — see #6.)

3. **Two different write-safety models across the fleet (document the choice).**
   - **`confirmed: z.literal(true)` re-validated inside `execute()`** → investor_tracker (4 write tools) and partner (5 write tools). Both **hardened and proven**: `lua test` without `confirmed` → `status:"rejected"` before any CRM call.
   - **Architectural / no confirm-literal** → clientAgent (OTP + email-match + whitelisted GraphQL), investorAgent (immediate write → **pending-queue + team review**), crmAgent (two-step **token propose→commit**). All safe, but there is **no uniform `confirmed`-gate** — worth a recorded decision so reviewers/testers don't expect one everywhere.

4. **Passphrase gate is user-scoped (not a defect).** Verification persists on `user.data.verified` + `staff_users`, so it challenges once per identity then stays verified across threads. The live challenge→verify path was captured on the first unverified thread; re-challenge from an already-verified account isn't reproducible.

5. **Live write round-trips remain ⏸ PENDING across the fleet** (per your decline-only authorization): investor_tracker writes + `followup-check` run (~59 real Tasks); partner 5 writes + fee `refused` round-trip; crmAgent `propose→commit` (propose writes a 10-min-TTL ledger row); investorAgent live `capture_investor_update` + draft generation; clientAgent post-OTP `get_client_status`. Close these on a **sandbox/staging CRM** — prod sandbox env is currently unconfigured and `lua test`/local runs read prod (or a dead local key for crmAgent).

6. **CRM data-hygiene items (CRM-side, surfaced faithfully by the agents — not agent defects).** `dealStatus` stays `Open` on closed deals (also drives #2); junk/placeholder & near-duplicate partner names; the spec placeholder "Ashurst & Kramer" is really "Anjarwalla & Khanna" in prod; stray `probability:50` + "test" note on Vantage×City Health (blocked from clearing by a known CRM zod `.optional()`-not-`.nullable()` bug).

7. **Version/deploy hygiene.** Partner agent snapshot is still **v1** though its primitives (1.0.2) and persona (v2) advanced — cut a fresh agent version for a clean rollback-able baseline. Several packages show local backup "out of sync" (unpushed local edits) / persona drift — local hygiene, server/promoted state is what's deployed.

8. **QA artifacts left in prod (need manual cleanup — no CLI to delete Data-collection rows).** QA userId `7e41017a-…` is in the `staff_users` collection of the passphrase-gated agents; `stage-watch` seeded 18 `referral_stage_snapshots`. Append-only `log_communication` rows were written to the **seeded test investor "Luatest1"** (not client data) during investorAgent QA.

## Where to see this on your dashboard

All activity is live in the org dashboard. Chat threads used this pass (per agent): `qa-it-01`/`qa-itrk-*` (investor_tracker), `qa-inv-*` (investorAgent), `qa-cli-*` (clientAgent), `qa-sum-*` (crmAgent), `qa-prt-*` (partner). Skill-call inputs/outputs are under each agent's logs (skill / preprocessor / webhook), and job runs under Jobs → history.

## Recommended next actions

- [ ] Reconcile `followup-check` + `stage-watch` schedules to source cron; re-push jobs (#1).
- [ ] Fix investor_tracker stalled-scan to exclude ClosedWon/ClosedLost by pipeline `stage` (#2).
- [ ] Decide + document the fleet write-safety model (confirmed-gate vs architectural) (#3).
- [ ] Stand up a **sandbox/staging CRM** and run the ⏸ live write round-trips there (#5).
- [ ] Cut a v2 agent-version snapshot for the partner agent; resolve local backup/persona drift (#7).
- [ ] Manually remove QA userId from `staff_users`; optionally reset the 18 seeded snapshots (#8).
- [ ] CRM-side: fix `dealStatus`-on-close, clearable-fields zod `.nullable()`, partner de-dup, spec name (#6).
- [ ] Minor: investor_tracker should verify investor classification instead of parroting an unverified "Excluded" claim.

*Per-agent detail: see the five sibling reports in this folder.*
