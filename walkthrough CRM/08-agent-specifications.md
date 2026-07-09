# §8. Agent specifications

**Spec (Build Specification §8):** Four Lua agents — Client Agent (8.1), Investor Agent (8.2), Investor Tracker Agent (8.3) and Referral/Partner Tracking Agent (8.4). Each is specified by its trigger, channels (WhatsApp, email, Slack, web chat), what it reads, what it writes to the CRM, its human gate, and a binding "never" list. The agents classify inbound correspondence, extract intake fields, draft outreach, maintain engagement stages and track referrals — but people decide and release: no NDA signing, no automatic outreach, no auto-onboarding.

## Build status

**Not built — 0 of 4 agents exist.** (Source: comparative analysis §8, "0 of 4 built; `ai.ts` holds read-only heuristic stubs".)

What does exist:

- `src/server/services/ai.ts` contains four read-only heuristic helper functions, each marked `// SEAM: replace body with Lua (Data API semantic search / LuaTool)`. These are placeholders with stable signatures, not agents — no triggers, no channel listeners, no classifiers, no agent-authored writes.
- The **data and guard substrate** the agents would drive is in place and richer than at the first audit: engagement stages, the NDA guard, disbursement tracking, an append-only stage-history audit trail, and overdue-task escalation flags.
- Per-agent nearest manual equivalents:
  - *Investor Agent (8.2):* heuristic investor↔mandate matching (`aiMatchInvestors`) surfaced by a button on mandate detail.
  - *Investor Tracker Agent (8.3):* the Engagement record, stage board, and disbursement table exist; a human moves stages. No scheduled follow-up checks.
  - *Referral/Partner Agent (8.4):* the partner portal referral form creates real mandates — a manual stand-in for channel capture.
  - *Client Agent (8.1):* nothing; the closest surface is manual communication logging on client detail.

This remains on the roadmap tracker (`memory/remaining-tasks.md`) under larger builds.

## See it in the app

There is no agent to see. The nearest related surfaces:

1. Log in at `http://localhost:3000/login` with `jane@noblestride.co` (any password) to enter the admin CRM.
2. Go to `http://localhost:3000/mandates`, open any mandate, and click **Match Investors** — this runs the heuristic stub that a real Investor Agent would replace. You get a ranked list of fitting investors; nothing is sent anywhere.
3. Go to `http://localhost:3000/dashboard` — the AI insight cards at the top are read-only outputs of the same stub family.
4. For the Investor Tracker Agent's territory, open `http://localhost:3000/engagement` — the stage board and disbursement table are the records the agent would maintain; today every change is human-made.
5. For the Referral Agent's territory, use the topbar **Viewing as** switcher to select a partner lens, then go to `http://localhost:3000/portal/partner/refer` and submit a referral — it creates a real mandate, manually.

## Key source files

- `src/server/services/ai.ts` — the four heuristic stubs with `SEAM` markers (the intended Lua replacement points)
- `src/components/crm/match-investors-button.tsx`, `src/components/crm/find-prospects-button.tsx` — UI over the stubs
- `src/components/crm/overview-insights.tsx`, `src/components/crm/overview-agent-card.tsx` — dashboard insight cards
- `src/server/domain/ranking.ts` — the matching heuristic itself
- `src/app/portal/partner/refer/submit-referral.ts` — manual stand-in for the Referral Agent's capture duty
