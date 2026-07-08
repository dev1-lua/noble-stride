# Investor Onboarding 2FA — Email OTP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a mandatory email-OTP second factor to the investor login flow, as a step-up after the existing email+password verification, with a 30-day opt-in trusted-device skip.

**Architecture:** The OTP core (generate/hash/store/verify a 6-digit code) is channel-agnostic and lives in `otp.ts`; delivery reuses the existing `sendMail` abstraction with a Resend adapter (ConsoleMailer fallback). `loginWithPassword` gains an `INVESTOR`-only branch: after a correct password on an `ACTIVE` investor account, if there is no valid trusted-device cookie it issues an OTP and returns `otp_required` (no session) instead of a token; the login action sets a short-lived signed `ns_2fa_pending` cookie and redirects to a new `/login/verify` page that verifies the code, then creates the real session. Internal/staff accounts are never challenged.

**Tech Stack:** Next.js (App Router, server actions), Prisma + PostgreSQL, `jose` (HS256 signed cookies), `node:crypto` (`randomInt`, SHA-256), vitest, Playwright (MCP).

## Global Constraints

Copied verbatim from project quirks — every task's requirements implicitly include these:

- Package manager: **corepack pnpm**, NEVER npm/yarn. Node 22. Run all commands from `noblestride-crm/`.
- Vitest does NOT auto-load `.env`. Run tests with `DATABASE_URL="postgresql://noblestride:noblestride@localhost:5544/noblestride"` exported. DB is a SHARED docker `noblestride-postgres` on host port **5544**.
- DB tests MUST self-clean with lowercase `zz-test`/`UNIQ` markers and NEVER touch demo data.
- **`src/generated/pothos-types.ts` is intentionally MODIFIED in the working tree and must NOT be committed or reverted.** Never `git add -A`. Stage explicit paths only; after staging run `git status --short` and if `src/generated/pothos-types.ts` is staged, `git restore --staged src/generated/pothos-types.ts` before committing.
- Migrations: `prisma migrate dev` FAILS on this shared DB (pre-existing legacy-Client drift). Use the `prisma migrate diff` → hand-place SQL → `prisma migrate deploy` workaround (Task 1).
- After a schema change, regenerate the Prisma client with `npx prisma generate`. If it hits a Windows EPERM prisma-DLL lock, stop any running dev server / node process holding the query engine and retry. Build with `npx next build` directly (not `pnpm build`).
- Pre-existing lint baseline: 8 errors + a few warnings in unrelated files. Do NOT add new lint errors; do NOT fix the pre-existing ones.
- Any NEW state-mutating server action/route outside GraphQL needs its own server-side authz (the GraphQL RBAC guards don't cover it). The `/login/verify` actions are authorized by the signed `ns_2fa_pending` cookie and rate-limited.
- Reuse `safeNext` (`src/app/login/safe-next.ts`) for any `?next=` param.
- **No new GraphQL mutation** in this plan — do not touch `graphql/mutations.ts`; `schema.smoke.test.ts` must stay 27 queries / 44 mutations.
- Commit per task on `feat/real-auth` only. **No merge, push, or PR.** End commit messages with:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

### Task 1: Prisma model + enum + migration

**Files:**
- Modify: `prisma/schema.prisma` (add enum, model, relation)
- Create: `prisma/migrations/20260708150000_investor_2fa_otp/migration.sql`

**Interfaces:**
- Produces: prisma client model `authOtpChallenge` with fields `{ id, accountId, purpose: AuthOtpPurpose, codeHash, destination, attempts, maxAttempts, expiresAt, consumedAt, createdAt }`; enum `AuthOtpPurpose { LOGIN_2FA }`; `AuthAccount.otpChallenges AuthOtpChallenge[]` back-relation.

- [ ] **Step 1: Add the enum** to `prisma/schema.prisma` next to the other auth enums (after `AuthTokenPurpose`, ~line 1108):

```prisma
enum AuthOtpPurpose {
  LOGIN_2FA
}
```

- [ ] **Step 2: Add the model** to `prisma/schema.prisma` after the `AuthToken` model (~line 1160):

```prisma
model AuthOtpChallenge {
  id          String         @id @default(cuid())
  accountId   String
  account     AuthAccount    @relation(fields: [accountId], references: [id], onDelete: Cascade)
  purpose     AuthOtpPurpose
  codeHash    String // sha256 hex of the 6-digit code; raw code never stored
  destination String // email the code was actually sent to (audit)
  attempts    Int            @default(0)
  maxAttempts Int            @default(5)
  expiresAt   DateTime
  consumedAt  DateTime?
  createdAt   DateTime       @default(now())

  @@index([accountId, purpose])
}
```

- [ ] **Step 3: Add the back-relation** on `AuthAccount` (in the relations block with `sessions`/`tokens`, ~line 1130):

```prisma
  sessions      AuthSession[]
  tokens        AuthToken[]
  otpChallenges AuthOtpChallenge[]
```

- [ ] **Step 4: Hand-write the migration SQL.** The change is purely additive (new enum + new table + FK to existing `AuthAccount`), so write the DDL directly — do NOT use `migrate diff`, which surfaces this DB's pre-existing legacy-Client drift. Create `prisma/migrations/20260708150000_investor_2fa_otp/migration.sql` with exactly:

```sql
-- CreateEnum
CREATE TYPE "AuthOtpPurpose" AS ENUM ('LOGIN_2FA');

-- CreateTable
CREATE TABLE "AuthOtpChallenge" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "purpose" "AuthOtpPurpose" NOT NULL,
    "codeHash" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthOtpChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuthOtpChallenge_accountId_purpose_idx" ON "AuthOtpChallenge"("accountId", "purpose");

-- AddForeignKey
ALTER TABLE "AuthOtpChallenge" ADD CONSTRAINT "AuthOtpChallenge_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "AuthAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

To sanity-check the SQL matches the schema model (optional, non-authoritative), you may run `npx prisma validate`. Do not block on `migrate diff` output.

- [ ] **Step 5: Apply the migration** to the shared DB:

```bash
DATABASE_URL="postgresql://noblestride:noblestride@localhost:5544/noblestride" npx prisma migrate deploy
```

Expected: "1 migration applied" (the `20260708150000_investor_2fa_otp`). If it reports the schema is already up to date because of a failed prior attempt, verify the table exists with `npx prisma db execute --stdin <<< '\d "AuthOtpChallenge"'` is NOT needed — instead just confirm generate+typecheck below.

- [ ] **Step 6: Regenerate the Prisma client:**

```bash
npx prisma generate
```

Expected: "Generated Prisma Client". On EPERM, kill any running `next dev`/node and retry.

- [ ] **Step 7: Typecheck** (confirms the model is on the client):

```bash
DATABASE_URL="postgresql://noblestride:noblestride@localhost:5544/noblestride" npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 8: Commit** (stage explicit paths; verify pothos-types is NOT staged):

```bash
git add prisma/schema.prisma prisma/migrations/20260708150000_investor_2fa_otp/migration.sql
git status --short   # confirm src/generated/pothos-types.ts is NOT in the staged list
git commit -m "feat(2fa): AuthOtpChallenge model + AuthOtpPurpose enum + migration

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: OTP core (`otp.ts`)

**Files:**
- Create: `src/server/auth/otp.ts`
- Test: `src/server/auth/__tests__/otp.smoke.test.ts`

**Interfaces:**
- Consumes: `hashToken` from `./session` (SHA-256 hex), `prisma` from `@/lib/db`.
- Produces:
  - `OTP_TTL_MS: number`, `OTP_MAX_ATTEMPTS: number`
  - `generateOtpCode(): string` — 6-digit zero-padded, crypto-random.
  - `hashOtpCode(code: string): string`
  - `createOtpChallenge(accountId: string, destination: string): Promise<{ challengeId: string; code: string }>` — invalidates prior unconsumed `LOGIN_2FA` challenges for the account, then creates a fresh one.
  - `verifyOtpChallenge(challengeId: string, code: string): Promise<VerifyOtpResult>` where
    `type VerifyOtpResult = { status: "ok"; accountId: string } | { status: "invalid"; remaining: number } | { status: "expired" } | { status: "locked" }`
  - `invalidateOtpChallenges(accountId: string): Promise<void>`

- [ ] **Step 1: Write the failing test** `src/server/auth/__tests__/otp.smoke.test.ts`:

```ts
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import {
  createOtpChallenge,
  generateOtpCode,
  hashOtpCode,
  OTP_MAX_ATTEMPTS,
  verifyOtpChallenge,
} from "../otp";

const EMAIL = "zz-test-otp@example.com";

async function makeAccount() {
  return prisma.authAccount.create({
    data: { email: `zz-test-otp-${Date.now()}@example.com`, passwordHash: "x", kind: "INVESTOR", status: "ACTIVE" },
  });
}

afterAll(async () => {
  await prisma.authAccount.deleteMany({ where: { email: { startsWith: "zz-test-otp" } } });
});

describe("otp core", () => {
  it("generates a 6-digit numeric code", () => {
    for (let i = 0; i < 50; i++) expect(generateOtpCode()).toMatch(/^\d{6}$/);
  });

  it("hashes and does not store plaintext", () => {
    expect(hashOtpCode("123456")).not.toBe("123456");
    expect(hashOtpCode("123456")).toBe(hashOtpCode("123456"));
  });

  it("verifies a correct code once (single-use)", async () => {
    const acct = await makeAccount();
    const { challengeId, code } = await createOtpChallenge(acct.id, EMAIL);
    const ok = await verifyOtpChallenge(challengeId, code);
    expect(ok).toEqual({ status: "ok", accountId: acct.id });
    const again = await verifyOtpChallenge(challengeId, code);
    expect(again.status).toBe("expired");
  });

  it("rejects a wrong code and decrements remaining, locks at max", async () => {
    const acct = await makeAccount();
    const { challengeId } = await createOtpChallenge(acct.id, EMAIL);
    let res = await verifyOtpChallenge(challengeId, "000000");
    expect(res.status === "invalid" && res.remaining === OTP_MAX_ATTEMPTS - 1).toBe(true);
    for (let i = 0; i < OTP_MAX_ATTEMPTS - 1; i++) res = await verifyOtpChallenge(challengeId, "000000");
    expect(res.status).toBe("locked");
  });

  it("treats an expired challenge as expired", async () => {
    const acct = await makeAccount();
    const { challengeId, code } = await createOtpChallenge(acct.id, EMAIL);
    await prisma.authOtpChallenge.update({ where: { id: challengeId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await verifyOtpChallenge(challengeId, code)).status).toBe("expired");
  });
});
```

- [ ] **Step 2: Run it, confirm it fails** (module missing):

```bash
DATABASE_URL="postgresql://noblestride:noblestride@localhost:5544/noblestride" npx vitest run src/server/auth/__tests__/otp.smoke.test.ts
```

Expected: FAIL — cannot resolve `../otp`.

- [ ] **Step 3: Implement** `src/server/auth/otp.ts`:

```ts
// Email/phone-agnostic OTP core for 2FA. Short numeric codes, hashed at rest
// (same sha256 discipline as sessions/tokens), single-use, attempt-limited.
import { randomInt } from "node:crypto";
import { prisma } from "@/lib/db";
import { hashToken } from "./session";

export const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const OTP_MAX_ATTEMPTS = 5;

export type VerifyOtpResult =
  | { status: "ok"; accountId: string }
  | { status: "invalid"; remaining: number }
  | { status: "expired" }
  | { status: "locked" };

export function generateOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashOtpCode(code: string): string {
  return hashToken(code);
}

export async function invalidateOtpChallenges(accountId: string): Promise<void> {
  await prisma.authOtpChallenge.updateMany({
    where: { accountId, purpose: "LOGIN_2FA", consumedAt: null },
    data: { consumedAt: new Date() },
  });
}

export async function createOtpChallenge(
  accountId: string,
  destination: string,
): Promise<{ challengeId: string; code: string }> {
  await invalidateOtpChallenges(accountId); // one active challenge per account
  const code = generateOtpCode();
  const row = await prisma.authOtpChallenge.create({
    data: {
      accountId,
      purpose: "LOGIN_2FA",
      codeHash: hashOtpCode(code),
      destination,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });
  return { challengeId: row.id, code };
}

export async function verifyOtpChallenge(challengeId: string, code: string): Promise<VerifyOtpResult> {
  const row = await prisma.authOtpChallenge.findUnique({ where: { id: challengeId } });
  if (!row) return { status: "invalid", remaining: 0 };
  if (row.consumedAt) return { status: "expired" };
  if (row.expiresAt.getTime() <= Date.now()) return { status: "expired" };
  if (row.attempts >= row.maxAttempts) return { status: "locked" };

  if (row.codeHash !== hashOtpCode(code)) {
    const updated = await prisma.authOtpChallenge.update({
      where: { id: row.id },
      data: { attempts: { increment: 1 } },
      select: { attempts: true, maxAttempts: true },
    });
    const remaining = Math.max(0, updated.maxAttempts - updated.attempts);
    return remaining <= 0 ? { status: "locked" } : { status: "invalid", remaining };
  }

  // Correct code — claim single-use atomically.
  const claimed = await prisma.authOtpChallenge.updateMany({
    where: { id: row.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (claimed.count === 0) return { status: "expired" };
  return { status: "ok", accountId: row.accountId };
}
```

- [ ] **Step 4: Run tests, confirm pass:**

```bash
DATABASE_URL="postgresql://noblestride:noblestride@localhost:5544/noblestride" npx vitest run src/server/auth/__tests__/otp.smoke.test.ts
```

Expected: PASS (all cases).

- [ ] **Step 5: Commit:**

```bash
git add src/server/auth/otp.ts src/server/auth/__tests__/otp.smoke.test.ts
git status --short   # pothos-types NOT staged
git commit -m "feat(2fa): OTP core — generate/hash/create/verify single-use codes

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Resend mailer adapter + dev OTP sink

**Files:**
- Modify: `src/server/auth/mailer.ts`
- Create: `src/server/auth/dev-otp-sink.ts`
- Modify: `.env` (add commented placeholders — gitignored, not committed)
- Test: `src/server/auth/__tests__/mailer.test.ts`, `src/server/auth/__tests__/dev-otp-sink.test.ts`

**Interfaces:**
- Produces:
  - `mailer.ts`: unchanged public `sendMail(msg: MailMessage): Promise<void>` (now Resend when `RESEND_API_KEY` set, else console). New exported pure helpers `mailProvider(): "resend" | "console"` and `buildResendPayload(msg, from)`.
  - `dev-otp-sink.ts`: `recordDevOtp(destination: string, code: string): void`, `readDevOtp(destination: string): string | null` — active only when `NODE_ENV !== "production"` AND `RESEND_API_KEY` unset.

- [ ] **Step 1: Write failing test** `src/server/auth/__tests__/mailer.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildResendPayload, mailProvider, sendMail } from "../mailer";

afterEach(() => {
  delete process.env.RESEND_API_KEY;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("mailer provider selection", () => {
  it("uses console when no key", () => {
    expect(mailProvider()).toBe("console");
  });
  it("uses resend when key present", () => {
    process.env.RESEND_API_KEY = "re_test";
    expect(mailProvider()).toBe("resend");
  });
  it("builds a resend payload", () => {
    expect(buildResendPayload({ to: "a@b.com", subject: "S", text: "T" }, "F")).toEqual({
      from: "F", to: ["a@b.com"], subject: "S", text: "T",
    });
  });
  it("console path does not throw and logs", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    await expect(sendMail({ to: "a@b.com", subject: "S", text: "T" })).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
  });
  it("resend path posts and throws on non-2xx", async () => {
    process.env.RESEND_API_KEY = "re_test";
    const fetchMock = vi.fn(async () => new Response("bad", { status: 422 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(sendMail({ to: "a@b.com", subject: "S", text: "T" })).rejects.toThrow(/Resend send failed/);
    expect(fetchMock).toHaveBeenCalledWith("https://api.resend.com/emails", expect.objectContaining({ method: "POST" }));
  });
});
```

- [ ] **Step 2: Run, confirm fail:**

```bash
DATABASE_URL="postgresql://noblestride:noblestride@localhost:5544/noblestride" npx vitest run src/server/auth/__tests__/mailer.test.ts
```

Expected: FAIL — `buildResendPayload`/`mailProvider` not exported.

- [ ] **Step 3: Rewrite** `src/server/auth/mailer.ts`:

```ts
// Mail abstraction. Resend when RESEND_API_KEY is set, else ConsoleMailer that
// logs the message so codes/links are usable in dev. Callers are unchanged.
// PROD: set RESEND_API_KEY + a verified RESEND_FROM before shipping.

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export function mailProvider(): "resend" | "console" {
  return process.env.RESEND_API_KEY ? "resend" : "console";
}

export function buildResendPayload(msg: MailMessage, from: string) {
  return { from, to: [msg.to], subject: msg.subject, text: msg.text };
}

export async function sendMail(msg: MailMessage): Promise<void> {
  if (mailProvider() === "console") {
    console.log(`\n[mailer] To: ${msg.to}\n[mailer] Subject: ${msg.subject}\n[mailer] ${msg.text}\n`);
    return;
  }
  const from = process.env.RESEND_FROM ?? "NobleStride <onboarding@resend.dev>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildResendPayload(msg, from)),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Resend send failed (${res.status}): ${detail.slice(0, 200)}`);
  }
}
```

- [ ] **Step 4: Write failing test** `src/server/auth/__tests__/dev-otp-sink.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest";
import { readDevOtp, recordDevOtp } from "../dev-otp-sink";

afterEach(() => {
  delete process.env.RESEND_API_KEY;
});

describe("dev otp sink", () => {
  it("records and reads a code when console fallback is active", () => {
    const dest = `zz-test-sink-${Date.now()}@example.com`;
    recordDevOtp(dest, "654321");
    expect(readDevOtp(dest)).toBe("654321");
  });
  it("is inert when RESEND_API_KEY is set", () => {
    process.env.RESEND_API_KEY = "re_test";
    const dest = `zz-test-sink-off-${Date.now()}@example.com`;
    recordDevOtp(dest, "111111");
    expect(readDevOtp(dest)).toBeNull();
  });
});
```

- [ ] **Step 5: Implement** `src/server/auth/dev-otp-sink.ts`:

```ts
// DEV/TEST ONLY. When running on the ConsoleMailer fallback (no RESEND_API_KEY),
// records the most recent OTP per destination to a temp file so the Playwright
// e2e can retrieve it. NOT web-accessible. Inert in production or when Resend is
// configured (a real email is sent instead).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SINK_PATH = join(tmpdir(), "ns-dev-otp-sink.json");

function enabled(): boolean {
  return process.env.NODE_ENV !== "production" && !process.env.RESEND_API_KEY;
}

export function recordDevOtp(destination: string, code: string): void {
  if (!enabled()) return;
  let data: Record<string, { code: string; ts: number }> = {};
  try {
    if (existsSync(SINK_PATH)) data = JSON.parse(readFileSync(SINK_PATH, "utf8"));
  } catch {
    data = {};
  }
  data[destination.toLowerCase()] = { code, ts: Date.now() };
  try {
    writeFileSync(SINK_PATH, JSON.stringify(data));
  } catch {
    /* best-effort */
  }
}

export function readDevOtp(destination: string): string | null {
  if (process.env.NODE_ENV === "production") return null;
  try {
    if (!existsSync(SINK_PATH)) return null;
    const data = JSON.parse(readFileSync(SINK_PATH, "utf8")) as Record<string, { code: string }>;
    return data[destination.toLowerCase()]?.code ?? null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 6: Add `.env` placeholders** (file is gitignored — do NOT commit it). Append:

```
# Email OTP (investor 2FA). Leave unset to use the ConsoleMailer fallback (logs the code).
RESEND_API_KEY=
RESEND_FROM="NobleStride <onboarding@resend.dev>"
```

- [ ] **Step 7: Run both tests, confirm pass:**

```bash
DATABASE_URL="postgresql://noblestride:noblestride@localhost:5544/noblestride" npx vitest run src/server/auth/__tests__/mailer.test.ts src/server/auth/__tests__/dev-otp-sink.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit** (NOT `.env`):

```bash
git add src/server/auth/mailer.ts src/server/auth/dev-otp-sink.ts src/server/auth/__tests__/mailer.test.ts src/server/auth/__tests__/dev-otp-sink.test.ts
git status --short   # pothos-types + .env NOT staged
git commit -m "feat(2fa): Resend mailer adapter + dev OTP sink for e2e

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Two-factor cookies + OTP issue orchestration (`two-factor.ts`)

**Files:**
- Create: `src/server/auth/two-factor.ts`
- Test: `src/server/auth/__tests__/two-factor.smoke.test.ts`

**Interfaces:**
- Consumes: `createOtpChallenge` (`./otp`), `sendMail` (`./mailer`), `recordDevOtp` (`./dev-otp-sink`), `jose`, `AUTH_SECRET`.
- Produces:
  - `PENDING_COOKIE = "ns_2fa_pending"`, `TRUST_COOKIE = "ns_2fa_trust"`, `PENDING_TTL_S`, `TRUST_TTL_S`
  - `type PendingPayload = { accountId: string; challengeId: string; emailMask: string }`
  - `signPending(p: PendingPayload): Promise<string>`
  - `verifyPending(jwt: string | undefined): Promise<PendingPayload | null>`
  - `signTrust(accountId: string): Promise<string>`
  - `verifyTrust(jwt: string | undefined, accountId: string): Promise<boolean>`
  - `maskEmail(email: string): string`
  - `issueLoginOtp(account: { id: string; email: string }): Promise<{ challengeId: string; emailMask: string }>`

- [ ] **Step 1: Write failing test** `src/server/auth/__tests__/two-factor.smoke.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { verifyOtpChallenge } from "../otp";
import { readDevOtp } from "../dev-otp-sink";
import {
  issueLoginOtp, maskEmail, signPending, signTrust, verifyPending, verifyTrust,
} from "../two-factor";

const PRIOR = process.env.AUTH_SECRET;
beforeAll(() => { process.env.AUTH_SECRET = "zz-test-secret-two-factor-0123456789"; });
afterAll(async () => {
  if (PRIOR === undefined) delete process.env.AUTH_SECRET; else process.env.AUTH_SECRET = PRIOR;
  await prisma.authAccount.deleteMany({ where: { email: { startsWith: "zz-test-2fa" } } });
});

describe("two-factor cookies", () => {
  it("round-trips a pending token", async () => {
    const jwt = await signPending({ accountId: "a1", challengeId: "c1", emailMask: "x***@y.com" });
    expect(await verifyPending(jwt)).toEqual({ accountId: "a1", challengeId: "c1", emailMask: "x***@y.com" });
  });
  it("rejects garbage / undefined pending", async () => {
    expect(await verifyPending(undefined)).toBeNull();
    expect(await verifyPending("not.a.jwt")).toBeNull();
  });
  it("trust token is valid only for its account", async () => {
    const jwt = await signTrust("acct-A");
    expect(await verifyTrust(jwt, "acct-A")).toBe(true);
    expect(await verifyTrust(jwt, "acct-B")).toBe(false);
    expect(await verifyTrust(undefined, "acct-A")).toBe(false);
  });
  it("masks emails", () => {
    expect(maskEmail("cmiriti@ifc.org")).toMatch(/^c.*@ifc\.org$/);
    expect(maskEmail("cmiriti@ifc.org")).not.toBe("cmiriti@ifc.org");
  });
  it("issues a login OTP that verifies", async () => {
    const acct = await prisma.authAccount.create({
      data: { email: `zz-test-2fa-${Date.now()}@example.com`, passwordHash: "x", kind: "INVESTOR", status: "ACTIVE" },
    });
    const { challengeId, emailMask } = await issueLoginOtp({ id: acct.id, email: acct.email });
    expect(emailMask).toContain("@");
    const code = readDevOtp(acct.email); // console fallback records it
    expect(code).toMatch(/^\d{6}$/);
    expect((await verifyOtpChallenge(challengeId, code!)).status).toBe("ok");
  });
});
```

- [ ] **Step 2: Run, confirm fail:**

```bash
DATABASE_URL="postgresql://noblestride:noblestride@localhost:5544/noblestride" npx vitest run src/server/auth/__tests__/two-factor.smoke.test.ts
```

Expected: FAIL — `../two-factor` missing.

- [ ] **Step 3: Implement** `src/server/auth/two-factor.ts`:

```ts
// Investor 2FA: short-lived signed "pending" cookie carrying the interstitial
// state between password success and OTP entry, and a 30-day signed
// "trusted device" cookie that lets a known browser skip OTP. HS256 over
// AUTH_SECRET (same scheme as the impersonation lens). Plus the issue-OTP
// orchestration (create challenge -> dev sink -> email).
import { SignJWT, jwtVerify } from "jose";
import { createOtpChallenge } from "./otp";
import { recordDevOtp } from "./dev-otp-sink";
import { sendMail } from "./mailer";

export const PENDING_COOKIE = "ns_2fa_pending";
export const TRUST_COOKIE = "ns_2fa_trust";
export const PENDING_TTL_S = 10 * 60; // 10 minutes
export const TRUST_TTL_S = 30 * 24 * 60 * 60; // 30 days

export type PendingPayload = { accountId: string; challengeId: string; emailMask: string };

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(s);
}

export async function signPending(p: PendingPayload): Promise<string> {
  return new SignJWT({ aid: p.accountId, cid: p.challengeId, mask: p.emailMask })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${PENDING_TTL_S}s`)
    .sign(secret());
}

export async function verifyPending(jwt: string | undefined): Promise<PendingPayload | null> {
  if (!jwt) return null;
  try {
    const { payload } = await jwtVerify(jwt, secret());
    if (typeof payload.aid !== "string" || typeof payload.cid !== "string" || typeof payload.mask !== "string") {
      return null;
    }
    return { accountId: payload.aid, challengeId: payload.cid, emailMask: payload.mask };
  } catch {
    return null;
  }
}

export async function signTrust(accountId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(accountId)
    .setIssuedAt()
    .setExpirationTime(`${TRUST_TTL_S}s`)
    .sign(secret());
}

export async function verifyTrust(jwt: string | undefined, accountId: string): Promise<boolean> {
  if (!jwt) return false;
  try {
    const { payload } = await jwtVerify(jwt, secret());
    return payload.sub === accountId;
  } catch {
    return false;
  }
}

export function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return "****";
  const shown = user.slice(0, 1);
  return `${shown}${"*".repeat(Math.max(3, user.length - 1))}@${domain}`;
}

function renderOtpEmail(code: string): { subject: string; text: string } {
  return {
    subject: "Your NobleStride sign-in code",
    text: `Your NobleStride verification code is ${code}. It expires in 10 minutes. If you didn't try to sign in, you can ignore this email.`,
  };
}

export async function issueLoginOtp(account: { id: string; email: string }): Promise<{ challengeId: string; emailMask: string }> {
  const { challengeId, code } = await createOtpChallenge(account.id, account.email);
  recordDevOtp(account.email, code); // no-op unless dev + console fallback
  const { subject, text } = renderOtpEmail(code);
  await sendMail({ to: account.email, subject, text });
  return { challengeId, emailMask: maskEmail(account.email) };
}
```

- [ ] **Step 4: Run tests, confirm pass:**

```bash
DATABASE_URL="postgresql://noblestride:noblestride@localhost:5544/noblestride" npx vitest run src/server/auth/__tests__/two-factor.smoke.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit:**

```bash
git add src/server/auth/two-factor.ts src/server/auth/__tests__/two-factor.smoke.test.ts
git status --short   # pothos-types NOT staged
git commit -m "feat(2fa): pending + trusted-device signed cookies and OTP issue orchestration

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Login integration — investor OTP branch

**Files:**
- Modify: `src/server/auth/login.ts`
- Modify: `src/app/login/actions.ts`
- Test: `src/server/auth/__tests__/login.smoke.test.ts` (add cases; keep existing)

**Interfaces:**
- Consumes: `verifyTrust`, `issueLoginOtp`, `signPending` (`./two-factor`).
- Produces: `LoginResult` union gains `{ ok: false; reason: "otp_required"; pendingToken: string; emailMask: string }`; `loginWithPassword` gains 4th param `opts?: { trustedDeviceToken?: string }`.

- [ ] **Step 1: Add failing test cases** to `src/server/auth/__tests__/login.smoke.test.ts`. Append inside the existing describe (adapt the account-creation helper to match the file's existing style; set `AUTH_SECRET` in `beforeAll` if the file doesn't already, with teardown):

```ts
// --- investor 2FA branch (Task 5) ---
it("challenges an ACTIVE investor for OTP when no trusted device", async () => {
  const email = `zz-test-login-2fa-${Date.now()}@example.com`;
  await prisma.authAccount.create({
    data: { email, passwordHash: await hashPassword("Str0ng!Passw0rd"), kind: "INVESTOR", status: "ACTIVE" },
  });
  const res = await loginWithPassword(email, "Str0ng!Passw0rd");
  expect(res.ok).toBe(false);
  expect(res).toMatchObject({ reason: "otp_required" });
  if (!res.ok && res.reason === "otp_required") {
    expect(res.pendingToken.length).toBeGreaterThan(10);
    expect(res.emailMask).toContain("@");
  }
});

it("skips OTP for an investor with a valid trusted-device token", async () => {
  const email = `zz-test-login-trust-${Date.now()}@example.com`;
  const acct = await prisma.authAccount.create({
    data: { email, passwordHash: await hashPassword("Str0ng!Passw0rd"), kind: "INVESTOR", status: "ACTIVE" },
  });
  const trust = await signTrust(acct.id);
  const res = await loginWithPassword(email, "Str0ng!Passw0rd", undefined, { trustedDeviceToken: trust });
  expect(res.ok).toBe(true);
});

it("never challenges an INTERNAL account", async () => {
  const email = `zz-test-login-internal-${Date.now()}@example.com`;
  await prisma.authAccount.create({
    data: { email, passwordHash: await hashPassword("Str0ng!Passw0rd"), kind: "INTERNAL", status: "ACTIVE" },
  });
  const res = await loginWithPassword(email, "Str0ng!Passw0rd");
  expect(res.ok).toBe(true);
});
```

Ensure imports at top of the test file include: `hashPassword` from `../password`, `signTrust` from `../two-factor`, and `zz-test-login` cleanup in `afterAll` (`deleteMany where email startsWith "zz-test-login"`). Set `process.env.AUTH_SECRET` in `beforeAll` with `afterAll` restore.

- [ ] **Step 2: Run, confirm the new cases fail:**

```bash
DATABASE_URL="postgresql://noblestride:noblestride@localhost:5544/noblestride" npx vitest run src/server/auth/__tests__/login.smoke.test.ts
```

Expected: FAIL — investor returns `ok:true` today (no OTP branch yet).

- [ ] **Step 3: Modify** `src/server/auth/login.ts`. Add imports and the union member, extend the signature, and insert the investor branch after the status checks (after line 51, before `createSession`):

```ts
import { issueLoginOtp, signPending, verifyTrust } from "./two-factor";
```

```ts
export type LoginResult =
  | { ok: true; token: string; expiresAt: Date; home: string }
  | { ok: false; reason: "invalid" | "locked" | "pending" | "suspended" }
  | { ok: false; reason: "otp_required"; pendingToken: string; emailMask: string };
```

```ts
export async function loginWithPassword(
  emailRaw: string,
  password: string,
  meta?: { ip?: string; userAgent?: string },
  opts?: { trustedDeviceToken?: string },
): Promise<LoginResult> {
```

Insert between the `SUSPENDED` check and the `createSession` call:

```ts
  if (account.status === "PENDING") return { ok: false, reason: "pending" };
  if (account.status === "SUSPENDED") return { ok: false, reason: "suspended" };

  // Investor 2FA: password was correct, so clear the password-lockout counters,
  // but require an email OTP before issuing a session unless this device is trusted.
  if (account.kind === "INVESTOR") {
    const trusted = await verifyTrust(opts?.trustedDeviceToken, account.id);
    if (!trusted) {
      await prisma.authAccount.update({
        where: { id: account.id },
        data: { failedLogins: 0, lockedUntil: null },
      });
      const { challengeId, emailMask } = await issueLoginOtp({ id: account.id, email: account.email });
      const pendingToken = await signPending({ accountId: account.id, challengeId, emailMask });
      await logAuthEvent(`Auth: 2FA challenge issued — ${email}`);
      return { ok: false, reason: "otp_required", pendingToken, emailMask };
    }
  }

  const { token, expiresAt } = await createSession(account.id, meta);
```

- [ ] **Step 4: Run tests, confirm the login core passes:**

```bash
DATABASE_URL="postgresql://noblestride:noblestride@localhost:5544/noblestride" npx vitest run src/server/auth/__tests__/login.smoke.test.ts
```

Expected: PASS (existing + 3 new).

- [ ] **Step 5: Modify** `src/app/login/actions.ts` to read the trust cookie, forward it, and handle `otp_required`. Add imports and cookie read:

```ts
import { cookies } from "next/headers";
import { PENDING_COOKIE, PENDING_TTL_S, TRUST_COOKIE } from "@/server/auth/two-factor";
```

Replace the `loginWithPassword` call + post-result block (lines 39-44) with:

```ts
  const cookieStore = await cookies();
  const trustedDeviceToken = cookieStore.get(TRUST_COOKIE)?.value;
  const res = await loginWithPassword(
    email,
    password,
    { ip, userAgent: hdrs.get("user-agent") ?? undefined },
    { trustedDeviceToken },
  );

  if (!res.ok && res.reason === "otp_required") {
    cookieStore.set(PENDING_COOKIE, res.pendingToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: PENDING_TTL_S,
    });
    redirect(`/login/verify${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  }
  if (!res.ok) back(MESSAGES[res.reason], email);
  const ok = res as Extract<Awaited<ReturnType<typeof loginWithPassword>>, { ok: true }>;

  await setSessionCookie(ok.token, ok.expiresAt);
  redirect(next ?? ok.home);
```

(Note: `redirect` throws, so the `otp_required` branch never falls through; `MESSAGES` needs no `otp_required` entry.)

- [ ] **Step 6: Typecheck:**

```bash
DATABASE_URL="postgresql://noblestride:noblestride@localhost:5544/noblestride" npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 7: Commit:**

```bash
git add src/server/auth/login.ts src/app/login/actions.ts src/server/auth/__tests__/login.smoke.test.ts
git status --short   # pothos-types NOT staged
git commit -m "feat(2fa): investor OTP branch in login + pending-cookie handoff

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: `/login/verify` page + verify/resend actions

**Files:**
- Create: `src/app/login/verify/page.tsx`
- Create: `src/app/login/verify/actions.ts`
- Modify: `src/middleware.ts` (only if `/login/verify` is not already publicly reachable)

**Interfaces:**
- Consumes: `verifyPending`, `signTrust`, `issueLoginOtp`, `signPending`, `PENDING_COOKIE`, `TRUST_COOKIE`, `PENDING_TTL_S`, `TRUST_TTL_S` (`@/server/auth/two-factor`); `verifyOtpChallenge`, `invalidateOtpChallenges` (`@/server/auth/otp`); `createSession` (`@/server/auth/session`); `setSessionCookie` (`@/server/auth/session-cookie`); `safeNext` (`../safe-next`); `rateLimit` (`@/server/auth/rate-limit`); `logAuthEvent` (`@/server/auth/audit`); `prisma`.
- Produces: server actions `verifyLoginOtpAction(formData: FormData): Promise<void>`, `resendLoginOtpAction(formData: FormData): Promise<void>`; the verify page.

- [ ] **Step 1: Confirm middleware allows `/login/verify` without a session.** Read `src/middleware.ts`. If it has an explicit list of public paths (e.g. `/login`, `/register`), and it matches by exact path or a prefix that already covers `/login/verify` (a `/login` prefix does), no change is needed. If it would redirect `/login/verify` to `/login` for lack of a session cookie, add `/login/verify` to the public set. Document which was the case in the task report.

- [ ] **Step 2: Implement** `src/app/login/verify/actions.ts`:

```ts
"use server";
// Investor 2FA step. Authorized solely by the signed ns_2fa_pending cookie set
// by loginAction after a correct password. No session exists yet.

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { logAuthEvent } from "@/server/auth/audit";
import { invalidateOtpChallenges, verifyOtpChallenge } from "@/server/auth/otp";
import { rateLimit } from "@/server/auth/rate-limit";
import { createSession } from "@/server/auth/session";
import { setSessionCookie } from "@/server/auth/session-cookie";
import {
  PENDING_COOKIE, PENDING_TTL_S, TRUST_COOKIE, TRUST_TTL_S,
  issueLoginOtp, signPending, signTrust, verifyPending,
} from "@/server/auth/two-factor";
import { safeNext } from "../safe-next";

const RESEND_COOLDOWN_MS = 60 * 1000;

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}

export async function verifyLoginOtpAction(formData: FormData): Promise<void> {
  const cookieStore = await cookies();
  const pending = await verifyPending(cookieStore.get(PENDING_COOKIE)?.value);
  const next = safeNext(String(formData.get("next") ?? "") || undefined);
  if (!pending) redirect("/login?error=session-expired");

  const ip = await clientIp();
  if (!rateLimit(`otp-verify:${ip}`) || !rateLimit(`otp-verify:${pending.accountId}`, { max: 20 })) {
    redirect("/login?error=locked");
  }

  const code = String(formData.get("code") ?? "").replace(/\D/g, "");
  const trust = String(formData.get("trust") ?? "") === "on";
  const result = await verifyOtpChallenge(pending.challengeId, code);

  const backToVerify = (params: string) => redirect(`/login/verify?${params}${next ? `&next=${encodeURIComponent(next)}` : ""}`);

  if (result.status === "invalid") backToVerify(`error=invalid&remaining=${result.remaining}`);
  if (result.status === "expired") {
    cookieStore.delete(PENDING_COOKIE);
    redirect("/login?error=code-expired");
  }
  if (result.status === "locked") {
    cookieStore.delete(PENDING_COOKIE);
    await invalidateOtpChallenges(pending.accountId);
    redirect("/login?error=too-many-codes");
  }

  // status === "ok"
  if (result.status !== "ok" || result.accountId !== pending.accountId) {
    redirect("/login?error=session-expired");
  }

  const account = await prisma.authAccount.findUnique({
    where: { id: pending.accountId },
    include: { person: true },
  });
  if (!account) redirect("/login?error=session-expired");

  const h = await headers();
  const { token, expiresAt } = await createSession(account!.id, {
    ip, userAgent: h.get("user-agent") ?? undefined,
  });
  await prisma.authAccount.update({
    where: { id: account!.id },
    data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() },
  });
  await setSessionCookie(token, expiresAt);
  cookieStore.delete(PENDING_COOKIE);

  if (trust) {
    cookieStore.set(TRUST_COOKIE, await signTrust(account!.id), {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
      path: "/", maxAge: TRUST_TTL_S,
    });
  }

  if (account!.person?.investorId) {
    await prisma.investor.updateMany({
      where: { id: account!.person.investorId, emailVerifiedAt: null },
      data: { emailVerifiedAt: new Date() },
    });
  }
  await logAuthEvent(`Auth: 2FA login success — ${account!.email}`);
  redirect(next ?? (account!.kind === "INTERNAL" ? "/dashboard" : "/portal/investor"));
}

export async function resendLoginOtpAction(formData: FormData): Promise<void> {
  const cookieStore = await cookies();
  const pending = await verifyPending(cookieStore.get(PENDING_COOKIE)?.value);
  const next = safeNext(String(formData.get("next") ?? "") || undefined);
  if (!pending) redirect("/login?error=session-expired");

  const ip = await clientIp();
  if (!rateLimit(`otp-resend:${ip}`, { max: 5 }) || !rateLimit(`otp-resend:${pending.accountId}`, { max: 5 })) {
    redirect("/login?error=too-many-codes");
  }

  // 60s cooldown based on the most recent challenge for this account.
  const latest = await prisma.authOtpChallenge.findFirst({
    where: { accountId: pending.accountId, purpose: "LOGIN_2FA" },
    orderBy: { createdAt: "desc" },
  });
  const nextParam = next ? `&next=${encodeURIComponent(next)}` : "";
  if (latest && Date.now() - latest.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    redirect(`/login/verify?error=cooldown${nextParam}`);
  }

  const account = await prisma.authAccount.findUnique({ where: { id: pending.accountId } });
  if (!account) redirect("/login?error=session-expired");

  const { challengeId, emailMask } = await issueLoginOtp({ id: account!.id, email: account!.email });
  cookieStore.set(PENDING_COOKIE, await signPending({ accountId: account!.id, challengeId, emailMask }), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
    path: "/", maxAge: PENDING_TTL_S,
  });
  redirect(`/login/verify?resent=1${nextParam}`);
}
```

- [ ] **Step 3: Implement** `src/app/login/verify/page.tsx` (server component; reads the pending cookie for the masked email, renders a native form — no client JS needed):

```tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PENDING_COOKIE, verifyPending } from "@/server/auth/two-factor";
import { safeNext } from "../safe-next";
import { resendLoginOtpAction, verifyLoginOtpAction } from "./actions";

const ERRORS: Record<string, string> = {
  invalid: "That code is incorrect. Check your email and try again.",
  cooldown: "Please wait a minute before requesting another code.",
};

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; remaining?: string; resent?: string; next?: string }>;
}) {
  const sp = await searchParams;
  const pending = await verifyPending((await cookies()).get(PENDING_COOKIE)?.value);
  if (!pending) redirect("/login?error=session-expired");

  const next = safeNext(sp.next) ?? "";
  const errorMsg = sp.error ? (ERRORS[sp.error] ?? "That code is incorrect.") : null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Verify it&apos;s you</h1>
        <p className="text-sm text-muted-foreground">
          We emailed a 6-digit code to <span className="font-medium">{pending!.emailMask}</span>. It expires in 10 minutes.
        </p>
      </div>

      {sp.resent ? <p className="text-sm text-emerald-600">A new code is on its way.</p> : null}
      {errorMsg ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {errorMsg}
          {sp.remaining ? ` ${sp.remaining} attempt(s) left.` : ""}
        </p>
      ) : null}

      <form action={verifyLoginOtpAction} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          required
          autoFocus
          className="w-full rounded-md border px-3 py-2 text-center text-lg tracking-[0.5em]"
          placeholder="000000"
          aria-label="6-digit code"
        />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="trust" defaultChecked />
          Trust this device for 30 days
        </label>
        <button type="submit" className="w-full rounded-md bg-black px-4 py-2 text-white">
          Verify and sign in
        </button>
      </form>

      <form action={resendLoginOtpAction}>
        <input type="hidden" name="next" value={next} />
        <button type="submit" className="text-sm text-muted-foreground underline">
          Didn&apos;t get it? Send a new code
        </button>
      </form>
    </main>
  );
}
```

(Match the existing `/login` page's styling utilities if they differ — mirror `src/app/login/page.tsx` classes so the screen is visually consistent. Adjust class names to the project's actual UI kit if needed; behavior is what matters.)

- [ ] **Step 4: Typecheck + full suite:**

```bash
DATABASE_URL="postgresql://noblestride:noblestride@localhost:5544/noblestride" npx tsc --noEmit
DATABASE_URL="postgresql://noblestride:noblestride@localhost:5544/noblestride" npx vitest run
```

Expected: tsc 0 errors; full vitest suite green (existing 541 + new OTP/mailer/sink/two-factor/login cases).

- [ ] **Step 5: Build check:**

```bash
npx next build
```

Expected: build succeeds; `/login/verify` appears in the route list.

- [ ] **Step 6: Commit:**

```bash
git add src/app/login/verify/page.tsx src/app/login/verify/actions.ts
# include src/middleware.ts ONLY if Step 1 required a change:
# git add src/middleware.ts
git status --short   # pothos-types NOT staged
git commit -m "feat(2fa): /login/verify OTP entry page + verify/resend actions

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: End-to-end verification (Playwright) + QA log

**Files:**
- Create: `playwright assessment/2026-07-08-investor-2fa-verification.md`

**Interfaces:**
- Consumes: the whole feature. No new exports.

**Preconditions:** Run on the ConsoleMailer fallback (no `RESEND_API_KEY`) so the OTP is retrievable from the dev sink. Reseed if the DB drifted (`corepack pnpm run seed`). Start the dev server (`corepack pnpm dev`). Seed investor: `cmiriti@ifc.org` / `NobleStride!Demo2026`. Seed staff admin: `evans@noblestride.capital` / same password.

- [ ] **Step 1: Full static gate:**

```bash
DATABASE_URL="postgresql://noblestride:noblestride@localhost:5544/noblestride" npx tsc --noEmit
DATABASE_URL="postgresql://noblestride:noblestride@localhost:5544/noblestride" npx vitest run
npx next build
DATABASE_URL="postgresql://noblestride:noblestride@localhost:5544/noblestride" npx eslint . 2>&1 | tail -5   # confirm no NEW errors over the 8 pre-existing
```

Expected: tsc 0, vitest green, build ✓, eslint ≤ pre-existing baseline.

- [ ] **Step 2: Flow A — investor first login is OTP-gated.** Fresh browser context. Navigate `/login`, sign in as `cmiriti@ifc.org`. Expect redirect to `/login/verify` (no session yet — confirm no `ns_session` cookie). Read the code for `cmiriti@ifc.org` from the dev sink file (`<os-temp>/ns-dev-otp-sink.json`). Enter it, leave "trust this device" checked, submit. Expect landing on `/portal/investor`. Confirm `ns_session` cookie now set. Confirm in DB `Investor.emailVerifiedAt` is set for IFC.

- [ ] **Step 3: Flow B — trusted device skips OTP.** In the SAME browser context, sign out (or clear session only, keep `ns_2fa_trust`), sign in again as `cmiriti@ifc.org`. Expect direct landing on `/portal/investor` with NO `/login/verify` stop.

- [ ] **Step 4: Flow C — new context re-challenges.** New/incognito context (no cookies). Sign in as `cmiriti@ifc.org`. Expect `/login/verify` again.

- [ ] **Step 5: Flow D — staff unaffected.** Sign in as `evans@noblestride.capital`. Expect direct landing on `/dashboard` with NO `/login/verify` stop and NO OTP.

- [ ] **Step 6: Flow E — wrong code + lockout.** Fresh context, sign in as investor to reach `/login/verify`. Enter a wrong code 5 times. Expect the inline "incorrect" error with a decrementing remaining count, then on the final attempt a bounce to `/login` with a "too many codes / expired" message. Confirm no session was created.

- [ ] **Step 7: Write the QA log** to `playwright assessment/2026-07-08-investor-2fa-verification.md`: per-flow PASS/FAIL, screenshots or snapshot notes, any bug found + fix commit hash, and the final gate results. Update the design spec status line to "Implemented" with any divergences.

- [ ] **Step 8: Commit:**

```bash
git add "playwright assessment/2026-07-08-investor-2fa-verification.md" docs/superpowers/specs/2026-07-08-investor-2fa-email-otp-design.md
git status --short   # pothos-types NOT staged
git commit -m "test(2fa): end-to-end verification pass + QA log

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- §2 investor-only, login-time, first-time mandatory, 30d trusted-device → Task 5 (branch), Task 6 (verify + trust cookie). ✓
- §2 email OTP via Resend + Console fallback → Task 3. ✓
- §5 gate between status check and `createSession` → Task 5 Step 3. ✓
- §6 `AuthOtpChallenge` + enum + `emailVerifiedAt` stamp → Task 1 (model), Task 6 (stamp). ✓
- §7 modules otp/mailer/two-factor/dev-sink/login/actions/verify → Tasks 2-6. ✓
- §8 tests + dev sink + Playwright flows → Tasks 2-4 (unit), Task 7 (e2e). ✓
- §4 security: hashed codes (T2), attempt limit (T2), signed short-lived pending + account-bound trust (T4), rate limit (T6), no enumeration (post-password only, T5). ✓
- §3 non-goals: no GraphQL mutation (nothing touches mutations.ts), no registration change, staff excluded (T5 `kind === "INVESTOR"` guard). ✓

**Placeholder scan:** No TBD/TODO; every code step has full code. ✓

**Type consistency:** `PendingPayload {accountId, challengeId, emailMask}` produced in T4, consumed identically in T5 (`signPending`) and T6 (`verifyPending`). `VerifyOtpResult` statuses (`ok`/`invalid`/`expired`/`locked`) produced in T2, matched exhaustively in T6. `LoginResult` `otp_required` member produced in T5, handled in `actions.ts` T5 Step 5. Cookie names/TTL constants (`PENDING_COOKIE`, `TRUST_COOKIE`, `PENDING_TTL_S`, `TRUST_TTL_S`) defined in T4, imported in T5/T6. ✓
