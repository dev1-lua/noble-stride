# Test artifacts left in the dev DB (2026-07-07)

While testing the live write paths I created/modified real rows in the seeded dev database.
None of this touches source code — it's all data — but you may want to reset the seed
(`pnpm db:reset && pnpm seed`) before a clean demo, or delete these individually.

## Records created
| Entity | Value | Where created | Notes |
|--------|-------|---------------|-------|
| Investor | **QA Test Capital** (`cmrah1th6000095q0bbhtp1bo`), contact `qa.tester@qatestcapital.com` | `/register` flow | Registered, OTP-verified, then **Approved** via CRM. Now an active/approved investor with 0 matching deals. |
| Client | **QA Referral Co** (`cmrahae2p000995q0wgfjjt5u`) | Partner "Submit Referral" (as African Legal Network) | Created a linked Mandate "QA Referral Co – Referral" and bumped African Legal Network's funnel to 3 introduced. |
| Task | **"QA test task - please ignore"** (owner Amos, source Email, deadline 2026-07-31) | `/tasks` → New Task | No linked record. |

## Records modified
| Entity | Change | Where |
|--------|--------|-------|
| Investor **IFC** | Investment Mandate text set to `"QA test: Growth-stage equity/debt in East African healthcare and agribusiness."` | Investor portal Fund Profile → Save |
| Partner **African Legal Network** | Phone changed to `+254-700-999888` | Partner portal My Details → Save |
| Investor **QA Test Capital** | Onboarding status `Pending Review → Approved` | CRM investor detail → Approve |

## Also worth knowing
- The `?interest=sent` express-interest request on "Project Amber Harrier" (as IFC) may have logged a request/activity — check the engagement/activity log if you want it clean.
- Pre-existing test junk was already in the DB before I started (`asd`, `abc23`, `test2`, `Test1`, `E2E Probe Capital`, `Gate Check Capital`, `Meridian Frontier Capital`, and the `E2E …` change-history entries). Those are not mine — see BUG-15.

---

## 2026-07-08 — SDD run verification pass

**No new DB test artifacts created.** The Task-19 Playwright pass was **read-only** — navigation + screenshots only (`/home`, `/home?help=journey`, `/deals?type=mandate`, a mandate detail, `/intake`). No records were created, edited, or deleted. Automated smoke tests (`vitest`) create their own `__notif_*` / `ZZ Test…` rows and self-clean in `finally` blocks per project convention. The 2026-07-07 artifacts above still stand — reset the seed before a clean demo if desired.
