# Real Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the forgeable demo viewpoint-cookie auth with real email+password authentication (argon2id, DB-backed sessions, domain guardrails, admin approval, server-enforced RBAC) per `docs/superpowers/specs/2026-07-08-real-authentication-design.md`.

**Architecture:** Custom DB-session auth (Lucia pattern). New `AuthAccount`/`AuthSession`/`AuthToken` Prisma models link credentials to the existing `User` (internal) and `Person` (investor) identities. `Viewpoint` becomes *derived* from the session; the demo "view as" lens survives as an admin-only, jose-signed impersonation cookie. RBAC matrix (`src/server/rbac/matrix.ts`) is finally enforced server-side in the GraphQL mutation layer.

**Tech Stack:** Next.js 16.2.9 (App Router, RSC, server actions), Prisma 6.19.3 + Postgres (docker, host port **5544**), `jose` 6.x (already installed), `@node-rs/argon2` (new dep), zod 4, vitest 4, graphql-yoga/pothos.

## Global Constraints

- **Working directory for all commands:** `D:\LuaWork\NobleStride\noble-stride\.claude\worktrees\real-auth\noblestride-crm` (all file paths below are relative to this unless they start with `docs/`, which is repo-root).
- **Package manager:** `corepack pnpm ...` — NEVER npm/yarn. Node 22.
- **Tests:** `DATABASE_URL="postgresql://noblestride:noblestride@localhost:5544/noblestride" corepack pnpm exec vitest run <path>` — vitest does NOT auto-load `.env`. DB tests must self-clean and use `ZZ Test` / `UNIQ-` markers in names — NEVER truncate demo data.
- **Baseline (must not regress):** `tsc --noEmit` = 0 errors; vitest = 489/489 passing; lint has 8 pre-existing errors / 3 warnings (don't add new ones).
- **Internal domain:** exactly `noblestride.capital`. Admin bootstrap emails: `evans@noblestride.capital`, `solomon@noblestride.capital`.
- **Cookies:** session cookie `ns_session` (httpOnly, sameSite lax, secure in prod, path /). Impersonation cookie keeps the name `ns_viewpoint` (now a signed JWT, httpOnly).
- **Server-action cookie quirk:** auth cookies MUST be set inside the server action before `redirect()` — never via a redirect through a route handler (the client router drops route-handler `Set-Cookie` on server-action redirects).
- **Never** log or store raw session/reset tokens — store SHA-256 hashes only.
- **Commits:** land on `feat/real-auth` only. NEVER push, NEVER merge, NEVER commit `src/generated/pothos-types.ts` churn (revert it if it shows up in `git status`).
- Existing UI conventions: CSS variables like `var(--bg-primary)`, `inputClass`/`labelClass` string constants, error round-trips via query params or `useActionState`. Follow them.

---

### Task 1: Prisma auth models + migration + env secrets

**Files:**
- Modify: `prisma/schema.prisma` (add enums + 3 models; add back-relations to `User` and `Person`)
- Modify: `.env` (append `AUTH_SECRET`, `SEED_USER_PASSWORD`)

**Interfaces:**
- Produces: Prisma models `AuthAccount`, `AuthSession`, `AuthToken`; enums `AccountKind { INTERNAL INVESTOR }`, `AccountStatus { PENDING ACTIVE SUSPENDED }`, `AuthTokenPurpose { RESET_PASSWORD VERIFY_EMAIL }`; `User.authAccount`, `Person.authAccount` optional back-relations. Env vars `AUTH_SECRET`, `SEED_USER_PASSWORD`.

- [ ] **Step 1: Add models to `prisma/schema.prisma`**

Append at the end of the file (after the last model):

```prisma
// ─────────────────────────────────────────────────────────────────────────────
// Real authentication (design spec 2026-07-08): credentials + DB sessions.
// AuthAccount links to User (internal staff) or Person (investor contact).
// ─────────────────────────────────────────────────────────────────────────────

enum AccountKind {
  INTERNAL
  INVESTOR
}

enum AccountStatus {
  PENDING
  ACTIVE
  SUSPENDED
}

enum AuthTokenPurpose {
  RESET_PASSWORD
  VERIFY_EMAIL
}

model AuthAccount {
  id           String        @id @default(cuid())
  email        String        @unique // always stored lowercase
  passwordHash String
  kind         AccountKind
  status       AccountStatus @default(PENDING)
  // Pre-approval signup details for internal accounts not yet in the directory:
  displayName  String?
  jobTitle     String?
  userId       String?       @unique
  user         User?         @relation(fields: [userId], references: [id], onDelete: Cascade)
  personId     String?       @unique
  person       Person?       @relation(fields: [personId], references: [id], onDelete: Cascade)
  failedLogins Int           @default(0)
  lockedUntil  DateTime?
  lastLoginAt  DateTime?
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt

  sessions AuthSession[]
  tokens   AuthToken[]

  @@index([kind, status])
}

model AuthSession {
  id         String      @id @default(cuid())
  tokenHash  String      @unique // sha256 hex of the opaque token; raw token never stored
  accountId  String
  account    AuthAccount @relation(fields: [accountId], references: [id], onDelete: Cascade)
  expiresAt  DateTime
  createdAt  DateTime    @default(now())
  lastUsedAt DateTime    @default(now())
  ip         String?
  userAgent  String?

  @@index([accountId])
}

model AuthToken {
  id        String           @id @default(cuid())
  tokenHash String           @unique
  accountId String
  account   AuthAccount      @relation(fields: [accountId], references: [id], onDelete: Cascade)
  purpose   AuthTokenPurpose
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime         @default(now())

  @@index([accountId])
}
```

- [ ] **Step 2: Add back-relations**

In `model User` (line ~464), after `savedViews   SavedView[] @relation("SavedViewCreatedBy")` add:

```prisma
  authAccount AuthAccount?
```

In `model Person` (line ~490), after `ssaForInvestors Investor[] @relation("InvestorSsaContact")` add:

```prisma
  authAccount AuthAccount?
```

- [ ] **Step 3: Run the migration (additive only — shared DB, other sessions may be live)**

```bash
DATABASE_URL="postgresql://noblestride:noblestride@localhost:5544/noblestride" corepack pnpm exec prisma migrate dev --name real-auth-models
```

Expected: `Your database is now in sync with your schema.` and a new folder `prisma/migrations/*_real_auth_models/`. Confirm the generated SQL contains only `CREATE TYPE` / `CREATE TABLE` / `CREATE INDEX` / `ALTER TABLE ... ADD CONSTRAINT` — no `DROP` on existing tables.

- [ ] **Step 4: Append env secrets to `.env`**

```bash
node -e "console.log('AUTH_SECRET='+require('crypto').randomBytes(32).toString('base64url'))" >> .env
echo 'SEED_USER_PASSWORD=NobleStride!Demo2026' >> .env
```

(`.env` is gitignored — verify with `git status` that it does not appear.)

- [ ] **Step 5: Verify tsc + existing tests still pass**

```bash
corepack pnpm exec tsc --noEmit
DATABASE_URL="postgresql://noblestride:noblestride@localhost:5544/noblestride" corepack pnpm exec vitest run
```

Expected: 0 tsc errors; 489 tests pass.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(auth): AuthAccount/AuthSession/AuthToken models + migration"
```

(Revert `src/generated/pothos-types.ts` churn first if present: `git checkout -- src/generated/pothos-types.ts`.)

---

### Task 2: Email guardrails module

**Files:**
- Create: `src/server/auth/guardrails.ts`
- Test: `src/server/auth/__tests__/guardrails.test.ts`

**Interfaces:**
- Consumes: `emailDomain`, `isFreeEmailDomain` from `@/lib/corporate-email` (existing); `isRegistrationBlocked` from `@/server/onboarding/register-investor` (existing).
- Produces:
  - `INTERNAL_EMAIL_DOMAIN = "noblestride.capital"`
  - `normalizeEmail(email: string): string`
  - `type EmailClass = { kind: "internal" } | { kind: "external" } | { kind: "blocked"; reason: "invalid" | "free-provider" }`
  - `classifyEmail(email: string): EmailClass` (pure)
  - `classifyEmailForSignup(email: string): Promise<EmailClass | { kind: "blocked"; reason: "greylisted" }>` (adds `BlockedRegistration` greylist)

- [ ] **Step 1: Write the failing test**

Create `src/server/auth/__tests__/guardrails.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { classifyEmail, normalizeEmail, INTERNAL_EMAIL_DOMAIN } from "../guardrails";

describe("normalizeEmail", () => {
  it("lowercases and trims", () => {
    expect(normalizeEmail("  Evans@NobleStride.Capital ")).toBe("evans@noblestride.capital");
  });
});

describe("classifyEmail", () => {
  it("classifies @noblestride.capital as internal (case-insensitive)", () => {
    expect(classifyEmail("evans@noblestride.capital")).toEqual({ kind: "internal" });
    expect(classifyEmail("Solomon@NOBLESTRIDE.CAPITAL")).toEqual({ kind: "internal" });
  });
  it("does NOT treat other noblestride TLDs as internal (tightens old @noblestride.* regex)", () => {
    expect(classifyEmail("x@noblestride.com")).toEqual({ kind: "external" });
  });
  it("classifies corporate emails as external", () => {
    expect(classifyEmail("jane@acmefund.com")).toEqual({ kind: "external" });
  });
  it("blocks free providers", () => {
    expect(classifyEmail("jane@gmail.com")).toEqual({ kind: "blocked", reason: "free-provider" });
    expect(classifyEmail("jane@yahoo.com")).toEqual({ kind: "blocked", reason: "free-provider" });
    expect(classifyEmail("jane@outlook.com")).toEqual({ kind: "blocked", reason: "free-provider" });
  });
  it("blocks malformed emails", () => {
    expect(classifyEmail("not-an-email")).toEqual({ kind: "blocked", reason: "invalid" });
    expect(classifyEmail("@nodomain")).toEqual({ kind: "blocked", reason: "invalid" });
  });
  it("exports the exact internal domain", () => {
    expect(INTERNAL_EMAIL_DOMAIN).toBe("noblestride.capital");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
corepack pnpm exec vitest run src/server/auth/__tests__/guardrails.test.ts
```

Expected: FAIL — cannot resolve `../guardrails`.

- [ ] **Step 3: Write the implementation**

Create `src/server/auth/guardrails.ts`:

```ts
// Email guardrails (real-auth spec §6): who may hold which kind of account.
// - @noblestride.capital (exact) → internal staff
// - other corporate domains → investor-eligible ("external")
// - free providers / malformed / greylisted → blocked
// Pure classify + async variant that adds the BlockedRegistration greylist.

import { emailDomain, isFreeEmailDomain } from "@/lib/corporate-email";
import { isRegistrationBlocked } from "@/server/onboarding/register-investor";

export const INTERNAL_EMAIL_DOMAIN = "noblestride.capital";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export type EmailClass =
  | { kind: "internal" }
  | { kind: "external" }
  | { kind: "blocked"; reason: "invalid" | "free-provider" };

export function classifyEmail(email: string): EmailClass {
  const domain = emailDomain(normalizeEmail(email));
  if (!domain) return { kind: "blocked", reason: "invalid" };
  if (domain === INTERNAL_EMAIL_DOMAIN) return { kind: "internal" };
  if (isFreeEmailDomain(domain)) return { kind: "blocked", reason: "free-provider" };
  return { kind: "external" };
}

export type SignupEmailClass = EmailClass | { kind: "blocked"; reason: "greylisted" };

/** classifyEmail + the BlockedRegistration greylist (DB). */
export async function classifyEmailForSignup(email: string): Promise<SignupEmailClass> {
  const base = classifyEmail(email);
  if (base.kind !== "external") return base;
  if (await isRegistrationBlocked(normalizeEmail(email))) {
    return { kind: "blocked", reason: "greylisted" };
  }
  return base;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
corepack pnpm exec vitest run src/server/auth/__tests__/guardrails.test.ts
```

Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/server/auth
git commit -m "feat(auth): email guardrails — internal domain, free-mail block, greylist"
```

---

### Task 3: Password hashing + policy

**Files:**
- Create: `src/server/auth/password.ts`
- Create: `src/server/auth/policy.ts`
- Test: `src/server/auth/__tests__/password.test.ts`
- Modify: `package.json` (new dep `@node-rs/argon2`)

**Interfaces:**
- Produces:
  - `hashPassword(password: string): Promise<string>`
  - `verifyPassword(hash: string, password: string): Promise<boolean>`
  - `DUMMY_HASH: string` (verify-target for unknown emails — timing equalization)
  - `validatePassword(password: string, email?: string): string | null` (error message or null)

- [ ] **Step 1: Install argon2 (prebuilt Windows binaries)**

```bash
corepack pnpm add @node-rs/argon2
```

Expected: added to `dependencies`, install succeeds. Sanity-check the native binding loads:

```bash
node -e "const a=require('@node-rs/argon2'); a.hash('x').then(h=>console.log(h.slice(0,20)))"
```

Expected: prints a string starting `$argon2id$`.

- [ ] **Step 2: Write the failing test**

Create `src/server/auth/__tests__/password.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword, DUMMY_HASH } from "../password";
import { validatePassword } from "../policy";

describe("password hashing", () => {
  it("hashes with argon2id and round-trips", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword(hash, "correct horse battery")).toBe(true);
    expect(await verifyPassword(hash, "wrong password!!")).toBe(false);
  });
  it("verifyPassword never throws on garbage hashes", async () => {
    expect(await verifyPassword("not-a-hash", "x")).toBe(false);
  });
  it("DUMMY_HASH is a valid argon2id hash that matches nothing we use", async () => {
    expect(DUMMY_HASH).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword(DUMMY_HASH, "anything")).toBe(false);
  });
});

describe("validatePassword", () => {
  it("rejects short passwords", () => {
    expect(validatePassword("short1!")).toMatch(/at least 10/);
  });
  it("rejects common passwords", () => {
    expect(validatePassword("password12")).toMatch(/too common/i);
  });
  it("rejects passwords containing the email local part", () => {
    expect(validatePassword("evans-secret-1", "evans@noblestride.capital")).toMatch(/email/i);
  });
  it("accepts a strong password", () => {
    expect(validatePassword("tr0ub4dor&horse", "evans@noblestride.capital")).toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
corepack pnpm exec vitest run src/server/auth/__tests__/password.test.ts
```

Expected: FAIL — cannot resolve `../password`.

- [ ] **Step 4: Write the implementations**

Create `src/server/auth/password.ts`:

```ts
// argon2id hashing (OWASP baseline params: 19 MiB memory, t=2, p=1).
// DUMMY_HASH is verified against when the email has no account, so login
// timing does not reveal whether an address exists.

import { hash, verify } from "@node-rs/argon2";

const ARGON2_OPTS = { memoryCost: 19456, timeCost: 2, parallelism: 1 };

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTS);
}

export async function verifyPassword(hashStr: string, password: string): Promise<boolean> {
  try {
    return await verify(hashStr, password, ARGON2_OPTS);
  } catch {
    return false; // malformed/legacy hash → never throws into callers
  }
}

// Pre-computed hash of an unguessable random value (regenerating per boot is
// fine too, but a constant keeps cold-start cheap). Matches no real password.
export const DUMMY_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$c2VjdXJlLXN0YXRpYy1zYWx0$T9aY5cCvIWaAvUJ9pd7UOTFAlL/O6P4W1cSXR8HZ2Fk";
```

Create `src/server/auth/policy.ts`:

```ts
// Password policy (real-auth spec §6): length ≥ 10, not a top-common password,
// must not contain the email local-part. Returns a user-safe error or null.

const COMMON_PASSWORDS = new Set([
  "password12", "password123", "1234567890", "qwertyuiop", "1q2w3e4r5t",
  "iloveyou12", "admin12345", "welcome123", "letmein123", "monkey12345",
  "dragon12345", "sunshine123", "princess123", "football123", "baseball123",
  "trustno1234", "superman123", "noblestride", "noblestride1", "noblestride123",
]);

export function validatePassword(password: string, email?: string): string | null {
  if (password.length < 10) return "Password must be at least 10 characters.";
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return "That password is too common — pick something less guessable.";
  if (email) {
    const local = email.split("@")[0]?.toLowerCase();
    if (local && local.length >= 3 && password.toLowerCase().includes(local)) {
      return "Password must not contain your email name.";
    }
  }
  return null;
}
```

- [ ] **Step 5: Fix DUMMY_HASH**

The constant above is illustrative — generate a real one and paste it in:

```bash
node -e "require('@node-rs/argon2').hash(require('crypto').randomBytes(32).toString('hex'),{memoryCost:19456,timeCost:2,parallelism:1}).then(h=>console.log(h))"
```

Replace the `DUMMY_HASH` value in `src/server/auth/password.ts` with the printed hash.

- [ ] **Step 6: Run test to verify it passes**

```bash
corepack pnpm exec vitest run src/server/auth/__tests__/password.test.ts
```

Expected: PASS (7 tests).

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml src/server/auth
git commit -m "feat(auth): argon2id password hashing + password policy"
```

---

### Task 4: Session store + reset-token store

**Files:**
- Create: `src/server/auth/session.ts` (Next-free, vitest-testable)
- Create: `src/server/auth/session-cookie.ts` (next/headers helpers)
- Create: `src/server/auth/tokens.ts`
- Test: `src/server/auth/__tests__/session.smoke.test.ts` (DB)

**Interfaces:**
- Consumes: Task 1 models; `prisma` from `@/lib/db`.
- Produces:
  - `generateSessionToken(): string`, `hashToken(raw: string): string`
  - `createSession(accountId: string, meta?: { ip?: string; userAgent?: string }): Promise<{ token: string; expiresAt: Date }>`
  - `validateSessionToken(token: string): Promise<{ session: AuthSession; account: AuthAccount } | null>` — null on unknown/expired/non-ACTIVE account; deletes expired rows; sliding renewal (30-day life, extend when < 15 days left; `lastUsedAt` bumped at most hourly)
  - `invalidateSession(sessionId: string)`, `invalidateAllSessions(accountId: string)`
  - `SESSION_COOKIE = "ns_session"`, `setSessionCookie(token, expiresAt)`, `clearSessionCookie()`
  - `createAuthToken(accountId: string, purpose: AuthTokenPurpose, ttlMs?: number): Promise<string>` (returns raw token, default TTL 60 min)
  - `consumeAuthToken(raw: string, purpose: AuthTokenPurpose): Promise<AuthAccount | null>` (single-use)

- [ ] **Step 1: Write the failing test**

Create `src/server/auth/__tests__/session.smoke.test.ts` (follow the `withDb` guard convention used in `src/server/onboarding/__tests__/resolve-login.smoke.test.ts` — read that file first and mirror its describe-skip pattern so the suite skips without `DATABASE_URL`):

```ts
import { afterAll, describe, expect, it } from "vitest";

const hasDb = Boolean(process.env.DATABASE_URL);
const d = hasDb ? describe : describe.skip;

d("auth session store (DB)", () => {
  const cleanupEmails = ["zz-test-session-UNIQ@example-authtest.com"];

  afterAll(async () => {
    const { prisma } = await import("@/lib/db");
    await prisma.authAccount.deleteMany({ where: { email: { in: cleanupEmails } } });
  });

  async function makeAccount() {
    const { prisma } = await import("@/lib/db");
    return prisma.authAccount.upsert({
      where: { email: cleanupEmails[0] },
      create: { email: cleanupEmails[0], passwordHash: "x", kind: "INVESTOR", status: "ACTIVE" },
      update: { status: "ACTIVE" },
    });
  }

  it("creates and validates a session; raw token is not stored", async () => {
    const { prisma } = await import("@/lib/db");
    const { createSession, validateSessionToken, hashToken } = await import("../session");
    const account = await makeAccount();
    const { token } = await createSession(account.id);
    expect(token.length).toBeGreaterThanOrEqual(40);
    const stored = await prisma.authSession.findUnique({ where: { tokenHash: hashToken(token) } });
    expect(stored).not.toBeNull();
    expect(stored!.tokenHash).not.toBe(token);
    const validated = await validateSessionToken(token);
    expect(validated?.account.id).toBe(account.id);
  });

  it("rejects unknown and expired tokens", async () => {
    const { prisma } = await import("@/lib/db");
    const { createSession, validateSessionToken, hashToken } = await import("../session");
    expect(await validateSessionToken("no-such-token-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")).toBeNull();
    const account = await makeAccount();
    const { token } = await createSession(account.id);
    await prisma.authSession.update({
      where: { tokenHash: hashToken(token) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await validateSessionToken(token)).toBeNull();
    // expired row is deleted
    expect(await prisma.authSession.findUnique({ where: { tokenHash: hashToken(token) } })).toBeNull();
  });

  it("rejects sessions of non-ACTIVE accounts and invalidateAllSessions works", async () => {
    const { prisma } = await import("@/lib/db");
    const { createSession, validateSessionToken, invalidateAllSessions } = await import("../session");
    const account = await makeAccount();
    const { token } = await createSession(account.id);
    await prisma.authAccount.update({ where: { id: account.id }, data: { status: "SUSPENDED" } });
    expect(await validateSessionToken(token)).toBeNull();
    await prisma.authAccount.update({ where: { id: account.id }, data: { status: "ACTIVE" } });
    const { token: token2 } = await createSession(account.id);
    await invalidateAllSessions(account.id);
    expect(await validateSessionToken(token2)).toBeNull();
  });

  it("reset tokens are single-use and purpose-scoped", async () => {
    const { createAuthToken, consumeAuthToken } = await import("../tokens");
    const account = await makeAccount();
    const raw = await createAuthToken(account.id, "RESET_PASSWORD");
    expect(await consumeAuthToken(raw, "VERIFY_EMAIL")).toBeNull(); // wrong purpose
    const consumed = await consumeAuthToken(raw, "RESET_PASSWORD");
    expect(consumed?.id).toBe(account.id);
    expect(await consumeAuthToken(raw, "RESET_PASSWORD")).toBeNull(); // single-use
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
DATABASE_URL="postgresql://noblestride:noblestride@localhost:5544/noblestride" corepack pnpm exec vitest run src/server/auth/__tests__/session.smoke.test.ts
```

Expected: FAIL — cannot resolve `../session`.

- [ ] **Step 3: Implement `src/server/auth/session.ts`**

```ts
// DB-backed sessions (Lucia pattern): opaque 256-bit token in the cookie,
// sha256 hash at rest. Sliding renewal. Next-free so vitest can import it.

import { createHash, randomBytes } from "node:crypto";
import type { AuthAccount, AuthSession } from "@prisma/client";
import { prisma } from "@/lib/db";

export const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const RENEW_WHEN_REMAINING_MS = 15 * 24 * 60 * 60 * 1000; // extend when < 15 days left
const TOUCH_INTERVAL_MS = 60 * 60 * 1000; // bump lastUsedAt at most hourly

export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export async function createSession(
  accountId: string,
  meta?: { ip?: string; userAgent?: string },
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);
  await prisma.authSession.create({
    data: { tokenHash: hashToken(token), accountId, expiresAt, ip: meta?.ip, userAgent: meta?.userAgent },
  });
  return { token, expiresAt };
}

export type ValidatedSession = { session: AuthSession; account: AuthAccount };

export async function validateSessionToken(token: string): Promise<ValidatedSession | null> {
  const row = await prisma.authSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { account: true },
  });
  if (!row) return null;
  const now = Date.now();
  if (row.expiresAt.getTime() <= now) {
    await prisma.authSession.delete({ where: { id: row.id } }).catch(() => {});
    return null;
  }
  if (row.account.status !== "ACTIVE") return null;

  const updates: { expiresAt?: Date; lastUsedAt?: Date } = {};
  if (row.expiresAt.getTime() - now < RENEW_WHEN_REMAINING_MS) {
    updates.expiresAt = new Date(now + SESSION_LIFETIME_MS);
  }
  if (now - row.lastUsedAt.getTime() > TOUCH_INTERVAL_MS) {
    updates.lastUsedAt = new Date(now);
  }
  if (Object.keys(updates).length > 0) {
    await prisma.authSession.update({ where: { id: row.id }, data: updates }).catch(() => {});
    if (updates.expiresAt) row.expiresAt = updates.expiresAt;
  }
  const { account, ...session } = row;
  return { session, account };
}

export async function invalidateSession(sessionId: string): Promise<void> {
  await prisma.authSession.deleteMany({ where: { id: sessionId } });
}

export async function invalidateAllSessions(accountId: string): Promise<void> {
  await prisma.authSession.deleteMany({ where: { accountId } });
}
```

- [ ] **Step 4: Implement `src/server/auth/session-cookie.ts`**

```ts
// Cookie half of the session layer — separated so session.ts stays Next-free.
// MUST be called from a server action or route handler (cookie mutation).

import { cookies } from "next/headers";

export const SESSION_COOKIE = "ns_session";

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
```

- [ ] **Step 5: Implement `src/server/auth/tokens.ts`**

```ts
// Single-use auth tokens (password reset now, email verification later).
// Same hash-at-rest rule as sessions.

import type { AuthAccount, AuthTokenPurpose } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { hashToken } from "./session";

const DEFAULT_TTL_MS = 60 * 60 * 1000; // 60 min

export async function createAuthToken(
  accountId: string,
  purpose: AuthTokenPurpose,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<string> {
  const raw = randomBytes(32).toString("base64url");
  await prisma.authToken.create({
    data: { tokenHash: hashToken(raw), accountId, purpose, expiresAt: new Date(Date.now() + ttlMs) },
  });
  return raw;
}

/** Marks the token used and returns its account, or null (unknown/expired/used/wrong purpose). */
export async function consumeAuthToken(raw: string, purpose: AuthTokenPurpose): Promise<AuthAccount | null> {
  const row = await prisma.authToken.findUnique({
    where: { tokenHash: hashToken(raw) },
    include: { account: true },
  });
  if (!row || row.purpose !== purpose || row.usedAt || row.expiresAt.getTime() <= Date.now()) return null;
  // Guard against concurrent consumption: only one updateMany can win.
  const claimed = await prisma.authToken.updateMany({
    where: { id: row.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (claimed.count === 0) return null;
  return row.account;
}
```

- [ ] **Step 6: Run test to verify it passes**

```bash
DATABASE_URL="postgresql://noblestride:noblestride@localhost:5544/noblestride" corepack pnpm exec vitest run src/server/auth/__tests__/session.smoke.test.ts
```

Expected: PASS (4 tests).

- [ ] **Step 7: Commit**

```bash
git add src/server/auth
git commit -m "feat(auth): DB session store, cookie helpers, single-use auth tokens"
```

---

### Task 5: Signed impersonation lens + `parseViewpoint` loses its admin default

**Files:**
- Create: `src/server/auth/impersonation.ts`
- Modify: `src/lib/viewpoint.ts`
- Test: `src/lib/__tests__/viewpoint.test.ts` (update), `src/server/auth/__tests__/impersonation.test.ts` (new)

**Interfaces:**
- Consumes: `Viewpoint`, `serializeViewpoint` from `@/lib/viewpoint`; `jose` `SignJWT`/`jwtVerify`; env `AUTH_SECRET`.
- Produces:
  - `parseViewpoint(raw): Viewpoint | null` — **breaking change**: returns `null` (not `ADMIN_VIEWPOINT`) for missing/garbage input. `ADMIN_VIEWPOINT` export stays.
  - `signImpersonation(vp: Viewpoint): Promise<string>` (HS256 JWT, 8 h expiry, payload `{ vp: serializeViewpoint(vp) }`)
  - `verifyImpersonation(jwt: string | undefined): Promise<Viewpoint | null>`
  - `IMPERSONATION_COOKIE = "ns_viewpoint"` (exported from `impersonation.ts`)

- [ ] **Step 1: Update the viewpoint unit tests**

In `src/lib/__tests__/viewpoint.test.ts`: read the existing file. Change every assertion that expects `parseViewpoint(undefined)` / `parseViewpoint("garbage")` / cookie-absent cases to resolve to `ADMIN_VIEWPOINT` — they must now expect `null`. Keep all assertions about valid investor/partner/orgRole payloads unchanged (valid payloads still parse to the same viewpoints). Add:

```ts
it("returns null for missing or malformed input (real-auth: no default identity)", () => {
  expect(parseViewpoint(undefined)).toBeNull();
  expect(parseViewpoint(null)).toBeNull();
  expect(parseViewpoint("")).toBeNull();
  expect(parseViewpoint("not-json")).toBeNull();
  expect(parseViewpoint(JSON.stringify({ role: "investor" }))).toBeNull(); // external without recordId
});
```

- [ ] **Step 2: Run to verify the updated tests fail**

```bash
corepack pnpm exec vitest run src/lib/__tests__/viewpoint.test.ts
```

Expected: FAIL on the new/changed assertions.

- [ ] **Step 3: Modify `src/lib/viewpoint.ts`**

Replace `parseViewpoint` (keep the rest of the file — types, `serializeViewpoint`, `viewpointHome`, `ADMIN_VIEWPOINT` — unchanged):

```ts
export function parseViewpoint(raw: string | undefined | null): Viewpoint | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as {
      role?: string;
      recordId?: string;
      orgRole?: string;
      userId?: string;
      impersonating?: boolean;
    };
    if (parsed.role === "investor" || parsed.role === "partner") {
      if (!parsed.recordId) return null;
      const vp: Viewpoint = { role: parsed.role, recordId: parsed.recordId };
      if (parsed.impersonating === true) vp.impersonating = true;
      return vp;
    }
    if (parsed.role !== "admin") return null;
    const orgRole = ORG_ROLES.includes(parsed.orgRole as OrgRoleLens)
      ? (parsed.orgRole as OrgRoleLens)
      : "Admin";
    if (orgRole === "Admin") return ADMIN_VIEWPOINT;
    return { role: "admin", orgRole, userId: parsed.userId };
  } catch {
    return null;
  }
}
```

Also update the file-top comment: the cookie is now a *signed admin impersonation lens*, no longer the identity.

- [ ] **Step 4: Write failing impersonation test**

Create `src/server/auth/__tests__/impersonation.test.ts`:

```ts
import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret-at-least-32-chars-long!!";
});

describe("impersonation lens JWT", () => {
  it("signs and verifies a viewpoint round-trip", async () => {
    const { signImpersonation, verifyImpersonation } = await import("../impersonation");
    const jwt = await signImpersonation({ role: "investor", recordId: "inv_1", impersonating: true });
    const vp = await verifyImpersonation(jwt);
    expect(vp).toEqual({ role: "investor", recordId: "inv_1", impersonating: true });
  });
  it("rejects tampered and unsigned values", async () => {
    const { verifyImpersonation } = await import("../impersonation");
    expect(await verifyImpersonation(undefined)).toBeNull();
    expect(await verifyImpersonation("garbage")).toBeNull();
    expect(await verifyImpersonation(JSON.stringify({ role: "admin" }))).toBeNull(); // old unsigned format
  });
});
```

- [ ] **Step 5: Run to verify it fails, then implement `src/server/auth/impersonation.ts`**

```bash
corepack pnpm exec vitest run src/server/auth/__tests__/impersonation.test.ts
```

```ts
// Admin-only "view as" lens (real-auth spec §7): the old ns_viewpoint cookie,
// now a signed 8h JWT. Only honored when the REAL session belongs to an Admin
// (enforced by the reader in server/viewpoint.ts, not here).

import { SignJWT, jwtVerify } from "jose";
import { parseViewpoint, serializeViewpoint, type Viewpoint } from "@/lib/viewpoint";

export const IMPERSONATION_COOKIE = "ns_viewpoint";
const MAX_AGE_S = 8 * 60 * 60;

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(s);
}

export async function signImpersonation(vp: Viewpoint): Promise<string> {
  return new SignJWT({ vp: serializeViewpoint(vp) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_S}s`)
    .sign(secret());
}

export async function verifyImpersonation(jwt: string | undefined): Promise<Viewpoint | null> {
  if (!jwt) return null;
  try {
    const { payload } = await jwtVerify(jwt, secret());
    return parseViewpoint(typeof payload.vp === "string" ? payload.vp : null);
  } catch {
    return null;
  }
}
```

- [ ] **Step 6: Fix remaining compile errors from the signature change**

`parseViewpoint` now returns `Viewpoint | null`. Run `corepack pnpm exec tsc --noEmit` and fix ONLY type errors, minimally — the behavioral rewrite of these files happens in Tasks 8–9:
- `src/app/page.tsx` (~line 19): `if (raw) { const vp = parseViewpoint(raw); if (vp) redirect(viewpointHome(vp)); }`
- `src/app/api/viewpoint/route.ts` (~line 17): `const vp = parseViewpoint(...); if (!vp) return NextResponse.redirect(new URL("/", req.url));` then proceed as before.
- `src/server/viewpoint.ts`: `return parseViewpoint(...) ?? ADMIN_VIEWPOINT;` (temporary — Task 8 rewrites this file; import `ADMIN_VIEWPOINT`).
- `src/app/login/actions.ts` compiles unchanged (it only serializes).

- [ ] **Step 7: Run full check**

```bash
corepack pnpm exec tsc --noEmit
DATABASE_URL="postgresql://noblestride:noblestride@localhost:5544/noblestride" corepack pnpm exec vitest run
```

Expected: 0 tsc errors, all tests pass (489 + new).

- [ ] **Step 8: Commit**

```bash
git add src/lib/viewpoint.ts src/lib/__tests__/viewpoint.test.ts src/server/auth src/app/page.tsx src/app/api/viewpoint/route.ts src/server/viewpoint.ts
git commit -m "feat(auth): signed impersonation lens; parseViewpoint loses default-admin"
```

---

### Task 6: Accounts core — signup, approval, suspension, audit

**Files:**
- Create: `src/server/auth/accounts.ts`
- Create: `src/server/auth/audit.ts`
- Test: `src/server/auth/__tests__/accounts.smoke.test.ts` (DB)

**Interfaces:**
- Consumes: Tasks 2–4 (`classifyEmail*`, `normalizeEmail`, `hashPassword`, `validatePassword`, `invalidateAllSessions`); `prisma`.
- Produces:
  - `class AuthFlowError extends Error` (message is user-safe)
  - `signupInternal(input: { email; name; jobTitle?; password }): Promise<{ status: "active" | "pending" }>`
  - `signupExistingContact(input: { email; password }): Promise<{ status: "pending" }>` — email must match a `Person` with an `investorId`
  - `approveInternalAccount(accountId: string, role: OrgRole, approvedByUserId: string): Promise<void>` — creates the `User` row, links, ACTIVE
  - `activateAccountsForInvestor(investorId: string): Promise<void>` / `suspendAccountsForInvestor(investorId: string): Promise<void>` — used by investor onboarding review (Task 12 wires them into `setOnboardingStatus`/`greylistInvestor`)
  - `suspendAccount(accountId, byUserId)`, `reactivateAccount(accountId, byUserId)`, `rejectPendingAccount(accountId, byUserId)` (deletes PENDING account), `changeInternalRole(accountId, role, byUserId)`
  - `audit.ts`: `logAuthEvent(subject: string, body?: string, opts?: { investorId?: string }): Promise<void>` (Activity row, `type: "Note"`, `createdSource: "SYSTEM"`; never throws)

- [ ] **Step 1: Write the failing test**

Create `src/server/auth/__tests__/accounts.smoke.test.ts` (same `describe.skip` DB-guard pattern as Task 4):

```ts
import { afterAll, describe, expect, it } from "vitest";

const hasDb = Boolean(process.env.DATABASE_URL);
const d = hasDb ? describe : describe.skip;

const EMAILS = {
  directory: "zz-test-directory-UNIQ@noblestride.capital",
  unknownInternal: "zz-test-newstaff-UNIQ@noblestride.capital",
  freemail: "zz-test-UNIQ@gmail.com",
  contact: "zz-test-contact-UNIQ@zzexample-fund.com",
};

d("accounts core (DB)", () => {
  afterAll(async () => {
    const { prisma } = await import("@/lib/db");
    await prisma.authAccount.deleteMany({ where: { email: { in: Object.values(EMAILS) } } });
    await prisma.user.deleteMany({ where: { email: { in: [EMAILS.directory, EMAILS.unknownInternal] } } });
    await prisma.person.deleteMany({ where: { email: EMAILS.contact } });
    await prisma.investor.deleteMany({ where: { name: "ZZ Test Fund UNIQ-accounts" } });
    await prisma.activity.deleteMany({ where: { subject: { contains: "zz-test-" } } });
  });

  it("internal signup with a directory match activates immediately with the User's role", async () => {
    const { prisma } = await import("@/lib/db");
    const { signupInternal } = await import("../accounts");
    const user = await prisma.user.create({
      data: { name: "ZZ Test Staff", email: EMAILS.directory, role: "DealLead" },
    });
    const res = await signupInternal({ email: EMAILS.directory, name: "ZZ Test Staff", password: "long-enough-pass-1" });
    expect(res.status).toBe("active");
    const account = await prisma.authAccount.findUnique({ where: { email: EMAILS.directory } });
    expect(account?.status).toBe("ACTIVE");
    expect(account?.userId).toBe(user.id);
    expect(account?.kind).toBe("INTERNAL");
  });

  it("internal signup without a directory match lands PENDING; approval creates the User", async () => {
    const { prisma } = await import("@/lib/db");
    const { signupInternal, approveInternalAccount } = await import("../accounts");
    const res = await signupInternal({
      email: EMAILS.unknownInternal, name: "ZZ New Staff", jobTitle: "Analyst", password: "long-enough-pass-1",
    });
    expect(res.status).toBe("pending");
    const account = await prisma.authAccount.findUnique({ where: { email: EMAILS.unknownInternal } });
    expect(account?.status).toBe("PENDING");
    const approver = await prisma.user.findFirst({ where: { email: EMAILS.directory } });
    await approveInternalAccount(account!.id, "TeamMember", approver!.id);
    const after = await prisma.authAccount.findUnique({
      where: { email: EMAILS.unknownInternal }, include: { user: true },
    });
    expect(after?.status).toBe("ACTIVE");
    expect(after?.user?.role).toBe("TeamMember");
    expect(after?.user?.name).toBe("ZZ New Staff");
  });

  it("rejects free-mail and duplicate signups with AuthFlowError", async () => {
    const { AuthFlowError, signupInternal, signupExistingContact } = await import("../accounts");
    await expect(signupExistingContact({ email: EMAILS.freemail, password: "long-enough-pass-1" }))
      .rejects.toBeInstanceOf(AuthFlowError);
    await expect(signupInternal({ email: EMAILS.directory, name: "x", password: "long-enough-pass-1" }))
      .rejects.toBeInstanceOf(AuthFlowError); // account already exists
  });

  it("existing investor-contact signup lands PENDING; investor activation flips it ACTIVE", async () => {
    const { prisma } = await import("@/lib/db");
    const { signupExistingContact, activateAccountsForInvestor, suspendAccountsForInvestor } = await import("../accounts");
    const investor = await prisma.investor.create({
      data: { name: "ZZ Test Fund UNIQ-accounts", investorType: "PE", onboardingStatus: "Approved" },
    });
    await prisma.person.create({
      data: { firstName: "ZZ", lastName: "Contact", email: EMAILS.contact, investorId: investor.id, isPrimaryContact: true },
    });
    const res = await signupExistingContact({ email: EMAILS.contact, password: "long-enough-pass-1" });
    expect(res.status).toBe("pending");
    await activateAccountsForInvestor(investor.id);
    let account = await prisma.authAccount.findUnique({ where: { email: EMAILS.contact } });
    expect(account?.status).toBe("ACTIVE");
    await suspendAccountsForInvestor(investor.id);
    account = await prisma.authAccount.findUnique({ where: { email: EMAILS.contact } });
    expect(account?.status).toBe("SUSPENDED");
  });
});
```

Note: check `InvestorType` enum values with `grep -n "enum InvestorType" -A 8 prisma/schema.prisma` — if `PE` is not a member, use the first real member in the test.

- [ ] **Step 2: Run to verify it fails**

```bash
DATABASE_URL="postgresql://noblestride:noblestride@localhost:5544/noblestride" corepack pnpm exec vitest run src/server/auth/__tests__/accounts.smoke.test.ts
```

Expected: FAIL — cannot resolve `../accounts`.

- [ ] **Step 3: Implement `src/server/auth/audit.ts`**

```ts
// Auth audit trail on the existing Activity model. Best-effort: auditing must
// never break the auth flow itself.

import { prisma } from "@/lib/db";

export async function logAuthEvent(
  subject: string,
  body?: string,
  opts?: { investorId?: string },
): Promise<void> {
  try {
    await prisma.activity.create({
      data: { type: "Note", subject, body, investorId: opts?.investorId, createdSource: "SYSTEM" },
    });
  } catch (err) {
    console.error("[auth] audit write failed:", err);
  }
}
```

(Check `Activity`'s required fields with `grep -n "model Activity" -A 25 prisma/schema.prisma` first; `type: "Note"` + `createdSource` follow `register-investor.ts`. If `type` uses a different enum member for notes, mirror what `register-investor.ts` uses.)

- [ ] **Step 4: Implement `src/server/auth/accounts.ts`**

```ts
// Account lifecycle (real-auth spec §6): signup paths, admin approval,
// suspension. All emails lowercase. AuthFlowError messages are user-safe.

import type { OrgRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { classifyEmail, classifyEmailForSignup, normalizeEmail } from "./guardrails";
import { hashPassword } from "./password";
import { validatePassword } from "./policy";
import { invalidateAllSessions } from "./session";
import { logAuthEvent } from "./audit";

export class AuthFlowError extends Error {}

const GENERIC_EXISTS = "An account with this email already exists. Try signing in instead.";

async function assertNoAccount(email: string): Promise<void> {
  const existing = await prisma.authAccount.findUnique({ where: { email }, select: { id: true } });
  if (existing) throw new AuthFlowError(GENERIC_EXISTS);
}

function assertPassword(password: string, email: string): void {
  const err = validatePassword(password, email);
  if (err) throw new AuthFlowError(err);
}

export async function signupInternal(input: {
  email: string;
  name: string;
  jobTitle?: string;
  password: string;
}): Promise<{ status: "active" | "pending" }> {
  const email = normalizeEmail(input.email);
  if (classifyEmail(email).kind !== "internal") {
    throw new AuthFlowError("Internal accounts require a @noblestride.capital email.");
  }
  assertPassword(input.password, email);
  await assertNoAccount(email);
  const passwordHash = await hashPassword(input.password);

  const directoryUser = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  });
  if (directoryUser) {
    if (!directoryUser.isActive) throw new AuthFlowError("This account is deactivated. Contact an administrator.");
    await prisma.authAccount.create({
      data: { email, passwordHash, kind: "INTERNAL", status: "ACTIVE", userId: directoryUser.id },
    });
    await logAuthEvent(`Auth: internal account activated (directory match) for ${email}`);
    return { status: "active" };
  }
  await prisma.authAccount.create({
    data: { email, passwordHash, kind: "INTERNAL", status: "PENDING", displayName: input.name, jobTitle: input.jobTitle },
  });
  await logAuthEvent(`Auth: internal account requested for ${email} — awaiting admin approval`);
  return { status: "pending" };
}

export async function signupExistingContact(input: {
  email: string;
  password: string;
}): Promise<{ status: "pending" }> {
  const email = normalizeEmail(input.email);
  const cls = await classifyEmailForSignup(email);
  if (cls.kind === "blocked") {
    throw new AuthFlowError(
      cls.reason === "free-provider"
        ? "Please use your official company email — free providers (Gmail, Yahoo, …) are not accepted."
        : "This email is not eligible to register. Contact NobleStride if you believe this is an error.",
    );
  }
  if (cls.kind === "internal") throw new AuthFlowError("NobleStride staff should use the internal sign-up.");
  assertPassword(input.password, email);
  await assertNoAccount(email);

  const person = await prisma.person.findFirst({
    where: { email: { equals: email, mode: "insensitive" }, investorId: { not: null } },
    orderBy: { createdAt: "desc" },
  });
  if (!person) {
    throw new AuthFlowError("No investor contact found for this email. Register your fund first.");
  }
  const passwordHash = await hashPassword(input.password);
  await prisma.authAccount.create({
    data: { email, passwordHash, kind: "INVESTOR", status: "PENDING", personId: person.id },
  });
  await logAuthEvent(
    `Auth: investor account requested for ${email} — awaiting review`,
    undefined,
    { investorId: person.investorId ?? undefined },
  );
  return { status: "pending" };
}

export async function approveInternalAccount(accountId: string, role: OrgRole, approvedByUserId: string): Promise<void> {
  const account = await prisma.authAccount.findUniqueOrThrow({ where: { id: accountId } });
  if (account.kind !== "INTERNAL" || account.status !== "PENDING") {
    throw new AuthFlowError("Only pending internal accounts can be approved this way.");
  }
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: account.displayName ?? account.email.split("@")[0],
        email: account.email,
        jobTitle: account.jobTitle,
        role,
      },
    });
    await tx.authAccount.update({
      where: { id: account.id },
      data: { status: "ACTIVE", userId: user.id },
    });
  });
  await logAuthEvent(`Auth: internal account approved for ${account.email} (role ${role}) by user ${approvedByUserId}`);
}

export async function rejectPendingAccount(accountId: string, byUserId: string): Promise<void> {
  const account = await prisma.authAccount.findUniqueOrThrow({ where: { id: accountId } });
  if (account.status !== "PENDING") throw new AuthFlowError("Only pending accounts can be rejected.");
  await prisma.authAccount.delete({ where: { id: accountId } });
  await logAuthEvent(`Auth: pending account rejected for ${account.email} by user ${byUserId}`);
}

export async function suspendAccount(accountId: string, byUserId: string): Promise<void> {
  const account = await prisma.authAccount.update({ where: { id: accountId }, data: { status: "SUSPENDED" } });
  await invalidateAllSessions(accountId);
  await logAuthEvent(`Auth: account suspended for ${account.email} by user ${byUserId}`);
}

export async function reactivateAccount(accountId: string, byUserId: string): Promise<void> {
  const account = await prisma.authAccount.findUniqueOrThrow({ where: { id: accountId } });
  if (account.status !== "SUSPENDED") throw new AuthFlowError("Only suspended accounts can be reactivated.");
  await prisma.authAccount.update({ where: { id: accountId }, data: { status: "ACTIVE", failedLogins: 0, lockedUntil: null } });
  await logAuthEvent(`Auth: account reactivated for ${account.email} by user ${byUserId}`);
}

export async function changeInternalRole(accountId: string, role: OrgRole, byUserId: string): Promise<void> {
  const account = await prisma.authAccount.findUniqueOrThrow({ where: { id: accountId } });
  if (account.kind !== "INTERNAL" || !account.userId) throw new AuthFlowError("Role changes apply to internal accounts only.");
  await prisma.user.update({ where: { id: account.userId }, data: { role } });
  await logAuthEvent(`Auth: role changed to ${role} for ${account.email} by user ${byUserId}`);
}

/** Investor onboarding review → account lifecycle (wired into services in the GraphQL task). */
export async function activateAccountsForInvestor(investorId: string): Promise<void> {
  await prisma.authAccount.updateMany({
    where: { person: { investorId }, status: { in: ["PENDING", "SUSPENDED"] } },
    data: { status: "ACTIVE" },
  });
}

export async function suspendAccountsForInvestor(investorId: string): Promise<void> {
  const accounts = await prisma.authAccount.findMany({
    where: { person: { investorId } }, select: { id: true },
  });
  for (const a of accounts) {
    await prisma.authSession.deleteMany({ where: { accountId: a.id } });
  }
  await prisma.authAccount.updateMany({ where: { person: { investorId } }, data: { status: "SUSPENDED" } });
}
```

- [ ] **Step 5: Run to verify it passes**

```bash
DATABASE_URL="postgresql://noblestride:noblestride@localhost:5544/noblestride" corepack pnpm exec vitest run src/server/auth/__tests__/accounts.smoke.test.ts
```

Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/server/auth
git commit -m "feat(auth): account lifecycle — signup paths, approval, suspension, audit"
```

---

### Task 7: Login core — credentials, lockout, rate limiting

**Files:**
- Create: `src/server/auth/login.ts`
- Create: `src/server/auth/rate-limit.ts`
- Test: `src/server/auth/__tests__/login.smoke.test.ts` (DB), rate-limit cases in the same file

**Interfaces:**
- Consumes: Tasks 3–4, 6 (`verifyPassword`, `DUMMY_HASH`, `createSession`, `logAuthEvent`, `normalizeEmail`).
- Produces:
  - `type LoginResult = { ok: true; token: string; expiresAt: Date; home: string } | { ok: false; reason: "invalid" | "locked" | "pending" | "suspended" }`
  - `loginWithPassword(email: string, password: string, meta?: { ip?: string; userAgent?: string }): Promise<LoginResult>` — `home` is `/dashboard` for INTERNAL, `/portal/investor` for INVESTOR. 10 failures → 15-min lock. Success resets `failedLogins`, stamps `lastLoginAt`.
  - `rateLimit(key: string, opts?: { max?: number; windowMs?: number }): boolean` — in-memory sliding window; `true` = allowed. Defaults max 20 / 10 min.

- [ ] **Step 1: Write the failing test**

Create `src/server/auth/__tests__/login.smoke.test.ts`:

```ts
import { afterAll, describe, expect, it } from "vitest";
import { rateLimit } from "../rate-limit";

const hasDb = Boolean(process.env.DATABASE_URL);
const d = hasDb ? describe : describe.skip;

describe("rateLimit (in-memory)", () => {
  it("allows up to max then blocks within the window", () => {
    const key = "test-key-UNIQ-" + Math.random();
    for (let i = 0; i < 5; i++) expect(rateLimit(key, { max: 5, windowMs: 60_000 })).toBe(true);
    expect(rateLimit(key, { max: 5, windowMs: 60_000 })).toBe(false);
  });
});

d("loginWithPassword (DB)", () => {
  const EMAIL = "zz-test-login-UNIQ@noblestride.capital";
  const PASSWORD = "long-enough-pass-1";

  afterAll(async () => {
    const { prisma } = await import("@/lib/db");
    await prisma.authAccount.deleteMany({ where: { email: EMAIL } });
    await prisma.user.deleteMany({ where: { email: EMAIL } });
    await prisma.activity.deleteMany({ where: { subject: { contains: "zz-test-login" } } });
  });

  async function makeActiveAccount() {
    const { prisma } = await import("@/lib/db");
    const { hashPassword } = await import("../password");
    const user = await prisma.user.upsert({
      where: { email: EMAIL },
      create: { name: "ZZ Login Test", email: EMAIL, role: "TeamMember" },
      update: {},
    });
    return prisma.authAccount.upsert({
      where: { email: EMAIL },
      create: { email: EMAIL, passwordHash: await hashPassword(PASSWORD), kind: "INTERNAL", status: "ACTIVE", userId: user.id },
      update: { status: "ACTIVE", failedLogins: 0, lockedUntil: null, passwordHash: await hashPassword(PASSWORD) },
    });
  }

  it("succeeds with correct credentials and returns internal home", async () => {
    await makeActiveAccount();
    const { loginWithPassword } = await import("../login");
    const res = await loginWithPassword(EMAIL, PASSWORD);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.home).toBe("/dashboard");
  });

  it("fails generically for wrong password and unknown email", async () => {
    await makeActiveAccount();
    const { loginWithPassword } = await import("../login");
    const wrong = await loginWithPassword(EMAIL, "totally-wrong-1");
    expect(wrong).toEqual({ ok: false, reason: "invalid" });
    const unknown = await loginWithPassword("zz-nobody-UNIQ@noblestride.capital", PASSWORD);
    expect(unknown).toEqual({ ok: false, reason: "invalid" });
  });

  it("locks after 10 consecutive failures", async () => {
    await makeActiveAccount();
    const { loginWithPassword } = await import("../login");
    for (let i = 0; i < 10; i++) await loginWithPassword(EMAIL, "totally-wrong-1");
    const locked = await loginWithPassword(EMAIL, PASSWORD); // even the RIGHT password
    expect(locked).toEqual({ ok: false, reason: "locked" });
  });

  it("reports pending and suspended states", async () => {
    const { prisma } = await import("@/lib/db");
    const account = await makeActiveAccount();
    const { loginWithPassword } = await import("../login");
    await prisma.authAccount.update({ where: { id: account.id }, data: { status: "PENDING", failedLogins: 0, lockedUntil: null } });
    expect(await loginWithPassword(EMAIL, PASSWORD)).toEqual({ ok: false, reason: "pending" });
    await prisma.authAccount.update({ where: { id: account.id }, data: { status: "SUSPENDED" } });
    expect(await loginWithPassword(EMAIL, PASSWORD)).toEqual({ ok: false, reason: "suspended" });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
DATABASE_URL="postgresql://noblestride:noblestride@localhost:5544/noblestride" corepack pnpm exec vitest run src/server/auth/__tests__/login.smoke.test.ts
```

Expected: FAIL — cannot resolve `../rate-limit`.

- [ ] **Step 3: Implement `src/server/auth/rate-limit.ts`**

```ts
// Best-effort in-memory rate limiter (per-process; resets on deploy — fine at
// this scale, swap for a table/redis when the app scales out).

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, opts?: { max?: number; windowMs?: number }): boolean {
  const max = opts?.max ?? 20;
  const windowMs = opts?.windowMs ?? 10 * 60 * 1000;
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count += 1;
  if (buckets.size > 10_000) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }
  return bucket.count <= max;
}
```

- [ ] **Step 4: Implement `src/server/auth/login.ts`**

```ts
// Credential login (real-auth spec §10). One generic "invalid" for wrong
// password AND unknown email (dummy-verify equalizes timing); account lockout
// after 10 straight failures for 15 minutes.

import { prisma } from "@/lib/db";
import { normalizeEmail } from "./guardrails";
import { DUMMY_HASH, verifyPassword } from "./password";
import { createSession } from "./session";
import { logAuthEvent } from "./audit";

const MAX_FAILURES = 10;
const LOCK_MS = 15 * 60 * 1000;

export type LoginResult =
  | { ok: true; token: string; expiresAt: Date; home: string }
  | { ok: false; reason: "invalid" | "locked" | "pending" | "suspended" };

export async function loginWithPassword(
  emailRaw: string,
  password: string,
  meta?: { ip?: string; userAgent?: string },
): Promise<LoginResult> {
  const email = normalizeEmail(emailRaw);
  const account = await prisma.authAccount.findUnique({ where: { email } });

  if (!account) {
    await verifyPassword(DUMMY_HASH, password); // timing equalization
    return { ok: false, reason: "invalid" };
  }
  if (account.lockedUntil && account.lockedUntil.getTime() > Date.now()) {
    return { ok: false, reason: "locked" };
  }

  const valid = await verifyPassword(account.passwordHash, password);
  if (!valid) {
    const failures = account.failedLogins + 1;
    await prisma.authAccount.update({
      where: { id: account.id },
      data: {
        failedLogins: failures,
        lockedUntil: failures >= MAX_FAILURES ? new Date(Date.now() + LOCK_MS) : null,
      },
    });
    if (failures === MAX_FAILURES) {
      await logAuthEvent(`Auth: account locked after ${MAX_FAILURES} failed logins — ${email}`);
    }
    return { ok: false, reason: "invalid" };
  }

  if (account.status === "PENDING") return { ok: false, reason: "pending" };
  if (account.status === "SUSPENDED") return { ok: false, reason: "suspended" };

  const { token, expiresAt } = await createSession(account.id, meta);
  await prisma.authAccount.update({
    where: { id: account.id },
    data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() },
  });
  await logAuthEvent(`Auth: login success — ${email}`);
  return { ok: true, token, expiresAt, home: account.kind === "INTERNAL" ? "/dashboard" : "/portal/investor" };
}
```

- [ ] **Step 5: Run to verify it passes**

```bash
DATABASE_URL="postgresql://noblestride:noblestride@localhost:5544/noblestride" corepack pnpm exec vitest run src/server/auth/__tests__/login.smoke.test.ts
```

Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add src/server/auth
git commit -m "feat(auth): credential login with lockout + in-memory rate limiter"
```

---

### Task 8: Identity derivation — `getCurrentAuth`, `getViewpoint` rewrite, null-viewpoint sweep

**Files:**
- Create: `src/server/auth/current.ts`
- Modify: `src/server/viewpoint.ts` (full rewrite)
- Modify: `src/server/rbac/context.ts`
- Modify: `src/app/api/viewpoint/route.ts` (full rewrite — admin-gated, signed)
- Modify: `src/app/page.tsx`, `src/app/(crm)/layout.tsx`, `src/components/portal/viewing-banner.tsx`, and every `src/app/portal/**` page/layout/action that calls `getViewpoint()`
- Test: `src/server/auth/__tests__/current.smoke.test.ts`

**Interfaces:**
- Consumes: Tasks 4–7.
- Produces:
  - `type CurrentAuth = { account: AuthAccount; user: User | null; person: (Person & { investor: Investor | null }) | null }`
  - `getCurrentAuth(): Promise<CurrentAuth | null>` — React `cache()`-wrapped; reads `ns_session` via `cookies()`
  - `resolveViewpointFor(auth: CurrentAuth | null, impersonationJwt: string | undefined): Promise<Viewpoint | null>` — pure derivation, reused by the GraphQL context in Task 12
  - `getViewpoint(): Promise<Viewpoint | null>` — **new contract: null = signed out**
  - `getOrgLens(): Promise<OrgLens>` — unchanged signature, but `redirect("/login")`s when signed out

- [ ] **Step 1: Write the failing test for the derivation core**

Create `src/server/auth/__tests__/current.smoke.test.ts`:

```ts
import { beforeAll, describe, expect, it } from "vitest";
import type { CurrentAuth } from "../current";

beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret-at-least-32-chars-long!!";
});

function internalAuth(role: "Admin" | "DealLead" | "TeamMember"): CurrentAuth {
  return {
    account: { id: "acc1", kind: "INTERNAL" } as CurrentAuth["account"],
    user: { id: "user1", role } as NonNullable<CurrentAuth["user"]>,
    person: null,
  };
}

describe("resolveViewpointFor", () => {
  it("returns null when signed out", async () => {
    const { resolveViewpointFor } = await import("../current");
    expect(await resolveViewpointFor(null, undefined)).toBeNull();
  });
  it("derives admin viewpoint for internal users from User.role", async () => {
    const { resolveViewpointFor } = await import("../current");
    expect(await resolveViewpointFor(internalAuth("Admin"), undefined)).toEqual({ role: "admin", orgRole: "Admin" });
    expect(await resolveViewpointFor(internalAuth("TeamMember"), undefined)).toEqual({
      role: "admin", orgRole: "TeamMember", userId: "user1",
    });
  });
  it("derives investor viewpoint from person.investorId", async () => {
    const { resolveViewpointFor } = await import("../current");
    const auth = {
      account: { id: "acc2", kind: "INVESTOR" },
      user: null,
      person: { id: "p1", investorId: "inv9", investor: { id: "inv9" } },
    } as unknown as CurrentAuth;
    expect(await resolveViewpointFor(auth, undefined)).toEqual({ role: "investor", recordId: "inv9" });
  });
  it("applies a signed impersonation lens ONLY for Admin org-role", async () => {
    const { resolveViewpointFor } = await import("../current");
    const { signImpersonation } = await import("../impersonation");
    const lens = await signImpersonation({ role: "investor", recordId: "inv1", impersonating: true });
    expect(await resolveViewpointFor(internalAuth("Admin"), lens)).toEqual({
      role: "investor", recordId: "inv1", impersonating: true,
    });
    // Non-admin real role: lens ignored
    expect(await resolveViewpointFor(internalAuth("TeamMember"), lens)).toEqual({
      role: "admin", orgRole: "TeamMember", userId: "user1",
    });
    // Investor account: lens ignored
    const inv = {
      account: { id: "acc2", kind: "INVESTOR" }, user: null,
      person: { id: "p1", investorId: "inv9", investor: { id: "inv9" } },
    } as unknown as CurrentAuth;
    expect(await resolveViewpointFor(inv, lens)).toEqual({ role: "investor", recordId: "inv9" });
  });
});
```

- [ ] **Step 2: Run to verify it fails, then implement `src/server/auth/current.ts`**

```bash
corepack pnpm exec vitest run src/server/auth/__tests__/current.smoke.test.ts
```

```ts
// The single source of request identity (real-auth spec §7).
// getCurrentAuth: session cookie → account (+User / +Person+Investor).
// resolveViewpointFor: identity (+optional signed admin lens) → Viewpoint.

import { cache } from "react";
import { cookies } from "next/headers";
import type { AuthAccount, Investor, Person, User } from "@prisma/client";
import { prisma } from "@/lib/db";
import { validateSessionToken } from "./session";
import { SESSION_COOKIE } from "./session-cookie";
import { verifyImpersonation } from "./impersonation";
import type { Viewpoint } from "@/lib/viewpoint";

export type CurrentAuth = {
  account: AuthAccount;
  user: User | null;
  person: (Person & { investor: Investor | null }) | null;
};

export const getCurrentAuth = cache(async (): Promise<CurrentAuth | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const validated = await validateSessionToken(token);
  if (!validated) return null;
  const { account } = validated;
  const [user, person] = await Promise.all([
    account.userId ? prisma.user.findUnique({ where: { id: account.userId } }) : null,
    account.personId
      ? prisma.person.findUnique({ where: { id: account.personId }, include: { investor: true } })
      : null,
  ]);
  return { account, user, person };
});

/** Derivation core — shared with the GraphQL context (which has no cookies()). */
export async function resolveViewpointFor(
  auth: CurrentAuth | null,
  impersonationJwt: string | undefined,
): Promise<Viewpoint | null> {
  if (!auth) return null;

  if (auth.account.kind === "INVESTOR") {
    const investorId = auth.person?.investorId;
    if (!investorId) return null; // orphaned account — treat as signed out
    return { role: "investor", recordId: investorId };
  }

  // INTERNAL
  const user = auth.user;
  if (!user || !user.isActive) return null;
  const base: Viewpoint =
    user.role === "Admin"
      ? { role: "admin", orgRole: "Admin" }
      : { role: "admin", orgRole: user.role, userId: user.id };

  if (user.role === "Admin" && impersonationJwt) {
    const lens = await verifyImpersonation(impersonationJwt);
    if (lens) return lens;
  }
  return base;
}
```

Run the test again — expected: PASS (4 tests).

- [ ] **Step 3: Rewrite `src/server/viewpoint.ts`**

```ts
import { cookies } from "next/headers";
import type { Viewpoint } from "@/lib/viewpoint";
import { getCurrentAuth, resolveViewpointFor } from "@/server/auth/current";
import { IMPERSONATION_COOKIE } from "@/server/auth/impersonation";

/** Derive the active viewpoint from the REAL session (null = signed out).
 *  Admins may overlay a signed "view as" lens (ns_viewpoint cookie). */
export async function getViewpoint(): Promise<Viewpoint | null> {
  const auth = await getCurrentAuth();
  const lens = (await cookies()).get(IMPERSONATION_COOKIE)?.value;
  return resolveViewpointFor(auth, lens);
}
```

- [ ] **Step 4: Update `src/server/rbac/context.ts`**

```ts
// getOrgLens — resolve the active in-org lens from the real session-derived
// viewpoint. Signed out → /login. External viewpoints resolve to Admin only
// as a type-safe fallback (they never reach the internal shell).

import { redirect } from "next/navigation";
import type { OrgRole } from "@prisma/client";
import { getViewpoint } from "@/server/viewpoint";

export interface OrgLens {
  orgRole: OrgRole;
  userId?: string;
}

export async function getOrgLens(): Promise<OrgLens> {
  const vp = await getViewpoint();
  if (!vp) redirect("/login");
  if (vp.role !== "admin") return { orgRole: "Admin" };
  return { orgRole: (vp.orgRole ?? "Admin") as OrgRole, userId: vp.userId };
}
```

- [ ] **Step 5: Rewrite `src/app/api/viewpoint/route.ts` (admin-gated switcher)**

```ts
import { NextRequest, NextResponse } from "next/server";
import { parseViewpoint, viewpointHome } from "@/lib/viewpoint";
import { getCurrentAuth } from "@/server/auth/current";
import { IMPERSONATION_COOKIE, signImpersonation } from "@/server/auth/impersonation";
import { logAuthEvent } from "@/server/auth/audit";

// Admin "view as" switcher (real-auth spec §7). GET so the switcher stays
// plain links. Requires a real Admin session; the lens cookie is a signed JWT.
// role=signout clears ONLY the lens ("Return to Admin") — real logout is a
// server action in the topbar.
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;

  if (params.get("role") === "signout") {
    const res = NextResponse.redirect(new URL("/dashboard", req.url));
    res.cookies.delete(IMPERSONATION_COOKIE);
    return res;
  }

  const auth = await getCurrentAuth();
  if (!auth || auth.account.kind !== "INTERNAL" || auth.user?.role !== "Admin") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const roleParam = params.get("role");
  const vp = parseViewpoint(
    JSON.stringify({
      role: roleParam,
      recordId: params.get("recordId") ?? undefined,
      orgRole: params.get("orgRole") ?? undefined,
      userId: params.get("userId") ?? undefined,
      impersonating: roleParam === "investor" || roleParam === "partner" ? true : undefined,
    }),
  );
  if (!vp) return NextResponse.redirect(new URL("/dashboard", req.url));

  await logAuthEvent(`Auth: admin ${auth.account.email} switched lens to ${JSON.stringify(vp)}`);
  const res = NextResponse.redirect(new URL(params.get("next") ?? viewpointHome(vp), req.url));
  res.cookies.set(IMPERSONATION_COOKIE, await signImpersonation(vp), {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 8 * 60 * 60,
  });
  return res;
}
```

- [ ] **Step 6: Null-viewpoint sweep across call sites**

Apply this exact pattern to every remaining `getViewpoint()` caller — signed out redirects to `/login`:

```ts
const vp = await getViewpoint();
if (!vp) redirect("/login");
```

Files and their specifics:
- `src/app/(crm)/layout.tsx` (~line 17): add the null check before the existing investor/partner redirects. (Admin-gating of the viewpoint switcher happens in Task 9 — no Topbar prop changes in this task.)
- `src/app/page.tsx`: replace the raw-cookie check with:
  ```ts
  import { getViewpoint } from "@/server/viewpoint";
  import { viewpointHome } from "@/lib/viewpoint";
  // in the component:
  const vp = await getViewpoint();
  if (vp) redirect(viewpointHome(vp));
  ```
  Remove the now-unused `cookies`/`parseViewpoint`/`VIEWPOINT_COOKIE` imports.
- `src/app/portal/investor/layout.tsx`: top of the component: `const vp = await getViewpoint(); if (!vp) redirect("/login");` (import `redirect` from `next/navigation`). Rest unchanged — it already branches on `vp.role === "investor" && vp.recordId`.
- Every `src/app/portal/investor/**/page.tsx` and `src/app/portal/partner/**/page.tsx` that does `if (vp.role !== "investor" || !vp.recordId) redirect(...)`: prepend the null check (`if (!vp) redirect("/login");`). Find them: `grep -rn "getViewpoint" src/app/portal src/components/portal`.
- Every `src/app/portal/**/actions.ts`: same null check but `throw new Error("Not signed in")` instead of redirect if the file's convention is returning errors — read each file and match its existing error convention. The identity (`vp.recordId`) is now session-derived, which is the security fix — no other logic change needed.
- `src/components/portal/viewing-banner.tsx`: `getViewpoint()` may now return null — render nothing (`return null`) when viewpoint is null or `!vp.impersonating`.

- [ ] **Step 7: Full check + fix stragglers**

```bash
corepack pnpm exec tsc --noEmit
DATABASE_URL="postgresql://noblestride:noblestride@localhost:5544/noblestride" corepack pnpm exec vitest run
```

Expected: 0 tsc errors; all tests pass. `src/server/onboarding/__tests__/resolve-login.smoke.test.ts` is untouched (resolve-login is deleted in Task 11).

- [ ] **Step 8: Commit**

```bash
git add -A -- src
git commit -m "feat(auth): session-derived viewpoint; admin-gated signed lens switcher; null sweep"
```

---

### Task 9: Login/logout UI + middleware

**Files:**
- Modify: `src/app/login/actions.ts` (full rewrite), `src/app/login/page.tsx`
- Create: `src/app/logout/actions.ts`
- Create: `src/middleware.ts`
- Modify: `src/components/shell/topbar.tsx` (real sign-out), `src/app/(crm)/layout.tsx` (pass admin flag), `src/components/shell/viewpoint-switcher.tsx` (render only for admins — read the file; add early `return null` unless a new `enabled` prop is true)
- Modify: `src/components/portal/investor-topbar.tsx` + portal sign-out links if present (grep `role=signout`)

**Interfaces:**
- Consumes: Task 7 `loginWithPassword`, `rateLimit`; Task 4 `setSessionCookie`, `clearSessionCookie`, `SESSION_COOKIE`; Task 8 `getCurrentAuth`.
- Produces: `loginAction(formData)` (real credentials), `logoutAction()` (server action; deletes session row + cookie + impersonation cookie, redirects `/login`), `src/middleware.ts` cookie-presence gate.

- [ ] **Step 1: Rewrite `src/app/login/actions.ts`**

```ts
"use server";
// Real credential login (spec §10). The session cookie is set HERE in the
// action (not via a route-handler redirect — the client router drops that
// Set-Cookie). Errors round-trip via query params, same as before.

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { loginWithPassword } from "@/server/auth/login";
import { rateLimit } from "@/server/auth/rate-limit";
import { setSessionCookie } from "@/server/auth/session-cookie";

const emailSchema = z.string().trim().email("Enter a valid email address.");

const MESSAGES: Record<string, string> = {
  invalid: "Incorrect email or password.",
  locked: "Too many failed attempts. Try again in about 15 minutes.",
  pending: "Your account is awaiting review by the NobleStride team.",
  suspended: "This account is suspended. Contact NobleStride if you believe this is an error.",
};

function safeNext(next: string | undefined): string | null {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : null;
}

export async function loginAction(formData: FormData): Promise<void> {
  const parsed = emailSchema.safeParse(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");
  const next = safeNext(String(formData.get("next") ?? "") || undefined);
  const back = (error: string, email = "") =>
    redirect(
      `/login?error=${encodeURIComponent(error)}${email ? `&email=${encodeURIComponent(email)}` : ""}${next ? `&next=${encodeURIComponent(next)}` : ""}`,
    );

  if (!parsed.success) back(parsed.error.issues[0]?.message ?? "Enter a valid email address.");
  const email = parsed.data!;

  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!rateLimit(`login:${ip}`)) back(MESSAGES.locked, email);

  const res = await loginWithPassword(email, password, { ip, userAgent: hdrs.get("user-agent") ?? undefined });
  if (!res.ok) back(MESSAGES[res.reason], email);
  const ok = res as Extract<Awaited<ReturnType<typeof loginWithPassword>>, { ok: true }>;

  await setSessionCookie(ok.token, ok.expiresAt);
  redirect(next ?? ok.home);
}
```

(Note: `redirect()` throws, so the `back()` calls terminate the action — the non-null assertion after `!parsed.success` mirrors the existing file's control flow.)

- [ ] **Step 2: Update `src/app/login/page.tsx`**

Read the current file and make these changes, preserving `inputClass`/`labelClass` and the overall layout:
1. Delete the amber "Demo mode — any password works" banner block entirely.
2. Update the file-top comment: real credential login.
3. Add `next` to the searchParams interface (`{ error?: string; email?: string; as?: string; next?: string }`) and a hidden field inside the form: `{sp.next ? <input type="hidden" name="next" value={sp.next} /> : null}`.
4. Change the password input placeholder to `"Your password"`.
5. Below the submit row, add:
```tsx
<div className="mt-4 flex items-center justify-between border-t border-[var(--border-subtle)] pt-4 text-xs">
  <Link href="/forgot-password" className="font-medium text-[var(--accent)] hover:underline">
    Forgot password?
  </Link>
  <Link href="/register" className="font-medium text-[var(--accent)] hover:underline">
    Create an account →
  </Link>
</div>
```
6. The `error.startsWith("No account")` register hint can stay (harmless) or be dropped — drop it.

(`/forgot-password` 404s until Task 10 — acceptable inside this task sequence.)

- [ ] **Step 3: Create `src/app/logout/actions.ts`**

```ts
"use server";
// Real sign-out: revoke the DB session, clear both auth cookies.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { validateSessionToken, invalidateSession } from "@/server/auth/session";
import { SESSION_COOKIE, clearSessionCookie } from "@/server/auth/session-cookie";
import { IMPERSONATION_COOKIE } from "@/server/auth/impersonation";

export async function logoutAction(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const validated = await validateSessionToken(token);
    if (validated) await invalidateSession(validated.session.id);
  }
  await clearSessionCookie();
  jar.delete(IMPERSONATION_COOKIE);
  redirect("/login");
}
```

- [ ] **Step 4: Real sign-out in the shells**

`src/components/shell/topbar.tsx`: replace the sign-out `<Link href="/api/viewpoint?role=signout">` block with a form action (Topbar is a client component — import the server action):

```tsx
import { logoutAction } from "@/app/logout/actions";
// … replace the Sign out <Link> with:
<form action={logoutAction}>
  <button
    type="submit"
    className="rounded border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)] transition-colors"
  >
    Sign out
  </button>
</form>
```

Grep for other `role=signout` links (`grep -rn "role=signout" src`) — for each in portal shells (`investor-topbar`, `portal-switcher`, `viewing-banner`, partner components): links meaning "leave the whole session" become the same `logoutAction` form; links meaning "Return to Admin" (impersonation exit — only shown when `impersonating`) KEEP pointing at `/api/viewpoint?role=signout` (which now clears only the lens and lands on /dashboard).

`src/components/shell/viewpoint-switcher.tsx`: read the file; add an `enabled?: boolean` prop, `if (!enabled) return null;` at the top. In `src/app/(crm)/layout.tsx`, pass `enabled` from the REAL role — compute `const auth = await getCurrentAuth();` (import from `@/server/auth/current`) and pass `enabled={auth?.user?.role === "Admin"}` through Topbar to the switcher (add the pass-through prop to Topbar).

- [ ] **Step 5: Create `src/middleware.ts` (repo path: `noblestride-crm/src/middleware.ts`)**

```ts
// Coarse edge gate (real-auth spec §8): cookie PRESENCE only — real session
// validation happens in layouts/actions/GraphQL (never trust middleware alone).

import { NextRequest, NextResponse } from "next/server";

const PROTECTED_PREFIXES = [
  "/dashboard", "/deals", "/mandates", "/transactions", "/investors",
  "/engagement", "/partners", "/clients", "/documents", "/tasks",
  "/access-matrix", "/service-providers", "/settings", "/portal",
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = req.cookies.has("ns_session");

  if (hasSession && (pathname === "/login" || pathname === "/register")) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  if (!hasSession && PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico|.*\\..*).*)"],
};
```

- [ ] **Step 6: Full check**

```bash
corepack pnpm exec tsc --noEmit
DATABASE_URL="postgresql://noblestride:noblestride@localhost:5544/noblestride" corepack pnpm exec vitest run
```

Expected: 0 errors, all pass.

- [ ] **Step 7: Manual smoke (dev server on a spare port)**

```bash
PORT=3100 corepack pnpm dev
```

In another shell: `curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3100/dashboard` — expect `307` redirecting to `/login?next=%2Fdashboard`. `curl -s http://localhost:3100/login | grep -c "Demo mode"` — expect `0`. Stop the dev server after.

- [ ] **Step 8: Commit**

```bash
git add -A -- src
git commit -m "feat(auth): real login/logout, admin-only switcher, edge middleware gate"
```

---

### Task 10: Password reset — mailer, forgot/reset pages

**Files:**
- Create: `src/server/auth/mailer.ts`
- Create: `src/server/auth/reset.ts`
- Create: `src/app/forgot-password/page.tsx`, `src/app/forgot-password/actions.ts`
- Create: `src/app/reset-password/[token]/page.tsx`, `src/app/reset-password/actions.ts`
- Test: `src/server/auth/__tests__/reset.smoke.test.ts`

**Interfaces:**
- Consumes: Tasks 3–4, 6 (`createAuthToken`, `consumeAuthToken`, `hashPassword`, `validatePassword`, `invalidateAllSessions`, `logAuthEvent`, `normalizeEmail`).
- Produces:
  - `mailer.ts`: `sendMail(msg: { to: string; subject: string; text: string }): Promise<void>` — `ConsoleMailer` implementation logs to server console (swap point for real SMTP later)
  - `reset.ts`: `requestPasswordReset(email: string, baseUrl: string): Promise<void>` (always resolves — no enumeration; mails a link when the account exists) and `performPasswordReset(rawToken: string, newPassword: string): Promise<{ ok: boolean; error?: string }>` (policy-checks, rehashes, clears lockout, revokes ALL sessions)

- [ ] **Step 1: Write the failing test**

Create `src/server/auth/__tests__/reset.smoke.test.ts`:

```ts
import { afterAll, describe, expect, it } from "vitest";

const hasDb = Boolean(process.env.DATABASE_URL);
const d = hasDb ? describe : describe.skip;

const EMAIL = "zz-test-reset-UNIQ@noblestride.capital";

d("password reset (DB)", () => {
  afterAll(async () => {
    const { prisma } = await import("@/lib/db");
    await prisma.authAccount.deleteMany({ where: { email: EMAIL } });
    await prisma.user.deleteMany({ where: { email: EMAIL } });
    await prisma.activity.deleteMany({ where: { subject: { contains: "zz-test-reset" } } });
  });

  it("full reset flow: request → token → new password; sessions revoked; token single-use", async () => {
    const { prisma } = await import("@/lib/db");
    const { hashPassword, verifyPassword } = await import("../password");
    const { createSession, validateSessionToken } = await import("../session");
    const { createAuthToken } = await import("../tokens");
    const { performPasswordReset } = await import("../reset");

    const user = await prisma.user.upsert({
      where: { email: EMAIL },
      create: { name: "ZZ Reset Test", email: EMAIL, role: "TeamMember" },
      update: {},
    });
    const account = await prisma.authAccount.upsert({
      where: { email: EMAIL },
      create: { email: EMAIL, passwordHash: await hashPassword("old-password-1"), kind: "INTERNAL", status: "ACTIVE", userId: user.id },
      update: {},
    });
    const { token: sessionToken } = await createSession(account.id);
    const raw = await createAuthToken(account.id, "RESET_PASSWORD");

    const bad = await performPasswordReset(raw, "short");
    expect(bad.ok).toBe(false); // policy rejected, token NOT consumed

    const good = await performPasswordReset(raw, "brand-new-pass-1");
    expect(good.ok).toBe(true);

    const after = await prisma.authAccount.findUniqueOrThrow({ where: { id: account.id } });
    expect(await verifyPassword(after.passwordHash, "brand-new-pass-1")).toBe(true);
    expect(await validateSessionToken(sessionToken)).toBeNull(); // sessions revoked

    const again = await performPasswordReset(raw, "another-pass-12");
    expect(again.ok).toBe(false); // single-use
  });
});
```

- [ ] **Step 2: Run to verify it fails, then implement**

```bash
DATABASE_URL="postgresql://noblestride:noblestride@localhost:5544/noblestride" corepack pnpm exec vitest run src/server/auth/__tests__/reset.smoke.test.ts
```

Create `src/server/auth/mailer.ts`:

```ts
// Mail abstraction (spec §3 non-goal: no SMTP yet). ConsoleMailer logs the
// message so reset links are usable in dev. Swap the export for a real
// implementation (Resend/SMTP) without touching callers.

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export async function sendMail(msg: MailMessage): Promise<void> {
  console.log(`\n[mailer] To: ${msg.to}\n[mailer] Subject: ${msg.subject}\n[mailer] ${msg.text}\n`);
}
```

Create `src/server/auth/reset.ts`:

```ts
// Password reset (spec §10). requestPasswordReset never reveals whether the
// email exists. performPasswordReset policy-checks BEFORE consuming the token
// so a typo doesn't burn the link.

import { prisma } from "@/lib/db";
import { normalizeEmail } from "./guardrails";
import { hashPassword } from "./password";
import { validatePassword } from "./policy";
import { hashToken, invalidateAllSessions } from "./session";
import { createAuthToken, consumeAuthToken } from "./tokens";
import { sendMail } from "./mailer";
import { logAuthEvent } from "./audit";

export async function requestPasswordReset(emailRaw: string, baseUrl: string): Promise<void> {
  const email = normalizeEmail(emailRaw);
  const account = await prisma.authAccount.findUnique({ where: { email } });
  if (!account || account.status !== "ACTIVE") return; // silent — no enumeration
  const raw = await createAuthToken(account.id, "RESET_PASSWORD");
  await sendMail({
    to: email,
    subject: "Reset your NobleStride password",
    text: `Reset link (valid 60 minutes): ${baseUrl}/reset-password/${raw}`,
  });
  await logAuthEvent(`Auth: password reset requested for ${email}`);
}

export async function performPasswordReset(
  rawToken: string,
  newPassword: string,
): Promise<{ ok: boolean; error?: string }> {
  // Peek at the token to policy-check against the right email WITHOUT consuming.
  const peek = await prisma.authToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    include: { account: true },
  });
  if (!peek || peek.purpose !== "RESET_PASSWORD" || peek.usedAt || peek.expiresAt.getTime() <= Date.now()) {
    return { ok: false, error: "This reset link is invalid or has expired. Request a new one." };
  }
  const policyError = validatePassword(newPassword, peek.account.email);
  if (policyError) return { ok: false, error: policyError };

  const account = await consumeAuthToken(rawToken, "RESET_PASSWORD");
  if (!account) return { ok: false, error: "This reset link is invalid or has expired. Request a new one." };

  await prisma.authAccount.update({
    where: { id: account.id },
    data: { passwordHash: await hashPassword(newPassword), failedLogins: 0, lockedUntil: null },
  });
  await invalidateAllSessions(account.id);
  await logAuthEvent(`Auth: password reset completed for ${account.email}`);
  return { ok: true };
}
```

Run the test again — expected: PASS.

- [ ] **Step 3: Create the forgot-password page + action**

`src/app/forgot-password/actions.ts`:

```ts
"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requestPasswordReset } from "@/server/auth/reset";
import { rateLimit } from "@/server/auth/rate-limit";

export async function forgotPasswordAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim();
  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (email && rateLimit(`forgot:${ip}`, { max: 5, windowMs: 10 * 60 * 1000 })) {
    const host = hdrs.get("host") ?? "localhost:3000";
    const proto = hdrs.get("x-forwarded-proto") ?? "http";
    await requestPasswordReset(email, `${proto}://${host}`);
  }
  redirect("/forgot-password?sent=1"); // same response regardless — no enumeration
}
```

`src/app/forgot-password/page.tsx` — follow `login/page.tsx`'s structure/classes exactly (copy the header block, card, `inputClass`/`labelClass` constants):
- Title "Reset your password", subtitle "We'll send a reset link to your email."
- When `searchParams.sent` is set, show a card: "If an account exists for that address, a reset link has been sent. (While email delivery is not configured, the link appears in the server console.)"
- Otherwise a single email field + submit button "Send reset link", `action={forgotPasswordAction}`, plus a "← Back to sign in" link to `/login`.

- [ ] **Step 4: Create the reset page + action**

`src/app/reset-password/actions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { performPasswordReset } from "@/server/auth/reset";

export async function resetPasswordAction(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (!token) redirect("/login");
  if (password !== confirm) {
    redirect(`/reset-password/${encodeURIComponent(token)}?error=${encodeURIComponent("Passwords do not match.")}`);
  }
  const res = await performPasswordReset(token, password);
  if (!res.ok) {
    redirect(`/reset-password/${encodeURIComponent(token)}?error=${encodeURIComponent(res.error ?? "Reset failed.")}`);
  }
  redirect(`/login?error=${encodeURIComponent("Password updated — sign in with your new password.")}`);
}
```

`src/app/reset-password/[token]/page.tsx` — same visual conventions; `params: Promise<{ token: string }>`, `searchParams: Promise<{ error?: string }>` (both awaited). Form: hidden `token` field, "New password" + "Confirm password" inputs (`type="password"`, `required`, `minLength={10}`), error banner when `sp.error`, submit "Set new password".

- [ ] **Step 5: Full check + commit**

```bash
corepack pnpm exec tsc --noEmit
DATABASE_URL="postgresql://noblestride:noblestride@localhost:5544/noblestride" corepack pnpm exec vitest run
git add -A -- src
git commit -m "feat(auth): password reset flow with console mailer"
```

---

### Task 11: Register flow — email-first fork, real passwords, OTP removed

**Files:**
- Modify: `src/server/onboarding/register-investor.ts` (add password; drop OTP)
- Modify: `src/lib/schemas/registration.ts` (extend with password)
- Modify: `src/app/register/actions.ts`, `src/app/register/page.tsx`, `src/app/register/register-wizard.tsx`, `src/app/register/register-steps.tsx`
- Create: `src/app/register/internal-form.tsx` (internal signup form)
- Delete: `src/server/onboarding/resolve-login.ts`, `src/server/onboarding/__tests__/resolve-login.smoke.test.ts`
- Test: update `src/server/onboarding/__tests__/register-investor.smoke.test.ts`, `src/lib/__tests__/registration-schema.test.ts`

**Interfaces:**
- Consumes: Tasks 2, 3, 6 (`classifyEmail`, `signupInternal`, `signupExistingContact`, `AuthFlowError`, `hashPassword`, `validatePassword`).
- Produces:
  - `registrationAccountSchema` = existing `registrationSchema` + `{ password: string; confirmPassword: string }` with a `.refine` match check and `validatePassword` refine
  - `registerInvestorWithAccount(raw: unknown): Promise<Investor>` — one transaction: Investor(PendingReview) + Person + PENDING AuthAccount; replaces `registerInvestor` in the actions (keep `registerInvestor` exported for its existing tests, or update tests to the new function — prefer updating tests)
  - `DEMO_OTP`, `confirmRegistrationOtp` deleted
  - Register page routes by email classification: internal → `internal-form`, external-with-existing-contact → password-only step, external-new → wizard, blocked → error

- [ ] **Step 1: Read the wizard first**

Read `src/app/register/page.tsx`, `register-wizard.tsx`, `register-steps.tsx` completely before editing. The wizard is a client multi-step form using `registerWizardAction` via `useActionState`; steps: form → verify (OTP) → done.

- [ ] **Step 2: Extend the schema (test-first)**

In `src/lib/__tests__/registration-schema.test.ts` add:

```ts
import { registrationAccountSchema } from "@/lib/schemas/registration";

describe("registrationAccountSchema", () => {
  const base = {
    fundName: "ZZ Fund", contactPerson: "Jane Doe", email: "jane@zzfund.com",
    phone: "+254700000000", investorType: "PE", sectorPreference: ["Agriculture"],
    dealType: "Equity", dealSizeBand: TICKET_BANDS[0].key,
  };
  it("requires matching passwords meeting policy", () => {
    expect(registrationAccountSchema.safeParse({ ...base, password: "short", confirmPassword: "short" }).success).toBe(false);
    expect(registrationAccountSchema.safeParse({ ...base, password: "long-enough-pass-1", confirmPassword: "different-pass-1" }).success).toBe(false);
    expect(registrationAccountSchema.safeParse({ ...base, password: "long-enough-pass-1", confirmPassword: "long-enough-pass-1" }).success).toBe(true);
  });
});
```

(Adapt `base` to the existing test file's fixture values — reuse its existing valid-input fixture if one exists; check the real enum members used there.)

Then in `src/lib/schemas/registration.ts` add:

```ts
import { validatePassword } from "@/server/auth/policy";

export const registrationAccountSchema = registrationSchema
  .extend({
    password: z.string(),
    confirmPassword: z.string(),
  })
  .superRefine((data, ctx) => {
    const err = validatePassword(data.password, data.email);
    if (err) ctx.addIssue({ code: "custom", message: err, path: ["password"] });
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({ code: "custom", message: "Passwords do not match.", path: ["confirmPassword"] });
    }
  });
```

(`policy.ts` is dependency-free, so importing it from `src/lib` does not pull server-only code into the client — verify `policy.ts` imports nothing from `node:` or Prisma. It doesn't.)

Run: `corepack pnpm exec vitest run src/lib/__tests__/registration-schema.test.ts` → PASS.

- [ ] **Step 3: Rework `register-investor.ts` (test-first)**

Update `src/server/onboarding/__tests__/register-investor.smoke.test.ts`: read it; replace `registerInvestor(...)` calls with `registerInvestorWithAccount({ ...sameFixture, password: "long-enough-pass-1", confirmPassword: "long-enough-pass-1" })`; delete OTP-related tests; add cleanup of `authAccount` rows for the test emails and an assertion:

```ts
const account = await prisma.authAccount.findUnique({ where: { email: FIXTURE_EMAIL.toLowerCase() } });
expect(account?.status).toBe("PENDING");
expect(account?.kind).toBe("INVESTOR");
```

In `src/server/onboarding/register-investor.ts`:
1. Delete `DEMO_OTP` and `confirmRegistrationOtp`.
2. Rename `registerInvestor` → `registerInvestorWithAccount`, parse with `registrationAccountSchema`, and extend the transaction — after the `tx.person.create` (capture its result), add:

```ts
const person = await tx.person.create({ /* existing data unchanged */ });
await tx.authAccount.create({
  data: {
    email: input.email.toLowerCase(),
    passwordHash,
    kind: "INVESTOR",
    status: "PENDING",
    personId: person.id,
  },
});
```

with `const passwordHash = await hashPassword(input.password);` computed before the transaction (import from `@/server/auth/password`; import `registrationAccountSchema` instead of `registrationSchema`). Also pre-check: if an `AuthAccount` already exists for the email, throw `RegistrationError("A registration with this contact email already exists. Contact NobleStride if you need access.")`.

Run: `DATABASE_URL=... corepack pnpm exec vitest run src/server/onboarding/__tests__/register-investor.smoke.test.ts` → PASS.

- [ ] **Step 4: Rework the register actions**

Rewrite `src/app/register/actions.ts`:

```ts
"use server";
// Server actions for the public /register flow (real-auth spec §10).
// Email-first fork: internal → staff signup; existing investor contact →
// password-only account request; new investor → wizard; blocked → error.

import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { prisma } from "@/lib/db";
import { classifyEmailForSignup, normalizeEmail } from "@/server/auth/guardrails";
import { AuthFlowError, signupExistingContact, signupInternal } from "@/server/auth/accounts";
import { registerInvestorWithAccount, RegistrationError } from "@/server/onboarding/register-investor";
import { rateLimit } from "@/server/auth/rate-limit";
import { headers } from "next/headers";

export interface WizardActionState {
  error?: string;
}

async function checkRate(scope: string): Promise<boolean> {
  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  return rateLimit(`${scope}:${ip}`, { max: 10, windowMs: 10 * 60 * 1000 });
}

/** Step 0: classify the email and route to the right path. */
export async function routeEmailAction(formData: FormData): Promise<void> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  if (!email) redirect("/register");
  const cls = await classifyEmailForSignup(email);
  if (cls.kind === "blocked") {
    const msg =
      cls.reason === "free-provider"
        ? "Please use your official company email address — free providers (Gmail, Yahoo, …) are not accepted."
        : cls.reason === "greylisted"
          ? "This email is not eligible to register. Contact NobleStride if you believe this is an error."
          : "Enter a valid email address.";
    redirect(`/register?error=${encodeURIComponent(msg)}&email=${encodeURIComponent(email)}`);
  }
  if (cls.kind === "internal") {
    redirect(`/register?path=internal&email=${encodeURIComponent(email)}`);
  }
  const contact = await prisma.person.findFirst({
    where: { email: { equals: email, mode: "insensitive" }, investorId: { not: null } },
    select: { id: true },
  });
  redirect(
    contact
      ? `/register?path=contact&email=${encodeURIComponent(email)}`
      : `/register?path=fund&email=${encodeURIComponent(email)}`,
  );
}

/** Internal staff signup. */
export async function internalSignupAction(_prev: WizardActionState, formData: FormData): Promise<WizardActionState> {
  if (!(await checkRate("signup"))) return { error: "Too many attempts — try again later." };
  const password = String(formData.get("password") ?? "");
  if (password !== String(formData.get("confirm") ?? "")) return { error: "Passwords do not match." };
  try {
    const res = await signupInternal({
      email: String(formData.get("email") ?? ""),
      name: String(formData.get("name") ?? "").trim(),
      jobTitle: String(formData.get("jobTitle") ?? "").trim() || undefined,
      password,
    });
    redirect(res.status === "active" ? `/login?error=${encodeURIComponent("Account created — sign in.")}` : "/register?step=pending");
  } catch (err) {
    if (err instanceof AuthFlowError) return { error: err.message };
    throw err;
  }
}

/** Existing investor-contact account request. */
export async function contactSignupAction(_prev: WizardActionState, formData: FormData): Promise<WizardActionState> {
  if (!(await checkRate("signup"))) return { error: "Too many attempts — try again later." };
  const password = String(formData.get("password") ?? "");
  if (password !== String(formData.get("confirm") ?? "")) return { error: "Passwords do not match." };
  try {
    await signupExistingContact({ email: String(formData.get("email") ?? ""), password });
    redirect("/register?step=pending");
  } catch (err) {
    if (err instanceof AuthFlowError) return { error: err.message };
    throw err;
  }
}

/** New-fund wizard submit (replaces the old registerWizardAction). */
export async function registerWizardAction(_prev: WizardActionState, formData: FormData): Promise<WizardActionState> {
  if (!(await checkRate("signup"))) return { error: "Too many attempts — try again later." };
  const raw = {
    fundName: String(formData.get("fundName") ?? "").trim(),
    contactPerson: String(formData.get("contactPerson") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    investorType: String(formData.get("investorType") ?? "").trim(),
    sectorPreference: formData.getAll("sectorPreference").map(String),
    dealType: String(formData.get("dealType") ?? "").trim(),
    dealSizeBand: String(formData.get("dealSizeBand") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  };
  try {
    await registerInvestorWithAccount(raw);
  } catch (err) {
    if (err instanceof ZodError) return { error: err.issues[0]?.message ?? "Check the form and try again" };
    if (err instanceof RegistrationError) return { error: err.message };
    throw err;
  }
  redirect("/register?step=pending");
}
```

Note: `redirect()` inside a try block throws `NEXT_REDIRECT` — it must NOT be swallowed by the catch. Move each `redirect(...)` call to after the try/catch (set a flag inside the try, redirect after), or re-throw when `err` has `digest` starting with `"NEXT_REDIRECT"`. Prefer restructuring: perform the awaited call in try/catch, then `redirect()` after.

- [ ] **Step 5: Rework the register UI**

Following the existing wizard's visual conventions (read before editing):
- `src/app/register/page.tsx`: derive the view from `searchParams`: no `path`/`step` → email-entry card (form → `routeEmailAction`, one email input, note "NobleStride staff and investors both start here"); `path=internal` → render `<InternalForm email={sp.email}/>`; `path=contact` → small card: email (read-only hidden field) + password + confirm, `useActionState(contactSignupAction)`-driven client subcomponent; `path=fund` → existing wizard with `email` prefilled; `step=pending` → confirmation card: "Thanks — your account request is in. The NobleStride team reviews every account; you'll be able to sign in once approved."; `error` → red banner (existing convention).
- `src/app/register/register-wizard.tsx`: add two password fields (`password`, `confirmPassword`, `type="password"`, `required`, `minLength={10}`) to the final form step, labeled "Create a password" / "Confirm password"; accept an `initialEmail` prop to prefill; on success the action now redirects to `?step=pending` — delete the OTP step (and its UI in `register-steps.tsx`), delete `verifyOtpAction` usage.
- Create `src/app/register/internal-form.tsx` (client component, `useActionState(internalSignupAction, {})`): fields Name (required), Job title (optional), Email (prefilled, read-only `<input readOnly name="email">`), Password + Confirm; inline `state.error` banner; submit "Request account".

- [ ] **Step 6: Delete the dummy login resolver**

```bash
git rm src/server/onboarding/resolve-login.ts src/server/onboarding/__tests__/resolve-login.smoke.test.ts
```

`grep -rn "resolve-login\|isTeamEmail" src` — expect no remaining references (login/actions.ts was rewritten in Task 9).

- [ ] **Step 7: Full check**

```bash
corepack pnpm exec tsc --noEmit
DATABASE_URL="postgresql://noblestride:noblestride@localhost:5544/noblestride" corepack pnpm exec vitest run
corepack pnpm exec eslint src/app/register src/server/onboarding 2>&1 | tail -5
```

Expected: 0 tsc errors; suite passes (resolve-login tests gone, register tests updated); no NEW lint errors.

- [ ] **Step 8: Commit**

```bash
git add -A -- src
git commit -m "feat(auth): email-first registration fork; investor wizard creates real accounts; OTP removed"
```

---

### Task 12: Server-side RBAC enforcement in GraphQL

**Files:**
- Modify: `src/graphql/context.ts` (session-derived actor)
- Create: `src/server/rbac/enforce.ts`
- Modify: `src/graphql/mutations.ts` (guard every mutation)
- Modify: `src/server/services/investors.ts` (`setOnboardingStatus`/`greylistInvestor` wire account activation)
- Test: `src/server/rbac/__tests__/enforce.test.ts`

**Interfaces:**
- Consumes: Task 8 `resolveViewpointFor`, `validateSessionToken`; existing `can`/`canUpdateRecord`/`canDeleteRecord` matrix; Task 6 `activateAccountsForInvestor`/`suspendAccountsForInvestor`.
- Produces:
  - `Actor` gains `{ authenticated: boolean; orgRole?: OrgRole; accountKind?: "INTERNAL" | "INVESTOR" }`
  - `assertCan(actor, entity, perm)`, `assertCanDelete(actor, entity)`, `assertCanUpdateOwnScoped(actor, entity, fetch)`, `assertAdmin(actor)` — all throw `GraphQLError` with `extensions.code = "FORBIDDEN"`

- [ ] **Step 1: Write the failing test**

Create `src/server/rbac/__tests__/enforce.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { assertCan, assertCanDelete, assertCanUpdateOwnScoped, assertAdmin } from "../enforce";
import type { Actor } from "@/graphql/context";

const admin: Actor = { type: "HUMAN", authenticated: true, accountKind: "INTERNAL", orgRole: "Admin", userId: "u1" };
const teamMember: Actor = { type: "HUMAN", authenticated: true, accountKind: "INTERNAL", orgRole: "TeamMember", userId: "u2" };
const dealLead: Actor = { type: "HUMAN", authenticated: true, accountKind: "INTERNAL", orgRole: "DealLead", userId: "u3" };
const investor: Actor = { type: "HUMAN", authenticated: true, accountKind: "INVESTOR" };
const anonymous: Actor = { type: "HUMAN", authenticated: false };
const apiAgent: Actor = { type: "AGENT", authenticated: true, userId: "agent-1" };

describe("assertCan", () => {
  it("admin can do everything; API agents pass (automation path)", () => {
    expect(() => assertCan(admin, "Investors", "D")).not.toThrow();
    expect(() => assertCan(apiAgent, "Investors", "C")).not.toThrow();
  });
  it("TeamMember cannot create or delete investors", () => {
    expect(() => assertCan(teamMember, "Investors", "C")).toThrow();
    expect(() => assertCanDelete(teamMember, "Investors")).toThrow();
  });
  it("anonymous and investor-kind actors are always denied", () => {
    expect(() => assertCan(anonymous, "Tasks", "R")).toThrow();
    expect(() => assertCan(investor, "Engagements", "U")).toThrow();
  });
});

describe("assertCanUpdateOwnScoped", () => {
  it("DealLead can update own transaction but not someone else's", async () => {
    await expect(
      assertCanUpdateOwnScoped(dealLead, "Transactions", async () => ({ ownerId: "u3" })),
    ).resolves.toBeUndefined();
    await expect(
      assertCanUpdateOwnScoped(dealLead, "Transactions", async () => ({ ownerId: "someone-else" })),
    ).rejects.toThrow();
  });
  it("admin skips the ownership fetch", async () => {
    let fetched = false;
    await assertCanUpdateOwnScoped(admin, "Transactions", async () => {
      fetched = true;
      return { ownerId: "x" };
    });
    expect(fetched).toBe(false);
  });
});

describe("assertAdmin", () => {
  it("only Admin org-role or API automation passes", () => {
    expect(() => assertAdmin(admin)).not.toThrow();
    expect(() => assertAdmin(apiAgent)).not.toThrow();
    expect(() => assertAdmin(dealLead)).toThrow();
    expect(() => assertAdmin(anonymous)).toThrow();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
corepack pnpm exec vitest run src/server/rbac/__tests__/enforce.test.ts
```

Expected: FAIL — `enforce` missing / `Actor` lacks fields.

- [ ] **Step 3: Update `src/graphql/context.ts`**

```ts
import { prisma } from "@/lib/db";
import { jwtVerify } from "jose";
import type { OrgRole } from "@prisma/client";
import { validateSessionToken } from "@/server/auth/session";
import { SESSION_COOKIE } from "@/server/auth/session-cookie";
import { IMPERSONATION_COOKIE } from "@/server/auth/impersonation";
import { resolveViewpointFor, type CurrentAuth } from "@/server/auth/current";

export interface Actor {
  type: "HUMAN" | "AGENT" | "API";
  userId?: string;
  label?: string;
  /** True only for a verified session cookie or a valid Bearer JWT. */
  authenticated: boolean;
  /** Effective in-org role (lens-aware) — internal HUMAN actors only. */
  orgRole?: OrgRole;
  accountKind?: "INTERNAL" | "INVESTOR";
}

export interface GraphQLContext {
  prisma: typeof prisma;
  actor: Actor;
}

function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

/** Cookie-authed browser calls must be same-origin (CSRF; Bearer calls exempt). */
function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // same-origin fetches may omit Origin
  const host = request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/**
 * Per-request context. Priority: Bearer JWT (external agents/API — unchanged
 * contract) → session cookie (browser UI) → anonymous (no rights).
 */
export async function createContext(request: Request): Promise<GraphQLContext> {
  const auth = request.headers.get("authorization");
  let actor: Actor = { type: "HUMAN", authenticated: false };

  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice("Bearer ".length);
    try {
      const secret = new TextEncoder().encode(process.env.API_JWT_SECRET ?? "");
      const { payload } = await jwtVerify(token, secret);
      actor = {
        type: (payload.actorType as Actor["type"]) ?? "API",
        userId: payload.sub,
        label: payload.label as string | undefined,
        authenticated: true,
      };
    } catch {
      actor = { type: "API", authenticated: false };
    }
    return { prisma, actor };
  }

  const sessionToken = readCookie(request, SESSION_COOKIE);
  if (sessionToken && sameOrigin(request)) {
    const validated = await validateSessionToken(sessionToken);
    if (validated) {
      const { account } = validated;
      const [user, person] = await Promise.all([
        account.userId ? prisma.user.findUnique({ where: { id: account.userId } }) : null,
        account.personId
          ? prisma.person.findUnique({ where: { id: account.personId }, include: { investor: true } })
          : null,
      ]);
      const current: CurrentAuth = { account, user, person };
      const vp = await resolveViewpointFor(current, readCookie(request, IMPERSONATION_COOKIE));
      if (vp) {
        actor = {
          type: "HUMAN",
          authenticated: true,
          accountKind: account.kind,
          userId: vp.role === "admin" ? (vp.userId ?? user?.id) : undefined,
          orgRole: vp.role === "admin" ? ((vp.orgRole ?? "Admin") as OrgRole) : undefined,
        };
      }
    }
  }
  return { prisma, actor };
}
```

(Note the lens-aware `orgRole`: an Admin impersonating the TeamMember lens is enforced as TeamMember — matches what the UI shows, and only Admins can impersonate, so lenses can only narrow.)

- [ ] **Step 4: Implement `src/server/rbac/enforce.ts`**

```ts
// Server-side RBAC enforcement (real-auth spec §9) — the matrix in matrix.ts
// finally gates mutations, not just buttons. API/AGENT actors with a valid
// Bearer JWT keep full automation access (existing contract).

import { GraphQLError } from "graphql";
import { can, canDeleteRecord, canUpdateRecord, type OwnableRecord, type Perm, type RbacEntity } from "./matrix";
import type { Actor } from "@/graphql/context";

export function forbidden(message = "Not authorized"): GraphQLError {
  return new GraphQLError(message, { extensions: { code: "FORBIDDEN" } });
}

function isAutomation(actor: Actor): boolean {
  return actor.authenticated && (actor.type === "API" || actor.type === "AGENT");
}

function internalRole(actor: Actor) {
  if (!actor.authenticated || actor.accountKind !== "INTERNAL" || !actor.orgRole) return null;
  return actor.orgRole;
}

export function assertCan(actor: Actor, entity: RbacEntity, perm: Perm): void {
  if (isAutomation(actor)) return;
  const role = internalRole(actor);
  if (!role || !can(role, entity, perm)) throw forbidden();
}

export function assertCanDelete(actor: Actor, entity: RbacEntity): void {
  if (isAutomation(actor)) return;
  const role = internalRole(actor);
  if (!role || !canDeleteRecord(role, entity)) throw forbidden();
}

/** Row-level update on own-scoped entities. `fetch` runs only for non-admin internal roles. */
export async function assertCanUpdateOwnScoped(
  actor: Actor,
  entity: RbacEntity,
  fetch: () => Promise<OwnableRecord | null>,
): Promise<void> {
  if (isAutomation(actor)) return;
  const role = internalRole(actor);
  if (!role || !can(role, entity, "U")) throw forbidden();
  if (role === "Admin") return;
  const record = await fetch();
  if (!record || !canUpdateRecord(role, entity, actor.userId, record)) throw forbidden();
}

export function assertAdmin(actor: Actor): void {
  if (isAutomation(actor)) return;
  if (internalRole(actor) !== "Admin") throw forbidden();
}
```

Run the test — expected: PASS (7 tests).

- [ ] **Step 5: Guard every mutation in `src/graphql/mutations.ts`**

Convert each resolver to an async arrow that asserts first. Pattern:

```ts
// before:
resolve: (_q, _r, args, ctx) => createInvestor(args.input as never, ctx.actor),
// after:
resolve: async (_q, _r, args, ctx) => {
  assertCan(ctx.actor, "Investors", "C");
  return createInvestor(args.input as never, ctx.actor);
},
```

Import at top: `import { assertAdmin, assertCan, assertCanDelete, assertCanUpdateOwnScoped } from "@/server/rbac/enforce"; import { prisma } from "@/lib/db";`

Exact mapping for ALL mutations (own-scoped fetches select only the ownership column):

| Mutation | Guard |
|---|---|
| `updateMandateStage` | `await assertCanUpdateOwnScoped(ctx.actor, "Mandates", () => prisma.mandate.findUnique({ where: { id: String(args.id) }, select: { leadId: true } }))` |
| `updateTransactionStage` | `await assertCanUpdateOwnScoped(ctx.actor, "Transactions", () => prisma.transaction.findUnique({ where: { id: String(args.id) }, select: { ownerId: true } }))` |
| `logEngagement`, `logActivity` | `assertCan(ctx.actor, "Engagements", "U")` |
| `createInvestor` | `assertCan(ctx.actor, "Investors", "C")` |
| `updateInvestor` | `assertCan(ctx.actor, "Investors", "U")` |
| `deleteInvestor` | `assertCanDelete(ctx.actor, "Investors")` |
| `setInvestorOnboardingStatus`, `greylistInvestor` | `assertAdmin(ctx.actor)` (approval decisions are admin-only per spec §2) |
| `recordOpenNda` | `assertCan(ctx.actor, "Investors", "U")` |
| `recordClosedNda` | `assertCan(ctx.actor, "Engagements", "U")` |
| `createClient` / `updateClient` / `deleteClient` | `assertCan(..., "Clients", "C"/"U")` / `assertCanDelete(..., "Clients")` |
| `createMandate` | `assertCan(ctx.actor, "Mandates", "C")` |
| `updateMandate` | `await assertCanUpdateOwnScoped(ctx.actor, "Mandates", () => prisma.mandate.findUnique({ where: { id: String(args.id) }, select: { leadId: true } }))` |
| `deleteMandate` | `assertCanDelete(ctx.actor, "Mandates")` |
| `createTransaction` | `assertCan(ctx.actor, "Transactions", "C")` |
| `updateTransaction` | `await assertCanUpdateOwnScoped(ctx.actor, "Transactions", () => prisma.transaction.findUnique({ where: { id: String(args.id) }, select: { ownerId: true } }))` |
| `deleteTransaction` | `assertCanDelete(ctx.actor, "Transactions")` |
| `createPartner` / `updatePartner` / `deletePartner` | `assertCan(..., "Partners", "C"/"U")` / `assertCanDelete(..., "Partners")` |
| `createServiceProvider` / `updateServiceProvider` / `deleteServiceProvider` | `assertCan(..., "Service Providers", "C"/"U")` / `assertCanDelete(..., "Service Providers")` |
| `createDocument` / `updateDocument` / `deleteDocument` | `assertCan(..., "Documents", "C"/"U")` / `assertCanDelete(..., "Documents")` |
| `createEngagement` | `assertCan(ctx.actor, "Engagements", "C")` |
| `updateEngagement` | `await assertCanUpdateOwnScoped(ctx.actor, "Engagements", () => prisma.engagement.findUnique({ where: { id: String(args.id) }, select: { ownerId: true } }))` |
| `createTask` | `assertCan(ctx.actor, "Tasks", "C")` |
| `updateTask` | `await assertCanUpdateOwnScoped(ctx.actor, "Tasks", () => prisma.task.findUnique({ where: { id: String(args.id) }, select: { assigneeId: true } }))` |
| `deleteTask` | `assertCanDelete(ctx.actor, "Tasks")` |
| `createPerson` / `updatePerson` | `assertCan(ctx.actor, "Investors", "U")` (contacts modify their parent records) |
| `deletePerson` | `assertCanDelete(ctx.actor, "Investors")` |
| `recordMilestone` / `unrecordMilestone` | `assertCan(ctx.actor, "Engagements", "U")` |
| `upsertDueDiligenceTrack` / `deleteDueDiligenceTrack` | `assertCan(ctx.actor, "Transactions", "U")` |
| `createSavedView` / `renameSavedView` / `deleteSavedView` | `assertCan(ctx.actor, "Tasks", "R")` (any authenticated internal role — Tasks:R is true for all three roles; this is the "is internal staff" check) |

- [ ] **Step 6: Wire investor review → account lifecycle**

In `src/server/services/investors.ts` (read it first): at the end of `setOnboardingStatus`, after the status update succeeds, add:

```ts
import { activateAccountsForInvestor, suspendAccountsForInvestor } from "@/server/auth/accounts";
// after the update:
if (status === "Approved") await activateAccountsForInvestor(id);
if (status === "Rejected") await suspendAccountsForInvestor(id);
```

And at the end of `greylistInvestor`: `await suspendAccountsForInvestor(id);` (match the actual parameter names in the file).

- [ ] **Step 7: Full check**

```bash
corepack pnpm exec tsc --noEmit
DATABASE_URL="postgresql://noblestride:noblestride@localhost:5544/noblestride" corepack pnpm exec vitest run
```

Expected: 0 errors, all pass.

- [ ] **Step 8: Commit**

```bash
git add -A -- src
git commit -m "feat(auth): server-side RBAC enforcement on all GraphQL mutations"
```

---

### Task 13: Admin user-management page

**Files:**
- Create: `src/app/(crm)/settings/users/page.tsx`
- Create: `src/app/(crm)/settings/users/actions.ts`
- Create: `src/app/(crm)/settings/users/user-actions-client.tsx` (small client component for the action buttons/forms)
- Modify: `src/components/shell/sidebar.tsx` (Admin-gated "Users" nav item), `src/app/(crm)/layout.tsx` (pass `isAdmin` prop to Sidebar)

**Interfaces:**
- Consumes: Task 6 (`approveInternalAccount`, `rejectPendingAccount`, `suspendAccount`, `reactivateAccount`, `changeInternalRole`, `activateAccountsForInvestor`), Task 4 (`createAuthToken`), Task 8 (`getCurrentAuth`).
- Produces: `/settings/users` page (Admin-only) with pending queue + account table; server actions `approveInternalAction`, `approveInvestorAccountAction`, `rejectAccountAction`, `suspendAccountAction`, `reactivateAccountAction`, `changeRoleAction`, `generateResetLinkAction`.

- [ ] **Step 1: Server actions — `src/app/(crm)/settings/users/actions.ts`**

```ts
"use server";
// Admin user management (real-auth spec §10). Every action re-checks the REAL
// role server-side (never the lens — an admin impersonating TeamMember still
// administers; a real TeamMember never can).

import { revalidatePath } from "next/cache";
import type { OrgRole } from "@prisma/client";
import { getCurrentAuth } from "@/server/auth/current";
import {
  approveInternalAccount, rejectPendingAccount, suspendAccount,
  reactivateAccount, changeInternalRole, activateAccountsForInvestor, AuthFlowError,
} from "@/server/auth/accounts";
import { createAuthToken } from "@/server/auth/tokens";
import { prisma } from "@/lib/db";
import { headers } from "next/headers";

async function requireRealAdmin() {
  const auth = await getCurrentAuth();
  if (!auth || auth.account.kind !== "INTERNAL" || auth.user?.role !== "Admin" || !auth.user.isActive) {
    throw new Error("Not authorized");
  }
  return auth;
}

export interface UserActionState {
  error?: string;
  resetLink?: string;
}

async function run(fn: (adminUserId: string) => Promise<void | string>): Promise<UserActionState> {
  try {
    const admin = await requireRealAdmin();
    const result = await fn(admin.user!.id);
    revalidatePath("/settings/users");
    return typeof result === "string" ? { resetLink: result } : {};
  } catch (err) {
    if (err instanceof AuthFlowError) return { error: err.message };
    if (err instanceof Error && err.message === "Not authorized") return { error: "Not authorized." };
    throw err;
  }
}

export async function approveInternalAction(_p: UserActionState, formData: FormData): Promise<UserActionState> {
  const role = String(formData.get("role") ?? "TeamMember") as OrgRole;
  return run((adminId) => approveInternalAccount(String(formData.get("accountId")), role, adminId));
}

export async function approveInvestorAccountAction(_p: UserActionState, formData: FormData): Promise<UserActionState> {
  return run(async () => {
    const account = await prisma.authAccount.findUniqueOrThrow({
      where: { id: String(formData.get("accountId")) },
      include: { person: true },
    });
    if (!account.person?.investorId) throw new AuthFlowError("No linked investor for this account.");
    await activateAccountsForInvestor(account.person.investorId);
  });
}

export async function rejectAccountAction(_p: UserActionState, formData: FormData): Promise<UserActionState> {
  return run((adminId) => rejectPendingAccount(String(formData.get("accountId")), adminId));
}

export async function suspendAccountAction(_p: UserActionState, formData: FormData): Promise<UserActionState> {
  return run((adminId) => suspendAccount(String(formData.get("accountId")), adminId));
}

export async function reactivateAccountAction(_p: UserActionState, formData: FormData): Promise<UserActionState> {
  return run((adminId) => reactivateAccount(String(formData.get("accountId")), adminId));
}

export async function changeRoleAction(_p: UserActionState, formData: FormData): Promise<UserActionState> {
  const role = String(formData.get("role") ?? "") as OrgRole;
  return run((adminId) => changeInternalRole(String(formData.get("accountId")), role, adminId));
}

export async function generateResetLinkAction(_p: UserActionState, formData: FormData): Promise<UserActionState> {
  return run(async () => {
    const raw = await createAuthToken(String(formData.get("accountId")), "RESET_PASSWORD");
    const hdrs = await headers();
    const host = hdrs.get("host") ?? "localhost:3000";
    const proto = hdrs.get("x-forwarded-proto") ?? "http";
    return `${proto}://${host}/reset-password/${raw}`;
  });
}
```

- [ ] **Step 2: Page — `src/app/(crm)/settings/users/page.tsx`**

RSC. Guard first: same `requireRealAdmin` logic inline — `const auth = await getCurrentAuth(); if (!auth || auth.account.kind !== "INTERNAL" || auth.user?.role !== "Admin") redirect("/dashboard");`. Then fetch:

```ts
const accounts = await prisma.authAccount.findMany({
  include: { user: true, person: { include: { investor: { select: { id: true, name: true, onboardingStatus: true } } } } },
  orderBy: [{ status: "asc" }, { createdAt: "desc" }],
});
const pending = accounts.filter((a) => a.status === "PENDING");
const rest = accounts.filter((a) => a.status !== "PENDING");
```

Render (match existing (crm) page styling — read `src/app/(crm)/access-matrix/page.tsx` for card/table conventions first):
1. "Pending approval" card: table (email, kind, name — `displayName` or person's investor name, requested date) with per-row `<UserActionsClient account={...} mode="pending" />`.
2. "All accounts" card: table (email, kind, role — `user.role` for INTERNAL, "—" for INVESTOR; status chip; last login) with `<UserActionsClient account={...} mode="active" />`.
Pass each client row a plain serializable object: `{ id, email, kind, status, role: a.user?.role ?? null }`.

- [ ] **Step 3: Client action buttons — `user-actions-client.tsx`**

Client component using `useActionState` per action. `mode="pending"`: for INTERNAL — role `<select name="role">` (Admin/DealLead/TeamMember, default TeamMember) + "Approve" (`approveInternalAction`) + "Reject" (`rejectAccountAction`); for INVESTOR — "Approve investor" (`approveInvestorAccountAction`) + "Reject". `mode="active"`: role select + "Change role" (INTERNAL only, `changeRoleAction`); "Suspend"/"Reactivate" by status; "Reset link" (`generateResetLinkAction`) which renders `state.resetLink` in a copyable `<code>` block when present; `state.error` inline in rose text. Hidden `accountId` input in every form. Use existing button classes from the topbar (`rounded border border-[var(--border-subtle)] px-2.5 py-1.5 text-xs ...`).

- [ ] **Step 4: Sidebar nav**

`src/components/shell/sidebar.tsx`: read the nav-item structure (line ~38 area); add to the nav list a `{ href: "/settings/users", label: "Users", Icon: Users, ... }` entry rendered ONLY when a new `isAdmin?: boolean` prop is true (import `Users` from lucide-react). `src/app/(crm)/layout.tsx`: compute `const auth = await getCurrentAuth();` (already imported in Task 9) and pass `<Sidebar pendingReview={pendingReview} isAdmin={auth?.user?.role === "Admin"} />`.

- [ ] **Step 5: Full check + manual smoke**

```bash
corepack pnpm exec tsc --noEmit
DATABASE_URL="postgresql://noblestride:noblestride@localhost:5544/noblestride" corepack pnpm exec vitest run
```

Expected: 0 errors, all pass. (Browser verification happens in Task 15.)

- [ ] **Step 6: Commit**

```bash
git add -A -- src
git commit -m "feat(auth): admin user-management page — approvals, roles, suspension, reset links"
```

---

### Task 14: Seed accounts + role bootstrap

**Files:**
- Modify: `prisma/seed.ts`

**Interfaces:**
- Consumes: Task 3 `hashPassword`; env `SEED_USER_PASSWORD`.
- Produces: 14 ACTIVE internal accounts (Evans + Solomon = `Admin`; jobTitle `"Deal Lead"` → `DealLead`; everyone else → `TeamMember`); 1 ACTIVE demo investor account for the primary contact of the first Approved investor with a contact email.

- [ ] **Step 1: Add auth cleanup to the idempotency block**

In `prisma/seed.ts` `main()` (~line 158), FIRST line of the delete block:

```ts
await prisma.authAccount.deleteMany(); // cascades AuthSession/AuthToken (DB-level)
```

- [ ] **Step 2: Role mapping + internal accounts**

Replace the USERS loop (~lines 176-188) with:

```ts
// USERS — real-auth role bootstrap (spec §11): Evans & Solomon are the
// full-access admins; "Deal Lead" job titles map to DealLead; rest TeamMember.
const ADMIN_EMAILS = new Set(["evans@noblestride.capital", "solomon@noblestride.capital"]);
const seedPassword = process.env.SEED_USER_PASSWORD ?? "NobleStride!Demo2026";
const seedPasswordHash = await hashPassword(seedPassword);

const usersByFirst = new Map<string, string>();
for (const u of seedData.users) {
  const email = u.email.toLowerCase();
  const role = ADMIN_EMAILS.has(email) ? "Admin" : u.jobTitle === "Deal Lead" ? "DealLead" : "TeamMember";
  const user = await prisma.user.create({
    data: {
      name: u.name,
      email: u.email,
      jobTitle: u.jobTitle,
      avatarColor: u.avatarColor,
      role,
    },
  });
  await prisma.authAccount.create({
    data: { email, passwordHash: seedPasswordHash, kind: "INTERNAL", status: "ACTIVE", userId: user.id },
  });
  usersByFirst.set(u.name.split(" ")[0].toLowerCase(), user.id);
}
console.log(`Seeded ${seedData.users.length} internal accounts (password: ${seedPassword})`);
```

Add the import at the top: `import { hashPassword } from "../src/server/auth/password";` — check how seed.ts imports app code today (grep its imports); if it only imports `@prisma/client`, use a relative import as shown and verify `tsx` resolves it. If `@/` aliases work under tsx (check `tsconfig` + how other scripts import), prefer `@/server/auth/password`. Watch out: `password.ts` imports `@node-rs/argon2` only — no Next dependencies — so it's seed-safe either way.

- [ ] **Step 3: Demo investor account**

After the investor+contacts seeding completes (find where `Person` rows with emails are created for investors — likely a CONTACTS section; place this after it), add:

```ts
// One ACTIVE investor account so the portal is directly loggable-into (spec §11).
const demoContact = await prisma.person.findFirst({
  where: { email: { not: null }, investor: { onboardingStatus: "Approved" }, isPrimaryContact: true },
  orderBy: { createdAt: "asc" },
  include: { investor: { select: { name: true } } },
});
if (demoContact?.email) {
  await prisma.authAccount.create({
    data: {
      email: demoContact.email.toLowerCase(),
      passwordHash: seedPasswordHash,
      kind: "INVESTOR",
      status: "ACTIVE",
      personId: demoContact.id,
    },
  });
  console.log(`Seeded investor account: ${demoContact.email} (${demoContact.investor?.name})`);
}
```

- [ ] **Step 4: Run the seed and verify**

```bash
corepack pnpm run seed
```

Expected output includes `Seeded 14 internal accounts` and `Seeded investor account: ...`. Verify roles:

```bash
docker exec noblestride-postgres psql -U noblestride -d noblestride -c "SELECT u.email, u.role, a.status, a.kind FROM \"User\" u JOIN \"AuthAccount\" a ON a.\"userId\" = u.id ORDER BY u.role, u.email;"
```

Expected: evans@ + solomon@ = `Admin`; Deal Lead-titled users = `DealLead`; rest `TeamMember`; all `ACTIVE`/`INTERNAL`.

- [ ] **Step 5: Full test suite (seed changed shared demo data — confirm nothing broke)**

```bash
corepack pnpm exec tsc --noEmit
DATABASE_URL="postgresql://noblestride:noblestride@localhost:5544/noblestride" corepack pnpm exec vitest run
```

Expected: 0 errors, all pass.

- [ ] **Step 6: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat(auth): seed internal accounts with role bootstrap + demo investor account"
```

---

### Task 15: End-to-end verification + docs

**Files:**
- Modify: `docs/superpowers/specs/2026-07-08-real-authentication-design.md` (status line only, if divergences emerged)
- No production code except fixes for verified bugs.

- [ ] **Step 1: Static gates**

```bash
corepack pnpm exec tsc --noEmit
DATABASE_URL="postgresql://noblestride:noblestride@localhost:5544/noblestride" corepack pnpm exec vitest run
corepack pnpm exec eslint src 2>&1 | tail -3
npx next build 2>&1 | tail -5
```

Expected: tsc 0 errors; vitest all pass (489 baseline minus 3 deleted resolve-login tests plus ~30 new); lint ≤ 8 pre-existing errors (none in new files); build succeeds. (Use `npx next build` directly if `pnpm run build`'s `prisma generate` hits the Windows EPERM DLL lock.) Revert `src/generated/pothos-types.ts` churn after build.

- [ ] **Step 2: Browser end-to-end pass (dev server on :3100)**

Start `PORT=3100 corepack pnpm dev` in the background, then drive with the Playwright MCP browser tools (or headless-Chrome + curl fallback):

1. `GET /dashboard` signed out → lands on `/login?next=/dashboard`.
2. Login `evans@noblestride.capital` / seed password → lands on `/dashboard`; topbar shows the viewpoint switcher; `/settings/users` loads.
3. Login as a TeamMember seed user (e.g. `irine@noblestride.capital` — check the exact seeded email in `prisma/seed-data.json`) → `/settings/users` redirects to `/dashboard`; no Users nav item; no switcher.
4. Direct GraphQL bypass check (the headline vulnerability): while logged in as the TeamMember, POST to `/api/graphql` mutation `deleteInvestor` (pick an id from the UI) → response contains `FORBIDDEN` error and the investor still exists. Repeat with NO cookies → `FORBIDDEN`.
5. Wrong password 3× → generic "Incorrect email or password."; then correct password still works (< 10 failures).
6. Investor login (seeded demo investor account) → lands on `/portal/investor`; navigating to `/dashboard` redirects to the portal.
7. `/register` with `test@gmail.com` → free-provider rejection. With a fresh corporate email → wizard → submits → pending screen; new PENDING account visible on `/settings/users` (as Evans); approve investor → investor login works after investor is Approved.
8. Internal signup with a NEW `@noblestride.capital` email → pending screen; approve as Evans with role TeamMember → login works.
9. Admin impersonation: as Evans, switch lens to an investor → portal with "viewing as" banner + Return to Admin works; as the TeamMember user, `GET /api/viewpoint?role=investor&recordId=<id>` directly → 403.
10. Forgot password for evans@ → reset link printed in the dev-server console → open link, set new password → old session invalidated (original tab's next navigation redirects to login), new password logs in. Reset back to the seed password afterwards (via the same flow) to keep the demo predictable.
11. Sign out → back to `/login`; `/dashboard` redirects to login again.

Record each step's outcome. Any failure: STOP, use superpowers:systematic-debugging, fix, re-verify, and only then continue.

- [ ] **Step 3: Update the QA log**

Per the working agreement, append the verification results to the living QA log (`playwright assessment/` directory at the repo root if present — create `playwright assessment/2026-07-08-real-auth-verification.md` with the checklist above and pass/fail per item).

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "test(auth): end-to-end verification pass + QA log"
```

---

## Self-Review (completed at authoring time)

- **Spec coverage:** §5 data model → Task 1; §6 guardrails/password/session/accounts/tokens/mailer/rate-limit/audit → Tasks 2–7, 10; §7 viewpoint derivation + impersonation → Tasks 5, 8; §8 route protection → Tasks 8, 9; §9 RBAC/CSRF → Task 12; §10 surfaces → Tasks 9, 10, 11, 13; §11 seeds/env → Tasks 1, 14; §12 testing → per-task TDD + Task 15.
- **Type consistency:** `hashToken` (session.ts) reused by tokens.ts/reset.ts; `CurrentAuth` shape shared current.ts ↔ context.ts; `Actor` fields consumed by enforce.ts match context.ts; `AuthFlowError` thrown in accounts.ts, caught in register/user-management actions; `loginWithPassword` result consumed in login action.
- **Known intentional deviations:** none at authoring time.
