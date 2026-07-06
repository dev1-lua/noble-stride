# §5. Sector taxonomy

**Spec (Build Specification §5):** An 18-value operational sector picklist at deal and company level (Agribusiness through Water & Sanitation), plus a second-level sub-sector picklist configured from NobleStride's sector document (e.g. Financial Services → Insurance, Banks, Microfinance; Technology → Fintech, Edtech, Agritech). The spec also notes that real estate, oil & gas, mining, alcohol, tobacco and gambling are excluded sectors for qualification (§11) — Real Estate stays in the list only because legacy advisory records reference it.

## Build status

Partially built. 16 of the 18 spec sectors are now exact (Energy was added and the "Retail & FMCG" label corrected in the spec-gap pass). Deviations:

- One extra top-level value, `Banking`, remains — pending client confirmation (client question 9).
- **Sub-sector taxonomy: not built** — depth is a client decision (memory/client-meeting-questions.md); no second-level picklist exists anywhere.
- **Restricted-sector screening: not built** — there is no qualification logic to screen out excluded sectors, because the §10 website intake and qualification agent is not built. Tracked in memory/remaining-tasks.md.
- Sector is a multi-select array in the build where the spec says single-select, and it is optional where the spec requires it (client question 11).

Source: comparative analysis §5.

## See it in the app

1. Sign in at `/login` as `jane@noblestride.co` (any password).
2. **Sector on a company:** go to `/clients`, open any client, click Edit — the Sector field is a multi-select over the taxonomy. Note there is no sub-sector field beneath it.
3. **Sector on a deal:** go to `/transactions` or `/mandates`, open a record, click Edit — the same sector list at deal level. Sector is not auto-inherited from the company (spec says "inherited, editable"); it is set independently.
4. **Sector as a matching input:** go to `/investors`, open an investor, click Edit — "Sector focus" uses the same taxonomy and drives mandate matching.
5. **Sector in reporting:** open `/dashboard` — the pipeline breakdown includes a deals-by-sector grouping.
6. **Sector in the investor portal:** switch the topbar "Viewing as" to an investor and open `/portal/investor` — the deal list is filtered by the investor's stored sector focus (automatic matching; the §11.1 investor-facing filter UI, including a sector filter, is not built).

## Key source files

- `prisma/schema.prisma` — the `Sector` enum (the taxonomy itself) and the `sectors` arrays on Client, Mandate, Transaction and Investor.
- `src/lib/vocab.ts` — sector display labels ("Retail & FMCG", etc.).
- `src/server/domain/filters.ts` and `src/server/domain/ranking.ts` — sector as a matching/filtering input for investor-deal fit.
- `src/server/services/dashboard.ts` — the by-sector pipeline grouping.
- `src/components/crm/client-form-drawer.tsx`, `investor-form-drawer.tsx` — the sector multi-selects.
