# §2. Entity catalogue and relationships

**Spec (Build Specification §2):** The system manages eleven record types: Company/Target (the central anchor), Deal/Mandate, Advisory Engagement (optional add-on, not committed PoC scope), Investor, Investor Contact, Referral/Partner, Service Provider, Task, Document, Communication, and the Investor-Deal Engagement link record. The relationship rules (§2.1) require every communication, document and task to tie back to a deal and every deal to a company; investor-to-deal links live in the Engagement record; and partner identity is internal-only, never exposed to investors.

## Build status

Built — 10 of the 11 entities are full CRM entities with list pages, form drawers and detail views. Mapping of spec names to built entities:

| Spec entity | Built as | Status |
|---|---|---|
| Company / Target | `Client` | Built (residual gap: sub-sector taxonomy) |
| Deal / Mandate | `Mandate` + `Transaction` | Built, split into two pipelines; kanban stage vocabulary still diverges from §4.4 (client question) |
| Advisory Engagement | — | Not built, correctly — spec-optional, pending discovery confirmation |
| Investor | `Investor` | Built (fullest entity) |
| Investor Contact | `Person` | Built, full CRUD via Contacts cards |
| Referral / Partner | `Partner` | Built |
| Service Provider | `ServiceProvider` | Built |
| Task | `Task` | Built, full CRUD with overdue escalation |
| Document | `Document` | Built as a register; file upload/storage deferred — tracked in memory/remaining-tasks.md |
| Communication | `Activity` | Built (manual logging; WhatsApp/email ingestion is the unbuilt §9 integration) |
| Investor-Deal Engagement | `Engagement` | Built, near-exact §3.11 match |

Relationship rules hold: deal-to-company anchoring, engagement link records, and partner internal-only (never projected to investors) are all enforced.

## See it in the app

1. Sign in at `/login` as `jane@noblestride.co` (any password) to get the admin lens.
2. Walk the sidebar in order — one page per entity:
   - `/clients` — Company/Target. Open a client to see the anchor role: mandates, contacts, documents, tasks and the activity timeline all hang off it.
   - `/mandates` — the client-acquisition side of Deal/Mandate, shown as a kanban board. Open one for detail.
   - `/transactions` — the fundraising-execution side of Deal/Mandate.
   - `/investors` — capital providers. Open one to see its Contacts card (Investor Contact / `Person` records) with add/edit/delete.
   - `/engagement` — the Investor-Deal Engagement link records, including the disbursement table.
   - `/partners` — Referral/Partner records with fee-sharing and internal-only flags.
   - `/service-providers` — the new-versus-trackers Service Provider record type.
   - `/documents` — the document register with types and access levels.
   - `/tasks` — action items with source, owner, deadline and escalation.
3. Communication: open any client, investor or transaction detail page and find the **Activity timeline** — each logged entry is a Communication record with channel and direction.
4. Partner internal-only rule: switch the topbar "Viewing as" to any investor and open a deal at `/portal/investor/deals/[id]` — no partner or consultant identity appears anywhere.

## Key source files

- `prisma/schema.prisma` — all eleven entity models and their relations.
- `src/server/services/` — one CRUD service per entity (`clients.ts`, `mandates.ts`, `transactions.ts`, `investors.ts`, `engagements.ts`, `partners.ts`, `service-providers.ts`, `tasks.ts`, `documents.ts`, `activities.ts`, `persons.ts`).
- `src/app/(crm)/` — one route directory per entity list/detail page.
- `src/components/crm/contacts-card.tsx` — Investor Contact management on detail pages.
- `src/components/crm/activity-timeline.tsx` — the Communication surface.
