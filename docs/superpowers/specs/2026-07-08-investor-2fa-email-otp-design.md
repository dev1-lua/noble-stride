# Investor Onboarding 2FA — Email OTP (Design Spec)

**Status:** Implemented (feat/real-auth, tasks 1-7 complete; e2e verified 2026-07-08 — see `playwright assessment/2026-07-08-investor-2fa-verification.md`). Delivered as designed; no divergences beyond the owner-approved email channel (§2).
**Date:** 2026-07-08
**Branch:** `feat/real-auth` (worktree `.claude/worktrees/real-auth`), app root `noblestride-crm/`.
**Author:** SDD build (brainstormed with user 2026-07-08).

## 1. Why (requirement source)

The decrypted source docs at repo root specify OTP-based 2FA for investor onboarding, which the
real-authentication build did not implement:

- **`decrypted/Data collected from potential investors_ CRM.docx`** — under **"WHILE LOGGING IN"**
  lists `Telephone number (for OTP needs)`; the doc is tagged 2FA.
- **`decrypted/Lua x Noblestride - Build Specification (INTERNAL).pdf`** — marks the investor phone
  field *"Used for OTP where relevant."*

The registration wizard already collects a phone number with the hint *"Used for OTP verification,"*
and `Investor.emailVerifiedAt` / `Investor.phoneVerifiedAt` columns are scaffolded but never written.
So the scaffolding anticipates OTP; the enforcement was missing.

## 2. Product decision (owner-confirmed 2026-07-08)

The source docs describe a **phone** OTP. The product owner chose, for this build, to deliver the OTP
**by email via Resend** (a free account they will provision), because Resend is free to demo and the
codebase already has an email abstraction. **This is a deliberate, owner-approved divergence from the
source doc's phone channel.** The phone number is still collected at registration (unchanged), but the
second factor is emailed. Phone-SMS remains a documented future swap (see §10) — the OTP core is
channel-agnostic, so switching delivery is a one-adapter change.

- **Scope:** 2FA applies **only** to `AuthAccount.kind === "INVESTOR"`. Internal/staff accounts are
  never challenged. Existing real email+password authentication is preserved for all accounts.
- **Timing:** enforced at **login**, as a step-up second factor after successful password verification.
  Registration is unchanged (still collects phone → `Person.phone`, creates a `PENDING` account,
  shows the awaiting-approval screen).
- **Mandatory first time:** the first login after admin approval is always challenged (no trusted-device
  cookie exists yet).
- **Re-prompt judgment (owner-approved):** after a successful OTP the user may opt to **trust the device
  for 30 days**; on that browser, subsequent logins within 30 days skip the OTP. New device, cleared
  cookies, or >30 days ⇒ challenged again.

## 3. Non-goals

- No SMS/Twilio in this build (owner dropped it).
- No 2FA for internal/staff or partner accounts.
- No OTP at registration (deferred to login per §2).
- No authenticator-app/TOTP, no backup codes, no per-device revocation list (admin-side trusted-device
  reset is deferred — see §10).
- No new GraphQL mutations (keeps the 44-mutation smoke test and RBAC matrix untouched).

## 4. Threat model / security posture (honest notes)

- **Email OTP is 2-step, not a strong second factor.** The code is delivered to the same email used as
  the login identifier, so it proves control of the mailbox rather than a distinct possession factor.
  This is a common, accepted pattern for a demo and materially raises the bar over password-only, but it
  is weaker than SMS/TOTP. Documented so the owner can upgrade the channel later (§10).
- **No user enumeration added.** The OTP step is only reached *after* a correct password on an `ACTIVE`
  investor account, so it does not reveal account existence beyond what the password step already does.
  The password step's existing timing-equalization (dummy hash on unknown email) is unchanged.
- **Codes hashed at rest.** Only the SHA-256 hash of the 6-digit code is stored (same discipline as
  sessions/tokens); the raw code lives only in the email.
- **Brute force.** 6-digit space is 1e6. Mitigated by: max 5 attempts per challenge, 10-minute expiry,
  challenge invalidated on max attempts (must restart login), and per-account + per-IP rate limiting on
  both send and verify.
- **Interstitial authorization.** Between the password step and OTP entry the user holds only a
  short-lived **signed** `ns_2fa_pending` cookie (httpOnly, ~10 min) — it is the sole authorization to
  attempt/resend OTP for that account and carries `{accountId, challengeId}`. No `ns_session` is issued
  until OTP succeeds.
- **Trusted-device cookie** `ns_2fa_trust` is a signed (jose/`AUTH_SECRET`) httpOnly JWT bound to
  `accountId`, 30-day expiry. Validated to match the account resolved by the password step (cookie from
  account A cannot skip OTP for account B).
- **Delivery failure.** If email send fails, surface a generic "couldn't send your code, try again" and
  log server-side; never leak provider errors. If an investor has no deliverable email (shouldn't happen —
  email is the account key), they cannot complete 2FA and must contact an admin.

## 5. Architecture / where it slots in

Login is a two-part switch today: `loginWithPassword` (`src/server/auth/login.ts`) verifies password →
status gate (PENDING/SUSPENDED) → `createSession` → returns a token that `loginAction`
(`src/app/login/actions.ts`) writes as the `ns_session` cookie, then redirects to `home`.

The 2FA gate is inserted **between the `ACTIVE` status check and `createSession`**, only for
`kind === "INVESTOR"`:

```
loginWithPassword(email, password, meta, { trustedDeviceCookie })
  ├─ (unchanged) normalize → find → lockout → verify password → status gate
  ├─ if kind !== INVESTOR            → createSession (unchanged)  → { ok, token, ... }
  ├─ if INVESTOR and trusted cookie valid for this account → createSession → { ok, token, ... }
  └─ if INVESTOR and not trusted:
        create AuthOtpChallenge(accountId, LOGIN_2FA), email the code,
        return { ok:false, reason:"otp_required", pending:{accountId, challengeId}, emailMask }
```

`loginAction` on `otp_required`: sign the `ns_2fa_pending` cookie, set it, redirect to
`/login/verify?next=…` (carrying the sanitized `next` via existing `safeNext`). **No session set.**

`/login/verify` (new page): reads/validates the pending cookie; renders the OTP form (masked email,
6 code inputs, "Trust this device for 30 days" checkbox default-checked, resend button). Posts to:

- **`verifyLoginOtpAction`** — reads pending cookie → challenge; verifies code (increments attempts,
  checks expiry/max/consumed). On success: `createSession` + set `ns_session`, clear `ns_2fa_pending`,
  set `ns_2fa_trust` if checkbox, stamp `Investor.emailVerifiedAt` if null, `logAuthEvent`, redirect to
  `safeNext(next) ?? home`. On failure: increment attempts; re-render with error; after max attempts kill
  the challenge and bounce to `/login` with "code expired, sign in again."
- **`resendLoginOtpAction`** — rate-limited + 60s cooldown; invalidates the current challenge, creates a
  new one, re-emails; re-renders `/login/verify`.

Middleware: `/login/verify` is public (like `/login`); the "already-authed skip" stays in the page layer.
A visit to `/login/verify` without a valid pending cookie redirects to `/login`.

## 6. Data model

New model + enum in `prisma/schema.prisma` (migration applied via the shared-DB `migrate diff` +
`migrate deploy` workaround, per project quirks — `migrate dev` fails on pre-existing drift):

```prisma
enum AuthOtpPurpose { LOGIN_2FA }

model AuthOtpChallenge {
  id          String         @id @default(cuid())
  accountId   String
  account     AuthAccount    @relation(fields: [accountId], references: [id], onDelete: Cascade)
  purpose     AuthOtpPurpose
  codeHash    String         // sha256 hex of the 6-digit code; raw code never stored
  destination String         // masked-for-UI email actually sent to (audit/debug)
  attempts    Int            @default(0)
  maxAttempts Int            @default(5)
  expiresAt   DateTime
  consumedAt  DateTime?
  createdAt   DateTime       @default(now())

  @@index([accountId, purpose])
}
```

`AuthAccount` gains `otpChallenges AuthOtpChallenge[]`. Milestone stamp reuses the existing unused
`Investor.emailVerifiedAt` (path: `AuthAccount.person.investor`). No prisma-count test exists, so adding a
model is safe; the GraphQL `schema.smoke.test.ts` (27 queries / 44 mutations) is unaffected.

## 7. Modules (anticipated; plan will specify exact code)

- `src/server/auth/otp.ts` — `generateCode()` (6-digit), `hashCode` (reuse `hashToken`), `createOtpChallenge`,
  `verifyOtpChallenge` (race-safe attempt increment + single-use claim), `invalidateOtpChallenges`.
- `src/server/auth/mailer.ts` — refactor `sendMail` to pick a provider: `ResendMailer` when
  `RESEND_API_KEY` present (POST `https://api.resend.com/emails` via `fetch`, no SDK), else the existing
  console log. Callers unchanged. Add `RESEND_API_KEY` / `RESEND_FROM` to `.env` docs.
- `src/server/auth/two-factor.ts` — pending-2fa and trusted-device signed-cookie helpers (jose):
  `signPending`/`verifyPending`, `signTrust`/`verifyTrust`, cookie names/set/clear; orchestration
  `beginInvestorOtp`, `verifyInvestorOtp`, `resendInvestorOtp`.
- `src/server/auth/login.ts` — branch on `kind === "INVESTOR"` + trusted-device check → `otp_required`.
- `src/app/login/actions.ts` — handle `otp_required` → set pending cookie → redirect `/login/verify`.
- `src/app/login/verify/` — `page.tsx`, form component, `actions.ts` (`verifyLoginOtpAction`,
  `resendLoginOtpAction`). Reuse `src/app/login/safe-next.ts` for `next`.
- OTP email copy in a small template helper (subject "Your NobleStride sign-in code", plaintext body).

## 8. Testing

- **Vitest** (DATABASE_URL exported; self-cleaning `zz-test`/`UNIQ` markers; never touch demo data):
  - `otp.ts`: generate range, hash≠plaintext, create/verify happy path, wrong code increments attempts,
    expiry, max-attempts kill, single-use (no reuse after consume).
  - `two-factor.ts`: pending/trust sign+verify round-trip, tamper rejection, expiry, account binding
    (trust cookie for account A rejected for account B).
  - `login.ts`: internal account → `ok` (no OTP); investor untrusted → `otp_required`; investor with valid
    trust cookie → `ok`; PENDING/SUSPENDED unchanged.
  - mailer provider selection (Resend when key present via injected fetch, console when absent).
- **schema.smoke.test.ts** unchanged (no GraphQL change) — assert this stays 27/44.
- **Playwright e2e (final pass, ConsoleMailer fallback — code read from a non-production dev sink):**
  1. Fresh browser, investor `cmiriti@ifc.org` → email+password → redirected to `/login/verify` (no
     session yet) → read code from dev sink → enter → lands in `/portal/investor`; `emailVerifiedAt` set.
  2. Trust-device checkbox checked on step 1 → second login same browser → **no OTP**, straight to portal.
  3. New/cleared browser → OTP challenged again.
  4. Staff `evans@noblestride.capital` login → **no OTP** (unaffected).
  5. Wrong code → inline error, attempt counter; max attempts → bounced to `/login`.

  **Dev sink for tests:** when running on the ConsoleMailer fallback (no `RESEND_API_KEY`), record the most
  recent code per destination to a scratch file under the OS temp dir (never web-accessible), guarded by
  `NODE_ENV !== "production"`, so the Playwright test can retrieve the code deterministically. Inert in prod.

## 9. Gate before "done"

`corepack pnpm exec tsc --noEmit` (0) · full vitest suite green (DATABASE_URL exported) · `npx next build` ✓ ·
eslint no new errors over the 8 pre-existing · Playwright flows in §8 all pass. Leave
`src/generated/pothos-types.ts` uncommitted. Commit per task on `feat/real-auth` only — no merge/push/PR.

## 10. Deferred / future

- **Phone SMS OTP** (the source-doc channel): drop-in `SmsSender` (Twilio or Africa's Talking — SSA-native)
  behind the same OTP core; set `Investor.phoneVerifiedAt` instead of/alongside `emailVerifiedAt`.
- **Must-configure-before-prod:** `RESEND_API_KEY` + verified sending domain (until then ConsoleMailer logs
  the code); same posture as the existing password-reset mailer.
- Admin "reset 2FA / distrust all devices" (needs a per-account trust epoch the trust cookie must beat).
- Optional account lockout after repeated OTP failure (today only the challenge dies).
