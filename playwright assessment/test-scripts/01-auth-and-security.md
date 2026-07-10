# 01 — Auth & Security

Covers: login (valid/invalid/lockout), the 2FA gate (ON vs OFF), registration wizard, forgot/reset
password, logout, session/RBAC enforcement, GraphQL mutation-bypass attempts, secrets-not-in-URL,
direct-URL access per role, and IDOR attempts. This is the highest-stakes script in the set — treat
every SECURE expectation as a P1 if it fails.

Preconditions: dev server at `localhost:3000`. Know the `RESEND_API_KEY` state of the running server
(check `.env` / ask whoever started it) before starting §3 — the 2FA behavior is entirely conditional
on it. Password for all seed accounts: `NobleStride!Demo2026`.

---

## 1. Login — valid / invalid / lockout

Exact mechanics confirmed in `src/server/auth/login.ts`: unknown email and wrong password both return
the identical generic message `"Incorrect email or password."` (dummy-hash timing equalization so an
attacker can't distinguish "no such account" from "wrong password"). **`MAX_FAILURES = 10`** →
15-minute lock (`"Too many failed attempts. Try again in about 15 minutes."`). Separate IP rate limit
on the whole `/login` route: **max 20 requests / 10 minutes** (`rateLimit("login:<ip>")`), same
"locked" message if tripped — independent of the per-account counter.

| # | Step | Expected | Record result |
|---|---|---|---|
| 1.1 | Go to `/login`. Submit a non-existent email + any password. | Generic "Incorrect email or password." Email address is preserved in the field (only password clears). | Pass/Fail — |
| 1.2 | Submit `evans@noblestride.capital` + wrong password. | Same generic message — indistinguishable from 1.1 (confirm wording is byte-identical). | Pass/Fail — |
| 1.3 | Submit `evans@noblestride.capital` + correct password `NobleStride!Demo2026`. | Redirect to `/dashboard`. | Pass/Fail — |
| 1.4 | Sign out. Fail `evans@…`'s password **10 times in a row** (use a throwaway account if you don't want to risk locking the real admin — e.g. register a fresh internal/investor account first, see §4, and lock that one instead). | On the 10th failure, account locks: message becomes "Too many failed attempts. Try again in about 15 minutes." | Pass/Fail — |
| 1.5 | Immediately try the CORRECT password on the now-locked account. | Still rejected with the lock message (lock applies regardless of correctness) for the 15-minute window. | Pass/Fail — |
| 1.6 | Toggle the password field's Eye/EyeOff icon. | Only swaps `type="password"`↔`type="text"` client-side — value is not submitted anywhere extra, no network request fires on toggle. | Pass/Fail — |
| 1.7 | Load `/login` while already signed in (valid session). | Redirects home for that role (`/dashboard` internal, `/portal/investor` investor) rather than re-rendering the login form. | Pass/Fail — |
| 1.8 | Manually craft `/login?next=/some/forbidden/path` and sign in. | After login, redirect follows `next` only if it's a legitimate app path — confirm the app doesn't blindly redirect to an external URL if `next` were crafted as `next=https://evil.example.com` (open-redirect check). | Pass/Fail — SECURE if no external redirect |
| 1.9 | Craft `/login?error=<script>alert(1)</script>` or an arbitrary unknown slug. | Renders only the generic "Please sign in to continue." (or equivalent safe default) — no reflected/executed content, per the allow-listed error-message mapping. | Pass/Fail — SECURE if no reflection |

---

## 2. Session / route protection (middleware + page guards)

`src/middleware.ts` is **cookie-presence-only** at the edge (deliberately — it can't validate a
session, only detect absence) — protected prefixes: `/dashboard, /deals, /mandates, /transactions,
/investors, /engagement, /partners, /clients, /documents, /tasks, /access-matrix,
/service-providers, /settings, /portal`. Real role/validity checks happen per-page via
`getViewpoint()`/`getCurrentAuth()`.

| # | Step | Expected | Record result |
|---|---|---|---|
| 2.1 | Signed out, request `/dashboard` directly. | 307 redirect to `/login?next=%2Fdashboard`. | Pass/Fail — |
| 2.2 | Signed out, request `/portal/investor`. | Redirect to `/login?next=%2Fportal%2Finvestor`. | Pass/Fail — |
| 2.3 | Signed out, request `/settings/users`. | Redirect to `/login?next=...` (same edge gate — role-specific denial happens after login, see 2.7). | Pass/Fail — |
| 2.4 | Sign in as Investor (`cmiriti@ifc.org`), then request `/dashboard` directly. | Redirected back to `/portal/investor` — a CRM route is not reachable by an investor account even with a valid session (page-level guard, not just middleware). | Pass/Fail — |
| 2.5 | As Investor, request `/portal/partner` directly. | Redirected away (per the partner page's own role guard) — not merely blocked, and not silently rendering partner data. | Pass/Fail — |
| 2.6 | As Team Member (`irine@noblestride.capital`), request `/settings/users` directly. | Redirected to `/dashboard` (Admin-only page, `getCurrentAuth()`-checked against the REAL role). | Pass/Fail — |
| 2.7 | Manually clear cookies mid-session (simulate a stale/invalidated session — e.g. sign in, then trigger a password reset for the same account in another tab which invalidates all sessions per §6, then reuse the old tab). | Old tab's next protected-route request redirects to `/login` cleanly — NOT trapped in a redirect loop (this was BUG fixed 2026-07-08: `/login` no longer bounces to `/` on stale-cookie presence). | Pass/Fail — |
| 2.8 | As Investor, request `/access-matrix`, `/tasks`, `/documents`, `/engagement`, `/clients`, `/partners`, `/service-providers`, `/mandates`, `/transactions` — the full CRM prefix list — directly by URL. | Every one redirects away from CRM (to `/portal/investor` or similar) — no partial CRM data rendered on any of them. | Pass/Fail — |

---

## 3. 2FA gate (Option B — `RESEND_API_KEY`-conditional) — investor-only

Exact gate (`src/server/auth/login.ts` + `mailer.ts`): `if (account.kind === "INVESTOR" &&
twoFactorEnabled())` where `twoFactorEnabled()` is simply `!!process.env.RESEND_API_KEY`. **Internal
accounts NEVER hit this branch, regardless of the key.** Trusted-device bypass via a signed 30-day
`ns_2fa_trust` cookie, independent of the key. OTP challenge: 6-digit code, **10-minute expiry**, **5
max wrong attempts** before the challenge locks (`?error=too-many-codes`), **60-second resend
cooldown**, resend capped at **5 per IP/account**, verify capped at **20 attempts per IP/account**.

### 3A. `RESEND_API_KEY` UNSET (recommended default for most of this QA pass)

| # | Step | Expected | Record result |
|---|---|---|---|
| 3.1 | Confirm env: `RESEND_API_KEY` is empty/unset on the running server. | — | N/A |
| 3.2 | Log in as `cmiriti@ifc.org` with the correct password. | Goes **straight to `/portal/investor`** — no `/login/verify` step at all (password-only). | Pass/Fail — |
| 3.3 | Log in as `evans@noblestride.capital` (internal). | Straight to `/dashboard`, as always — confirm internal accounts are identical regardless of the flag. | Pass/Fail — |

### 3B. `RESEND_API_KEY` SET (requires restarting the dev server with the key populated — coordinate with whoever controls the environment; if you cannot toggle it, mark this whole subsection "not exercised — env fixed for this pass" rather than guessing)

| # | Step | Expected | Record result |
|---|---|---|---|
| 3.4 | With the key set and a fresh browser context (no trust cookie), log in as `cmiriti@ifc.org` with the correct password. | Redirects to `/login/verify`, shows masked email (e.g. `c******@ifc.org`), "Trust this device for 30 days" checkbox present and checked by default. | Pass/Fail — |
| 3.5 | Enter the OTP (read from the dev sink `%TEMP%/ns-dev-otp-sink.json` if using ConsoleMailer, or the real inbox if Resend is truly live). | Verifies → `/portal/investor`; cookies now include both `ns_session` and `ns_2fa_trust`. | Pass/Fail — |
| 3.6 | Sign out (session cookie cleared, trust cookie retained), sign back in as the same investor. | Goes straight to `/portal/investor` — **no** OTP step (trusted-device bypass). | Pass/Fail — |
| 3.7 | Clear all cookies, sign in again as the same investor. | OTP re-challenged (device no longer trusted). | Pass/Fail — |
| 3.8 | Enter 5 wrong codes in a row. | Each shows "That code is incorrect… N attempt(s) left" counting down; the 5th redirects to `/login?error=too-many-codes` with a friendly message — no session issued at any point. | Pass/Fail — |
| 3.9 | Request a resend, then immediately request another resend. | Second attempt within 60s → `?error=cooldown` friendly message. | Pass/Fail — |
| 3.10 | Let a code sit unused for 10+ minutes, then try to verify it. | Rejected as expired (treat as an incorrect/invalid code — confirm actual copy). | Pass/Fail — |
| 3.11 | As internal staff (`evans@…`) with the key SET. | Still no OTP — confirm the gate really is investor-only, not "any account when key is set." | Pass/Fail — |

---

## 4. Registration wizard (`/register`)

Email-first router (`classifyEmailForSignup`): staff domain → `internal` form; existing investor
contact by email → `contact` (password-only) form; unrecognized email → `fund` 6-step wizard. Free
email providers (gmail/yahoo/etc.) and DB-greylisted emails are rejected before the wizard is shown.
Signup itself is rate-limited **max 10 requests / 10 min / IP**.

| # | Step | Expected | Record result |
|---|---|---|---|
| 4.1 | Go to `/register`, enter a free-provider email (e.g. `test@gmail.com`). | Rejected with a free-provider error (`?error=free-provider`); confirm the error is user-friendly, not a raw slug. | Pass/Fail — |
| 4.2 | Enter a malformed email (no domain / invalid format). | Rejected (`invalid-email`) before any wizard step shows. | Pass/Fail — |
| 4.3 | Enter a fresh, valid corporate-looking email not already in the seed data. | Routed into the 6-step **fund wizard**: Fund/entity name → Contact → Investor type → Sector preference → Deal type & size → Review + password/confirm. | Pass/Fail — |
| 4.4 | On the Review step, submit with password/confirm mismatched. | Client-side (or server) rejects before writing; error shown without losing prior step data. | Pass/Fail — |
| 4.5 | On the Review step, deliberately trigger a validation error (short password, e.g. < 10 chars). | **Re-check BUG-08**: research indicates all wizard values live in client `useState` and repopulate the review step via hidden inputs — a failed submit should NOT wipe Fund name/Contact/Type/Sectors/Deal type. Confirm FIXED (all fields persist) or STILL REPRODUCES (fields clear). | Pass/Fail — |
| 4.6 | Complete the wizard successfully (password ≥ 10 chars, matching confirm). | Account created in PENDING status; confirm it shows up in the appropriate review queue (`/investors?onboarding=PendingReview` for a fund account, or `/settings/users` pending table for an internal-domain signup). | Pass/Fail — |
| 4.7 | Attempt to submit the wizard 11+ times rapidly from the same IP (or check via network timing). | Rate limit trips after 10 within 10 minutes — confirm a clear rejection rather than a crash. (Skip if this would pollute the seed DB with junk accounts — reason through it or use a disposable email pattern and clean up after.) | Pass/Fail — |
| 4.8 | Enter an email matching an existing investor contact's email (the `contact` branch). | Routed to a lighter password-only signup form, not the full 6-step wizard. | Pass/Fail — |
| 4.9 | Enter a `@noblestride.capital`-style internal email. | Routed to the `internal` signup form; on submit, lands in `/settings/users` pending queue for Admin approval (per `02-admin-crm.md` §12.2). | Pass/Fail — |

---

## 5. Forgot / reset password

No-enumeration copy confirmed: **"If an account exists for that address, a reset link has been
sent."** regardless of whether the account exists. Rate limit **max 5 / 10 min / IP**. Reset token:
**60-minute expiry**, single-use, and a successful reset **invalidates all existing sessions** for
that account.

| # | Step | Expected | Record result |
|---|---|---|---|
| 5.1 | Go to `/forgot-password`, submit a non-existent email. | Same generic "If an account exists…" message — no indication the account doesn't exist. | Pass/Fail — |
| 5.2 | Submit a real account's email (e.g. a disposable test account you registered, not a seed account, to avoid disrupting other testers). | Identical message shown; reset email/link generated server-side (ConsoleMailer sink or real inbox depending on config). | Pass/Fail — |
| 5.3 | Submit the same email 6 times within a few minutes. | 6th+ request rate-limited (still shows the generic message or a distinct throttling message — note which). | Pass/Fail — |
| 5.4 | Follow a valid reset link, submit mismatched password/confirm. | Rejected: "Passwords do not match." | Pass/Fail — |
| 5.5 | Follow a valid reset link, submit a password < 10 chars or otherwise policy-failing. | Rejected with the weak-password message from `validatePassword`. | Pass/Fail — |
| 5.6 | Follow a valid reset link, submit a strong matching password. | Success → redirect `/login?notice=password-updated`; sign in with the NEW password works. | Pass/Fail — |
| 5.7 | If you had an active session on this account in another tab BEFORE the reset, check that tab after step 5.6. | That session is now invalid — next navigation redirects to `/login` (all sessions invalidated on reset). | Pass/Fail — |
| 5.8 | Try to reuse the SAME reset link a second time (after already using it in 5.6). | Rejected: "This reset link is invalid or has expired." (single-use enforced). | Pass/Fail — |
| 5.9 | Manually construct a bogus/garbage token at `/reset-password/not-a-real-token`. | Same invalid/expired message, no stack trace or 500. | Pass/Fail — |
| 5.10 | Wait out (or simulate) the 60-minute token expiry, then attempt to use it. | Rejected as invalid/expired. (May be impractical to wait live — note as "not exercised, timing-dependent" if skipped, but confirm the expiry check exists in the DB record via `AuthToken.expiresAt` if you have DB access.) | Pass/Fail — |

---

## 6. Logout

| # | Step | Expected | Record result |
|---|---|---|---|
| 6.1 | While signed in, click Sign out from the sidebar profile dropdown. | Redirects to `/login`; both `ns_session` and any 2FA cookies cleared. | Pass/Fail — |
| 6.2 | After logging out, press the browser Back button, then try to navigate within the app. | Does not resurrect the session (no cached protected content usable) — protected routes redirect to `/login` again. | Pass/Fail — |
| 6.3 | Confirm logout revokes the session **server-side** (DB), not just clears the cookie — e.g. capture the `ns_session` cookie value before logout, then replay a request with that exact cookie value after logout (via devtools/manual cookie injection). | Replayed request is treated as unauthenticated (session invalidated in DB, not just locally forgotten). | Pass/Fail — SECURE if replay fails |

---

## 7. GraphQL mutation-bypass / RBAC enforcement

Every mutation routes through `src/server/rbac/enforce.ts` (`assertCan`, `assertCanDelete`,
`assertCanUpdateOwnScoped`, `assertAdmin`) — throwing `FORBIDDEN` GraphQLErrors. Portal accounts
(investor/partner) have no `orgRole`, so `internalRole(actor)` is `null` and **every** one of these
checks throws for them regardless of entity/id.

| # | Step | Expected | Record result |
|---|---|---|---|
| 7.1 | As a signed-in Investor, use devtools/network replay to POST a `deleteInvestor` mutation directly to `/api/graphql` with your investor session cookie. | `FORBIDDEN` GraphQLError — investor accounts have no internal role at all. | Pass/Fail — SECURE |
| 7.2 | As a signed-in Team Member (lacking Investors:Delete per the access matrix), replay the same `deleteInvestor` mutation. | `FORBIDDEN` — entity-level RBAC denies it even for an internal role. | Pass/Fail — SECURE |
| 7.3 | With NO session cookie at all, replay any mutation (e.g. `updateEngagement`). | Denied — unauthenticated actor. | Pass/Fail — SECURE |
| 7.4 | As a Team Member who does NOT own a given engagement, replay `updateEngagement` for that specific engagement id (row-level, not just entity-level check). | Denied — `assertCanUpdateOwnScoped` re-fetches the record and checks `canUpdateRecord(role, entity, userId, record)`; owning it is required, not just having generic Engagements:U. | Pass/Fail — SECURE |
| 7.5 | As a Team Member who DOES own that engagement, repeat. | Succeeds. | Pass/Fail — |
| 7.6 | Attempt an engagement restage into an NDA-gated stage where the investor has no NDA (re-verify BUG-17's fix at the GraphQL layer directly, not just through the UI). | A real, human-readable `NdaGuardError` message surfaces (not "Unexpected error.") — confirm `mask-error.ts` still passes these through. | Pass/Fail — |
| 7.7 | Craft an obviously malformed/garbage GraphQL query against `/api/graphql`. | Clean GraphQL validation error, no stack trace or internal path leakage in the response body. | Pass/Fail — |

---

## 8. IDOR — investor accessing another investor's/deal's data

Confirmed by design: `loadInvestorPipeline`/deal-detail loaders always scope by the caller's own
`vp.recordId` from the server-derived viewpoint, never a client-supplied id; a requested deal id
outside the investor's own projected set resolves to `undefined` → `notFound()`.

| # | Step | Expected | Record result |
|---|---|---|---|
| 8.1 | As Investor A (`cmiriti@ifc.org`), note a deal id visible to a DIFFERENT investor only (one IFC has no engagement with and that isn't independently discoverable via IFC's mandate/sector/geo — get this id from an Admin session's full deal list). | Visiting `/portal/investor/deals/<that-id>` as IFC → 404 (not a masked/blocked view, a true not-found — confirm it isn't leaking even a masked card). | Pass/Fail — SECURE |
| 8.2 | As Investor A, attempt to craft an `expressInterest` form submission (or direct server-action call) with a `dealId` belonging to a deal outside A's visibility. | The action independently re-derives the deal from A's own scoped loader — write fails / 404s rather than creating an engagement on an invisible deal. | Pass/Fail — SECURE |
| 8.3 | As Investor A, attempt to view another investor's Fund Profile, Pipeline, or Dashboard by guessing/adjusting any id-bearing URL (if any such URL pattern exists — most portal pages are session-scoped with no id in the URL; confirm this is actually the case, i.e. there's no `?investorId=` param anywhere that could be tampered with). | No id-bearing URL exists for cross-investor data, OR if one does, tampering with it doesn't change whose data is shown (always the session's own `recordId`). | Pass/Fail — SECURE |
| 8.4 | As an excluded investor (e.g. IncoFin) or greylisted investor (e.g. Afrexim) — log in if credentials are available, or check via an Admin session what their classification is and attempt direct-URL access to `/portal/investor` and a specific deal id. | Sees nothing (blocked classification → empty portal, per prior confirmed behavior); direct deal-URL still resolves to nothing/404, no IDOR. | Pass/Fail — SECURE |
| 8.5 | As a signed-in Partner, attempt to view another partner's referral data by any id-bearing URL if one exists. | Scoped to own partner id only (`loadPartnerPortalData`, own profile + own referred deals). | Pass/Fail — SECURE |

---

## 9. Secrets hygiene — not in URL, not in console

| # | Step | Expected | Record result |
|---|---|---|---|
| 9.1 | Throughout the login, register, reset-password, and settings/users flows, watch the address bar. | No email address, password, or reset token ever appears as a URL query param (confirm `/register` internal routing uses a cookie, not `?email=`, per the 2026-07-09 finding). | Pass/Fail — |
| 9.2 | Open devtools console during login/register/reset flows. | No password, token, or OTP code ever logged to console (the ConsoleMailer OTP-sink behavior writing to a dev file is expected in non-prod — confirm it's not ALSO echoed to the browser console). | Pass/Fail — |
| 9.3 | Inspect network requests during these flows. | Passwords sent only over the POST body of the actual auth action, never in a GET query string; no request accidentally includes another user's data. | Pass/Fail — |
| 9.4 | Check `/settings/users` "Reset link" generation. | The generated reset URL/token is shown to the Admin inline (expected — it's an admin tool) but never leaks into browser history via a GET navigation with the token as a trackable query param beyond what's necessary, and the token is single-use per §5.8. | Pass/Fail — |

---

## Summary

- 46 numbered test cases across 9 subsections.
- Confirmed-fixed-in-code (verify live): BUG-08 (register field wipe), BUG-14 (express-interest form
  destruction), BUG-07 (advisor-type mismatch) — the latter two are re-verified in `03`/`04` but the
  root mechanism is auth/data-model, cross-referenced here too.
- Any Fail in §2, §3B, §7, or §8 is a P1 — stop and log immediately.
