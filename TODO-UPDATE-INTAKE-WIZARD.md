# **⚠️ WARNING: THE `/intake` WIZARD MUST BE UPDATED TO THE SOW §10.1 FIELD SET ASAP ⚠️**

**THE PUBLIC `/intake` FORM IS OUT OF SYNC WITH THE SIGNED SOW (§10.1) AND WITH THE NEW WEBSITE INTAKE & QUALIFICATION AGENT. THIS MUST BE ADDRESSED AS SOON AS POSSIBLE.**

_Created 2026-07-20 during the Website Intake & Qualification Agent build (SOW §10). The agent path was brought fully up to spec; per the scoping decision, the wizard was deliberately left untouched this pass._

## What's wrong with the wizard today

The wizard (`noblestride-crm/src/app/intake/` + `src/lib/schemas/intake.ts`) still uses the legacy field set:

1. **Wrong requiredness** — it hard-requires fields the SOW marks optional or doesn't list at all: registration number, phone, revenue, EBITDA, net profit, total assets, audited years, use of funds, timeline, ownership summary. §10.1 requires none of these; missing financials should land as `NeedsReview`, not block submission.
2. **Missing §10.1 REQUIRED fields**: HQ city, countries of operations (multi-select — it collects a single region), core product/service, description, founders' gender, founders' nationality, target clients, **NDA acceptance**.
3. **Missing §10.1 optional fields**: expected post-money valuation, raised to date (current round), raised to date (since inception), existing investors, revenue forecast, profitability, origination source, notes.
4. **No Mezzanine instrument** — it offers Debt/Equity/Both; §10.1 is debt/equity/mezzanine (multi-select).

## The reference implementation (already built and tested)

The agent path is the source of truth for the §10.1 field set — migrate the wizard onto it:

- Schema: `noblestride-crm/src/lib/schemas/website-intake.ts` (`websiteIntakeSchema`)
- Pipeline: `noblestride-crm/src/server/onboarding/submit-website-intake.ts` (`submitWebsiteIntake`)
- Service wrapper (dedupe + bare ack): `submitWebsiteClientIntake` in `src/server/services/client-intake.ts`
- GraphQL: `submitWebsiteIntake` mutation / `WebsiteIntakeInput` in `src/graphql/`
- Tests: `src/server/onboarding/__tests__/submit-website-intake.smoke.test.ts`

## When the wizard migrates

Retire the legacy path entirely: `intakeSchema`/`intakeSubmitSchema` (`src/lib/schemas/intake.ts`), `submitIntake` (`src/server/onboarding/submit-intake.ts`), the `submitClientIntake` mutation + `ClientIntakeInput`, and the old `client_agent`'s `SubmitIntakeTool` — the new `website_intake_agent/` supersedes it on the public site.
