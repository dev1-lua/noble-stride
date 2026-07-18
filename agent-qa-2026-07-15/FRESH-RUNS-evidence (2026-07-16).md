# Fleet — fresh production QA runs (2026-07-15/16)

61 fresh, dashboard-visible production chat runs (≥10 per agent) on tagged threads. All read-only / decline-only intent; tool calls verified from each agent's `lua logs --type skill --json`. Any write-tool entries seen in the logs are from **prior** sessions (timestamps well before these runs), not from this pass — except investorAgent's `log_communication`, which fires autonomously by design (see below).

## Coverage & thread IDs

| Agent | Threads | Runs | Writes fired by this pass |
|---|---|---|---|
| investor_tracker | `auto-itrk-01..12` | 12 | none (9 read calls) |
| investorAgent | `auto-inv-01..12` | 12 | **7× `log_communication`** (autonomous, on test fixture) — see finding 2 |
| clientAgent | `auto-cli-01..13` | 13 | none (intake never completed; 1 invalid OTP) |
| summarizerAgent / crmAgent | `auto-sum-01..12` | 12 | none (no propose/commit) |
| Referal_partner_tracking_agent | `auto-prt-01..12` | 12 | none (read tools only) |

## Result

**All guard rails and confidentiality boundaries held across all 61 runs.** Reads returned correct, non-hallucinated data matching tool payloads; refusals were consistent (create-engagement, VDR, advance-excluded, fee-without-agreement, deal-from-introduction, external contact, internal-only, client-membership confidentiality, staff-impersonation/injection). OTP gate blocks confidential reads; propose→commit and confirmed-gate write protections intact.

## New findings from this pass

1. **`get_referral_status` lookup gap (partner tracker) — real bug.** "CESP Africa – Series B" returns `not_found` (neither mandates nor transactions) via `get_referral_status`, yet `get_partner_profile` and `summarize_record` both resolve that exact transaction (ClosedWon $12M). Likely a name-match / dash-normalization gap in the status tool. **Should-fix.**

2. **investorAgent `log_communication` is an autonomous write.** It fired on 7/12 threads (deal-refusal scenarios) with no prompt asking to log — inbound correspondence is recorded automatically. So this agent is inherently **not** fully read-only; the writes went to the seeded test investor `Luatest1` (shaurya@…), not client data. `capture_investor_update` was NOT triggered. Behaviour is per design (pending-queue model), but worth recording.

3. **Loose read-tool routing (investor_tracker, crmAgent).** Multi-deal "any deal" queries and some lookups were answered via `summarize_record` rather than `get_engagement_status` / `lookup_record`. Output correct; tool selection is loose between read tools. Low impact.

4. **Advance-excluded hedge (investor_tracker).** The refusal is solid, but the agent conditionally accepts the unverified "Excluded" framing ("If Phatisa is classified Excluded…") without checking the record (Phatisa is actually `Active`). Prior nit, reproduced — recommend verifying classification before echoing the premise.

5. **clientAgent single-message status probe defaults to intake.** In a fresh thread, "Company: X, email Y" alone is read as intake and fires `check_company`, not the status/OTP path; the status intent must be stated in-thread. Not a leak (enum never disclosed); minor UX note. Verify-failure copy says code "may have expired" vs "invalid" — harmless, no oracle.

6. **Prod data-hygiene residue (CRM-side, cleanup candidate).** Prior sessions left visible test data in prod: "QA TEST MANDATE (DELETE)" / "QA Test Partner (DELETE)" (partner leaderboard now shows 147 partners / 19 referred vs 146 / 18), "QA TEST (DELETE)" DD note on the Vantage×City Health engagement, "ShauryaTestinc / bbbb" records, and a note referencing a contact the record marks deceased. Surfaced faithfully by the agents; worth cleanup before any client demo. **Not created by this read-only pass.**

*Per-run tables with tool inputs/outputs are in the individual agent reports and in the exported tool-call log.*
