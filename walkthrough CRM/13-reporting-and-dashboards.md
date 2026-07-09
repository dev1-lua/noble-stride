# §13. Reporting and dashboards

**Spec (Build Specification §13):** Seven dashboard views: Pipeline overview (active vs inactive, by lead / transaction type / sector / ticket-size band), Deal status (stage distribution + stage history), Investor engagement (deals under review / rejected / invested per investor, historical summary), Disbursement (total / disbursed / pending by deal, investor, year, quarter), Referrals & partners (deals introduced, status, conversion funnel), Team & tasks (deal load, task status by owner, overdue actions), and Advisory (by type, KES value, lead, milestone).

## Build status

**Largely built — all non-advisory views exist.** (Source: comparative analysis §13, verdict "🟡→✅".) Two spec-gap passes added the groupings row by row; the only remaining marks are:

- **Advisory dashboard: not built, correctly** — Advisory Engagement is an optional add-on outside committed PoC scope.
- **Deal-status distribution is keyed to the internal kanban stage vocabulary**, not the spec's §4.4 stage list (a client-vocabulary question, not a build gap).

Beyond spec: an Investor Onboarding stat group, a 6-month pipeline trend chart, and AI insight cards.

## See it in the app

1. Log in at `http://localhost:3000/login` as `jane@noblestride.co` (any password).
2. Go to `http://localhost:3000/dashboard`. Working top to bottom you can find each spec view:
   - **Pipeline overview** — stat cards with the active-vs-inactive split, plus breakdowns by lead, financing type, sector, and ticket-size band, and the pipeline trend chart.
   - **Deal status** — stage distribution plus the "Recent Changes" stage-history feed and transition counts (fed by the append-only audit trail).
   - **Investor engagement** — per-investor rollup table (under review / rejected / invested), invested/completed totals, and the historical year/quarter outcome table.
   - **Disbursement** — total / disbursed / pending, with the year-and-quarter grouped summary.
   - **Referrals & partners** — per-partner introduced → progressed → won/lost conversion funnel.
   - **Team & tasks** — deal load by team member, task-status-by-owner cross-tab, and overdue actions (driven by the escalation flag).
3. Go to `http://localhost:3000/mandates` and `http://localhost:3000/transactions` — kanban boards give the visual pipeline-stage view; segment tiles at the top of list pages give quick slice counts.
4. Go to `http://localhost:3000/engagement` — the per-investor disbursement table underlying the disbursement dashboard.
5. There is no Advisory view anywhere; that is expected (optional scope).

## Key source files

- `src/server/services/dashboard.ts` — all dashboard aggregation queries (pipeline groupings, disbursement by year/quarter, investor rollups, conversion funnels, team workload)
- `src/app/(crm)/dashboard/page.tsx` — the dashboard page composing the panels
- `src/components/crm/deal-analytics-panels.tsx` — pass-2 analytics (change feed, investor rollup, historical outcomes, funnel)
- `src/components/crm/pipeline-breakdown.tsx`, `pipeline-chart.tsx`, `stat-row.tsx`, `team-tasks-panel.tsx` — panel components
- `src/components/crm/kanban-board.tsx`, `segment-row.tsx` — boards and list-page segment tiles
- `src/lib/ticket-bands.ts` — ticket-size banding reused by the pipeline grouping
- `src/server/services/stage-history.ts`, `src/components/crm/stage-history.tsx` — the audit trail behind the stage-history view
