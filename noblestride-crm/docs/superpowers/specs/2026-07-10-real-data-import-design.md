# Real-Data Import — Design Spec

**Date:** 2026-07-10
**Status:** Approved (design), implementing local-first
**Author:** Shaurya + Claude

## Problem

The deployed app shows placeholder-looking data: every investor engagement sits at
stage `Shared`, every client at status `Prospect`. Investigation showed the investor
**engagement funnel is 100% synthetic seed** — and **no spreadsheet records per-investor
per-deal stages**, so it cannot be made "real". However, real structured data does exist
for **investors, investor contacts, referral partners, and law firms**, and is currently
either not imported or only partially seeded.

## Goal

A "full real-data pass": replace/enrich synthetic entities with real data from the
`decrypted/` spreadsheets, **local DB first**, production later behind explicit approval.

## Scope

| Piece | Source | Action |
|---|---|---|
| **A. Investors** | Investor Tracker → `Contacts VC PE DFI` (85 firms) | Upsert by normalized name. 34 match existing seed → enrich (do NOT overwrite `engagementClassification`/`ndaStatus`). ~51 new → create. **No deletes** (preserves demo engagements). |
| **A2. Investor contacts** | same sheet (688 person rows) | Forward-fill firm name; create `Person` per named row (name, role parsed from "Name - Role", email, phone). Dedupe against existing by normalized name/email per investor. First per firm → `isPrimary`. |
| **F. Partners / referees** | Engagement Tracker → `Source/Referee` col (~130 real values) | Clean (drop internal staff + status noise), dedupe, classify `advisorType` (firm keywords → AdvisoryFirm/Consultant; else Other), `internalOnly=true`, link `referredMandates` to the client's mandate. Merge with seed partners by name. |
| **B. Service Providers** | Investor Tracker → `Law Firms` sheet (49) | Create `ServiceProvider(type=LawFirm)` + contacts + profile/amount/status. Dedupe by name. |

### Explicitly NOT changing (user decisions)
- **Engagement funnel** stays synthetic → **marked "Demo data"** on By-Deal / By-Investor screens (small badge + tooltip).
- **Client status** stays `Prospect`.
- **Investor-preference .docx** are blank templates (no per-investor data) → nothing to import; real preference signal comes only from the Investor Tracker focus columns (piece A).

## Data-mapping rules (best-effort, raw text preserved)

- **Firm/partner/law-firm names**: clean — take text before first newline, collapse whitespace, strip trailing "LEFT"/address noise.
- **Sector focus** (prose, 167 distinct): keyword map → `Sector[]` (microfinance/financial→FinancialServices, tech/fintech/ICT→Technology, agri→Agribusiness, energy→Energy/RenewableEnergy, health→Healthcare, manufactur→Manufacturing, …). Store full raw text in `investmentMandate`/`notes` so nothing is lost.
- **Geographic focus** (sparse, ~5 values): East Africa→EastAfrica; South Africa→SouthernAfrica; Africa→PanAfrica; Global→Global.
- **InvestorType** (no column): infer from name (Ventures→VentureCapital; IFC/Norfund/FMO/CDC/Proparco/DFI-style→DFI; Bank→DebtProvider; Capital/Partners/Fund→PrivateEquity) else default PrivateEquity.
- **Contact role**: split "Name - Role" on first `-`/`–`.
- **Partner advisorType**: name contains Advisory/Advisors→AdvisoryFirm; Consult/Accountants→Consultant; Law/Advocates/LLP→Lawyer; else Other. Individuals (no firm keyword) → Other with `internalOnly=true`.
- **Referee noise filter**: drop values matching internal staff first-names (Amos/Ken/Duncan/Brenda/Cliff/James/Evans/Sheilla/Joel/Irine/Muriuki/Joseph) and status words (Dropped/On hold/Completed/To small/Too small/Startup/N/A/Closed/Drop/Completed).

## Architecture

Extend the existing, proven two-step pipeline (idempotent, re-runnable):

1. **`scripts/parse-real-data.py`** — add `parse_investors()`, `parse_investor_contacts()` (grouped),
   `parse_service_providers()`, `parse_partners()`. Extend `real-data.json` with
   `investors`, `serviceProviders`, `partners` keys (existing `mandates`, `tasks` untouched).
2. **`scripts/import-real-data.ts`** — add upsert-by-normalized-name for investors (+contacts),
   service providers (+contacts), partners (+`referredMandates` links). Owns only these entities;
   no blind deletes; safe to re-run.

## Safety

- Local Docker Postgres only (`localhost:5544`); prod `DATABASE_URL` lives in Vercel, not referenced here.
- Verified: nothing local can reach prod unless a prod URL is manually pasted into the shell.
- Production run deferred until explicit go-ahead + connection string.

## Verification

- Run parse + import against local; assert counts (investors ≈ 85, contacts grow, partners grow,
  serviceProviders ≈ 49) and no orphaned/duplicated records.
- Playwright pass at the end: Investors list shows real firms with contacts; Partners list shows
  real referees tagged internal-only; Service Providers shows law firms; Engagement screens show
  the "Demo data" badge.
- Leave working tree dirty; commit only on explicit go-ahead.
