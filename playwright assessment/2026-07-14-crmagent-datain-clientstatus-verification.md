# 2026-07-14 — crmAgent Data-In (Plan 1) + Client-Agent OTP Status (Plan 2) — End-of-Build Verification

**Branch:** integration/all-features (working tree dirty on purpose — NO commits, base b209ddd).
**Build mode:** local only. Nothing was `lua push`ed/deployed and no Vercel changes were made, so the *deployed* agents do not have this build — browser checks therefore verify page/widget plumbing and document deployed-agent behavior, while the functional verification of record is the local E2E smokes + suites below.

## Verification of record (local, not browser)

| Layer | Evidence | Result |
|---|---|---|
| P1 write flow E2E | `crm_agent/scripts/write-smoke.ts` vs local CRM (schema-introspected first) | 13/13 PASS; DB verified (Task createdSource=AGENT, ledger attribution evans@) |
| P2 status flow E2E | `client_agent/scripts/smoke.ts` status section vs local CRM | 7/7 PASS (request→sink code→verify→token→status `received`, exact 10-key whitelist, impostor request shape-identical + impostor verify fails); Activity {WebChat/Inbound/AGENT} + challenge consumed verified in DB; 0 impostor challenge rows |
| Suites | noblestride-crm (incl. 31 client-status + schema-lock + agent-write), crm_agent 54, client_agent 23 | all green; `tsc --noEmit` clean ×3 |
| Reviews | Per-task Fable reviews P1.1–P1.11, P2.1–P2.5; final whole-branch Fable review incl. P2.6/P2.7 at task-gate depth + 41-item deferred-minors triage; consolidated fix pass (F1–F10) + fix re-review | Approved ("With fixes" → fixes applied & re-approved) |
| Production-write guard (new) | Ran both smokes with no env: crm_agent refused (resolved Vercel URL, exit 1 before any network call); client_agent resolved localhost and passed | behaves as designed |

## Browser pass (Playwright, localhost:3000)

1. **`/talk-to-us` public page** — renders exact-viewport chat layout, LuaPop iframe mounts, welcome + 3 quick-reply buttons. Screenshot: `2026-07-14-crmagent-status-01-talk-to-us.png`.
2. **Client widget conversation** — sent a status question ("can I check the status of our application…"). Deployed (v1) agent replied with the *message-taking* flow (asks for email to log follow-up) — correct for the deployed version, which predates this build's OTP status tools. Screenshot: `2026-07-14-crmagent-status-02-widget-v1-behavior.png`.
   **NOTE:** the previous session's "out of credits" webchat platform blocker did NOT reproduce — the client channel (lt132s) streamed a normal reply. Blocker appears resolved/intermittent.
3. **CRM dashboard (evans@, Admin)** — loads fully (KPIs, pipeline, tasks). Staff Lua widget opens with the renamed "**NobleStride CRM Assistant**" header (local `lua-pop-widget.tsx`). Message sent; **no reply after ~35s** from the staff channel (4rtza3). Not a build gate (local crmAgent is undeployed by design) but worth checking channel credits/agent state before the eventual deploy. Screenshot: `2026-07-14-crmagent-status-03-staff-widget-no-reply.png`.

## What the browser could NOT verify (and why)

The new OTP status conversation and the staff write flow (propose→confirm→commit) live in the *local* `client_agent/` and `crm_agent/` code, which is not deployed. Browser-level conversational verification of those flows must be re-run **after** the user-approved `lua push`/deploy (see `lua release flow` memory: push → deploy → version create → promote, work account only).

## Open items for the user (from final review — need a human ruling)

1. **OnHold semantics:** open-stage Transaction with `dealStatus=OnHold` shows `in_execution` (plan's literal open-filter text) vs spec table hinting `with_team`; `ClosedOnHold` unaddressed.
2. **ClosedWon vs newer open transaction:** current code shows `completed`; reviewer recommends open-txn-first (one-line reorder, changes repeat-client visible behavior).
3. **Timing side-channel:** `requestClientStatusOtp` awaits the mail send (plan-verbatim) — strictly-literal anti-enumeration would want fire-and-forget.
4. **Pre-existing DB drift** on migration `20260703055946` (3 live Client columns not in schema) still blocks `prisma migrate dev` — needs a reconciliation decision.
5. **Commit scoping (when user green-lights commits):** exclude `investor_agent/` + stray intent-added docs; `docs/VERCEL-AGENT-DEPLOYMENT-2026-07-14.md` now has the key REDACTED (was plaintext); `crm_agent/scripts/write-smoke.ts` is now intent-added so it ships.
6. Dev DB retains 1 pre-existing `ZZTest Playwright Ventures Ltd` fixture (predates build; left alone).
