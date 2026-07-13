# Real-Data Import — Verification (2026-07-10)

Spec: `noblestride-crm/docs/superpowers/specs/2026-07-10-real-data-import-design.md`
Target: local Docker Postgres (localhost:5544). Production untouched.
Mode: SDD — Sonnet implemented, Fable reviewed the pipeline, controller verified. NOT committed.

## What was built
- `scripts/parse-real-data.py` extended: parses the Investor Tracker (firms + contacts),
  the Law Firms sheet (service providers), and the Engagement Tracker Source/Referee column
  (referral partners, noise-filtered), into `prisma/real-data.json`.
- `scripts/import-real-data.ts` extended: idempotent upsert-by-name for investors (+contacts),
  service providers, partners (+referredMandates links). Enrich = gap-fill only; never touches
  engagement classification / NDA / status / investorType on existing rows. No deletes.
- "Demo data" badge added to both engagement screens (the funnel has no real source).

## DB counts (before → after)
| Entity | Before | After |
|---|---|---|
| Investors | 43 | **95** |
| Persons (contacts) | 231 | **800** |
| Partners | 15 | **146** |
| Service Providers | 4 | **52** |
| Engagements (demo) | 61 | **61** (preserved) |
| Mandate referral links | — | 17 |

Import is idempotent: 2nd/3rd runs create 0 new rows. `tsc --noEmit` clean.

## Live Playwright checks (logged in as staff evans@noblestride.capital)
- **/investors** — "Showing all 95 investors"; real firms (AGRI-VIE, Abler Nordic, Abraaj,
  Activa Capital, Afrexim, AfricInvest…). PASS.
- **/partners** — "Showing 146 of 146"; real referees (Africapital, African Legal Network,
  Alfrick Murunga, Adam Kassaine…). PASS.
- **/service-providers** — "Showing 52 of 52"; real law firms with contacts + emails
  (Anjarwalla & Khanna, Ashitiva Advocates LLP, AF Mpanga, African Legal Network…). PASS.
- **/engagement/deals** and **/engagement/investors** — "Demo data" badge present with
  explanatory tooltip. PASS.
- Screenshot: `playwright assessment/2026-07-10-engagement-demo-badge.png`.

## Known data-hygiene items (from the SOURCE spreadsheets, not import bugs)
- A few investor/service-provider rows have a street address in the name column
  (e.g. "34 Lombard Road", "1st Floor, Wing B, Capitol Hill Square") — present in the
  original tracker (and prior seed). Optional source-side cleanup.
- Referral links are ~17, not >100: most `Source/Referee` client names have no matching
  Client row in the CRM (those companies were never imported), so there is nothing to link.
  Unmatched names are logged by the importer (`unmatchedReferralClients`), not dropped silently.

## Review status
- Pipeline (parser + importer): Fable review — Spec ✅, Code quality Approved; 1 Important
  (`\bbii\b/\bbio\b` raw-string) + 2 Minor fixed and re-verified functionally.
- Badge (Task 4): verified by inspection + live check (trivial `Badge` reuse, tsc clean).
