# Playwright Assessment — living QA log for the NobleStride CRM

This directory is the **ongoing quality + requirements-conformance log** for the NobleStride Capital
CRM. It's driven by end-to-end Playwright walkthroughs of `http://localhost:3000`, cross-checked
against the two signed specs:
- `decrypted/Noblestride_Lua_Phase1_Client_SOW_ Signed.pdf` (client SOW)
- `decrypted/Lua x Noblestride - Build Specification (INTERNAL).pdf` (engineer spec)

**It is a living document.** As we fix bugs, close blockers, and build toward the client's
requirements, we update these files — mark items resolved, add new findings from each testing pass,
and keep the coverage map current. The goal is a running, honest picture of how close the build is to
"the perfect CRM based on the client's requirements."

## Contents
| File | Purpose |
|------|---------|
| [`00-SUMMARY.md`](00-SUMMARY.md) | Executive summary + scorecard for the latest pass |
| [`01-BUGS.md`](01-BUGS.md) | Every defect, ranked by severity, with repro + evidence + spec ref + fix |
| [`02-BLOCKERS.md`](02-BLOCKERS.md) | What blocks real deployment / the next phase |
| [`03-COVERAGE-MAP.md`](03-COVERAGE-MAP.md) | Route-by-route + spec-§ coverage (✅ / ⚠️ / ➖) |
| [`04-TEST-ARTIFACTS-LEFT-IN-DB.md`](04-TEST-ARTIFACTS-LEFT-IN-DB.md) | Data created/edited while testing (for cleanup) |

## How we keep it current (convention)
- When a bug is fixed, append a `✅ Fixed <date> — <commit/notes>` line to its entry rather than
  deleting it, so we keep the history.
- Add new findings from each Playwright pass with the pass date.
- Update `03-COVERAGE-MAP.md` status markers as areas change.
- Keep the scorecard in `00-SUMMARY.md` in sync.

## Assessment log
| Pass | Date | Scope | Result |
|------|------|-------|--------|
| 1 | 2026-07-07 | Full E2E: onboarding → portals → CRM, all routes & personas | 1 high / 5 medium / ~10 low bugs; 3 blockers; ~7 known scope gaps |

_Last updated: 2026-07-07._
