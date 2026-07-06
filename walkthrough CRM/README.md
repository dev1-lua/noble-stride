# NobleStride CRM — Build Specification Walkthrough

One file per section of **"Lua x Noblestride — Build Specification (INTERNAL)"** (the 29-page SOW & Build Specification, v2.0 · 1 June 2026; full text extracted at `docs/SOW.md`). Each file summarises what the spec section requires, states honestly what is built, and gives exact click-paths to see it in the running app.

## Getting into the app

1. Start the app (usually already running): `cd noblestride-crm && pnpm dev` → http://localhost:3000
2. **There is no real authentication** — this is a demo. A viewpoint cookie (`ns_viewpoint`) decides which lens you see the CRM through:
   - **Admin (NobleStride team):** sign in at `/login` with any `@noblestride.*` email (e.g. `jane@noblestride.co`) and any password → lands on `/dashboard`.
   - **Investor:** sign in with a registered investor contact email (e.g. `amina@meridianfrontier.com` for the planted pending investor, or self-register at `/register` — demo OTP is `000000`) → lands on `/portal/investor`, gated by onboarding status.
   - **Partner:** sign in with a partner contact email → `/portal/partner`.
   - From any admin page, the topbar **"Viewing as"** switcher jumps straight into any investor's or partner's portal view; **Sign out** returns to the public landing page at `/`.

## Investor onboarding states (what an investor sees at sign-in)

| State | Screen |
|---|---|
| Pending review | "Registration under review" |
| Approved | Deal pipeline (`/portal/investor`) |
| Rejected | "Registration not approved" |
| Greylisted / Excluded / Inactive / On hold | "Portal access restricted" (neutral; spec §11.2 — these funds never see opportunities) |

Admins decide from `/investors/[id]` → Onboarding panel → **Approve / Reject / Greylist**.

## Sections

### Part I–II · Scope & data model
- [§1 Purpose and scope](01-purpose-and-scope.md)
- [§2 Entity catalogue and relationships](02-entity-catalogue.md)
- [§3 Data dictionary (all 11 entities)](03-data-dictionary.md)
- [§4 Controlled-value (picklist) library](04-picklist-library.md)
- [§5 Sector taxonomy](05-sector-taxonomy.md)
- [§6 Milestone framework](06-milestone-framework.md)
- [§7 Audit, immutability and access control](07-audit-and-access-control.md)

### Part III · Agents & integrations
- [§8 Agent specifications](08-agent-specifications.md)
- [§9 WhatsApp correspondence integration](09-whatsapp-integration.md)
- [§10 Website intake and qualification agent](10-website-intake-qualification.md)
- [§11 Investor deal visibility](11-investor-deal-visibility.md)
- [§12 Automation guardrails and escalation](12-automation-guardrails.md)

### Part IV · Reporting, delivery & commercial
- [§13 Reporting and dashboards](13-reporting-and-dashboards.md)
- [§14 Systems and integrations](14-systems-and-integrations.md)
- [§15 Deliverables](15-deliverables.md)
- [§16 Approach and timeline](16-approach-and-timeline.md)
- [§17 Items to confirm in discovery](17-discovery-items.md)
- [§18 Roles and responsibilities](18-roles-and-responsibilities.md)
- [§19 Assumptions and out of scope](19-assumptions-and-out-of-scope.md)
- [§20 Commercial terms](20-commercial-terms.md)
- [§21 Acceptance](21-acceptance.md)

## Related repo documents

- `docs/SOW.md` — the Build Specification full text (source of the section numbers used here).
- `docs/CRM-VS-BUILD-SPEC-COMPARATIVE-ANALYSIS-2026-07-06.md` — field-by-field gap analysis behind every "Build status" note.
- `memory/remaining-tasks.md` — deferred-work tracker (real auth, DocuSign, WhatsApp, agents…).
- `memory/client-meeting-questions.md` — open questions for NobleStride.
