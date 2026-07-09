# §15. Deliverables

**Spec (Build Specification §15):** Lists nine deliverables for the engagement: a signed-off discovery & configuration brief; the configured CRM (entities, relationships, audit trails, picklists, tagging); four deployed agents (Client, Investor, Investor Tracker, Referral/Partner); WhatsApp integration; a website intake & qualification agent; investor deal visibility; reporting dashboards; access controls & DPA configuration; and onboarding & handover.

## Where this stands

Deliverable-by-deliverable, against the demo build (mirrors §14 of `docs/CRM-VS-BUILD-SPEC-COMPARATIVE-ANALYSIS-2026-07-06.md`):

| §15 deliverable | Status |
|---|---|
| Discovery & configuration brief | Done as in-repo docs (SOW extraction, comparative analysis, open-question tracker); not yet a client-signed brief. |
| Configured CRM | Mostly done — all core entities, picklists, tagging, contact CRUD, stage/identifier audit trail and immutability. Real authentication and enforced in-org RBAC still pending. |
| Four deployed agents | Not built. |
| WhatsApp integration | Not built. |
| Website intake & qualification agent | Not built for *companies* (§10's target). The build does have investor self-registration at `/register`, which exceeds spec in a different direction. |
| Investor deal visibility | Done — visibility engine with NDA/interest gates and pre-NDA codename masking. |
| Reporting dashboards | Done — all non-advisory §13 views. |
| Access controls & DPA configuration | Partial — external-role confidentiality gates plus the full §7.1 audit + immutability slice are done; in-org RBAC and full DPA configuration pending. |
| Onboarding & handover | Partial — documentation exists in-repo; team walkthrough and PoC support setup pending. |

The build also exceeds spec in several places (investor approval queue, working investor and partner portals, document review chain, real-data import) — see §15 of the comparative analysis.

## See it in the app / in the repo

- **Configured CRM:** http://localhost:3000/login → `jane@noblestride.co` (any password) → admin CRM. Work through `/clients`, `/mandates`, `/transactions`, `/investors`, `/engagement`, `/partners`, `/service-providers`, `/documents`, `/tasks`, `/access-matrix`.
- **Investor deal visibility:** topbar "Viewing as" switcher → an investor → `/portal/investor`; masking/gating logic lives in `noblestride-crm/src/server/visibility/`.
- **Reporting dashboards:** `/dashboard` (admin lens).
- **Access controls:** `/access-matrix` for the role/gate matrix.
- **Status source of truth:** `docs/CRM-VS-BUILD-SPEC-COMPARATIVE-ANALYSIS-2026-07-06.md` §14–16.
