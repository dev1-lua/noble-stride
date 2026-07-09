# Auth System Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a discoverable sidebar logout, client-side search/filter toolbars on every list table, restrict the Users page to internal accounts (investor accounts managed on the Investors page), a password show/hide eye toggle, and remove email/password/dev-console leakage from URLs and user-facing copy.

**Architecture:** Two new reusable client components (`PasswordInput`, `TableSearch`) plus a client `LoginForm` using React 19 `useActionState`. Existing server actions and the session/OTP/reset core are reused unchanged except for the `loginAction` signature. Filtering is entirely client-side (no URL params → no PII in URLs).

**Tech Stack:** Next.js App Router (RSC + server actions), React 19 (`useActionState`), TypeScript, Tailwind with CSS custom-property tokens, Prisma, Vitest (existing `*.test.ts` pattern), Playwright MCP for the final E2E pass.

## Global Constraints

- Branch: `integration/all-features`. App root: `noblestride-crm/`. All paths below are relative to `noblestride-crm/`.
- **No commits during implementation.** Leave the working tree dirty; the single commit happens only after the end-of-run review + Playwright pass + explicit user go-ahead (user standing preference).
- Never place email or password in any URL query string or path. Never `console.log` a password. The password eye toggle is client-only (`type` swap); it transmits nothing.
- Cross-page status/error messages that arrive via URL must render only from a fixed slug→copy allow-list; never render an arbitrary reflected string.
- Follow existing styling: CSS tokens (`var(--...)`), the `useActionState` + `<form action={submitAction}>` pattern already in `settings/users/user-actions-client.tsx`, and the `FilterBar`/`Select`/`Input` look from the Investors page.
- Admin-only server actions must re-check the REAL role (not the impersonation lens), matching `requireRealAdmin` in `settings/users/actions.ts`.
- Run `npm run lint` and `npx tsc --noEmit` (or the project's typecheck) after code changes; pre-existing lint noise is acceptable (see memory), new errors are not.

---

### Task 1: `PasswordInput` reusable component (Point 4)

**Files:**
- Create: `src/components/ui/password-input.tsx`
- Modify: `src/components/ui/index.ts` (add export)

**Testing note:** this repo has **no** `@testing-library/react`/jsdom (test
convention is pure-logic `.ts` tests). `PasswordInput` is pure presentation
with no extractable logic, so it has **no unit test** — the show/hide toggle is
verified in the Playwright E2E pass (Point 4 scenario). Do NOT add
`@testing-library/react` or a `.tsx` test.

**Interfaces:**
- Produces: `PasswordInput` — a controlled/uncontrolled `<input>` wrapper. Props extend native input props (`name`, `id`, `required`, `minLength`, `defaultValue`, `value`, `onChange`, `placeholder`, `className`, `autoComplete`). Internally holds `visible` boolean state, renders `type={visible ? "text" : "password"}`, and a trailing `<button type="button">` with `Eye`/`EyeOff` from `lucide-react` toggling visibility.

- [ ] **Step 1: Write the component**

```tsx
// src/components/ui/password-input.tsx
"use client";

import { forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/cn";

export type PasswordInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">;

// Masked input with a client-only show/hide eye toggle. The toggle only swaps
// the input's `type` — it transmits nothing and never submits the form.
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(function PasswordInput(
  { className, "aria-label": ariaLabel, ...props },
  ref,
) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        ref={ref}
        type={visible ? "text" : "password"}
        aria-label={ariaLabel ?? "Password field"}
        className={cn(
          "w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg-primary)] px-3 py-2 pr-10 text-sm text-[var(--text-primary)]",
          "placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]",
          className,
        )}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        tabIndex={0}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
});
```

Add to `src/components/ui/index.ts`:

```ts
export { PasswordInput } from "./password-input";
export type { PasswordInputProps } from "./password-input";
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors referencing the new file.

- [ ] **Step 3: Stage (do NOT commit)**

Run: `git add src/components/ui/password-input.tsx src/components/ui/index.ts`

---

### Task 2: Apply `PasswordInput` to register forms (Point 4)

**Files:**
- Modify: `src/app/register/contact-form.tsx` (2 password fields, lines ~48, ~62)
- Modify: `src/app/register/internal-form.tsx` (2 password fields, lines ~80, ~94)
- Modify: `src/app/register/register-wizard.tsx` (2 password fields, lines ~263, ~274)
- Note: `register-wizard.tsx` may render `contact-form`/`internal-form` — inspect first; do not double-wrap fields already handled by those child components. Only replace raw `<input type="password">` occurrences.

> The reset-password page's password fields are swapped to `PasswordInput` in
> Task 4 (which also hardens that page), and the login field in Task 3 — to
> avoid two tasks editing the same file.

**Interfaces:**
- Consumes: `PasswordInput` from `@/components/ui` (Task 1).

- [ ] **Step 1: Replace each `<input type="password" ... />`** with `<PasswordInput ... />`, preserving all existing props (`id`, `name`, `required`, `minLength`, `defaultValue`, `placeholder`, `autoComplete`). Drop the literal `type="password"` and any `className` that only set border/padding (the component supplies those); keep layout-only classes via the `className` prop. Add `import { PasswordInput } from "@/components/ui";` to each file. For files that are Server Components, note `PasswordInput` is a Client Component and can be rendered inside a form in an RSC — but if the containing form needs the value client-side it already is a client form; verify each file's `"use client"` status and only add the import.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors referencing these files.

- [ ] **Step 3: Manual render check (deferred to E2E)** — mark done; the Playwright pass (Point 4 scenario) verifies the toggle on register + reset.

- [ ] **Step 4: Stage (do NOT commit)**

Run: `git add src/app/register/contact-form.tsx src/app/register/internal-form.tsx src/app/register/register-wizard.tsx "src/app/reset-password/[token]/page.tsx"`

---

### Task 3: Login form client component + `useActionState` + URL hardening (Points 4 login field, 5)

**Files:**
- Create: `src/app/login/login-form.tsx`
- Create: `src/app/login/messages.ts` (slug→copy allow-list, shared)
- Modify: `src/app/login/actions.ts` (change `loginAction` signature)
- Modify: `src/app/login/page.tsx` (render `<LoginForm>`, map URL slug via allow-list)
- Test: `src/app/login/messages.test.ts`

**Interfaces:**
- Produces: `LoginFormState = { error?: string; email?: string }`; `loginAction(prevState: LoginFormState, formData: FormData): Promise<LoginFormState>` (redirects on success / OTP branch, returns state on failure).
- Produces: `LOGIN_NOTICES: Record<string, string>` and `loginNotice(slug: string | undefined): string | null` in `messages.ts`.
- Consumes: `PasswordInput` (Task 1), existing `loginWithPassword`, `rateLimit`, `setSessionCookie`, `safeNext`, 2FA cookie constants.

- [ ] **Step 1: Write the failing test for the slug allow-list**

```ts
// src/app/login/messages.test.ts
import { describe, it, expect } from "vitest";
import { loginNotice } from "./messages";

describe("loginNotice", () => {
  it("maps known slugs to copy", () => {
    expect(loginNotice("password-updated")).toMatch(/sign in/i);
    expect(loginNotice("session-expired")).toMatch(/expired/i);
  });
  it("returns a generic fallback for unknown/arbitrary input (no reflection)", () => {
    expect(loginNotice("<script>alert(1)</script>")).toBe("Please sign in to continue.");
    expect(loginNotice("Call this number 555-0100")).toBe("Please sign in to continue.");
  });
  it("returns null when no slug is present", () => {
    expect(loginNotice(undefined)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/login/messages.test.ts`
Expected: FAIL — module `./messages` not found.

- [ ] **Step 3: Implement `messages.ts`**

```ts
// src/app/login/messages.ts
// Fixed allow-list of messages that may arrive on /login via ?error / ?notice
// (2FA bounce, password-reset success). Never render a reflected URL string —
// unknown slugs collapse to a single generic line (anti content-spoofing).

const NOTICES: Record<string, string> = {
  "password-updated": "Password updated — sign in with your new password.",
  "session-expired": "Your sign-in session expired. Please sign in again.",
  "code-expired": "Your code expired. Please sign in again to get a new one.",
  "too-many-codes": "Too many incorrect codes. Please sign in again to get a new code.",
  locked: "Too many attempts. Please try again in a little while.",
  suspended: "This account is suspended. Contact NobleStride if you believe this is an error.",
};

const GENERIC = "Please sign in to continue.";

export function loginNotice(slug: string | undefined): string | null {
  if (!slug) return null;
  return NOTICES[slug] ?? GENERIC;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/login/messages.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Rewrite `loginAction` to return state instead of redirecting with email/error**

```ts
"use server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { loginWithPassword } from "@/server/auth/login";
import { rateLimit } from "@/server/auth/rate-limit";
import { setSessionCookie } from "@/server/auth/session-cookie";
import { PENDING_COOKIE, PENDING_TTL_S, TRUST_COOKIE } from "@/server/auth/two-factor";
import { safeNext } from "./safe-next";

const emailSchema = z.string().trim().email("Enter a valid email address.");

const MESSAGES: Record<string, string> = {
  invalid: "Incorrect email or password.",
  locked: "Too many failed attempts. Try again in about 15 minutes.",
  pending: "Your account is awaiting review by the NobleStride team.",
  suspended: "This account is suspended. Contact NobleStride if you believe this is an error.",
  otp_unavailable: "We couldn't send your verification code. Please try again in a moment.",
};

export interface LoginFormState {
  error?: string;
  email?: string;
}

export async function loginAction(_prev: LoginFormState, formData: FormData): Promise<LoginFormState> {
  const rawEmail = String(formData.get("email") ?? "");
  const parsed = emailSchema.safeParse(rawEmail);
  const password = String(formData.get("password") ?? "");
  const next = safeNext(String(formData.get("next") ?? "") || undefined);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Enter a valid email address.", email: rawEmail };
  }
  const email = parsed.data;

  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!rateLimit(`login:${ip}`)) return { error: MESSAGES.locked, email };

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
  if (!res.ok) return { error: MESSAGES[res.reason] ?? "Sign-in failed.", email };

  const ok = res as Extract<Awaited<ReturnType<typeof loginWithPassword>>, { ok: true }>;
  await setSessionCookie(ok.token, ok.expiresAt);
  redirect(next ?? ok.home);
}
```

> Note: `redirect()` throws internally; that is expected inside a `useActionState` action and is not caught as an error.

- [ ] **Step 6: Create the client `LoginForm`**

```tsx
// src/app/login/login-form.tsx
"use client";

import { useActionState } from "react";
import Link from "next/link";
import { PasswordInput } from "@/components/ui";
import { loginAction, type LoginFormState } from "./actions";

const inputClass =
  "w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] " +
  "placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]";
const labelClass = "block text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]";

const initial: LoginFormState = {};

export function LoginForm({ isInvestor, next }: { isInvestor: boolean; next?: string }) {
  const [state, submitAction, isPending] = useActionState(loginAction, initial);
  return (
    <section className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-5">
      {state.error && (
        <div className="mb-4 rounded-lg border border-[var(--t-tag-bg-rose)] bg-[var(--t-tag-bg-rose)] p-3 text-sm text-[var(--t-tag-text-rose)]">
          {state.error}
        </div>
      )}
      <form action={submitAction} className="space-y-4">
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <div>
          <label htmlFor="email" className={labelClass}>
            Email <span className="text-rose-500">*</span>
          </label>
          <input
            id="email" name="email" type="email" required autoComplete="username"
            defaultValue={state.email ?? ""} placeholder="name@fund.com"
            className={"mt-1 " + inputClass}
          />
        </div>
        <div>
          <label htmlFor="password" className={labelClass}>
            Password <span className="text-rose-500">*</span>
          </label>
          <PasswordInput
            id="password" name="password" required autoComplete="current-password"
            placeholder="Your password" className="mt-1"
          />
        </div>
        <div className={"flex items-center gap-4 border-t border-[var(--border-subtle)] pt-4 " + (isInvestor ? "justify-between" : "justify-end")}>
          {isInvestor && (
            <Link href="/register" className="text-xs font-medium text-[var(--accent)] hover:underline">
              New here? Register your fund →
            </Link>
          )}
          <button type="submit" disabled={isPending}
            className="rounded bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-60">
            {isPending ? "Signing in…" : "Sign in"}
          </button>
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-[var(--border-subtle)] pt-4 text-xs">
          <Link href="/forgot-password" className="font-medium text-[var(--accent)] hover:underline">Forgot password?</Link>
          <Link href="/register" className="font-medium text-[var(--accent)] hover:underline">Create an account →</Link>
        </div>
      </form>
    </section>
  );
}
```

- [ ] **Step 7: Rewrite `login/page.tsx` to render `<LoginForm>` and map URL slug via allow-list**

Keep the server component + `getViewpoint()` gate. Replace the inline form and the `ERROR_COPY[sp.error] ?? sp.error` block. The page now reads `sp.error` (a slug from 2FA bounce) and `sp.notice` (from reset success) through `loginNotice()`:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewpoint } from "@/server/viewpoint";
import { viewpointHome } from "@/lib/viewpoint";
import { LoginForm } from "./login-form";
import { loginNotice } from "./messages";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ error?: string; notice?: string; as?: string; next?: string }>;
}

export default async function LoginPage({ searchParams }: PageProps) {
  const vp = await getViewpoint();
  if (vp) redirect(viewpointHome(vp));

  const sp = await searchParams;
  const isInvestor = sp.as === "investor";
  const notice = loginNotice(sp.notice ?? sp.error); // fixed allow-list; never reflects arbitrary strings

  return (
    <div className="flex min-h-screen items-start justify-center bg-[var(--bg-secondary)] px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Link href="/" className="text-sm font-semibold tracking-tight text-emerald-950">NobleStride Capital</Link>
          <h1 className="mt-3 text-2xl font-bold text-[var(--text-primary)]">{isInvestor ? "Investor sign in" : "Sign in"}</h1>
          <p className="mt-1 text-sm text-[var(--text-tertiary)]">{isInvestor ? "Investor & partner portal access" : "NobleStride team workspace"}</p>
        </div>
        {notice && (
          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-4 text-sm text-[var(--text-secondary)]">
            {notice}
          </div>
        )}
        <LoginForm isInvestor={isInvestor} next={sp.next} />
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Update callers that redirect to `/login` with a full-sentence error**

- `src/app/reset-password/actions.ts`: change the success redirect from `?error=Password updated…` to `redirect("/login?notice=password-updated")`.
- Search for other `/login?error=` producers and convert full-sentence messages to slugs from `messages.ts`:

Run: `grep -rn "/login?error=" src`
For each hit that passes a full sentence, replace with an existing slug (`session-expired`, `code-expired`, `too-many-codes`, `locked`, `suspended`) or add a new slug to `NOTICES`. The 2FA verify bounce already uses these slugs — leave those.

- [ ] **Step 9: Typecheck + tests**

Run: `npx tsc --noEmit && npx vitest run src/app/login`
Expected: no new type errors; login tests pass.

- [ ] **Step 10: Stage (do NOT commit)**

Run: `git add src/app/login src/app/reset-password/actions.ts`

---

### Task 4: Harden the reset-password error reflection (Point 5)

**Files:**
- Modify: `src/app/reset-password/[token]/page.tsx` (renders `sp.error` verbatim ~line 40)
- Modify: `src/app/reset-password/actions.ts` (error redirects)

**Interfaces:**
- Consumes: a small local slug map (reset errors are few).

- [ ] **Step 1: Add a reset slug map + apply the `PasswordInput` here too**

In `reset-password/[token]/page.tsx`, replace the verbatim `{sp.error}` render with a fixed map, and swap both password `<input>`s for `<PasswordInput>` (this also completes Point 4 for reset):

```tsx
const RESET_ERRORS: Record<string, string> = {
  mismatch: "Passwords do not match.",
  invalid: "This reset link is invalid or has expired. Request a new one.",
  weak: "Password must be at least 10 characters.",
};
const errorText = sp.error ? (RESET_ERRORS[sp.error] ?? "Reset failed. Request a new link.") : null;
```

Render `{errorText && (<div …>{errorText}</div>)}`.

- [ ] **Step 2: Update `resetPasswordAction` to redirect with slugs**

```ts
if (password !== confirm) redirect(`/reset-password/${encodeURIComponent(token)}?error=mismatch`);
const res = await performPasswordReset(token, password);
if (!res.ok) redirect(`/reset-password/${encodeURIComponent(token)}?error=invalid`);
redirect("/login?notice=password-updated");
```

(Map `weak` if `performPasswordReset` distinguishes a length failure; otherwise `invalid` covers it.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Stage (do NOT commit)**

Run: `git add "src/app/reset-password/[token]/page.tsx" src/app/reset-password/actions.ts`

---

### Task 5: Sidebar logout buttons (Point 1)

**Files:**
- Modify: `src/components/shell/sidebar.tsx` (add pinned footer with logout)
- Modify: `src/components/portal/investor-sidebar.tsx` (add logout to footer)

**Interfaces:**
- Consumes: `logoutAction` from `@/app/logout/actions` (existing, revokes session + clears cookies + redirects to `/login`).

- [ ] **Step 1: Add logout footer to the internal sidebar**

In `src/components/shell/sidebar.tsx`, add `LogOut` to the `lucide-react` import and `import { logoutAction } from "@/app/logout/actions";`. Before the closing `</aside>`, after the scrollable nav `</div>`, add:

```tsx
{/* Sign out — pinned footer, always visible. Revokes the DB session. */}
<div className="flex-shrink-0 border-t border-[var(--border-subtle)] px-3 py-3">
  <form action={logoutAction}>
    <button
      type="submit"
      className="flex w-full items-center gap-3 rounded px-3 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
    >
      <LogOut className="h-4 w-4 flex-shrink-0 text-[var(--t-tag-text-rose)]" />
      Sign out
    </button>
  </form>
</div>
```

- [ ] **Step 2: Add logout to the investor sidebar**

In `src/components/portal/investor-sidebar.tsx`, add `LogOut` to the import and `import { logoutAction } from "@/app/logout/actions";`. Replace the static "Investor Portal" footer `<div>` (or add above it) with the same `<form action={logoutAction}>` button block as Step 1.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Stage (do NOT commit)**

Run: `git add src/components/shell/sidebar.tsx src/components/portal/investor-sidebar.tsx`

---

### Task 6: `TableSearch` reusable component (Point 2)

**Files:**
- Create: `src/components/crm/table-filter.ts` (pure filter logic — no React, so it is unit-testable without DOM tooling)
- Create: `src/components/crm/table-search.tsx` (client component; imports `applyTableFilters` + types from `table-filter.ts`)
- Test: `src/components/crm/table-filter.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface TableFilter<T> { key: string; label: string; options: { value: string; label: string }[]; get: (row: T) => string; }
  export interface TableSearchProps<T> {
    rows: T[];
    searchText: (row: T) => string[];        // strings matched (case-insensitive) against the query
    filters?: TableFilter<T>[];
    searchPlaceholder?: string;
    children: (filtered: T[]) => React.ReactNode;  // render-prop for the table body
  }
  export function TableSearch<T>(props: TableSearchProps<T>): JSX.Element;
  export function applyTableFilters<T>(rows, query, active, searchText, filters): T[]; // pure, exported for tests
  ```
- Consumes: `Input`, `Select` from `@/components/ui`.

- [ ] **Step 1: Write the failing test for the pure filter fn**

```ts
// src/components/crm/table-filter.test.ts
import { describe, it, expect } from "vitest";
import { applyTableFilters } from "./table-filter";

type Row = { email: string; role: string };
const rows: Row[] = [
  { email: "solomon@noblestride.capital", role: "Admin" },
  { email: "ivy@noblestride.capital", role: "TeamMember" },
  { email: "cmiriti@ifc.org", role: "TeamMember" },
];
const searchText = (r: Row) => [r.email, r.role];
const filters = [{ key: "role", label: "Role", options: [], get: (r: Row) => r.role }];

describe("applyTableFilters", () => {
  it("matches search case-insensitively across fields", () => {
    expect(applyTableFilters(rows, "IVY", {}, searchText, filters).map((r) => r.email)).toEqual(["ivy@noblestride.capital"]);
  });
  it("applies a filter value", () => {
    expect(applyTableFilters(rows, "", { role: "Admin" }, searchText, filters)).toHaveLength(1);
  });
  it("intersects search + filter", () => {
    expect(applyTableFilters(rows, "ifc", { role: "TeamMember" }, searchText, filters)).toHaveLength(1);
  });
  it("empty query + no active filters returns all", () => {
    expect(applyTableFilters(rows, "", {}, searchText, filters)).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/crm/table-filter.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3a: Implement the pure `table-filter.ts`**

```ts
// src/components/crm/table-filter.ts
// Pure filter logic for TableSearch — no React, so it is unit-testable in a
// plain vitest .ts test (this repo has no DOM test tooling).

export interface TableFilter<T> {
  key: string;
  label: string;
  options: { value: string; label: string }[];
  get: (row: T) => string;
}

export function applyTableFilters<T>(
  rows: T[],
  query: string,
  active: Record<string, string>,
  searchText: (row: T) => string[],
  filters: TableFilter<T>[],
): T[] {
  const q = query.trim().toLowerCase();
  return rows.filter((row) => {
    if (q && !searchText(row).some((s) => (s ?? "").toLowerCase().includes(q))) return false;
    for (const f of filters) {
      const v = active[f.key];
      if (v && f.get(row) !== v) return false;
    }
    return true;
  });
}
```

- [ ] **Step 3b: Implement `table-search.tsx`**

```tsx
"use client";

import { useMemo, useState } from "react";
import { Input, Select } from "@/components/ui";
import { applyTableFilters, type TableFilter } from "./table-filter";

export type { TableFilter } from "./table-filter";
export interface TableSearchProps<T> {
  rows: T[];
  searchText: (row: T) => string[];
  filters?: TableFilter<T>[];
  searchPlaceholder?: string;
  children: (filtered: T[]) => React.ReactNode;
}

export function TableSearch<T>({ rows, searchText, filters = [], searchPlaceholder = "Search…", children }: TableSearchProps<T>) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<Record<string, string>>({});
  const filtered = useMemo(
    () => applyTableFilters(rows, query, active, searchText, filters),
    [rows, query, active, searchText, filters],
  );
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-64">
          <Input type="search" placeholder={searchPlaceholder} value={query}
            onChange={(e) => setQuery(e.target.value)} aria-label={searchPlaceholder} />
        </div>
        {filters.map((f) => (
          <div key={f.key} className="w-44">
            <Select
              options={[{ value: "", label: `All ${f.label}` }, ...f.options]}
              value={active[f.key] ?? ""}
              onChange={(v) => setActive((a) => ({ ...a, [f.key]: v }))}
              placeholder={f.label}
            />
          </div>
        ))}
      </div>
      <p className="text-sm text-[var(--text-tertiary)]">
        Showing {filtered.length} of {rows.length}
      </p>
      {filtered.length === 0 ? (
        <p className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-4 py-6 text-sm text-[var(--text-tertiary)]">
          No matches.
        </p>
      ) : (
        children(filtered)
      )}
    </div>
  );
}
```

> Confirm `Select`'s `onChange` gives the value string (it does per Investors `FilterBar`). Confirm `Input` forwards `value`/`onChange` (per `InputProps`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/crm/table-filter.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Stage (do NOT commit)**

Run: `git add src/components/crm/table-filter.ts src/components/crm/table-search.tsx src/components/crm/table-filter.test.ts`

---

### Task 7: Users page — restrict to internal + add search (Points 2, 3)

**Files:**
- Modify: `src/app/(crm)/settings/users/page.tsx`
- Create: `src/app/(crm)/settings/users/accounts-table.tsx` (client wrapper using `TableSearch`)

**Interfaces:**
- Consumes: `TableSearch` (Task 6), existing `UserActionsClient`, `StatusChip`/`label`.

- [ ] **Step 1: Restrict queries to INTERNAL**

In `page.tsx`, after fetching `accounts`, filter to internal for BOTH sections:
```ts
const internal = accounts.filter((a) => a.kind === "INTERNAL");
const pending = internal.filter((a) => a.status === "PENDING");
const rest = internal.filter((a) => a.status !== "PENDING");
```
(Investor accounts are managed on the Investors page — Task 9.)

- [ ] **Step 2: Create `accounts-table.tsx`** — a Client Component that receives the serialized `rest` rows (id, email, role label, roleValue, status, lastLogin string, plus the `AccountRow` shape `UserActionsClient` needs) and renders the "All accounts" table inside `TableSearch`, with filters for Role (`options("OrgRole")` values Admin/DealLead/TeamMember) and Status (ACTIVE/SUSPENDED). `searchText` returns `[email]`. Keep the exact `<table>`/`<StatusChip>`/`<UserActionsClient>` markup from the current page, mapping over the `TableSearch` render-prop rows. Pass only serializable primitives from the server page (format dates to strings server-side).

- [ ] **Step 3: Wire it in `page.tsx`** — replace the inline "All accounts" `<table>` with `<AccountsTable rows={rest.map(serialize)} />`. Leave the pending table inline (small, no search needed).

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no new errors.

- [ ] **Step 5: Stage (do NOT commit)**

Run: `git add "src/app/(crm)/settings/users/page.tsx" "src/app/(crm)/settings/users/accounts-table.tsx"`

---

### Task 8: Apply `TableSearch` to the remaining list tables (Point 2)

**Files (one client wrapper per page, following Task 7's pattern):**
- `src/app/(crm)/deals/*` — search by deal name/company; filters as available (stage/status).
- `src/app/(crm)/clients/*` — search by client name; filter by sector/status if present.
- `src/app/(crm)/documents/*` — search by document name; filter by type/status.
- `src/app/(crm)/tasks/*` — search by task title; filter by status/assignee.
- `src/app/(crm)/partners/*` — search by partner name; filter by type.
- `src/app/(crm)/service-providers/*` — search by provider name; filter by category.

**Interfaces:**
- Consumes: `TableSearch` (Task 6).

- [ ] **Step 1: For each page**, read the current file to find where the main list `<table>` renders and what row data is in scope. Extract the table into a sibling Client Component `*-table.tsx` (or add `"use client"` search wrapper) that wraps the existing markup in `<TableSearch>` with page-appropriate `searchText` + `filters` (use existing `options("...")` from `@/lib/vocab` where a matching enum exists; omit filters that have no vocab). Pass serializable rows from the server page. Do NOT alter the data queries.

- [ ] **Step 2: Skip any page that has no tabular list** (e.g. a page that is purely cards) — note it in the run log rather than forcing a table. The Investors page is intentionally skipped (already has `FilterBar`).

- [ ] **Step 3: Typecheck + lint after each page**

Run: `npx tsc --noEmit`
Expected: no new errors per page.

- [ ] **Step 4: Stage (do NOT commit)**

Run: `git add "src/app/(crm)/deals" "src/app/(crm)/clients" "src/app/(crm)/documents" "src/app/(crm)/tasks" "src/app/(crm)/partners" "src/app/(crm)/service-providers"`

---

### Task 9: Investor detail — Account access panel (Point 3)

**Files:**
- Create: `src/app/(crm)/investors/[id]/account-actions.ts` (investor-scoped server actions)
- Create: `src/app/(crm)/investors/[id]/account-panel.tsx` (client)
- Modify: `src/app/(crm)/investors/[id]/page.tsx` (fetch linked account, render panel for real admins)

**Interfaces:**
- Consumes: `suspendAccount`, `reactivateAccount` from `@/server/auth/accounts`; `createAuthToken` from `@/server/auth/tokens`; `getCurrentAuth`.
- Produces: `suspendInvestorAccountAction`, `reactivateInvestorAccountAction`, `generateInvestorResetLinkAction` (each `(prev: UserActionState, formData) => Promise<UserActionState>`), reusing the `UserActionState` shape.

- [ ] **Step 1: Implement `account-actions.ts`** — mirror `settings/users/actions.ts` (`requireRealAdmin` + a `run` helper) but `revalidatePath` the investor detail path. The reset-link action builds the same `${proto}://${host}/reset-password/${raw}` URL. Accept `accountId` from the form.

- [ ] **Step 2: Fetch the linked account in `page.tsx`** — query `prisma.authAccount.findFirst({ where: { kind: "INVESTOR", person: { investorId: <id> } }, include: { person: true } })`. Compute `isRealAdmin` via `getCurrentAuth()` (same predicate as the Users page). Render `<AccountPanel account={serialized|null} canManage={isRealAdmin} />`.

- [ ] **Step 3: Implement `account-panel.tsx`** — if `!account` show "No login account for this investor." Else show email, `StatusChip`, last-login; and when `canManage`, Suspend/Reactivate (by status) + Reset link buttons using `useActionState` with the Step-1 actions (copy the small form pattern from `user-actions-client.tsx`, including the `ResetLinkBlock`).

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no new errors.

- [ ] **Step 5: Stage (do NOT commit)**

Run: `git add "src/app/(crm)/investors/[id]"`

---

## End-of-run (after all tasks)

1. **Consolidated review pass** (requesting-code-review / code-review) across the whole diff — correctness, security (URL/console leakage, admin gating, no reflected strings), reuse. Loop until every finding is fixed.
2. **Playwright E2E pass** — one real-world scenario per point (see below). Log results to the `playwright assessment/` dir.
3. Report results; **commit only on explicit user go-ahead.**

### Playwright scenarios (one per point)
1. **Logout:** sign in (internal + investor) → click sidebar-bottom "Sign out" → lands on `/login`, protected route now redirects to login.
2. **Search:** on Users, type an email → table narrows; apply a Role filter → intersects; clear → restores; URL unchanged.
3. **Users internal-only:** Users page shows no INVESTOR rows; investor detail page shows the Account access panel with working suspend/reset.
4. **Eye toggle:** on login + register + reset, click eye → characters visible; click again → masked; toggling never submits.
5. **No URL leak:** submit wrong password → inline error + email preserved + `/login` URL has no query string; visit `/login?error=<evil>` → generic message only.
6. **Reset copy:** submit forgot-password → neutral "If an account exists…" with no server-console mention.

## Self-Review

- **Spec coverage:** Point 1→Task 5; Point 2→Tasks 6,7,8; Point 3→Tasks 7,9; Point 4→Tasks 1,2,3,4; Point 5→Tasks 3,4; Point 6→(folded into Task 3 stage? no) — **gap check:** Point 6 (forgot-password copy) — ADD as Task 10 below to avoid burying it.
- **Placeholder scan:** Task 8 is intentionally pattern-based (per-page markup varies); it carries the exact pattern + per-page search/filter specifics rather than fabricated markup for files not yet read. This is a deliberate read-then-apply task, not a placeholder.
- **Type consistency:** `LoginFormState`, `UserActionState`, `TableFilter/TableSearchProps`, `loginNotice` used consistently across tasks.

### Task 10: Forgot-password copy (Point 6)

**Files:**
- Modify: `src/app/forgot-password/page.tsx` (the `sent` confirmation block, ~lines 37-41)

- [ ] **Step 1:** Replace the confirmation paragraph text with exactly: "If an account exists for that address, a reset link has been sent." Remove the parenthetical "(While email delivery is not configured, the link appears in the server console.)". Leave `mailer.ts` unchanged.
- [ ] **Step 2: Typecheck** — `npx tsc --noEmit`.
- [ ] **Step 3: Stage** — `git add src/app/forgot-password/page.tsx`.
