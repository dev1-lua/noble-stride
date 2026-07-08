# Real Authentication for NobleStride CRM — Design

**Date:** 2026-07-08
**Branch:** `feat/real-auth` (worktree, based on `integration/all-features` @ 833de8f)
**Status:** Approved for implementation (decisions delegated to Claude's best recommendation by Shaurya, 2026-07-08)

## 1. Problem

The CRM has no real authentication. Identity is an **unsigned, non-httpOnly JSON cookie** (`ns_viewpoint`) that anyone can forge, and a **missing cookie means full admin**. `/login` accepts any password; `/register` verifies a fake OTP (`000000`). RBAC (`Admin/DealLead/TeamMember` matrix in `src/server/rbac/matrix.ts`) only hides buttons in React server components — the GraphQL mutation layer (`/api/graphql`) enforces nothing, so any direct request can create/update/delete every entity. External users (investors) have no accounts at all; they are `Person` rows matched by email.

This design replaces the demo auth with real email+password authentication, database-backed sessions, domain guardrails, server-side RBAC enforcement, and an admin approval workflow — while preserving the demo "view as" lens as a secure, admin-only impersonation feature.

## 2. Goals

1. Email + password signup and login for two populations:
   - **Internal** — `@noblestride.capital` emails only. Evans and Solomon are full-access **Admins**; other staff are **TeamMembers** (or **DealLeads**) with the existing restricted matrix.
   - **Investor** — official company email only; free-mail providers (gmail, yahoo, etc.) and greylisted domains are rejected.
2. Database-backed sessions with secure cookies; signed-out users cannot see or mutate anything.
3. RBAC enforced **server-side** (GraphQL mutations + server actions), not just in the UI.
4. Admin approval workflow for new accounts + an admin user-management page.
5. Password reset and lockout protections; no user-enumeration; audit trail of auth events.
6. Preserve the demo capability: admins can still "view as" an investor/partner/org-role via a **signed, admin-only** impersonation cookie.

## 3. Non-goals

- Partner self-serve accounts (partner portal remains reachable via admin impersonation; the account model is extensible to `PARTNER` later).
- OAuth/SSO (Google Workspace SSO is a natural later step for the internal side), MFA/TOTP, WebAuthn.
- Real email delivery. A `Mailer` interface is included; the dev implementation logs links to the server console. Swapping in SMTP/Resend later is a one-file change.
- Client (company-raising-capital) portal accounts.

## 4. Approaches considered

| | Approach | Verdict |
|---|---|---|
| A | **better-auth** library + Prisma adapter | Mature feature set, but it owns its own user/session/account table shapes and client/server API. Grafting it onto the existing 15-relation `User` model, Person-based external identity, server-action login flow, and viewpoint system means fighting the library at every seam. Rejected. |
| B | **Auth.js (next-auth v5)** credentials provider | Credentials provider forces JWT-strategy sessions — no server-side revocation (logout-all, suspend user, password-change invalidation). Email+password is explicitly a second-class citizen. Rejected. |
| C | **Custom DB-session auth** (Lucia pattern) | ~600 lines of well-understood code on standard primitives: argon2id hashing, opaque 256-bit tokens stored hashed (SHA-256), DB session rows, httpOnly cookies. Exact fit for the domain guardrails, approval workflow, Person/User dual identity, and impersonation overlay. `jose` (already installed) signs the impersonation cookie. **Chosen.** |

## 5. Data model (Prisma additions)

New models — no changes to existing model shapes (only new relation fields on `User`/`Person`):

```prisma
enum AccountKind { INTERNAL INVESTOR }          // PARTNER reserved for later
enum AccountStatus { PENDING ACTIVE SUSPENDED }
enum AuthTokenPurpose { RESET_PASSWORD VERIFY_EMAIL }

model AuthAccount {
  id            String        @id @default(cuid())
  email         String        @unique            // always stored lowercase
  passwordHash  String
  kind          AccountKind
  status        AccountStatus @default(PENDING)
  userId        String?       @unique            // INTERNAL → User
  personId      String?       @unique            // INVESTOR → Person (investor derived via person.investorId)
  failedLogins  Int           @default(0)
  lockedUntil   DateTime?
  lastLoginAt   DateTime?
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
  user     User?         @relation(...)
  person   Person?       @relation(...)
  sessions AuthSession[]
  tokens   AuthToken[]
}

model AuthSession {
  id         String   @id @default(cuid())
  tokenHash  String   @unique                    // sha256(opaque token); raw token never stored
  accountId  String
  account    AuthAccount @relation(..., onDelete: Cascade)
  expiresAt  DateTime
  createdAt  DateTime @default(now())
  lastUsedAt DateTime @default(now())
  ip         String?
  userAgent  String?
}

model AuthToken {                                 // password reset now; email verification later
  id        String   @id @default(cuid())
  tokenHash String   @unique
  accountId String
  account   AuthAccount @relation(..., onDelete: Cascade)
  purpose   AuthTokenPurpose
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime @default(now())
}
```

Migration is **additive only** (safe on the shared docker Postgres :5544 while other sessions run). Existing `OrgRole` on `User.role` becomes the real, persisted internal role.

## 6. Auth core (`src/server/auth/`)

One module per concern; all pure-logic parts unit-testable without Next:

- **`password.ts`** — argon2id via `@node-rs/argon2` (prebuilt Windows binaries; parameters: memory 19 MiB, iterations 2, parallelism 1 — OWASP baseline). `hashPassword` / `verifyPassword`; always run a dummy verify on unknown email to equalize timing.
- **`policy.ts`** — password policy: ≥ 10 chars, must not equal/contain the email local-part, top-common-password denylist (small embedded list). Zod schemas shared with the UI.
- **`guardrails.ts`** — domain rules:
  - `INTERNAL_DOMAIN = "noblestride.capital"` (exact match — replaces the loose `@noblestride.*` regex in `resolve-login.ts`).
  - `FREE_MAIL_DOMAINS` embedded list (gmail, googlemail, yahoo, outlook, hotmail, live, msn, icloud, me.com, aol, proton.me, protonmail, gmx, zoho, mail.com, yandex, …).
  - `classifyEmail(email)` → `internal | investor-eligible | blocked(reason)`; merges the existing `BlockedRegistration` greylist check.
- **`session.ts`** — `createSession(accountId)` generates 32 random bytes (base64url), stores `sha256` hash, returns raw token; `validateSessionToken(token)` looks up hash, checks expiry + account status, sliding renewal (30-day lifetime, extended when < 15 days remain; `lastUsedAt` updated at most hourly); `invalidateSession`, `invalidateAllSessions(accountId)`. Cookie: `ns_session`, httpOnly, `sameSite: "lax"`, `secure` in production, `path: "/"`.
- **`current.ts`** — `getCurrentAuth()`: React-`cache()`-wrapped per-request resolver. Reads `ns_session` → validated session → loads account + linked `User` or `Person`(+`Investor`) → returns `CurrentAuth | null`. The single source of identity for layouts, pages, server actions, and the GraphQL context.
- **`accounts.ts`** — signup, linking, approval, suspension:
  - Internal signup: email must classify `internal`. If it matches an existing directory `User` → account created **ACTIVE**, linked, role read from `User.role`. If not in the directory → **PENDING** (admin approves; approval creates the `User` row with an admin-chosen role, default TeamMember).
  - Investor signup (new investor): extends the existing `/register` wizard — wizard now also collects a password and creates `Investor(PendingReview)` + `Person` + **PENDING** `AuthAccount` in one transaction. Admin approval (existing onboarding review) activates the account.
  - Investor signup (existing contact): email matches a `Person` linked to an `Investor` → **PENDING** account linked to that Person. Admin approval required (substitutes for email-ownership verification while there is no SMTP).
  - All emails lowercased; generic responses to prevent enumeration ("If this address is eligible, your account is awaiting review").
- **`tokens.ts`** — single-use, hashed, 60-min-TTL reset tokens; consuming one sets the new password, clears lockout, and **revokes all sessions**.
- **`mailer.ts`** — `Mailer` interface + `ConsoleMailer` (logs reset links). Env-selectable later.
- **`rate-limit.ts`** — per-account lockout in DB (`failedLogins`; 10 fails → locked 15 min) + per-IP in-memory token bucket for `/login` + signup actions (best-effort, resets on deploy — acceptable at this scale).
- **`audit.ts`** — writes `Activity` rows (existing model) for: login success/failure, lockout, signup, approval/rejection, role change, suspension, password reset, impersonation start/stop.

## 7. Identity → viewpoint derivation (the key refactor)

`Viewpoint` stops being *stored* state and becomes *derived* state. All 26 files that call `getViewpoint()` keep working; only the source of truth changes.

- `src/server/viewpoint.ts` → `getViewpoint()` now:
  1. `getCurrentAuth()`. No session → `null` (callers redirect to `/login`). **The "no cookie = admin" default dies.**
  2. INTERNAL account → base viewpoint `{ role: "admin", orgRole: user.role, userId: user.id }`.
  3. INVESTOR account → `{ role: "investor", recordId: person.investorId }`.
  4. If (and only if) the base viewpoint is an **Admin** org-role and a valid **signed** impersonation cookie exists → overlay the impersonated lens with `impersonating: true`.
- **Impersonation cookie** replaces the forgeable `ns_viewpoint`: same payload, now a `jose` HS256 JWT signed with new env `AUTH_SECRET`, httpOnly, 8 h max age. `/api/viewpoint` (GET, kept so the switcher stays plain links) now **requires an Admin session**, signs the payload, and audits. `?role=signout` clears only the impersonation cookie ("Return to Admin"). Non-admins hitting it get 403.
- `parseViewpoint` in `src/lib/viewpoint.ts` loses its admin default (returns `null` on absence/garbage); `viewpointHome` unchanged. Existing viewpoint unit tests updated.
- Portal server actions (`expressInterest`, `saveFundProfile`, partner actions) re-derive `investorId`/`partnerId` from the session-backed viewpoint — never from raw cookies.

## 8. Route protection

Defense in depth — three layers, none trusted alone:

1. **`src/middleware.ts` (new)** — coarse, fast gate: no `ns_session` cookie → redirect to `/login?next=<path>` for `(crm)` routes and `/portal/*`; redirect `/login`/`/register` → home when a session cookie exists. Cookie *presence* only (no DB at the edge); never the sole protection (CVE-2025-29927 lesson).
2. **Layouts (real check)** — `(crm)/layout.tsx`: `getViewpoint()`; `null` → `redirect("/login")`; investor → `redirect(viewpointHome)`. `portal/investor/layout.tsx`: requires investor viewpoint (real or admin-impersonated); keeps the existing onboarding/classification restricted screens. A PENDING account session cannot exist (login refuses), but a mid-session suspension is caught here because `getCurrentAuth` re-checks account status per request.
3. **Mutation layer** — §9.

Landing `page.tsx`: session present → forward to `viewpointHome`; otherwise public landing (drop the raw-cookie-presence hack).

## 9. Server-side RBAC enforcement

- **GraphQL context** (`src/graphql/context.ts`): in addition to the existing Bearer-JWT API-actor path (unchanged), resolve the session cookie → `actor = { type: "HUMAN", userId, orgRole, accountKind }`. No session and no valid JWT → anonymous actor with **no mutation rights**.
- **Guard helper** `src/server/rbac/enforce.ts` — `assertCan(actor, entity, perm, record?)`: wraps the existing pure matrix (`can`, `canUpdateRecord`, `canDeleteRecord`); throws `GraphQLError("FORBIDDEN")`. Applied to **every mutation** in `src/graphql/mutations.ts` with the entity/perm it touches. INVESTOR accounts and anonymous callers: all mutations denied (investor writes flow through their own server actions). API/AGENT actors keep current behavior (JWT-authenticated automation path).
- **CSRF**: server actions are origin-checked by Next natively. `/api/graphql` additionally rejects cookie-authenticated POSTs whose `Origin` doesn't match the request host (Bearer-token requests exempt).
- The UI keeps using the same matrix to hide controls — now as UX, not as security.

## 10. Auth surfaces (pages & actions)

- **`/login`** — real form: email + password. Server action: guardrail classify → lockout check → verify → create session → set cookie in-action → redirect to `viewpointHome` (preserving the known Next redirect/Set-Cookie quirk). Generic failure message; "awaiting review" state for PENDING; lockout message without revealing counts. Demo banner removed.
- **`/register`** — email-first fork:
  - `@noblestride.capital` → internal path: name, job title, password → directory match ⇒ ACTIVE (then straight to login), else PENDING confirmation screen.
  - Company email → existing investor wizard (anti-broker gate intact) + password step; demo OTP **removed** (replaced by admin approval; `AuthTokenPurpose.VERIFY_EMAIL` reserved for when SMTP lands). Existing-contact emails short-circuit to "account request created, awaiting review".
  - Free-mail/greylisted → rejected with the existing blocked-registration UX.
- **Forgot password** — `/login` link → request form (generic response) → `ConsoleMailer` logs the reset URL → `/reset-password/[token]` sets a new policy-checked password, revokes all sessions.
- **Sign out** — topbar becomes a POST server action: delete session row + cookie. Impersonation "Return to Admin" stays separate.
- **Admin user management** — new `(crm)/settings/users` (Admin-only, server-enforced): pending-account queue (approve with role pick / reject), account list (kind, status, role, last login), actions: change role, suspend/reactivate (revokes sessions), generate reset link. Sidebar link gated to Admins.

## 11. Seeds & bootstrap

- `prisma/seed.ts`: create INTERNAL `AuthAccount`s (ACTIVE) for all 14 team users. `User.role` set explicitly: **evans@ / solomon@noblestride.capital → `Admin`**; jobTitle "Deal Lead" → `DealLead`; everyone else → `TeamMember`. Seed password from `SEED_USER_PASSWORD` env (default `NobleStride!Demo2026`, echoed in seed output).
- One demo INVESTOR account (ACTIVE) for a primary contact of an Approved seeded investor, so the portal is directly loggable-into.
- New env: `AUTH_SECRET` (impersonation JWT signing). No `.env.example` exists in the repo; generate a value into the worktree `.env` and document both `AUTH_SECRET` and `SEED_USER_PASSWORD` in the spec-adjacent plan and final report.

## 12. Testing

TDD throughout (vitest, existing setup; DB tests use the shared :5544 Postgres with self-cleaning `ZZ Test`/UNIQ markers):

- Unit: guardrails classification (internal/free-mail/greylist/case), password policy, session token round-trip + expiry + sliding renewal, reset-token single-use, `assertCan` matrix coverage, viewpoint derivation incl. impersonation overlay + non-admin rejection.
- Integration (DB): signup paths (directory-match ACTIVE, unknown-internal PENDING, new-investor transaction, existing-contact PENDING), login success/failure/lockout/suspension, approval activation, password reset revoking sessions.
- Existing suites (491 tests) stay green; viewpoint tests updated for the no-default change.
- Final end-to-end **Playwright verification pass at the end** (per working agreement): login as admin/member/investor, guardrail rejections, RBAC-denied direct GraphQL mutation, impersonation round-trip, sign-out.

## 13. Risks / notes

- **Shared DB**: migration is additive; seed changes re-run `npm run seed` only when explicitly executed — other worktrees unaffected until they pull this branch.
- **In-memory IP rate limiting** resets per process — acceptable now; swap for a table/redis later.
- **No SMTP**: admin approval substitutes for email-ownership verification. When email lands, enable `VERIFY_EMAIL` tokens for the existing-contact signup path (highest-risk path today, mitigated by human review).
- **`resolve-login.ts`** is superseded and removed with the demo login; `register-investor.ts` is extended, not replaced.
- Commits land on `feat/real-auth` only (isolated worktree); no push/merge without explicit go-ahead.
