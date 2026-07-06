# §18. Roles and responsibilities

**Spec (Build Specification §18):** Splits responsibilities across six areas. Lua runs discovery workshops, configures the platform, builds the agents, specifies required system access, structures and loads data, builds approval routing, and provides PoC support per the SLA (Appendix B). Noblestride provides detail and signs off the brief, confirms configuration decisions, nominates an access coordinator and provides timely API/admin access, supplies trackers/files/templates and confirms data quality, makes all approval and release decisions, and raises issues via the designated contact. Designated contacts: Lua — Lorcan O'Cathain (lorcan@heylua.ai); Noblestride — Evans Wesonga, CEO (evans.wesonga@noblestride.co.ke).

## Where this stands

- **Lua side:** the build/configuration and data-structuring responsibilities are demonstrably in motion — the CRM is configured and the client's real trackers are imported (106 mandates / 104 clients / 387 tasks). Discovery workshops and the agent builds have not started.
- **Noblestride side:** every client responsibility is still pending a kickoff — no signed-off brief, no confirmed configuration decisions (the 15 open questions in `memory/client-meeting-questions.md`), no nominated access coordinator (§17 item 7), and no API/admin access provided (§17 item 6). Source trackers *were* provided and drove the data import.
- **Approvals in the product:** the spec's principle that Noblestride makes all approval and release decisions is already modeled — investor registrations land in a PendingReview→Approved queue, and data-room access sits behind internal approval even with an Open NDA.
- **SLA/support:** Appendix B support setup is part of the pending onboarding & handover deliverable (§15).

## See it in the app / in the repo

- Approval flows (Noblestride's "approval & release decisions" made concrete): admin lens → `/investors` (registration approval queue) and `/access-matrix` (who sees what); investor side via "Viewing as" → `/portal/investor`.
- `docs/SOW.md` §18 — the responsibilities table and designated contacts.
- `memory/client-meeting-questions.md` — the decisions currently waiting on the Noblestride side of the table.
- `docs/NobleStride-Update-Email-2026-07-03.md` — the reporting channel toward the designated contact in practice.
