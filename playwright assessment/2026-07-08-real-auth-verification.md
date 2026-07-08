# Real Authentication — End-to-End Verification Pass (2026-07-08)

Branch `feat/real-auth` (15-task SDD build replacing demo-mode auth with real credential auth, DB sessions, server-side RBAC, password reset, email-first registration, admin user management, and seeded role bootstrap).

## Static gates
| Gate | Result |
|---|---|
| `tsc --noEmit` | 0 errors |
| `vitest run` (full suite) | 541 / 541 passing (77 files) |
| `eslint src` | 8 errors / 2 warnings — all pre-existing (0 new; the 2 in `register/` confirmed pre-existing via git-stash diff during Task 11) |
| `npx next build` | Succeeds; all new routes present (`/settings/users`, `/forgot-password`, `/reset-password/[token]`, `/register`); middleware compiled (shown as "Proxy" in Next 16) |

## Browser end-to-end pass (dev server :3100, Playwright)
Demo creds: password `NobleStride!Demo2026` (all accounts). Admin `evans@noblestride.capital`; TeamMember `irine@noblestride.capital`; Investor `cmiriti@ifc.org`.

| # | Check | Result |
|---|-------|--------|
| 1 | Signed-out `/dashboard` → redirects to `/login?next=%2Fdashboard` | ✅ PASS |
| 2 | Admin login → `/dashboard`; viewpoint switcher visible; `/settings/users` loads | ✅ PASS |
| 3 | TeamMember → `/settings/users` redirects to `/dashboard`; no Users nav; no switcher | ✅ PASS |
| 4 | **GraphQL bypass (headline):** TeamMember cookie'd `deleteInvestor` mutation → `FORBIDDEN`; no-cookie → denied; investor row still exists (count=1) | ✅ PASS |
| 5 | 3× wrong password → generic "Incorrect email or password."; correct password then works (< 10 failures) | ✅ PASS |
| 6 | Investor login → `/portal/investor`; `/dashboard` redirects back to portal (isolation) | ✅ PASS |
| 7 | `/register` `test@gmail.com` → free-provider block; fresh corporate email → wizard → submit → pending; PENDING account visible on `/settings/users` | ✅ PASS |
| 8 | Internal `@noblestride.capital` signup → pending; admin approves as TeamMember → new user can log in | ✅ PASS |
| 9 | Admin impersonation → investor portal with "viewing as" banner + Return to Admin works; TeamMember direct `/api/viewpoint?role=investor` → 403 | ✅ PASS |
| 10 | Forgot password → console reset link → set new password → old session invalidated → new password logs in (password restored to seed afterward) | ✅ PASS (after bug fix below) |
| 11 | Sign out → `/login`; `/dashboard` redirects to login again (session gone) | ✅ PASS |

## Bug found and fixed during verification
**Stale-session login trap** (surfaced in check 10). The edge middleware redirected `/login`/`/register` → `/` on `ns_session` cookie *presence* only (it cannot validate at the edge). After a session was invalidated server-side (password reset in another tab, admin suspension, expiry) with the stale cookie still in the browser, `/dashboard` correctly bounced to `/login`, but `/login` then bounced to `/` — trapping the user with no route to the sign-in form. Security intact (dead sessions never reached protected data), but a real UX break in the recovery path.

**Fix** (commit `4136df5`): removed the presence-only redirect from `src/middleware.ts`; moved the "already-authenticated → skip auth page" decision into `login/page.tsx` and `register/page.tsx`, where `getCurrentAuth()` validates the session against the DB (stale cookie → null → form renders; valid session → redirect home). Re-verified by curl: `/login` and `/register` with a stale cookie → `200` (render), no-cookie `/dashboard` → `307 /login?next=%2Fdashboard` (protected gate unaffected). tsc 0, suite 541/541.

## Test-data cleanup
Removed the verification-created rows (`ZZ Test Corp` investor, `founder@zztestcorp.com` + `zz.newstaff@noblestride.capital` accounts and their Person/User rows). `responsAbility` investor confirmed still present. Demo data intact.

## Outcome
All 11 flows pass; 1 verified bug found and fixed. The headline vulnerability (unauthenticated/under-privileged GraphQL mutation bypass) is closed — verified denied both with a TeamMember session and with no session.
