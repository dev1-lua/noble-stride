# §9. WhatsApp correspondence integration

**Spec (Build Specification §9):** Connect to Noblestride's existing WhatsApp workflows, classify inbound messages, and route the relevant ones into the CRM. Six mapping rows are specified: deal-status updates write to Deal + Communication; client/investor updates log against the right deal; task assignments in chat create linked Tasks; deal mentions route to the deal manager's queue; overdue deadlines flag and escalate; data/status requests open tracked workflows. §9.1 lists what must never be automated from WhatsApp (internal discussions, sensitive conversations, pre-introduction investor requests, initial outreach, advisor deal-sharing, commercial negotiation).

## Build status

**Not built.** No WhatsApp webhook, API client or message parser exists anywhere in the codebase. All six mapping-table rows are missing. (Source: comparative analysis §9, "nothing beyond a manual source tag".)

What does exist is the **receiving substrate**, built so the integration can land later without schema work:

- `Communication.channel` picklist includes `WhatsApp` (exact six spec values) — but it is set by hand.
- `Task.source` picklist includes `WhatsApp` — also set by hand.
- The overdue-task escalation flag (`escalated`, auto-set by a sweep) covers the "overdue / missed deadline" row's downstream half.
- The §9.1 never-automated list has no enforcement layer yet; nothing prevents a naive future integration from violating it.

Tracked in `memory/remaining-tasks.md` under larger builds (channel capture).

## See it in the app

Nothing automated to see. The manual stand-ins:

1. Log in at `http://localhost:3000/login` as `jane@noblestride.co` (any password).
2. Open any client at `http://localhost:3000/clients` (or a mandate/investor detail page) and use **Log Communication** — pick channel **WhatsApp**, direction, and a summary. This writes the same Communication record the integration would write, by hand.
3. On the resulting timeline entry, click **+ Task** — this is the manual version of the "task assigned in chat → linked task" mapping row.
4. Go to `http://localhost:3000/tasks` — create a task with source **WhatsApp**; tasks past their deadline show the auto-set overdue/escalated flag (spec row 5's downstream behavior).
5. There is no inbound webhook endpoint; no incoming message will ever appear on its own.

## Key source files

None implement the integration itself. Substrate:

- `src/server/services/activities.ts` — generalized `logActivity` with channel + direction, links to any record
- `src/components/crm/log-engagement-dialog.tsx`, `src/components/crm/activity-timeline.tsx` — manual logging UI and timeline with per-activity "+ Task"
- `src/server/services/tasks.ts` — task CRUD, `TaskSource` picklist, `flagOverdueTasks()` escalation sweep
- `prisma/schema.prisma` — `CommChannel` / `TaskSource` enums ready to receive structured inbound
