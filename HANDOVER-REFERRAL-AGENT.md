# Handover prompt — paste this into a new Claude Code chat

---

Build the Referral / Partner Tracking Agent (Build Spec §8.4), the fourth Lua agent for the NobleStride CRM.

**The full approved implementation plan is at `noblestride-crm/referal_partner_agent/PLAN.md` — read it first and follow it phase by phase (Phases 1→7).** It was already researched, designed, and approved; do not re-plan it.

**Execute it yourself, directly, in this session — do NOT use subagent-driven development, do NOT dispatch implementer/reviewer subagents, no SDD ledgers or task briefs. Just write the code with normal edits, test as you go, and keep me posted.**

## Ground rules

- Create branch `feat/referral-partner-agent` off the current branch before touching code. Commit per phase with clear messages.
- The working tree has pre-existing uncommitted changes (`.gitignore`, `investor-tracker-agent/*`, `src/generated/pothos-types.ts`, untracked `.vercel/`, `agent-info.md`, `PROD-RECOVERY-2026-07-09.md`) — leave them alone, never commit them.
- The agent scaffold already exists at `noblestride-crm/referal_partner_agent/` (bare `lua init`, agentId `baseAgent_agent_1784064430432_jb06nrzm6`). Build into it.
- The template to copy patterns from is `noblestride-crm/investor-tracker-agent/` — especially `src/lib/crm-client.ts`, `src/lib/record-lookup.ts`, `src/skills/tools/UpdateEngagementTool.ts` (the write-tool confirmed-gate pattern), `src/jobs/followup-check.job.ts` (cron + Data-collection dedupe), `src/processors/passphrase-gate.ts`, and `AGENT-BUILD-2026-07-14.md` (build record + gotchas).

## Locked decisions (already agreed — don't re-ask)

1. CRM-side read-only GraphQL additions are approved (expose `stageChanges`, `referredTransactions` on Partner, fix `partnerReferralStats` for direct transaction referrals). Zero Prisma migrations.
2. Cron `stage-watch` job: yes (weekday 08:00 Africa/Nairobi, snapshot-diff via Data collections, staff webchat fanout).
3. Partner introduces a NEW deal → default is Partner upsert + review Task (never auto-create the deal); a separate `create_referred_mandate` tool exists ONLY for when staff explicitly say "create the mandate".
4. Webchat + `TEAM_PASSPHRASE` preprocessor now; email/WhatsApp platform channels later.
5. Fee guard (agent-side, CRM has none): "recorded agreement" = `feeSharingAgreement === true && partnerAgreementStatus === "Signed"` on the Partner; required before any `partnerFeeStatus`/`partnerFeeAmount` write; warn (don't block) on empty `feeSharingTerms`.

## Critical gotchas (learned the hard way on the investor tracker)

- **`lua test` calls `execute()` WITHOUT zod validation** — every write tool MUST re-run `inputSchema.safeParse(input)` at the top of `execute()` and return `status: "rejected"` before any CRM call. A `confirmed:false` test call once wrote to prod.
- **Sandbox `lua chat`/`lua test` read the local gitignored `.env` and hit the PROD CRM.** Never pass `confirmed: true` in `lua test`; in conversational sandbox tests, always DECLINE at the confirmation prompt for writes.
- Use the `/lua-push` skill, not raw `lua push all --force` (permission classifier blocks the raw form). Never `--auto-deploy`.
- CRM `globalSearch` matches names only, never record ids — port `record-lookup.ts` and add partner/mandate/client by-id fallbacks to `ID_LOOKUPS`.
- Platform logs don't capture preprocessor `console.log` — encode debug info in the block `response` string.
- Prod env vars are set via `npx lua env production -k KEY -v VALUE` (`CRM_API_URL=https://noble-stride.vercel.app/api/graphql`, `CRM_AGENT_KEY` = Vercel `AGENT_API_KEY`, `TEAM_PASSPHRASE=noblestride2026` — same phrase as the other agents).
- Deploy order matters: the CRM Vercel deploy (Phase 1 fields) must go out before the production agent deploy. Prod DB migrations are manual on this project, but Phase 1 needs NONE (GraphQL-layer only) — keep it that way.
- Ask me before running anything that creates records in prod (e.g. first stage-watch run, mandate creation tests).

## Definition of done

All plan phases complete: CRM additions deployed, agent compiles (`lua compile --ci`), full vitest suite green, `tsc --noEmit` clean, smoke script passes against local CRM, sandbox conversational QA per the plan's checklist, then the gated ship sequence (push → deploy → prod env → verify job registered), and an `AGENT-BUILD-<date>.md` build record in the agent folder mirroring the investor tracker's.

---
