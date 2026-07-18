# Handover — continue Investor Tracker Agent testing

Copy-paste the prompt below into a new Claude Code chat (run from the repo root
`/Users/devashishthapliyal/Documents/work/Lua/NOBLESTRIDE`). Full build context is in
`noblestride-crm/investor-tracker-agent/AGENT-BUILD-2026-07-14.md` — the prompt tells the
new session to read it first.

---

## The prompt

```
Continue testing the NobleStride Investor Tracker Lua agent. Read
noblestride-crm/investor-tracker-agent/AGENT-BUILD-2026-07-14.md first — it is the
complete build record. Work from noblestride-crm/investor-tracker-agent/ (branch
feat/investor-tracker-agent).

State when the last session ended:
- Agent investor_tracker (baseAgent_agent_1784032867846_7j9q1ht9n, org 1e5359cc-…) is
  DEPLOYED at v1 (skill investor-tracker 1.0.1, job followup-check 1.0.1, preprocessor
  passphrase-gate 1.0.1, persona v1). It talks to the prod CRM
  https://noble-stride.vercel.app/api/graphql via x-agent-key.
- Working tree has an UNPUSHED hardening fix: all 4 write tools re-validate their zod
  schema inside execute() because `lua test` bypasses schema validation (this caused a
  stray prod write — see doc §Post-deploy testing #3). 104 vitest tests pass.
- A fresh passphrase-gate v1.0.3 is pushed/staged but not deployed, so `lua chat`
  (sandbox) still answers "not fully configured".
- Local .env (gitignored) holds CRM_API_URL / CRM_AGENT_KEY / TEAM_PASSPHRASE=tracker-sandbox-pass.

Do, in order, checking with me before anything that writes to production:
1. Commit the working-tree hardening changes to feat/investor-tracker-agent if not committed.
2. `npx lua push all --ci --force` (staged only — I deploy myself), then I run
   `lua deploy all --force`.
3. Revert the stray prod write: engagement cmqqcri8600bf42ctcev2aox3 probability → null
   (I will approve the mutation).
4. I set the production passphrase: npx lua env production -k TEAM_PASSPHRASE -v <phrase>.
5. Sandbox conversational QA via `npx lua chat --ci -m …`: (a) gate challenges, (b)
   tracker-sandbox-pass verifies, (c) "where does Vantage Capital stand on the City Health
   Hospital deal?" uses get_engagement_status, (d) "what's stalled?" uses the scan, (e) a
   write request must ask for confirmation BEFORE calling the tool, (f) asking it to share
   a deal with an excluded investor must refuse, (g) asking it to grant VDR access must refuse.
6. Same pass on production: `npx lua chat -e production --ci -m …`.
7. Verify the followup-check job: `npx lua test job --name followup-check` (careful: it
   creates real Tasks in the prod CRM — ask me first) and check dedupe on a second run.
8. Report a QA triage summary; fix what's broken (Sonnet-writes/Opus-reviews optional).

Known gotchas: the lua deploy-guard hook misfires on complex shell ($(), pipes, && chains)
— keep Bash simple and retry; lua test bypasses zod schemas (why the hardening exists);
never pass --auto-deploy; never hardcode the agent key in a command line (read it from
agent-info.md via grep|cut|xargs).
```
