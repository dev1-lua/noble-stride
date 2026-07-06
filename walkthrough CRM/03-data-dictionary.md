# §3. Data dictionary

**Spec (Build Specification §3):** Eleven field-by-field tables (§3.1–§3.11) define every entity's fields, types, required flags and controlled values, using NobleStride's existing spreadsheet column names so the mapping from the current trackers is one-to-one. Picklist values are defined in §4. Advisory Engagement (§3.3) is explicitly optional and outside committed PoC scope.

## Build status

Mostly built. After two spec-gap implementation passes, the Company (§3.1) and Deal (§3.2) field gaps — the biggest pre-implementation misses — are closed; the Engagement record (§3.11) is a near-exact match with a full edit surface. Residual gaps: sub-sector taxonomy (client decision), document file upload/storage (deferred — tracked in memory/remaining-tasks.md), and a handful of vocabulary items awaiting client confirmation (deal stage, deployment status). Per-entity detail below. Source: comparative analysis §3.

## §3.1 Company / Target → Client

Was the weakest entity; now largely complete (~19 of 28 fields exact). Codename is stored separately from legal name, financials (revenue, EBITDA, debt, loan book, assets), founders' gender multi-select, impact flags, profitability picklist and years-of-operation derivation are all in. Remaining: sub-sector (not built — client question) and single-vs-multi sector.

**See it:** `/clients` → open any client → "Edit" drawer shows the full field set; the detail page shows derived years of operation and the primary contact from the Contacts card.

## §3.2 Deal / Mandate → Mandate + Transaction

The spec's one entity is split into two pipelines: `Mandate` (client acquisition) and `Transaction` (fundraising execution). Deal type, deal status, deal milestone, max selling stake, target profile, use of funds, VDR link, referrer and deal-level probability are all present. `dateOpened` and `source` are immutable once set (§7.1). Gaps: ticket size and deal lead are optional where the spec requires them; the kanban stage vocabulary still diverges from §4.4 (client question).

**See it:** `/mandates` (kanban) and `/transactions`; open a detail page and its edit drawer. Note the disabled Date opened / Source fields once set.

## §3.3 Advisory Engagement

Not built — correctly. The spec marks it optional and outside committed PoC scope (§17 item 1, §19.2); inclusion is a client decision.

## §3.4 Investor → Investor

Strong. All matching inputs (sector/geographic focus, ticket min/max, instruments), NDA status, engagement classification (drives visibility), next action date, feedback and the SSA-region contact are present. Minor divergences: some spec-required fields are optional in the admin path, and deployment-status vocabulary awaits client confirmation.

**See it:** `/investors` → open an investor → edit drawer for the full profile; SSA-region contact and classification on the detail page.

## §3.5 Investor Contact → Person

Complete with full CRUD. At-least-one-parent and one-primary-per-parent rules are enforced server-side; primary-contact reassignment is audited.

**See it:** the **Contacts** card on any client, investor or partner detail page — add, edit, delete, set primary, set SSA flag.

## §3.6 Referral / Partner → Partner

All spec fields: advisor type, fee-sharing agreement and terms, NDA/partner agreement status, internal-only (default true). Deals-introduced is settable only from the mandate side.

**See it:** `/partners` → open a partner; or switch "Viewing as" to a partner and visit `/portal/partner/refer` to submit a referral that creates a real mandate.

## §3.7 Service Provider → ServiceProvider

All nine fields; type enum exact; transaction linking writable via a multi-select in the transaction drawer.

**See it:** `/service-providers` for the list; `/transactions/[id]` for the Service Providers card on a deal.

## §3.8 Task → Task

Full CRUD with the exact §4.11/§4.12 picklists, assistant field, and an automatic overdue escalation flag that self-clears. Linked record and owner are optional where the spec requires them.

**See it:** `/tasks` → "New task"; escalated (overdue) tasks are flagged in the list and on `/dashboard`.

## §3.9 Document → Document

The register is built: type picklist (superset), version, access level (exact four values, enforced by the visibility engine), status, mandate/client/investor links, and a review chain beyond spec. **File is still an optional URL — no upload/storage.** Not built — tracked in memory/remaining-tasks.md (explicitly deferred pending an infrastructure choice).

**See it:** `/documents`; also the Documents card on `/mandates/[id]`.

## §3.10 Communication → Activity

Complete for manual logging: channel (exact six values), direction, required summary, any-record linking (enforced server-side), trusted logged-by, and create-task-from-communication. Automated ingestion from WhatsApp/email is the unbuilt §9 integration.

**See it:** open `/clients/[id]`, `/investors/[id]` or `/transactions/[id]` → Activity timeline → "Log activity"; use "+ Task" on an entry to spawn a linked task.

## §3.11 Investor-Deal Engagement → Engagement

The best entity — all 15 spec fields, exact 12-value stage order, NDA type, term sheet with date, total/disbursed/pending amounts (pending auto-derived), year/quarter auto-derived, and a full edit surface. Stage changes are audited and the restage control is NDA-guarded.

**See it:** `/engagement` → the disbursement table (per-row edit) → open an engagement detail page for the stage control, milestone checklist and edit drawer.

## Key source files

- `prisma/schema.prisma` — every model and enum.
- `src/lib/schemas/` — zod input schemas per entity (required-field enforcement).
- `src/server/services/` — CRUD services, including `persons.ts` (contact rules), `engagements-crud.ts`, `tasks.ts`, `activities.ts`.
- `src/components/crm/` — form drawers per entity (`client-form-drawer.tsx`, `engagement-form-drawer.tsx`, `task-form-drawer.tsx`, etc.) and `contacts-card.tsx`.
- `src/lib/vocab.ts` — picklist labels used across the forms.
