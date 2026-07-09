# §16. Approach and timeline

**Spec (Build Specification §16):** The implementation runs 4–6 weeks from the Effective Date, inside the 3-month Proof of Concept defined in Appendix A of the Enterprise Agreement. Three phases: Discovery & scoping (weeks 1–2, validate the data model and workflows, confirm the §17 open items, set the access matrix and integrations); Build & configuration (weeks 2–5, configure the CRM, build the agents, WhatsApp/website integrations, visibility and access controls); Deployment & onboarding (weeks 5–6, deploy, load data, team walkthrough, begin the PoC). The PoC then runs on live operations for months 1–3.

## Where this stands

The demo build front-loaded most of the *Build & configuration* phase before formal discovery:

- **Phase 1 (Discovery):** not yet run as a workshop. The inputs are ready — the extracted spec (`docs/SOW.md`), a full gap analysis, and a numbered open-question list (`memory/client-meeting-questions.md`, 15 items) that maps onto the §17 discovery agenda.
- **Phase 2 (Build):** the CRM-configuration slice is substantially built (entities, picklists, audit, visibility, dashboards, portals). The agent/WhatsApp/website-integration slice of phase 2 is not started — those are the "larger builds" on the roadmap.
- **Phase 3 (Deployment & onboarding):** partially anticipated — real client data is already imported (106 mandates / 104 clients / 387 tasks), and this walkthrough documentation set is the start of the handover material. Team walkthrough and PoC support setup are pending.
- **PoC period:** not started; the app currently runs on a demo viewpoint lens rather than real authentication (`memory/remaining-tasks.md`), which must land before live operations.

Net effect: when discovery happens, it validates against a working system rather than a blank page, and the weeks 2–5 build effort concentrates on agents, integrations, and auth.

## See it in the app / in the repo

This is a process section — the artifacts are in the repo, not on an app screen:

- `docs/SOW.md` §16 — the spec's phase table.
- `docs/CRM-VS-BUILD-SPEC-COMPARATIVE-ANALYSIS-2026-07-06.md` §16 "What to do next" — done / still-open / roadmap / needs-client-input breakdown.
- `memory/remaining-tasks.md` — deferred work that gates the PoC (auth, OTP, file storage, e-signing).
- `.superpowers/sdd/progress.md` — running build-progress ledger.
- `docs/NobleStride-Update-Email-2026-06-26.md` and `docs/NobleStride-Update-Email-2026-07-03.md` — client-facing progress snapshots.
