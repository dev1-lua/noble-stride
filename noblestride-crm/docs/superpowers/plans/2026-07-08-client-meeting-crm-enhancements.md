# Client-Meeting CRM Enhancements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship four demo-facing changes: a minimal internal-team landing page; greylisting that blocks the domain from re-registering; a top-of-dashboard onboarding alert with inline actions + sidebar badge; and replacing the flat Engagement board with "By Deal" / "By Investor" focal views under a sidebar dropdown.

**Architecture:** Next.js App Router (RSC by default, client islands only where needed), Prisma/Postgres via a thin service layer, urql for client mutations, Tailwind v4, vocab-driven `Chip`s. Plain DTOs cross the RSC→client boundary (no Prisma types). Tasks are independent; sequenced to minimise shared-file churn.

**Tech Stack:** TypeScript, Next.js 16, React Server Components, Prisma 6, GraphQL (Pothos/Yoga), urql, Tailwind CSS v4, vitest, lucide-react.

## Global Constraints

- **Working dir:** `D:\LuaWork\NobleStride\noble-stride\noblestride-crm` (all paths below are relative to it).
- **No direct commits:** implement + verify, leave the tree dirty. Do **not** run `git commit` unless the user explicitly says so. The "Commit" steps below are written for completeness but are **gated on explicit user go-ahead** — skip them otherwise.
- **Prisma on Windows:** `next dev` locks the Prisma query-engine DLL. Before any `prisma migrate`/`prisma generate`, stop the dev server; restart it after.
- **RBAC:** reuse existing `can` / `canUpdateRecord` gating on any create/update surface; do not invent new permission logic.
- **DTO boundary:** map Prisma rows to plain objects (strings/numbers/booleans) in the Server Component before passing to any `"use client"` component. Convert `Decimal` with `Number(...)`, `Date` with `.toISOString()`.
- **Vocab:** render enum values with `<Chip value=… group=…/>` and `label(group, value)` from `@/lib/vocab`; never hard-code enum display strings.
- **Copy rule (landing):** never call the audience "the deal team"; it is NobleStride's internal team (admins + internal members).
- **Verify before done:** each task ends with running it in the app (dev server at `localhost:3000`) and observing the behaviour, plus `npm run lint` and `npx tsc --noEmit` clean for touched files. Pre-existing lint warnings elsewhere are acceptable (see memory).

---

## Task 1: Minimal internal-team landing page

**Files:**
- Modify (full rewrite of the JSX body): `src/app/page.tsx`

**Interfaces:**
- Consumes: existing `parseViewpoint`, `viewpointHome`, `VIEWPOINT_COOKIE` from `@/lib/viewpoint`; `cookies` from `next/headers`; `redirect` from `next/navigation`; `Link` from `next/link`; `ArrowRight` from `lucide-react`.
- Produces: nothing consumed by other tasks.

- [ ] **Step 1: Rewrite `src/app/page.tsx`**

Replace the entire file with the version below. It keeps the signed-in redirect, removes the `CAPABILITIES` grid, the `INVESTOR_STEPS` block, the "Are you an investor?" section, and the footer, and renders a single full-height centred hero.

```tsx
// page.tsx — public landing page.
// Internal-first front door: NobleStride's internal team (admins + internal
// members) signs in to the workspace; investors get small secondary
// "Login as an investor" / "Sign up as an investor" entry points.
// A visitor with a viewpoint cookie is forwarded home (the cookie's PRESENCE
// is the signed-in signal — a missing cookie parses as admin, so we check the
// raw cookie, not the parsed role).

import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { ArrowRight } from "lucide-react";
import { parseViewpoint, viewpointHome, VIEWPOINT_COOKIE } from "@/lib/viewpoint";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const raw = (await cookies()).get(VIEWPOINT_COOKIE)?.value;
  if (raw) redirect(viewpointHome(parseViewpoint(raw)));

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      {/* Header */}
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <span className="text-sm font-semibold tracking-tight text-emerald-950">
          NobleStride Capital
        </span>
        <nav className="flex items-center gap-4">
          <Link
            href="/login?as=investor"
            className="text-xs font-medium text-zinc-500 hover:text-emerald-950"
          >
            Login as an investor
          </Link>
          <Link
            href="/register"
            className="text-xs font-medium text-zinc-500 hover:text-emerald-950"
          >
            Sign up as an investor
          </Link>
          <Link
            href="/login"
            className="rounded-full bg-emerald-950 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900"
          >
            Sign in
          </Link>
        </nav>
      </header>

      {/* Centred hero fills the remaining viewport */}
      <main className="flex flex-1 items-center justify-center px-6">
        <div className="w-full max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">
            NobleStride Capital · Internal Workspace
          </p>
          <h1 className="mx-auto mt-4 max-w-2xl text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl">
            NobleStride&apos;s internal deal workspace
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-zinc-600">
            One place for the NobleStride team to run mandates, track NDA-gated
            documents, and move every investor relationship from teaser to close.
          </p>
          <div className="mt-8 flex items-center justify-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-full bg-emerald-950 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-900"
            >
              Sign in to your workspace <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-4 flex items-center justify-center gap-4 text-xs text-zinc-500">
            <Link
              href="/login?as=investor"
              className="font-medium hover:text-emerald-950 hover:underline"
            >
              Login as an investor
            </Link>
            <span className="text-zinc-300">·</span>
            <Link href="/register" className="font-medium hover:text-emerald-950 hover:underline">
              Sign up as an investor
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck & lint**

Run: `npx tsc --noEmit` and `npm run lint`
Expected: no new errors from `src/app/page.tsx` (unused imports `Briefcase`, `FileCheck2`, etc. are gone, so no unused-var warnings).

- [ ] **Step 3: Verify in the app**

Start the dev server (`npm run dev`), open `http://localhost:3000/` while signed out (clear the viewpoint cookie / use a fresh session). Confirm: full-height centred hero, heading "NobleStride's internal deal workspace", one-line subheading, "Sign in to your workspace" button, small investor login/sign-up links, header wordmark + links; NO "Built for the deal team" grid, NO investor-steps section, NO footer. Click "Sign in" → `/login`; "Sign up as an investor" → `/register`. Then confirm a signed-in session still redirects away from `/`.

- [ ] **Step 4 (gated): Commit** — only if the user explicitly approves committing.

```bash
git add src/app/page.tsx
git commit -m "feat(landing): minimal internal-team cover page"
```

---

## Task 2: Greylisting blocks the domain from re-registering

**Files:**
- Modify: `prisma/schema.prisma` (add `BlockedRegistrationKind` enum, `BlockedRegistration` model, back-relation on `Investor`)
- Modify: `src/lib/corporate-email.ts` (**extend** the existing module — it already holds the free-provider set — with two exported helpers; do NOT create a new provider list anywhere)
- Modify: `src/server/services/investors.ts` (`greylistInvestor` writes a block)
- Modify: `src/server/onboarding/register-investor.ts` (register rejects blocked email/domain)
- Test (modify): `src/lib/__tests__/corporate-email.test.ts` if present, else create it (test the two new helpers)
- Test (modify): `src/server/onboarding/__tests__/register-investor.smoke.test.ts`

> **DRY note (must follow):** `src/lib/corporate-email.ts` already defines a private `FREE_EMAIL_DOMAINS` set and `isCorporateEmail()`. Do NOT duplicate that list. Extend that file to export `emailDomain()` and `isFreeEmailDomain()` that reuse the existing set.

**Interfaces:**
- Produces:
  - `src/lib/corporate-email.ts` (extended) → `emailDomain(email: string): string | null` (lower-cased domain after `@`, or null if malformed); `isFreeEmailDomain(domain: string): boolean` (reuses the existing `FREE_EMAIL_DOMAINS` set).
  - `register-investor.ts` → `isRegistrationBlocked(email: string): Promise<boolean>` (exported for tests).
  - Prisma model `BlockedRegistration { id, kind, value, reason?, investorId?, createdAt }`, unique `(kind, value)`.
- Consumes: existing `prisma` from `@/lib/db`, `greylistInvestor(id, actor)`.

- [ ] **Step 1: Add helper tests (test first)**

First read `src/lib/corporate-email.ts` — it already has a private `FREE_EMAIL_DOMAINS` set and `isCorporateEmail()`. You will extend it. Create/extend `src/lib/__tests__/corporate-email.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { emailDomain, isFreeEmailDomain } from "@/lib/corporate-email";

describe("emailDomain", () => {
  it("lower-cases and extracts the domain", () => {
    expect(emailDomain("Broker@Acme-Brokers.COM")).toBe("acme-brokers.com");
  });
  it("returns null for malformed input", () => {
    expect(emailDomain("not-an-email")).toBeNull();
    expect(emailDomain("")).toBeNull();
  });
});

describe("isFreeEmailDomain", () => {
  it("flags common consumer providers", () => {
    expect(isFreeEmailDomain("gmail.com")).toBe(true);
    expect(isFreeEmailDomain("yahoo.com")).toBe(true);
  });
  it("does not flag corporate domains", () => {
    expect(isFreeEmailDomain("acme-brokers.com")).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test — expect failure (helpers missing)**

Run: `npx vitest run src/lib/__tests__/corporate-email.test.ts`
Expected: FAIL (no exports `emailDomain` / `isFreeEmailDomain`).

- [ ] **Step 3: Extend `src/lib/corporate-email.ts`**

Refactor `isCorporateEmail` to reuse the new `emailDomain`, and add the two exported helpers. The existing `FREE_EMAIL_DOMAINS` set is the single source of truth — do NOT duplicate it:

```ts
/** Lower-cased domain part of an email, or null if the string isn't email-shaped. */
export function emailDomain(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at < 1 || at === email.length - 1) return null;
  const domain = email.slice(at + 1).trim().toLowerCase();
  return domain.includes(".") ? domain : null;
}

/** True when `domain` is a known free/consumer provider. */
export function isFreeEmailDomain(domain: string): boolean {
  return FREE_EMAIL_DOMAINS.has(domain.toLowerCase());
}

/** True when the email has a domain that is not a known free provider. */
export function isCorporateEmail(email: string): boolean {
  const domain = emailDomain(email);
  return domain !== null && !isFreeEmailDomain(domain);
}
```

(Replace the existing `isCorporateEmail` with the version above; keep the `FREE_EMAIL_DOMAINS` set as-is.)

- [ ] **Step 4: Run the test — expect pass**

Run: `npx vitest run src/lib/__tests__/corporate-email.test.ts`
Expected: PASS. Also run the existing registration test to confirm the `isCorporateEmail` refactor didn't regress: `npx vitest run src/lib/schemas` (or the file that imports `isCorporateEmail`).

- [ ] **Step 5: Add the Prisma model**

In `prisma/schema.prisma`, add near the other enums:

```prisma
enum BlockedRegistrationKind {
  Domain
  Email
}
```

Add a new model (place it after the `Investor` model):

```prisma
// BlockedRegistration — email domains/addresses barred from self-registration.
// Populated when an investor is greylisted (anti-broker guardrail): corporate
// domains block the whole domain; free-provider addresses block the exact email.
model BlockedRegistration {
  id         String                  @id @default(cuid())
  kind       BlockedRegistrationKind
  value      String // normalized lower-case: domain ("acme.com") or full email
  reason     String?
  investorId String?
  investor   Investor?               @relation(fields: [investorId], references: [id], onDelete: SetNull)
  createdAt  DateTime                @default(now())

  @@unique([kind, value])
  @@index([investorId])
}
```

In the `Investor` model, add the back-relation alongside the other relation fields (e.g. after `stageChanges StageChange[]`):

```prisma
  blockedRegistrations BlockedRegistration[]
```

- [ ] **Step 6: Migrate & generate** (stop the dev server first — Windows DLL lock)

Run: `npx prisma migrate dev --name blocked_registration`
Then: `npx prisma generate`
Expected: migration created and applied; client regenerated with `BlockedRegistration` + `BlockedRegistrationKind`.

- [ ] **Step 7: Block on greylist — modify `greylistInvestor`**

In `src/server/services/investors.ts`, add imports at the top:

```ts
import { emailDomain, isFreeEmailDomain } from "@/lib/corporate-email";
```

Replace the body of `greylistInvestor` with the version below. It loads the primary contact email (fallback: any contact email) and upserts a block inside the same transaction, then extends the Activity note.

```ts
export async function greylistInvestor(id: string, actor: Actor) {
  return prisma.$transaction(async (tx) => {
    const investor = await tx.investor.update({
      where: { id },
      data: { engagementClassification: "Greylisted", onboardingStatus: "Rejected" },
    });

    // Find a contact email to block: prefer the primary contact, else any contact.
    const contact = await tx.person.findFirst({
      where: { investorId: id, email: { not: null } },
      orderBy: { isPrimaryContact: "desc" },
      select: { email: true },
    });

    let blockNote = "Portal access blocked; registration resolved as Rejected.";
    const email = contact?.email?.trim().toLowerCase();
    const domain = email ? emailDomain(email) : null;
    if (email && domain) {
      const block =
        isFreeEmailDomain(domain)
          ? { kind: "Email" as const, value: email }
          : { kind: "Domain" as const, value: domain };
      await tx.blockedRegistration.upsert({
        where: { kind_value: { kind: block.kind, value: block.value } },
        create: { ...block, reason: `Greylisted: ${investor.name}`, investorId: id },
        update: { reason: `Greylisted: ${investor.name}`, investorId: id },
      });
      blockNote +=
        block.kind === "Domain"
          ? ` Domain ${block.value} blocked from re-registration.`
          : ` Email ${block.value} blocked from re-registration.`;
    }

    await tx.activity.create({
      data: {
        type: "Note",
        subject: `Investor greylisted — ${investor.name}`,
        body: blockNote,
        investorId: id,
        createdSource: actorSource(actor),
      },
    });
    return investor;
  });
}
```

> Note: the Prisma composite-unique input key for `@@unique([kind, value])` is `kind_value`.

- [ ] **Step 8: Block on register — modify `register-investor.ts`**

In `src/server/onboarding/register-investor.ts`, add the import:

```ts
import { emailDomain } from "@/lib/corporate-email";
```

Add this exported helper above `registerInvestor`:

```ts
/**
 * True when the email's exact address or its domain has been blocked from
 * self-registration (populated when an investor is greylisted).
 */
export async function isRegistrationBlocked(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  const domain = emailDomain(normalized);
  const hit = await prisma.blockedRegistration.findFirst({
    where: {
      OR: [
        { kind: "Email", value: normalized },
        ...(domain ? [{ kind: "Domain" as const, value: domain }] : []),
      ],
    },
    select: { id: true },
  });
  return hit !== null;
}
```

Then, inside `registerInvestor`, immediately after `const input = registrationSchema.parse(raw);` and BEFORE the existing duplicate-email lookup, add:

```ts
  if (await isRegistrationBlocked(input.email)) {
    throw new RegistrationError(
      "This email domain is not eligible to register. Contact NobleStride if you believe this is an error.",
    );
  }
```

- [ ] **Step 9: Extend the register smoke test**

The existing `src/server/onboarding/__tests__/register-investor.smoke.test.ts` uses a `withDb()` wrapper (skips gracefully when the DB is down), a file-level `UNIQ = smoke-${Date.now()}` token embedded in names for scoped cleanup, a shared `input` object, and an `afterAll` that deletes activities/persons/investors whose name contains `UNIQ`. **Reuse all of that.** Add the import and describe block below, and extend the `afterAll`.

**Key gotcha (do not miss):** a Gmail address cannot be self-registered — `registrationSchema` rejects free-provider emails via `isCorporateEmail` before `registerInvestor` runs. So the free-provider case must create the investor + contact **directly via Prisma**, then greylist, then assert the recorded block row is `kind: "Email"`. Only the corporate-domain case exercises the register-time block.

Add near the top imports:

```ts
import { greylistInvestor } from "@/server/services/investors";
```

Extend the existing `afterAll` body (add this line before the investor delete — `BlockedRegistration.investorId` is `onDelete: SetNull`, so order is not critical, but clean the rows we created):

```ts
    await prisma.blockedRegistration.deleteMany({ where: { reason: { contains: UNIQ } } });
```

Add this describe block:

```ts
describe("registerInvestor — greylist domain block", () => {
  it("blocks re-registration on the whole domain after a corporate-email greylist", async () => {
    const out = await withDb(async () => {
      const domain = `brokers-${UNIQ}.example.com`;
      const first = await registerInvestor({
        ...input,
        fundName: `Broker One ${UNIQ}`,
        email: `jane@${domain}`,
      });
      await greylistInvestor(first.id, { type: "HUMAN" });

      // a DIFFERENT address on the SAME domain is now barred at registration
      await expect(
        registerInvestor({ ...input, fundName: `Broker Two ${UNIQ}`, email: `bob@${domain}` }),
      ).rejects.toThrow(RegistrationError);
      return true;
    });
    if (out === null) return; // DB down — skip
  });

  it("records an exact-email block (not a domain block) when greylisting a free-provider contact", async () => {
    const out = await withDb(async () => {
      const email = `greylist-${UNIQ}@gmail.com`;
      // Gmail can't self-register (schema rejects free providers) — create directly.
      const inv = await prisma.investor.create({
        data: {
          name: `Gmail Broker ${UNIQ}`,
          investorType: "PrivateEquity",
          onboardingStatus: "PendingReview",
          contacts: { create: { firstName: "Gil", email, isPrimaryContact: true } },
        },
      });
      await greylistInvestor(inv.id, { type: "HUMAN" });

      const block = await prisma.blockedRegistration.findFirst({ where: { reason: { contains: UNIQ } } });
      expect(block?.kind).toBe("Email");
      expect(block?.value).toBe(email);
      return true;
    });
    if (out === null) return; // DB down — skip
  });
});
```

> `{ type: "HUMAN" }` is a valid `Actor`. The shared `input` already has valid enum values (`dealSizeBand: "1m-5m"`, `dealType: "Equity"`, etc.), so spreading `...input` keeps registrations valid.

- [ ] **Step 10: Run the onboarding tests — expect pass**

Run: `npx vitest run src/server/onboarding/__tests__/register-investor.smoke.test.ts`
Expected: PASS (all cases, including the two new ones).

- [ ] **Step 11: Verify in the app**

Restart the dev server. Sign in as internal (admin). Greylist an investor that has a corporate contact email (via the investor detail page's Greylist button, or the dashboard card once Task 3 lands). Then open an incognito session, go to `/register`, and try to register with an email on that same domain → expect the rejection message. Register with a different, un-blocked domain → succeeds (lands in PendingReview).

- [ ] **Step 12 (gated): Commit** — only on explicit user go-ahead.

```bash
git add prisma/ src/lib/free-email-domains.ts src/lib/__tests__/free-email-domains.test.ts src/server/services/investors.ts src/server/onboarding/register-investor.ts src/server/onboarding/__tests__/register-investor.smoke.test.ts
git commit -m "feat(onboarding): greylisting blocks the email domain from re-registering"
```

---

## Task 3: Dashboard onboarding alert + sidebar badge

**Files:**
- Modify: `src/server/services/dashboard.ts` (add `pendingOnboardingInvestors()`)
- Create: `src/components/crm/onboarding-queue-card.tsx`
- Modify: `src/app/(crm)/dashboard/page.tsx` (fetch pending list, render card at top)
- Modify: `src/app/(crm)/layout.tsx` (fetch pending count, pass to `<Sidebar />`)
- Modify: `src/components/shell/sidebar.tsx` (accept `pendingReview` prop, render badge on Investors item)
- Test (modify/create): `src/server/services/__tests__/dashboard.test.ts` or a focused new test for `pendingOnboardingInvestors`

**Interfaces:**
- Consumes: existing `OnboardingActions` (`{ investorId }`) from `@/components/crm/onboarding-actions`; existing `onboardingStats()` (returns `{ pendingReview, ... }`) from `@/server/services/dashboard`.
- Produces:
  - `pendingOnboardingInvestors(): Promise<{ id: string; name: string; registeredAt: Date | null; contactName: string | null; contactEmail: string | null }[]>` (newest registration first).
  - `<OnboardingQueueCard investors={PendingOnboardingDTO[]} />` where `PendingOnboardingDTO = { id, name, registeredAt: string | null, contactName: string | null, contactEmail: string | null }`.
  - `Sidebar` gains optional prop `pendingReview?: number`; `NavItem` gains optional `badge?: number`.

- [ ] **Step 1: Add `pendingOnboardingInvestors()` service (test first)**

Look at `src/server/services/dashboard.ts` for the `onboardingStats()` implementation to match query style. Add a focused test (create `src/server/services/__tests__/onboarding-queue.test.ts`, following the DB-reset pattern used by existing service tests):

```ts
import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/db";
import { pendingOnboardingInvestors } from "@/server/services/dashboard";

describe("pendingOnboardingInvestors", () => {
  it("returns only PendingReview investors with their primary contact", async () => {
    const inv = await prisma.investor.create({
      data: {
        name: "Pending Fund", investorType: "PrivateEquity",
        onboardingStatus: "PendingReview", registeredAt: new Date(),
        contacts: { create: { firstName: "Pat", lastName: "Lee", email: "pat@pendingfund.com", isPrimaryContact: true } },
      },
    });
    const rows = await pendingOnboardingInvestors();
    const row = rows.find((r) => r.id === inv.id);
    expect(row).toBeTruthy();
    expect(row!.contactEmail).toBe("pat@pendingfund.com");
    expect(row!.name).toBe("Pending Fund");
    // cleanup
    await prisma.investor.delete({ where: { id: inv.id } });
  });
});
```

- [ ] **Step 2: Run — expect failure (function missing)**

Run: `npx vitest run src/server/services/__tests__/onboarding-queue.test.ts`
Expected: FAIL (no export `pendingOnboardingInvestors`).

- [ ] **Step 3: Implement `pendingOnboardingInvestors()`**

Add to `src/server/services/dashboard.ts`:

```ts
/**
 * Investors awaiting onboarding review, newest registration first, with their
 * primary contact (name + email). Drives the dashboard onboarding alert card.
 */
export async function pendingOnboardingInvestors() {
  const investors = await prisma.investor.findMany({
    where: { onboardingStatus: "PendingReview" },
    orderBy: [{ registeredAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      registeredAt: true,
      contacts: {
        where: { email: { not: null } },
        orderBy: { isPrimaryContact: "desc" },
        take: 1,
        select: { firstName: true, lastName: true, email: true },
      },
    },
  });

  return investors.map((inv) => {
    const c = inv.contacts[0];
    return {
      id: inv.id,
      name: inv.name,
      registeredAt: inv.registeredAt,
      contactName: c ? [c.firstName, c.lastName].filter(Boolean).join(" ") || null : null,
      contactEmail: c?.email ?? null,
    };
  });
}
```

- [ ] **Step 4: Run — expect pass**

Run: `npx vitest run src/server/services/__tests__/onboarding-queue.test.ts`
Expected: PASS.

- [ ] **Step 5: Build `OnboardingQueueCard`**

Create `src/components/crm/onboarding-queue-card.tsx` (server-compatible; the actions inside are the existing client component):

```tsx
// onboarding-queue-card.tsx — top-of-dashboard alert for investors awaiting
// onboarding review. Inline Approve/Decline/Greylist per row (reuses
// OnboardingActions) + a "View list" link to the shared review-queue page.
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { OnboardingActions } from "@/components/crm/onboarding-actions";

export interface PendingOnboardingDTO {
  id: string;
  name: string;
  registeredAt: string | null;
  contactName: string | null;
  contactEmail: string | null;
}

const MAX_ROWS = 5;

export function OnboardingQueueCard({ investors }: { investors: PendingOnboardingDTO[] }) {
  if (investors.length === 0) return null;
  const shown = investors.slice(0, MAX_ROWS);
  const extra = investors.length - shown.length;

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100">
            <UserPlus className="h-4 w-4 text-amber-700" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-amber-900">
              {investors.length} investor registration{investors.length === 1 ? "" : "s"} awaiting review
            </h2>
            <p className="text-xs text-amber-700">Approve, decline, or greylist — or open the full queue.</p>
          </div>
        </div>
        <Link
          href="/investors?onboarding=PendingReview"
          className="shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-100"
        >
          View list →
        </Link>
      </div>

      <ul className="mt-4 divide-y divide-amber-200/70">
        {shown.map((inv) => (
          <li key={inv.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <Link href={`/investors/${inv.id}`} className="text-sm font-medium text-zinc-900 hover:text-accent">
                {inv.name}
              </Link>
              <p className="truncate text-xs text-zinc-500">
                {inv.contactName ? `${inv.contactName} · ` : ""}
                {inv.contactEmail ?? "no contact email"}
              </p>
            </div>
            <OnboardingActions investorId={inv.id} />
          </li>
        ))}
      </ul>

      {extra > 0 && (
        <Link href="/investors?onboarding=PendingReview" className="mt-1 inline-block text-xs font-medium text-amber-800 hover:underline">
          +{extra} more — view list →
        </Link>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Render the card at the top of the dashboard**

In `src/app/(crm)/dashboard/page.tsx`:
1. Add import: `import { OnboardingQueueCard } from "@/components/crm/onboarding-queue-card";` and add `pendingOnboardingInvestors` to the existing `@/server/services/dashboard` import list.
2. Add `pendingOnboardingInvestors()` to the `Promise.all([...])` and destructure it (e.g. `pendingOnboarding`).
3. Map to DTOs and render the card as the FIRST child inside the top-level `<div className="space-y-6">`, before the page header `Reveal`:

```tsx
      <OnboardingQueueCard
        investors={pendingOnboarding.map((p) => ({
          id: p.id,
          name: p.name,
          registeredAt: p.registeredAt ? p.registeredAt.toISOString() : null,
          contactName: p.contactName,
          contactEmail: p.contactEmail,
        }))}
      />
```

(The card returns `null` when empty, so it's inert with no pending registrations.)

- [ ] **Step 7: Add the badge prop to the sidebar**

In `src/components/shell/sidebar.tsx`:
1. Extend `NavItemProps` with `badge?: number;` and render it inside `NavItem` after the `{label}` (right-aligned pill), reusing the emerald badge style:

```tsx
      {label}
      {badge ? (
        <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold leading-none text-white">
          {badge}
        </span>
      ) : null}
```

2. Change `export function Sidebar()` to `export function Sidebar({ pendingReview = 0 }: { pendingReview?: number })`.
3. Where the nav maps `MAIN_NAV`, pass a badge for the Investors item:

```tsx
          {MAIN_NAV.map(({ href, label, Icon }) => (
            <NavItem
              key={href}
              href={href}
              label={label}
              Icon={Icon}
              active={isActive(href)}
              badge={href === "/investors" ? pendingReview : undefined}
            />
          ))}
```

- [ ] **Step 8: Feed the count from the layout**

In `src/app/(crm)/layout.tsx`, add `pendingReview` to the parallel fetch (reuse the enum filter directly to avoid pulling the whole stats object):

```ts
  const [investors, partners, users, pendingReview] = await Promise.all([
    prisma.investor.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.partner.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.investor.count({ where: { onboardingStatus: "PendingReview" } }),
  ]);
```

Then render `<Sidebar pendingReview={pendingReview} />`.

- [ ] **Step 9: Typecheck & lint**

Run: `npx tsc --noEmit` and `npm run lint`
Expected: clean for the touched files.

- [ ] **Step 10: Verify in the app**

With the dev server running and seed data that leaves ≥1 `PendingReview` investor (the register flow or seed produces these): open `/dashboard` → the amber card is the first thing at the top, listing pending funds with Approve/Decline/Greylist and a "View list →" link. Click "View list →" → lands on `/investors?onboarding=PendingReview`. Approve one → row disappears and the count drops after refresh. Confirm the sidebar "Investors" item shows the pending count badge, and it decreases/clears as you clear the queue. Greylist one and confirm (Task 2) the domain gets blocked.

- [ ] **Step 11 (gated): Commit** — only on explicit user go-ahead.

```bash
git add src/server/services/dashboard.ts src/server/services/__tests__/onboarding-queue.test.ts src/components/crm/onboarding-queue-card.tsx "src/app/(crm)/dashboard/page.tsx" "src/app/(crm)/layout.tsx" src/components/shell/sidebar.tsx
git commit -m "feat(dashboard): top onboarding alert with inline actions + sidebar badge"
```

---

## Task 4: Engagement "By Deal" / "By Investor" focal views

**Files:**
- Create: `src/lib/engagement-stage-colors.ts` (shared stage→color map + ordered stage list)
- Modify: `src/server/services/engagements.ts` (add `engagementsByInvestor()` and a `stageCounts` helper)
- Create: `src/components/crm/focal-pipeline-board.tsx` (shared grouped board)
- Modify: `src/app/(crm)/engagement/page.tsx` (replace board markup with a redirect to `/engagement/deals`)
- Create: `src/app/(crm)/engagement/deals/page.tsx`
- Create: `src/app/(crm)/engagement/investors/page.tsx`
- Modify: `src/components/shell/sidebar.tsx` (Engagement becomes an expandable parent with By Deal / By Investor children)
- Test (create): `src/server/services/__tests__/engagements-by-investor.test.ts`

**Interfaces:**
- Consumes: existing `engagementsByDeal()`, `LABELS`, `label` from `@/lib/vocab`, `Chip`/`Badge` from `@/components/ui`. From Task 3, `Sidebar` already accepts `pendingReview` — preserve that prop.
- Produces:
  - `engagement-stage-colors.ts` → `ENGAGEMENT_STAGES: string[]` (12, vocab order); `stageBarColor(stage: string): string` (Tailwind `bg-*` class); `stageColorSwatch(stage: string): string` (same, for legend dot).
  - `engagements.ts` → `engagementsByInvestor()` (investors with ≥1 engagement, each with their engagements incl. `transaction`); `stageCountsFor(engagements: {engagementStage: string}[]): {stage,label,count}[]` (only count>0, vocab order).
  - `<FocalPipelineBoard groups={FocalGroupDTO[]} />` where
    `FocalGroupDTO = { id, name, href, countLabel, stageCounts: {stage: string, label: string, count: number}[], items: {id: string, counterpartName: string, counterpartHref: string, stage: string, stageLabel: string, interestLevel: string | null}[] }`.

- [ ] **Step 1: Add the shared stage-color module**

Create `src/lib/engagement-stage-colors.ts` (mirrors the 12-stage order + palette already in `engagement-stage-board.tsx`):

```ts
// engagement-stage-colors.ts — single source of truth for engagement-stage
// ordering and colors, shared by the focal boards' distribution bars/legends.
import { LABELS } from "@/lib/vocab";

export const ENGAGEMENT_STAGES: string[] = Object.keys(LABELS.EngagementStage);

// Solid bg-* per stage, in vocab order (Shared → … → Declined).
const STAGE_BG: Record<string, string> = {
  Shared: "bg-slate-400",
  TeaserSent: "bg-sky-400",
  NDASigned: "bg-sky-500",
  IMShared: "bg-violet-400",
  VDRAccess: "bg-violet-500",
  Meeting: "bg-amber-400",
  InfoRequest: "bg-amber-500",
  DueDiligence: "bg-orange-500",
  TermSheet: "bg-emerald-400",
  Offer: "bg-emerald-500",
  Invested: "bg-emerald-600",
  Declined: "bg-rose-500",
};

export function stageBarColor(stage: string): string {
  return STAGE_BG[stage] ?? "bg-zinc-300";
}

export function stageColorSwatch(stage: string): string {
  return stageBarColor(stage);
}
```

- [ ] **Step 2: Add `engagementsByInvestor()` + `stageCountsFor()` (test first)**

Create `src/server/services/__tests__/engagements-by-investor.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { stageCountsFor } from "@/server/services/engagements";

describe("stageCountsFor", () => {
  it("counts by stage in vocab order, omitting zero-count stages", () => {
    const rows = [
      { engagementStage: "NDASigned" },
      { engagementStage: "NDASigned" },
      { engagementStage: "TeaserSent" },
    ];
    const counts = stageCountsFor(rows);
    expect(counts).toEqual([
      { stage: "TeaserSent", label: expect.any(String), count: 1 },
      { stage: "NDASigned", label: expect.any(String), count: 2 },
    ]);
  });
});
```

- [ ] **Step 3: Run — expect failure**

Run: `npx vitest run src/server/services/__tests__/engagements-by-investor.test.ts`
Expected: FAIL (no export `stageCountsFor`).

- [ ] **Step 4: Implement the service additions**

In `src/server/services/engagements.ts` add (reuse the existing `LABELS`/`label` imports already at the top of the file):

```ts
/**
 * Per-stage counts for a set of engagements, in vocab order, omitting stages
 * with zero engagements. Shared by the focal (By Deal / By Investor) boards.
 */
export function stageCountsFor(engagements: { engagementStage: string }[]) {
  const counts = new Map<string, number>();
  for (const e of engagements) counts.set(e.engagementStage, (counts.get(e.engagementStage) ?? 0) + 1);
  return Object.keys(LABELS.EngagementStage)
    .filter((stage) => (counts.get(stage) ?? 0) > 0)
    .map((stage) => ({ stage, label: label("EngagementStage", stage), count: counts.get(stage)! }));
}

/**
 * Every investor that has at least one engagement, each with its engagements
 * (transaction included), investors ordered by name. Mirror of
 * engagementsByDeal() with the focal entity flipped.
 */
export async function engagementsByInvestor() {
  const investors = await prisma.investor.findMany({
    where: { engagements: { some: {} } },
    orderBy: { name: "asc" },
    include: { engagements: { include: { transaction: true } } },
  });
  return investors.map((investor) => ({ investor, engagements: investor.engagements }));
}
```

- [ ] **Step 5: Run — expect pass**

Run: `npx vitest run src/server/services/__tests__/engagements-by-investor.test.ts`
Expected: PASS.

- [ ] **Step 6: Build `FocalPipelineBoard`**

Create `src/components/crm/focal-pipeline-board.tsx`:

```tsx
// focal-pipeline-board.tsx — grouped engagement board used by both the
// By-Deal and By-Investor views. Each group is a native <details> row: the
// summary shows the focal name, a count, a stacked stage-distribution bar and
// stage pills; expanding reveals the individual engagements. Server-compatible.
import Link from "next/link";
import { Chip } from "@/components/ui";
import { stageBarColor } from "@/lib/engagement-stage-colors";

export interface FocalGroupItemDTO {
  id: string;
  counterpartName: string;
  counterpartHref: string;
  stage: string;
  stageLabel: string;
  interestLevel: string | null;
}
export interface FocalGroupDTO {
  id: string;
  name: string;
  href: string;
  countLabel: string;
  stageCounts: { stage: string; label: string; count: number }[];
  items: FocalGroupItemDTO[];
}

function StageBar({ stageCounts, total }: { stageCounts: FocalGroupDTO["stageCounts"]; total: number }) {
  if (total === 0) return null;
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-zinc-100">
      {stageCounts.map((s) => (
        <div
          key={s.stage}
          className={stageBarColor(s.stage)}
          style={{ width: `${(s.count / total) * 100}%` }}
          title={`${s.label}: ${s.count}`}
        />
      ))}
    </div>
  );
}

export function FocalPipelineBoard({ groups }: { groups: FocalGroupDTO[] }) {
  if (groups.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200/80 bg-white px-5 py-12 text-center text-zinc-500 shadow-sm">
        No engagements recorded yet.
      </div>
    );
  }
  return (
    <div className="space-y-2.5">
      {groups.map((g) => {
        const total = g.items.length;
        return (
          <details key={g.id} className="group rounded-xl border border-zinc-200/80 bg-white shadow-sm">
            <summary className="flex cursor-pointer list-none items-center gap-4 px-4 py-3 [&::-webkit-details-marker]:hidden">
              <span className="w-4 shrink-0 text-zinc-400 transition-transform group-open:rotate-90">▸</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <Link
                    href={g.href}
                    className="min-w-0 truncate text-sm font-semibold text-zinc-900 hover:text-accent"
                    title={g.name}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {g.name}
                  </Link>
                  <span className="shrink-0 text-xs font-medium text-zinc-500">{g.countLabel}</span>
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <StageBar stageCounts={g.stageCounts} total={total} />
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {g.stageCounts.map((s) => (
                    <span key={s.stage} className="inline-flex items-center gap-1.5 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-600">
                      <span className={`h-2 w-2 rounded-full ${stageBarColor(s.stage)}`} />
                      {s.label}·{s.count}
                    </span>
                  ))}
                </div>
              </div>
            </summary>

            <ul className="divide-y divide-zinc-100 border-t border-zinc-100">
              {g.items.map((it) => (
                <li key={it.id} className="flex items-center justify-between gap-3 px-4 py-2.5 pl-12">
                  <Link href={it.counterpartHref} className="min-w-0 truncate text-sm text-zinc-800 hover:text-accent" title={it.counterpartName}>
                    {it.counterpartName}
                  </Link>
                  <div className="flex shrink-0 items-center gap-2">
                    {it.interestLevel && <Chip value={it.interestLevel} group="InterestLevel" />}
                    <Chip value={it.stage} group="EngagementStage" />
                    <Link href={`/engagement/${it.id}`} className="text-xs font-medium text-accent hover:underline">
                      Open →
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </details>
        );
      })}
    </div>
  );
}
```

> Note: `summary` is a server-rendered element; the `onClick={(e) => e.stopPropagation()}` on the inner `Link` keeps clicking the name from toggling the `<details>`. If lint flags an event handler in a server component, add `"use client"` at the top of this file (it has no server-only deps, so that's safe) — prefer client only if the handler triggers the error.

- [ ] **Step 7: Legend helper (inline in pages)**

Both pages render a small legend above the board. Define it inline in each page (or as a tiny local component) using `ENGAGEMENT_STAGES` + `stageColorSwatch` + `label("EngagementStage", s)`. Example row:

```tsx
<div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-zinc-500">
  {ENGAGEMENT_STAGES.map((s) => (
    <span key={s} className="inline-flex items-center gap-1">
      <span className={`h-2 w-2 rounded-full ${stageColorSwatch(s)}`} />
      {label("EngagementStage", s)}
    </span>
  ))}
</div>
```

- [ ] **Step 8: Create `/engagement/deals` page**

Create `src/app/(crm)/engagement/deals/page.tsx`. It ports the old page's counters + disbursements + timeline and adds the By-Deal focal board. Base it on the OLD `src/app/(crm)/engagement/page.tsx` (read it before deleting in Step 10) — keep every fetch/markup it had EXCEPT the `EngagementStageBoard`, which is replaced by `<FocalPipelineBoard>`.

Key differences from the old page:
- Drop `engagementsByStage` import/usage for the board; instead use `engagementsByDeal()` + `stageCountsFor`.
- Keep `engagementCounters`, `listDisbursements`, `disbursementByPeriod`, `activityTimeline`, `listTransactions`, `listInvestors`, `relationOptions`, and all the disbursement/timeline markup verbatim.
- The "Deals Rejected" counter (previously from `engagementsByStage`) → compute from the by-deal data: sum of `Declined` across all deals, or keep a small `engagementsByStage` call ONLY for that counter. Simplest: keep `engagementsByStage()` in the fetch list solely to derive `declinedCount` (it's one query, already the old behaviour).

Board construction:

```tsx
import { engagementsByDeal, stageCountsFor } from "@/server/services/engagements";
import { FocalPipelineBoard } from "@/components/crm/focal-pipeline-board";
import type { FocalGroupDTO } from "@/components/crm/focal-pipeline-board";
import { ENGAGEMENT_STAGES, stageColorSwatch } from "@/lib/engagement-stage-colors";
// ...within the component, after fetching byDeal = await engagementsByDeal():
const dealGroups: FocalGroupDTO[] = byDeal.map(({ transaction, engagements }) => ({
  id: transaction.id,
  name: transaction.name,
  href: `/transactions/${transaction.id}`,
  countLabel: `${engagements.length} investor${engagements.length === 1 ? "" : "s"}`,
  stageCounts: stageCountsFor(engagements),
  items: engagements.map((e) => ({
    id: e.id,
    counterpartName: e.investor.name,
    counterpartHref: `/investors/${e.investorId}`,
    stage: e.engagementStage,
    stageLabel: e.engagementStage,
    interestLevel: e.interestLevel,
  })),
}));
```

Page layout (top → bottom): header (`<h1>Engagement — By Deal</h1>` + subheading + RBAC-gated `LogEngagementDialog`), the 7-tile counters strip (verbatim from old page), the legend row (Step 7), `<FocalPipelineBoard groups={dealGroups} />`, then the Disbursements section + `DisbursementPeriodSummary` + `ActivityTimeline` (verbatim from old page).

- [ ] **Step 9: Create `/engagement/investors` page**

Create `src/app/(crm)/engagement/investors/page.tsx`. Lighter: header + counters strip + legend + board only.

```tsx
import { engagementCounters } from "@/server/services/activities";
import { engagementsByInvestor, stageCountsFor } from "@/server/services/engagements";
import { listTransactions } from "@/server/services/transactions";
import { listInvestors } from "@/server/services/investors";
import { FocalPipelineBoard } from "@/components/crm/focal-pipeline-board";
import type { FocalGroupDTO } from "@/components/crm/focal-pipeline-board";
import { StatCard } from "@/components/ui";
import { LogEngagementDialog } from "@/components/crm/log-engagement-dialog";
import { ENGAGEMENT_STAGES, stageColorSwatch } from "@/lib/engagement-stage-colors";
import { label } from "@/lib/vocab";
import { getOrgLens } from "@/server/rbac/context";
import { can } from "@/server/rbac/matrix";

export default async function EngagementByInvestorPage() {
  const lens = await getOrgLens();
  const [counters, byInvestor, transactions, investors] = await Promise.all([
    engagementCounters(),
    engagementsByInvestor(),
    listTransactions(),
    listInvestors({}),
  ]);

  const groups: FocalGroupDTO[] = byInvestor.map(({ investor, engagements }) => ({
    id: investor.id,
    name: investor.name,
    href: `/investors/${investor.id}`,
    countLabel: `${engagements.length} deal${engagements.length === 1 ? "" : "s"}`,
    stageCounts: stageCountsFor(engagements),
    items: engagements.map((e) => ({
      id: e.id,
      counterpartName: e.transaction.name,
      counterpartHref: `/transactions/${e.transactionId}`,
      stage: e.engagementStage,
      stageLabel: e.engagementStage,
      interestLevel: e.interestLevel,
    })),
  }));

  const txnOptions = transactions.map((t) => ({ value: t.id, label: t.name }));
  const invOptions = investors.map((i) => ({ value: i.id, label: i.name }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Engagement — By Investor</h1>
          <p className="mt-1 text-sm text-zinc-500">Each investor and the deals they&apos;re engaged on, by pipeline stage</p>
        </div>
        {can(lens.orgRole, "Engagements", "C") && (
          <LogEngagementDialog transactions={txnOptions} investors={invOptions} />
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Outreach" value={String(counters.outreach)} />
        <StatCard label="NDA Signed" value={String(counters.ndaSigned)} />
        <StatCard label="Data Room" value={String(counters.dataRoom)} />
        <StatCard label="Meetings" value={String(counters.meetings)} />
        <StatCard label="Feedback" value={String(counters.feedback)} />
        <StatCard label="Term Sheets" value={String(counters.termSheets)} />
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-zinc-500">
        {ENGAGEMENT_STAGES.map((s) => (
          <span key={s} className="inline-flex items-center gap-1">
            <span className={`h-2 w-2 rounded-full ${stageColorSwatch(s)}`} />
            {label("EngagementStage", s)}
          </span>
        ))}
      </div>

      <FocalPipelineBoard groups={groups} />
    </div>
  );
}
```

> Confirm `engagementCounters` field names (`outreach`, `ndaSigned`, `dataRoom`, `meetings`, `feedback`, `termSheets`) against the old page — they were used identically there.

- [ ] **Step 10: Replace the old `/engagement` page with a redirect**

Overwrite `src/app/(crm)/engagement/page.tsx` (after copying its markup into the deals page in Step 8):

```tsx
// engagement/page.tsx — the flat all-together board was replaced by the two
// focal views (By Deal / By Investor). Land on the default focal view.
import { redirect } from "next/navigation";

export default function EngagementPage() {
  redirect("/engagement/deals");
}
```

- [ ] **Step 11: Make the sidebar Engagement item expandable**

In `src/components/shell/sidebar.tsx`:
1. Add `ChevronDown` (or reuse an existing chevron) to the lucide import.
2. Add a small client sub-component that renders the Engagement parent + its two children, with local open state defaulting to open when the path is under `/engagement`. Replace the Engagement entry in the `MAIN_NAV.map` render with this expandable group. Concretely, split the nav render so all items render normally EXCEPT `/engagement`, which renders an `EngagementNavGroup`:

```tsx
function EngagementNavGroup({ active }: { active: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(active);
  const childActive = (href: string) => pathname === href;
  return (
    <div>
      <div className="flex items-center">
        <Link
          href="/engagement"
          className={cn(
            "relative flex flex-1 items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
            active ? "bg-white/10 font-medium" : "hover:bg-white/5",
          )}
          style={{ color: active ? "#ffffff" : SIDEBAR_FG }}
        >
          {active && <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-emerald-400" />}
          <MessageSquare className="h-4 w-4 flex-shrink-0" style={{ color: active ? "#34d399" : SIDEBAR_FG }} />
          Engagement
        </Link>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle engagement views"
          className="ml-1 flex h-7 w-7 items-center justify-center rounded-md hover:bg-white/5"
          style={{ color: SIDEBAR_FG }}
        >
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open ? "" : "-rotate-90")} />
        </button>
      </div>
      {open && (
        <div className="ml-9 mt-0.5 flex flex-col gap-0.5">
          {[
            { href: "/engagement/deals", label: "By Deal" },
            { href: "/engagement/investors", label: "By Investor" },
          ].map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm transition-colors",
                childActive(c.href) ? "bg-white/10 font-medium text-white" : "hover:bg-white/5",
              )}
              style={{ color: childActive(c.href) ? "#ffffff" : SIDEBAR_FG }}
            >
              {c.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
```

3. In the `MAIN_NAV.map`, special-case Engagement:

```tsx
          {MAIN_NAV.map(({ href, label, Icon }) =>
            href === "/engagement" ? (
              <EngagementNavGroup key={href} active={isActive(href)} />
            ) : (
              <NavItem
                key={href}
                href={href}
                label={label}
                Icon={Icon}
                active={isActive(href)}
                badge={href === "/investors" ? pendingReview : undefined}
              />
            ),
          )}
```

4. Ensure `useState` is imported from `react`. Keep the `pendingReview` prop from Task 3 intact.

- [ ] **Step 12: Typecheck & lint**

Run: `npx tsc --noEmit` and `npm run lint`
Expected: clean for touched files.

- [ ] **Step 13: Verify in the app**

With the dev server running: click "Engagement" in the sidebar → it expands to "By Deal" and "By Investor", and navigates to `/engagement/deals`. On **By Deal**: counters strip on top; one expandable row per deal showing "N investors", a colored stage bar + stage pills; expanding lists the investors with stage chips and "Open →"; disbursements table + timeline appear below. On **By Investor** (`/engagement/investors`): one row per investor showing "N deals" + stage bar; expand lists the deals. Confirm the old flat 12-stage board is gone and visiting `/engagement` redirects to `/engagement/deals`. Confirm the Investors badge (Task 3) still renders.

- [ ] **Step 14 (gated): Commit** — only on explicit user go-ahead.

```bash
git add src/lib/engagement-stage-colors.ts src/server/services/engagements.ts src/server/services/__tests__/engagements-by-investor.test.ts src/components/crm/focal-pipeline-board.tsx "src/app/(crm)/engagement" src/components/shell/sidebar.tsx
git commit -m "feat(engagement): replace flat board with By Deal / By Investor focal views"
```

---

## Self-review notes (author)

- **Spec coverage:** Task 1↔spec Task 4 (landing); Task 2↔spec Task 3 (domain block); Task 3↔spec Task 2 (dashboard alert + badge); Task 4↔spec Task 1 (engagement views, replace + preserve counters/disbursements/timeline). All four spec sections have a task.
- **Shared file (`sidebar.tsx`):** touched by Task 3 (badge prop) then Task 4 (expandable Engagement). Sequenced 3→4 so the badge prop already exists when Task 4 edits the same file. Both edits are called out explicitly.
- **Type consistency:** `FocalGroupDTO`/`FocalGroupItemDTO` used identically in the component and both pages; `PendingOnboardingDTO` matches the card prop; `pendingReview` prop name consistent across layout/sidebar; `stageCountsFor` shape `{stage,label,count}` consistent across service, component, and pages.
- **Verification:** each task ends with an in-app check, not just tests — the landing page and engagement views are primarily visual, so they lean on the running app; the greylist/register logic and services carry unit tests.
```
