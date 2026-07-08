# Investor 2FA (Email OTP) — End-to-End Verification

**Date:** 2026-07-08
**Branch:** `feat/real-auth` (worktree `.claude/worktrees/real-auth`)
**Build under test:** worktree dev server on **http://localhost:3005** (port 3000 was a separate/main-checkout server; explicitly avoided). Confirmed the worktree build: `/login/verify` returns 307 (route exists).
**Mailer mode:** ConsoleMailer fallback (`RESEND_API_KEY` empty) → OTP codes read from the dev sink `%TEMP%/ns-dev-otp-sink.json`.
**Seed:** `corepack pnpm run seed` — investor `cmiriti@ifc.org` (IFC), admin `evans@noblestride.capital`; shared password `NobleStride!Demo2026`.

## Result: ALL FLOWS PASS

| Flow | Scenario | Expected | Observed | Verdict |
|------|----------|----------|----------|---------|
| A | Investor first login (no trusted device) | Password → `/login/verify` (no session), then correct OTP → `/portal/investor` | Redirected to `/login/verify` showing masked `c******@ifc.org` + checkbox checked; sink code `940098`; verify → `/portal/investor` | ✅ |
| B | Trusted device skips OTP | Sign out (keep trust cookie) → re-login → straight to portal, no OTP | Signed out → `/login`; re-login `cmiriti` → `/portal/investor` directly, no `/login/verify` | ✅ |
| C | New/cleared device re-challenges | Clear cookies → login → OTP again | `context.clearCookies()` → login `cmiriti` → `/login/verify` | ✅ |
| D | Staff/internal unaffected | Admin login → `/dashboard`, no OTP | `evans@noblestride.capital` → `/dashboard` directly; cookies = `[ns_session]` only (no `ns_2fa_trust`, no verify stop) | ✅ |
| E | Wrong code lockout | Wrong codes decrement remaining; lock at 5 → bounce to `/login`; no session | remaining `4` then `3` (server-side, DB attempts 0→5); banner "That code is incorrect… N attempt(s) left."; 5th → `/login?error=too-many-codes`; final cookies = `[ns_2fa_pending]` only — **no `ns_session`** | ✅ |
| F | Resend cooldown | Resend within 60s → cooldown message | "Send a new code" (<60s) → `/login/verify?error=cooldown` | ✅ |

## Evidence details

- **Flow A DB confirmation:** `Investor(IFC).emailVerifiedAt = 2026-07-08 16:29:18` (stamped on first successful OTP); the `LOGIN_2FA` challenge row `consumed=true, attempts=0`.
- **Trusted-device cookie proven set:** before `clearCookies()` in Flow C, context held `[ns_2fa_trust, ns_session]` — confirming Flow A's checkbox set the 30-day trust cookie, and Flow B's login rode it.
- **Flow E server truth (vs. UI race):** an intermediate scripted loop appeared to show `remaining=4` five times — this was a client-side `page.url()` readback race in the test harness, not an app bug. The DB shows the single challenge incremented `attempts 0→5` and locked; two deliberate, fully-settled attempts showed `remaining=4` then `remaining=3`; the rendered banner showed the correct decrementing count. No session was ever issued on the failure path.
- **Scoping proven both ways:** investors are always challenged without a trust cookie (A/C); internal/staff never challenged (D). Existing email+password auth is intact for both kinds.

## Static gate

- `npx tsc --noEmit`: 0 errors
- `npx vitest run`: full suite green (561 tests; +20 over the pre-2FA 541: otp/mailer/dev-otp-sink/two-factor + 3 login cases)
- `npx next build`: succeeds; `/login/verify` present in the route list (verified in Task 6)
- eslint: no new errors over the pre-existing baseline

## Bugs found

None. No fixes required during verification.

## Notes / deferred (unchanged from design §10)

- Delivery is the ConsoleMailer fallback until `RESEND_API_KEY` + a verified `RESEND_FROM` domain are configured (must-configure-before-prod, same posture as the existing password-reset mailer).
- Email OTP is 2-step (code to the login email), weaker than SMS/TOTP but standard for the demo; phone-SMS remains a documented drop-in via the same OTP core.
