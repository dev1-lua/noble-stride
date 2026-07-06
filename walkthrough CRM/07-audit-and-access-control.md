# §7. Audit, immutability and access control

**Spec (Build Specification §7):** §7.1 requires that changes to protected fields keep the prior value, timestamp and user: core identifiers (legal names, registration details, primary contacts), deal creation date/source/ID (immutable), investor interest records, and every deal-stage change. §7.2 defines a role-based access matrix (Admin, Deal lead, Team member, Investor, Partner) with create/read/update rights per entity, enforced at the data layer, plus a hard rule: partner/consultant identity and other investors on a deal are never visible to any external role, and excluded/greylisted investors see nothing.

## Build status

Split verdict — §7.1 fully built, §7.2 partially.

- **§7.1 audit and immutability: built.** Every mandate/transaction/engagement stage and status change writes an append-only `StageChange` row (from→to, timestamp, actor). Core-identifier changes are audited too: client name and registration number, investor and partner names, and primary-contact reassignment. `Mandate.dateOpened`, `Mandate.source` and `Transaction.dateOpened` are locked once set (server-side error plus disabled edit fields); IDs are system cuids never exposed for edit.
- **§7.2 external-role gating: built.** The visibility engine enforces field-level gating, the partner-identity and other-investors hard rules, and excluded/greylisted blocking.
- **§7.2 in-org RBAC and real authentication: not built — tracked in memory/remaining-tasks.md.** The `/access-matrix` page renders the spec's role matrix but is display-only; GraphQL mutations carry no role checks; sign-in is a demo viewpoint-lens cookie with a hardcoded OTP, not real authentication.

Source: comparative analysis §7.

## See it in the app

### Flow 1 — Stage-change audit trail (§7.1)
1. Sign in at `/login` as `jane@noblestride.co` (any password).
2. Open a transaction at `/transactions/[id]` and change its stage or deal status. The **Change history** panel appends the from→to entry with timestamp and user.
3. Do the same on an engagement (`/engagement` → detail → restage): investor interest progression is audited the same way.
4. `/dashboard` includes a "Recent Changes" feed rolling up stage changes across all audited entities.

### Flow 2 — Identifier audit and immutability (§7.1)
1. Open a client at `/clients/[id]`, edit its legal name or registration number, save — the rename appears in the Change history panel with the prior value.
2. In the Contacts card, reassign the primary contact — also audited.
3. Edit a mandate at `/mandates/[id]`: Date opened and Source are disabled once set; the server rejects attempts to change them.

### Flow 3 — The role matrix (§7.2)
1. Go to `/access-matrix` — the spec §7.2 CRU matrix rendered per entity and role. Note honestly: this page documents the intended matrix; internal roles are not yet enforced at the data layer.

### Flow 4 — External-role enforcement (the part that is enforced)
1. Use the topbar "Viewing as" switcher to become an investor. On `/portal/investor` and a deal page, confirm: only fitting mandates, codenames pre-NDA, no partner identity, no other investors, VDR documents gated on NDA.
2. Switch to a partner: `/portal/partner` shows only their own referrals — no client financials, no investor data.
3. Set an investor's classification to Excluded (admin lens, `/investors/[id]`), then view as them: no opportunities at all.

## Key source files

- `prisma/schema.prisma` — the append-only `StageChange` model with mandate/transaction/engagement/client/investor/partner links.
- `src/server/services/stage-history.ts` — writing and reading audit rows.
- `src/components/crm/stage-history.tsx` — the Change history panels on detail pages.
- `src/server/services/mandates.ts`, `transactions.ts` — the dateOpened/source immutability guards.
- `src/components/crm/access-matrix.tsx` and `src/app/(crm)/access-matrix/` — the §7.2 matrix page (display-only).
- `src/server/visibility/` — the enforced external gating engine (`tiers.ts` for NDA tiers, `matrix.ts` for field-level rules, `codename.ts` for pre-NDA masking, `project.ts`/`load.ts` for safe projection).
- `src/server/viewpoint.ts` — the demo lens standing in for real authentication.
