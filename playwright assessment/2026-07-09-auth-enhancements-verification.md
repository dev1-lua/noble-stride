# Auth Enhancements — E2E Verification (2026-07-09)

Branch: `integration/all-features` (working tree, uncommitted). Dev server: hot-reloading instance on `localhost:3000` serving this working dir. Logged in as Admin (session pre-existing).

Six requested enhancements. Plan: `docs/superpowers/plans/2026-07-09-auth-enhancements.md`. Consolidated Fable review: 0 Critical / 5 Important / 8 Minor — all fixed and re-verified before this pass.

## Results — one scenario per point

| # | Point | Result | Evidence |
|---|-------|--------|----------|
| 1 | Sidebar logout | ✅ PASS (internal live) | Clicked sidebar-bottom "Sign out" on `/dashboard` → redirected to `/login`, session cleared. Investor sidebar: same `logoutAction` + identical button block (see limitation). |
| 2 | Search/filters above tables | ✅ PASS | `/settings/users` "All accounts": typed "evans" → "Showing 1 of 14", only match shown, **URL unchanged** (client-side, no email in URL). Role/Status filters render with "All Role"/"All Status" reset state. |
| 3 | Users internal-only; investor accts on Investors page | ✅ PASS | Users "All accounts" = 14 INTERNAL rows only (no investor accounts). Pending-approval queue retained (admin123@… Approve/Reject). IFC investor detail shows admin-only "Account access" panel (cmiriti@ifc.org, Suspend + Reset link). |
| 4 | Password eye toggle | ✅ PASS | Login: toggle flips `type` password↔text (value visible), button `type=button`, `aria-pressed` toggles, label Show/Hide. Register internal form: 2 fields + 2 toggles. Reset page: 2 fields + 2 toggles. |
| 5 | No email/password in URL or console; no reflected strings | ✅ PASS | Wrong password → URL stays `/login` (no `?email=`/`?error=`), email preserved inline, error "Incorrect email or password." Crafted `/login?error=<attacker text>` → renders only generic "Please sign in to continue." (no reflection). Register routing → `/register?path=internal` (email via cookie, **not** URL). |
| 6 | Forgot-password copy | ✅ PASS | Submitted forgot-password → "If an account exists for that address, a reset link has been sent." — no "server console"/"email delivery" dev mention. |

## Verification limitation (honest note)

- **Point 1 investor-side sidebar logout was NOT clicked live.** Investor login requires OTP, and this environment's `RESEND_API_KEY` fails (the 2FA/login smoke tests fail for the same reason), so no investor session could be established; the admin "view as investor" lens has no per-investor picker and redirects `/portal/investor`→`/dashboard`. The investor sidebar (`investor-sidebar.tsx`) uses the **same** `logoutAction` and the **same** button block as the internal sidebar, which WAS clicked live and works. Confirmed by code + consolidated review, not by a live portal click.

## Build/test state at verification

- `npx tsc --noEmit`: clean.
- `npx vitest run`: 758 passed / 6 skipped; **2 failures are pre-existing env-only smokes** (`two-factor.smoke`, `login.smoke`) that need a provisioned DB+mailer — no `src/server/auth/*` source was modified by this work.
- New unit tests: `login/messages.test.ts` (allow-list), `crm/table-filter.test.ts` (filter logic) — pass.

## Not committed
Working tree left dirty per standing preference; commit pending explicit go-ahead.
