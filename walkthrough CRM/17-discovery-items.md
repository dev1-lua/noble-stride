# §17. Items to confirm together in discovery

**Spec (Build Specification §17):** A short list of eight decisions to lock in during the discovery workshop. None block the start of configuration; they refine specific pieces of the build: (1) Advisory work in or out of PoC scope; (2) final picklist values and the team-member (User) list; (3) Term Sheet Deals disbursement semantics; (4) the full investor field set and which fields are required; (5) sub-sector taxonomy depth; (6) API/admin access per system (SharePoint, Outlook, WhatsApp); (7) the access coordinator (Evans Wesonga / Solomon named as candidates); (8) Open vs Closed NDA handling in visibility.

## Where this stands

All eight items remain open — none has been confirmed with the client. Where the build could not wait, it proceeded on a documented assumption, tracked as a numbered question in `memory/client-meeting-questions.md`:

| §17 item | Status / tracker cross-reference |
|---|---|
| 1. Advisory in/out of PoC | Open — **Q14**. Currently *not* built (correct per spec default). |
| 2. Final picklists & User list | Open — overlaps **Q7** (deal-stage vocabulary), **Q9** (sector list cleanup), **Q10** (deployment-status vocabulary conflict), **Q11** (sector single- vs multi-select). User list not yet set. |
| 3. Term Sheet Deals semantics | Open — disbursement tracking is built on the Engagement entity; finer points unconfirmed. No tracker question yet. |
| 4. Full investor field set | Open — **Q1**. Assumption in force: all registration and fund-profile fields mandatory. Related: **Q4** (investor-type dropdown), **Q5** (ticket-band boundaries), **Q12** (required-field enforcement on legacy imports). |
| 5. Sub-sector taxonomy depth | Open — touches **Q9** (Banks as a Financial Services sub-sector once sub-sectors land). |
| 6. API/admin access per system | Open — no integrations connected yet, so nothing has forced the question. |
| 7. Access coordinator | Open — candidates named in the spec, not confirmed. |
| 8. Open vs Closed NDA in visibility | Open — **Q2**. Assumption in force: Open NDA can be granted access to any data room (each behind internal approval); Closed NDA covers exactly one target. |

Additional open questions not on the §17 list but queued for the same workshop: **Q3** (teaser anonymization pre-NDA), **Q6** (masking of declined deals), **Q8** (country- vs region-level geography), **Q13** (derived vs stored teaser/IM/model status), **Q15** (landing-page copy and the team-login rule).

## See it in the app / in the repo

- `memory/client-meeting-questions.md` — the canonical numbered list (Q1–Q15).
- `docs/SOW.md` §17 — the spec's own table.
- To see the assumptions live: `/register` (investor-type dropdown, ticket bands — Q4/Q5); "Viewing as" → an investor without an NDA → `/portal/investor` shows codename-masked teasers (Q2/Q3); `src/lib/ticket-bands.ts` for the assumed band boundaries.
