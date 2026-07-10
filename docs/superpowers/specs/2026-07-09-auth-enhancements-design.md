# Auth System Enhancements — Design

**Date:** 2026-07-09
**Branch:** `integration/all-features`
**App root:** `noblestride-crm/`
**Author:** Shaurya Dabral (with Claude)

## Context

The `feat/real-auth` work is merged into `integration/all-features`. The auth
system has: credential login (`/login`, POST form), 2FA/OTP for investors,
password reset (`/forgot-password`, `/reset-password/[token]`), registration
(`/register`), a working `logoutAction`, admin user management
(`/settings/users`), impersonation lens, and rate limiting. This spec adds six
usability/security refinements requested after review of the deployed app.

Only two account kinds exist in the model: `INTERNAL` (Admin / DealLead /
TeamMember) and `INVESTOR`. Clients / partners / service providers are records,
not login accounts.

## Goals (the six points)

1. Prominent **logout button pinned to the bottom of the left sidebar** on every
   login surface (internal shell + investor portal).
2. **Search + filter toolbar above every list table** (client-side), matching
   the Investors-page pattern.
3. **Users / User Management page restricted to internal users**; investor
   accounts managed on the Investors page where their data lives.
4. **Password show/hide eye toggle** on every login/sign-up/reset password field.
5. **Email & password never reach the URL or console** — hardening.
6. Remove the **dev "appears in the server console" leak** from the user-facing
   reset-password confirmation copy.

## Non-goals

- No change to the underlying session/OTP/reset crypto or the rate limiter.
- No pagination or server-side search backends (client-side filtering only).
- No new account *kinds*; clients/partners/service-providers remain non-login.

---

## Point 1 — Sidebar logout button

`logoutAction` (`src/app/logout/actions.ts`) already revokes the DB session and
clears both auth cookies. The gap is discoverability: the topbar "Sign out" is
easy to miss.

- Add a pinned footer to `src/components/shell/sidebar.tsx` (internal) — it
  currently has no footer — with a `LogOut` icon + "Sign out" label inside a
  `<form action={logoutAction}>`, separated by a top border, full-width, hover
  state.
- Add the same to `src/components/portal/investor-sidebar.tsx`, replacing the
  static "Investor Portal" footer label (or placing the button above it).
- Keep the topbar "Sign out" as-is (harmless redundancy).
- Both shells reuse these two sidebars, so this covers all login surfaces.

**Testing:** click the sidebar logout on internal + investor shells → lands on
`/login`, session cookie cleared, back-button does not restore an authed page.

---

## Point 2 — Client-side search + filters above tables

New reusable client component `src/components/crm/table-search.tsx`:

```
<TableSearch
  rows={data}
  searchText={(row) => [row.email, row.name, ...]}   // strings to match against `q`
  filters={[{ key, label, options: [{value,label}], get: (row) => string }]}
  searchPlaceholder="Search…"
>
  {(filteredRows) => (/* page's own <table> markup over filteredRows */)}
</TableSearch>
```

- Filters entirely in-browser (no URL params → no emails in the URL; consistent
  with Points 4/5).
- Renders a search input + filter `<Select>` dropdowns styled like the
  Investors `FilterBar`, a "Showing X of Y" count, and an empty state.
- Render-prop keeps each table's bespoke cells / chips / action buttons intact.

Applied to: **Users** (search email/name; filter Kind/Role/Status), **Deals,
Clients, Documents, Tasks, Partners, Service Providers**. The **Investors** page
keeps its existing server-side `FilterBar` unchanged.

Each target page: server component fetches rows → passes to `<TableSearch>`.

**Testing:** on Users, typing an email narrows the table; a role filter narrows
it; combined search+filter intersect; clearing restores all; the URL never
changes.

---

## Point 3 — Users page internal-only; investor accounts on Investors page

`src/app/(crm)/settings/users/page.tsx`:

- Filter **both** the pending-approval queue and "All accounts" to
  `kind === "INTERNAL"`. INVESTOR accounts no longer appear here.

Investor account lifecycle (the only external login kind):

- Onboarding review already lives on the Investors page ("Review queue") — no
  change.
- Add an **"Account access"** admin panel to the investor detail page
  `src/app/(crm)/investors/[id]/page.tsx`: shows the linked `AuthAccount`
  (email, status, last login) with **Suspend / Reactivate / Reset link**,
  reusing the existing account server actions from `settings/users/actions.ts`
  (extract shared helpers if needed). Admin-only, guarded against the
  impersonation lens (same `requireRealAdmin` rule).
- If an investor has no linked account, the panel shows "No login account".

**Testing:** Users page shows only INTERNAL rows; investor detail page shows the
account panel; suspend/reactivate/reset-link work and are admin-gated.

---

## Point 4 — Password eye toggle

New reusable client component `src/components/ui/password-input.tsx`: a masked
input with a trailing eye / eye-off button toggling `type` between `"password"`
and `"text"`. Pure client-side visibility; value never transmitted by the
toggle. Accessible: `aria-label` ("Show password" / "Hide password"),
`aria-pressed`, keyboard-operable, `type="button"` so it never submits the form.

Applied to every password field:
`src/app/login/*` (new login-form, Point 5), `src/app/register/contact-form.tsx`,
`src/app/register/internal-form.tsx`, `src/app/register/register-wizard.tsx`,
`src/app/reset-password/[token]/page.tsx`.

**Testing:** eye reveals characters, eye-off re-masks; toggling does not submit;
works on login, register (both forms), and reset.

---

## Point 5 — No email/password in URL or console (hardening)

- Convert the login form to a client component `src/app/login/login-form.tsx`
  using React 19 `useActionState`. `loginAction` changes signature to
  `(prevState, formData) => { error?, email? }`, returning error + typed email
  on failure (still `redirect()` on success and on the 2FA branch). Result: **no
  `?email=` and no `?error=` from login submissions.** The typed email is
  preserved in client state, not the URL.
- The `login/page.tsx` stays a server component (keeps the `getViewpoint()`
  redirect gate) and renders `<LoginForm>`.
- Harden the remaining cross-page params that still arrive via URL (2FA verify
  bounce → `/login?error=<slug>`, reset success): render **only** from a fixed
  slug→copy allow-list; unknown slugs fall back to a generic message. **Never**
  render an arbitrary reflected string (kills the content-spoofing/phishing
  vector). Reset-success becomes a slug (e.g. `?notice=password-updated`).
- Audit confirms no password logging. `mailer.ts` / `two-factor.ts` dev console
  output contains reset/OTP links only (dev-only), never passwords — unchanged.

**Testing:** wrong-password login shows the error inline with the email still
populated and a clean `/login` URL (no query string); a crafted
`/login?error=<evil>` shows only the generic fallback, not the attacker string.

---

## Point 6 — Remove dev console leak from reset copy

`src/app/forgot-password/page.tsx`: remove the parenthetical
"(While email delivery is not configured, the link appears in the server
console.)". Confirmation reads only: "If an account exists for that address, a
reset link has been sent." Dev-console delivery in `mailer.ts` is unchanged.

**Testing:** submitting the forgot-password form shows the neutral message with
no mention of the server console.

---

## Architecture / isolation notes

- `<PasswordInput>` and `<TableSearch>` are self-contained, reusable UI units
  with clear prop interfaces; they carry no page-specific logic.
- `<LoginForm>` owns login form state; `login/page.tsx` owns the auth gate.
- Investor account actions reuse the existing user-management server actions;
  shared logic is extracted into a helper rather than duplicated.

## Process

1. writing-plans → implementation plan.
2. SDD execution (Sonnet implements).
3. Single consolidated review pass at the end; loop until all findings fixed.
4. Playwright end-to-end pass, one scenario per point.
5. No commits until explicit go-ahead (working tree left dirty).
