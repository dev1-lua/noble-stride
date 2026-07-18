# Production Recovery — 2026-07-09

Incident writeup + runbook for the NobleStride CRM production outage on Vercel
(project `dev-lua-s-projects/noble-stride`, live at `https://noble-stride.vercel.app`).

## TL;DR

The production database was **17 migrations behind the deployed code**. The build
pipeline generates the Prisma *client* but never applied *migrations*, so prod was
frozen at the June 19 `init` schema while the app expected columns/tables added
through July 8.

**Fixed by** running `prisma migrate deploy` against the prod Neon DB (2/21 → 21/21),
then creating one internal login account. **Login now works end-to-end on the live site.**

---

## Symptoms

1. **500s / Prisma `P2022`** in Vercel logs:
   ```
   The column `Transaction.successFeeAmount` does not exist in the current database.
   ```
2. **Could not log in** — credentials rejected.
3. Secondary noise: `Failed to find Server Action "…"` warning (a *stale browser tab*
   from an older deployment — unrelated to the DB; cleared by a hard refresh).

## Root cause

- `package.json` build script was:
  ```
  "build": "prisma generate && next build"
  ```
  → generates the client, **never runs migrations**. Nothing else (no `vercel.json`,
  no CI step) applied them either.
- Result: prod DB had only **2 of 21** migrations applied (`_init` + `add_createdsource`).
  Everything from `20260626…` onward was missing, including:
  - `…successfee` → the `Transaction.successFeeAmount` column (cause of the P2022 crash)
  - `…real_auth_models` → `AuthAccount` / `AuthSession` / `AuthToken` tables
  - `…investor_2fa_otp` → `AuthOtpChallenge` table
- Login reads `prisma.authAccount` (`src/server/auth/login.ts`) and
  `prisma.authOtpChallenge` (`src/server/auth/otp.ts`). Those **tables didn't exist**,
  and even once created they were **empty** (0 accounts) — so there was nothing to log
  in with. `loginWithPassword` returns a generic `invalid` for both wrong-password AND
  no-such-account, which is why it read as "incorrect password".

## What we did

1. **Linked the project & pulled prod env** (Vercel CLI wasn't installed globally; used `npx`):
   ```bash
   cd noblestride-crm
   npx vercel@latest login
   npx vercel@latest link                 # dev-lua-s-projects/noble-stride
   npx vercel@latest env pull .env.vercel.prod --environment=production
   ```
   → All Neon DB vars (`DATABASE_URL`, `POSTGRES_*`, etc.) came back **empty**: they're
   flagged **"Sensitive"** in Vercel, so `env pull` cannot decrypt them. (Non-sensitive
   vars like `VERCEL_ENV=production` pulled fine — confirming the pull itself worked.)

2. **Got the direct connection string from Neon** (Vercel → Storage → Neon DB, or the
   Neon console). Used the **unpooled / direct** endpoint (host **without** `-pooler`) —
   `prisma migrate deploy` cannot run through Neon's PgBouncer pooler.

3. **Applied the pending migrations** against prod:
   ```bash
   DATABASE_URL="<neon UNPOOLED url>" npx prisma migrate deploy
   DATABASE_URL="<neon UNPOOLED url>" npx prisma migrate status   # → "up to date"
   ```
   → 19 migrations applied, **21/21**, "Database schema is up to date!".
   This fixed the `successFeeAmount` crash.

4. **Installed a missing dependency locally**: `@node-rs/argon2` (declared in
   `package.json` but absent from local `node_modules`) — needed to hash the password.
   ```bash
   pnpm install
   ```

5. **Created ONE internal login account** (non-destructive — did **not** reseed/wipe the
   existing prod data, which already had 14 users / 209 persons / 41 investors / 60
   engagements). Attached an `AuthAccount` to the existing admin user `evans`:
   - `kind: INTERNAL`, `status: ACTIVE`, `userId` → existing user (role `Admin`)
   - password hashed with the app's own `hashPassword` (argon2id).

## Login credentials (demo)

| Field | Value |
|-------|-------|
| URL | `https://noble-stride.vercel.app/login` |
| Email | `evans@noblestride.capital` |
| Password | `NobleStride!Demo2026` |

- Internal accounts skip 2FA/OTP → straight to `/dashboard`, full Admin access.
- If you get `Failed to find Server Action`, **hard-refresh** (Cmd+Shift+R) or use an
  incognito window first — that's a stale cached tab, not an auth error.

## Verification (evidence)

- `prisma migrate status` → **21/21, up to date**.
- Direct check against prod DB: account present (INTERNAL/ACTIVE), `authAccount_total=1`,
  and `loginWithPassword("evans@…","NobleStride!Demo2026")` → `{ ok: true, home: "/dashboard" }`.
- Wrong password → correctly rejected (`invalid`).
- **Live browser test**: drove `https://noble-stride.vercel.app/login`, entered the
  credentials, clicked Sign in → redirected to `/dashboard`. ✅ Works on the real site.

## Outstanding / recommended follow-ups

1. **⚠️ Make migrations run on every deploy** (otherwise the NEXT migration breaks prod
   the same way). Change the build script:
   ```jsonc
   "build": "prisma generate && prisma migrate deploy && next build"
   ```
   Note: if the Vercel build connects via the pooled URL, add a `directUrl` to the Prisma
   datasource pointing at the unpooled endpoint so `migrate deploy` can run.
2. **🔑 Rotate the Neon DB password.** The production connection string was shared in
   plaintext during recovery. Reset it in the Neon console; Vercel's integration updates
   the env var automatically.
3. **Create more accounts as needed.** To add logins without wiping data, insert
   `AuthAccount` rows (INTERNAL → link `userId`; INVESTOR → link `personId`). A full
   `pnpm seed` also works but is **destructive** (`deleteMany` rebuilds all demo data).

## Runbook — applying migrations to prod in the future

```bash
cd noblestride-crm
# Direct (unpooled) Neon string — host WITHOUT "-pooler"
DATABASE_URL="<neon UNPOOLED url>" npx prisma migrate deploy
DATABASE_URL="<neon UNPOOLED url>" npx prisma migrate status   # confirm "up to date"
```

## Environment notes

- **DB**: Neon Postgres. Direct endpoint `ep-frosty-band-ahl2swqd…` (unpooled) for
  migrations; pooled `…-pooler…` endpoint for app runtime.
- **DB URL in Vercel is "Sensitive"** → not retrievable via `vercel env pull`; get the
  string from the Neon console / Vercel Storage tab.
- **Package manager**: pnpm. `@node-rs/argon2` is required for password hashing.
