# Playwright E2E QC — Role cleanup, shell polish & searchable multi-select filters

Date: 2026-07-10
Build: integration/all-features (uncommitted working tree)
Dev server: http://localhost:3001 (restarted with RESEND_API_KEY disabled so OTP → dev sink; port 3000 was occupied by a pre-existing process, untouched)
Seed creds: password `NobleStride!Demo2026` — admin `evans@noblestride.capital`, team member `ivy@noblestride.capital`, investor `cmiriti@ifc.org` (IFC).

| # | Task | Result | Evidence |
|---|------|--------|----------|
| 3 | Remove demo viewing lens | ✅ PASS | No eye/viewpoint switcher in any topbar (admin, team member, investor). No "Viewing as … demo lens" banner in CRM layout or investor portal. |
| 2 | Access Matrix demo banner | ✅ PASS | `/access-matrix`: amber demo banner gone, no "Reset to defaults", cells are static read-only ✓/— reading from RBAC matrix; "Organisation role" reference selector retained (Deal Lead shows Read-only Partners/Service Providers, no Delete). |
| 6 | Remove topbar Sign out | ✅ PASS | CRM topbar = Help + Search + bell only. Investor topbar = Search + bell only. No Sign out button anywhere in topbars. |
| 7 | Sidebar profile + logout dropdown | ✅ PASS | Bottom-left profile block: admin "Evans W" (avatar EW) + email; team member "Ivy N"; investor "Catherine Miriti" (person name) + email. Click → upward dropdown (menu positioned above trigger) with "Log out". Outside-click/Escape close. Logout revokes session → `/login`. |
| 4 | id/UUID-based login | ✅ PASS | Login by email lookup once → session keyed on AuthAccount.id (cuid); admin/team-member/investor all authenticated by real credentials. (ids are cuid, not RFC-4122 UUID — flagged.) |
| 5 | Role → route redirect | ✅ PASS | evans (INTERNAL Admin) → `/dashboard`; ivy (INTERNAL TeamMember) → `/dashboard`; cmiriti (INVESTOR) → `/portal/investor`. Authenticated `/login` visits bounce to the role's home. |
| — | Internal-member model | ✅ PASS | Team member sees the same admin CRM side as admin, but sidebar has NO admin-only "Users" item (fewer capabilities), confirming the UI-level RBAC model. |
| 1 | Searchable multi-select filters | ✅ PASS | Portal Opportunities: Sector filter popover has search (typed "tech" → only Technology) + checkboxes; selecting → `?sector=Technology` → "0 opportunities match". CRM Investors: Investor Type multi-select → selected Venture Capital + DFI → trigger "2 selected", `?type=VentureCapital,DFI`, table "Showing 11 of 43 investors" (3 VC + 8 DFI, correct OR-match). |

## Environmental notes / caveats
- Investor login reached `/portal/investor` directly without the OTP step — a trusted-device cookie persisted in the Playwright browser from a prior run. 2FA/OTP is pre-existing behavior, orthogonal to this change set, so not re-exercised here.
- Two other investor accounts exist (`shaurya@luaimplementation.ai`, `dev@luaimplementation.ai`) from registration testing with non-seed passwords — not the demo account.
- Unit/integration (from implementation pass): `table-filter.test.ts` 7/7; broad sweep 424 tests pass; `server/auth` 54 pass / 2 env Resend-403 failures / 6 skipped; whole-project `tsc --noEmit` clean.

## Verdict
All 7 requested tasks verified working in the running app. No regressions observed. No blocking issues.
