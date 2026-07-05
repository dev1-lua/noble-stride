# Investor Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Public investor registration with demo 2FA, a pending→approval gate, Open/Closed NDA recording with VDR gating, teaser anonymization, and full admin-dashboard mapping — per `docs/superpowers/specs/2026-07-05-investor-onboarding-design.md`.

**Architecture:** Registration creates an `Investor` row in `PendingReview` (Approach: extend Investor — no separate registration model). The existing visibility engine (`src/server/visibility/`) stays the single gating authority: pending/rejected → tier `NONE`; VDR documents additionally require the correct NDA (Open = all deals, Closed = that one deal). NDAs are recorded manually by the team; a service-level guard blocks NDA-requiring stage changes without one. Admin surfaces everything (queue, panels, dashboard stats).

**Tech Stack:** Next.js 16 App Router (RSC + server actions), Prisma 6 (Postgres), Pothos GraphQL + urql (admin mutations), Zod v4, Tailwind v4, Vitest.

## Global Constraints

- App root is `noblestride-crm/` inside the repo. All paths below are relative to `noblestride-crm/` unless prefixed with `repo:`.
- Run all commands from `D:\LuaWork\NobleStride\noble-stride\noblestride-crm` (PowerShell: `cd noblestride-crm` first).
- Additive schema changes only — never rename/remove existing fields, enums, or models.
- Follow existing conventions exactly: PascalCase enums, vocab labels in `src/lib/vocab.ts`, services as the only Prisma access for writes, portal pages read ONLY via `src/server/visibility`, portal identity ONLY from the `ns_viewpoint` cookie server-side.
- Guardrails (SOW §06, non-negotiable): no automatic NDA signing; no VDR access without internal approval AND the correct signed NDA; greylisted/excluded/pending investors see nothing.
- Demo 2FA: static OTP `000000`, clearly labeled demo in the UI. It must NOT be presented as real security.
- Dev environment quirks (repo:memory + prior plan): dev server usually already running on :3000 — `prisma generate`/`migrate` fail with EPERM while it runs (query-engine DLL lock). Stop it for Task 1, restart after. `src/generated/pothos-types.ts` regenerates with a machine-absolute path — do NOT commit that churn (`git checkout -- src/generated/pothos-types.ts` if only the path line changed... it will also gain the new enum; commit the enum change but check the diff). Pre-existing lint failures in `clients-table.tsx`, `count-up.tsx`, `prisma/seed.ts`, `investors-crud.smoke.test.ts` are NOT ours — do not fix, do not worry.
- Commit after every task (small commits within a task are fine). Message style: `feat(onboarding): …` / `test(onboarding): …`.
- Tests: `npx vitest run <file>` for one file, `npm run test` for the suite. Some existing tests hit the local Postgres (docker-compose) — it must be up.

---

### Task 1: Schema migration, vocab, Zod schema, filters

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/lib/vocab.ts`
- Modify: `src/lib/schemas/investor.ts`
- Modify: `src/server/domain/types.ts` (InvestorFilter)
- Modify: `src/server/domain/filters.ts` (buildInvestorWhere)
- Test: `src/lib/__tests__/schemas.test.ts` (extend), `src/server/domain/__tests__/filters.test.ts` (extend if exists — check with Glob; if no filters test exists, add assertions to whichever test file covers `buildInvestorWhere`, or create `src/server/domain/__tests__/filters-onboarding.test.ts`)

**Interfaces:**
- Produces: Prisma enum `OnboardingStatus { PendingReview, Approved, Rejected }`; `Investor.onboardingStatus/emailVerifiedAt/phoneVerifiedAt/registeredAt/openNdaSignedAt`; `Engagement.ndaSignedAt`; vocab group `"OnboardingStatus"`; `investorCreateSchema` accepts the new fields; `InvestorFilter.onboardingStatus?: OnboardingStatus`.

- [ ] **Step 1: Add the enum + fields to `prisma/schema.prisma`**

Add after the `InvestorNdaStatus` enum block:

```prisma
enum OnboardingStatus {
  PendingReview
  Approved
  Rejected
}
```

In `model Investor`, after the `ndaStatus` line, add:

```prisma
  // Investor onboarding (design spec 2026-07-05): approval gate + demo-OTP stamps + open-NDA record
  onboardingStatus         OnboardingStatus                 @default(Approved)
  emailVerifiedAt          DateTime?
  phoneVerifiedAt          DateTime?
  registeredAt             DateTime?
  openNdaSignedAt          DateTime?
```

Add `@@index([onboardingStatus])` next to the existing Investor indexes.

In `model Engagement`, after the `ndaType` line, add:

```prisma
  ndaSignedAt        DateTime?
```

- [ ] **Step 2: Stop the dev server, run the migration, restart**

The dev server holds the Prisma query-engine DLL (EPERM otherwise). Find and stop it (it is a demo dev server — safe to restart):

```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -Confirm:$false }
npx prisma migrate dev --name investor_onboarding_nda
```

Expected: new folder under `prisma/migrations/*_investor_onboarding_nda`, `prisma generate` succeeds. Then restart the dev server in the background: `npm run dev` (run_in_background). Verify `http://localhost:3000/dashboard` responds.

Note: `src/generated/pothos-types.ts` will regenerate. Commit the content changes (new enum/fields) but sanity-check the diff for the machine-absolute path churn noted in Global Constraints.

- [ ] **Step 3: Vocab labels + status colors**

In `src/lib/vocab.ts`, add to `LABELS` (next to `InvestorNdaStatus`):

```ts
  OnboardingStatus: { PendingReview: "Pending Review", Approved: "Approved", Rejected: "Rejected" },
```

Add to `STATUS_DOT`:

```ts
  // OnboardingStatus
  PendingReview: "bg-amber-500",
  Rejected: "bg-rose-500",
```

(`Approved` intentionally reuses the existing `Approved: "bg-emerald-500"` key already present for DocumentStatus.)

- [ ] **Step 4: Zod schema**

In `src/lib/schemas/investor.ts`, import `OnboardingStatus` from `@prisma/client` and add to `investorCreateSchema` (after `ndaStatus`):

```ts
  onboardingStatus: z.nativeEnum(OnboardingStatus).optional(),
  emailVerifiedAt: z.date().optional(),
  phoneVerifiedAt: z.date().optional(),
  registeredAt: z.date().optional(),
  openNdaSignedAt: z.date().optional(),
```

- [ ] **Step 5: Filter plumbing**

In `src/server/domain/types.ts`, add `onboardingStatus?: OnboardingStatus;` to `InvestorFilter` (import the type). In `src/server/domain/filters.ts` → `buildInvestorWhere`, add:

```ts
  if (filter.onboardingStatus) where.onboardingStatus = filter.onboardingStatus;
```

(Read the file first and match its exact construction style — it may build the object differently.)

- [ ] **Step 6: Write/extend tests**

In `src/lib/__tests__/schemas.test.ts` add:

```ts
it("investor schema accepts onboarding fields", () => {
  const parsed = investorCreateSchema.parse({
    name: "Fund X",
    investorType: "PrivateEquity",
    onboardingStatus: "PendingReview",
    registeredAt: new Date("2026-07-05"),
  });
  expect(parsed.onboardingStatus).toBe("PendingReview");
});
```

Add a `buildInvestorWhere` assertion (in the existing filters test file, or a new one):

```ts
it("filters by onboardingStatus", () => {
  expect(buildInvestorWhere({ onboardingStatus: "PendingReview" })).toMatchObject({
    onboardingStatus: "PendingReview",
  });
});
```

- [ ] **Step 7: Run tests**

Run: `npx vitest run src/lib/__tests__/schemas.test.ts` (and the filters test file). Expected: PASS. Also run `npm run test` — expect no regressions beyond pre-existing known failures.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(onboarding): OnboardingStatus enum + investor/engagement onboarding & NDA fields"
```

---

### Task 2: Corporate-email validator, ticket bands, registration schema (pure, TDD)

**Files:**
- Create: `src/lib/corporate-email.ts`
- Create: `src/lib/ticket-bands.ts`
- Create: `src/lib/schemas/registration.ts`
- Test: `src/lib/__tests__/corporate-email.test.ts`, `src/lib/__tests__/registration-schema.test.ts`

**Interfaces:**
- Produces: `isCorporateEmail(email: string): boolean`; `TICKET_BANDS: TicketBand[]` + `ticketBand(key: string): TicketBand | undefined` where `TicketBand = { key: string; label: string; min: number; max: number | null }`; `registrationSchema` (Zod) + `type RegistrationInput = z.infer<typeof registrationSchema>` with fields `fundName, contactPerson, email, phone, investorType, sectorPreference, dealType, dealSizeBand`.

- [ ] **Step 1: Write the failing tests**

`src/lib/__tests__/corporate-email.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isCorporateEmail } from "@/lib/corporate-email";

describe("isCorporateEmail", () => {
  it.each([
    "jane@acmecapital.com",
    "evans@noblestride.co.ke",
    "a@fund.vc",
  ])("accepts corporate email %s", (email) => {
    expect(isCorporateEmail(email)).toBe(true);
  });

  it.each([
    "jane@gmail.com",
    "jane@GMAIL.COM",
    "jane@yahoo.com",
    "jane@hotmail.com",
    "jane@outlook.com",
    "jane@icloud.com",
    "jane@protonmail.com",
    "jane@yandex.com",
  ])("rejects free-provider email %s", (email) => {
    expect(isCorporateEmail(email)).toBe(false);
  });

  it("rejects malformed input", () => {
    expect(isCorporateEmail("not-an-email")).toBe(false);
    expect(isCorporateEmail("@gmail.com")).toBe(false);
    expect(isCorporateEmail("a@nodot")).toBe(false);
  });
});
```

`src/lib/__tests__/registration-schema.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { registrationSchema } from "@/lib/schemas/registration";

const valid = {
  fundName: "Acme Capital",
  contactPerson: "Jane Doe",
  email: "jane@acmecapital.com",
  phone: "+254700000000",
  investorType: "PrivateEquity",
  sectorPreference: ["Agribusiness"],
  dealType: "Equity",
  dealSizeBand: "1m-5m",
};

describe("registrationSchema", () => {
  it("parses a complete registration", () => {
    const parsed = registrationSchema.parse(valid);
    expect(parsed.fundName).toBe("Acme Capital");
  });

  it("rejects free-provider emails", () => {
    expect(registrationSchema.safeParse({ ...valid, email: "jane@gmail.com" }).success).toBe(false);
  });

  it("requires every field (all mandatory)", () => {
    for (const key of Object.keys(valid)) {
      const { [key as keyof typeof valid]: _omitted, ...rest } = valid;
      expect(registrationSchema.safeParse(rest).success).toBe(false);
    }
  });

  it("requires at least one sector", () => {
    expect(registrationSchema.safeParse({ ...valid, sectorPreference: [] }).success).toBe(false);
  });

  it("rejects an unknown deal-size band", () => {
    expect(registrationSchema.safeParse({ ...valid, dealSizeBand: "gt50m" }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/corporate-email.test.ts src/lib/__tests__/registration-schema.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the three modules**

`src/lib/corporate-email.ts`:

```ts
// Corporate-email gate for investor registration ("exclude use of Gmail or
// Yahoo emails" — Data-collected-from-potential-investors doc). Blocklist of
// well-known free providers; anything else with a plausible domain passes.

const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com",
  "yahoo.com", "yahoo.co.uk", "ymail.com",
  "hotmail.com", "outlook.com", "live.com", "msn.com",
  "aol.com",
  "icloud.com", "me.com", "mac.com",
  "proton.me", "protonmail.com",
  "gmx.com", "gmx.net",
  "yandex.com", "yandex.ru",
  "mail.com", "zoho.com",
]);

/** True when the email has a domain that is not a known free provider. */
export function isCorporateEmail(email: string): boolean {
  const at = email.lastIndexOf("@");
  if (at < 1 || at === email.length - 1) return false;
  const domain = email.slice(at + 1).trim().toLowerCase();
  if (!domain.includes(".")) return false;
  return !FREE_EMAIL_DOMAINS.has(domain);
}
```

`src/lib/ticket-bands.ts`:

```ts
// Deal-size dropdown bands for investor registration. Bands align with the
// client's own "Template to Collect Investor Preferences" check sizes,
// extended upward for the PE/DFI audience. Selecting a band writes
// Investor.ticketMin/ticketMax.

export interface TicketBand {
  key: string;
  label: string;
  min: number;
  /** null = open-ended upper bound */
  max: number | null;
}

export const TICKET_BANDS: TicketBand[] = [
  { key: "lt100k", label: "Under $100k", min: 0, max: 100_000 },
  { key: "100k-250k", label: "$100k – $250k", min: 100_000, max: 250_000 },
  { key: "250k-500k", label: "$250k – $500k", min: 250_000, max: 500_000 },
  { key: "500k-1m", label: "$500k – $1M", min: 500_000, max: 1_000_000 },
  { key: "1m-5m", label: "$1M – $5M", min: 1_000_000, max: 5_000_000 },
  { key: "gt5m", label: "Over $5M", min: 5_000_000, max: null },
];

export function ticketBand(key: string): TicketBand | undefined {
  return TICKET_BANDS.find((b) => b.key === key);
}
```

`src/lib/schemas/registration.ts`:

```ts
import { z } from "zod";
import { Sector, Instrument, InvestorType } from "@prisma/client";
import { isCorporateEmail } from "@/lib/corporate-email";
import { TICKET_BANDS } from "@/lib/ticket-bands";

const bandKeys = TICKET_BANDS.map((b) => b.key) as [string, ...string[]];

/** Step-1 registration fields — ALL mandatory (design spec §2). */
export const registrationSchema = z.object({
  fundName: z.string().trim().min(1, "Name of the fund is required"),
  contactPerson: z.string().trim().min(1, "Contact person is required"),
  email: z
    .string()
    .trim()
    .email("Enter a valid email address")
    .refine(isCorporateEmail, "Please use your corporate email address — free providers (Gmail, Yahoo, …) are not accepted"),
  phone: z.string().trim().min(7, "Telephone number is required (used for OTP verification)"),
  investorType: z.nativeEnum(InvestorType),
  sectorPreference: z.array(z.nativeEnum(Sector)).min(1, "Select at least one sector"),
  dealType: z.nativeEnum(Instrument),
  dealSizeBand: z.enum(bandKeys),
});

export type RegistrationInput = z.infer<typeof registrationSchema>;
```

Note: `investorType` is a deliberate 7th field beyond the doc's six — the CRM requires it (`Investor.investorType` is non-nullable) and the team would otherwise classify manually. It is flagged in `repo:memory/client-meeting-questions.md` in Task 10.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/corporate-email.test.ts src/lib/__tests__/registration-schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/corporate-email.ts src/lib/ticket-bands.ts src/lib/schemas/registration.ts src/lib/__tests__/corporate-email.test.ts src/lib/__tests__/registration-schema.test.ts
git commit -m "feat(onboarding): corporate-email gate, ticket bands, registration schema"
```

---

### Task 3: Registration core module (testable, DB-backed)

**Files:**
- Create: `src/server/onboarding/register-investor.ts`
- Test: `src/server/onboarding/__tests__/register-investor.smoke.test.ts` (DB-backed — follow the naming/setup pattern of `src/server/__tests__/investors-crud.smoke.test.ts`; read that file first and mirror how it connects/cleans up)

**Interfaces:**
- Consumes: `registrationSchema`/`RegistrationInput` (Task 2), `ticketBand` (Task 2).
- Produces: `registerInvestor(raw: unknown): Promise<Investor>` (creates Investor `PendingReview` + primary-contact Person + Activity, in one transaction; throws `RegistrationError` on duplicate contact email); `confirmRegistrationOtp(investorId: string, emailCode: string, phoneCode: string): Promise<void>`; `DEMO_OTP = "000000"`; `class RegistrationError extends Error`.

- [ ] **Step 1: Write the failing smoke test**

`src/server/onboarding/__tests__/register-investor.smoke.test.ts` (adapt setup/teardown to the existing smoke-test pattern — the assertions below are the contract):

```ts
import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { registerInvestor, confirmRegistrationOtp, DEMO_OTP, RegistrationError } from "@/server/onboarding/register-investor";

const UNIQ = `smoke-${Date.now()}`;
const input = {
  fundName: `Smoke Fund ${UNIQ}`,
  contactPerson: "Ada Lovelace",
  email: `ada@${UNIQ}.example.com`,
  phone: "+254711111111",
  investorType: "PrivateEquity",
  sectorPreference: ["Technology"],
  dealType: "Equity",
  dealSizeBand: "1m-5m",
};

afterAll(async () => {
  await prisma.activity.deleteMany({ where: { investor: { name: { contains: UNIQ } } } });
  await prisma.person.deleteMany({ where: { investor: { name: { contains: UNIQ } } } });
  await prisma.investor.deleteMany({ where: { name: { contains: UNIQ } } });
});

describe("registerInvestor", () => {
  it("creates a PendingReview investor with primary contact + activity", async () => {
    const investor = await registerInvestor(input);
    expect(investor.onboardingStatus).toBe("PendingReview");
    expect(investor.registeredAt).toBeInstanceOf(Date);
    expect(investor.createdSource).toBe("API");
    expect(Number(investor.ticketMin)).toBe(1_000_000);
    expect(Number(investor.ticketMax)).toBe(5_000_000);

    const contact = await prisma.person.findFirst({ where: { investorId: investor.id } });
    expect(contact?.isPrimaryContact).toBe(true);
    expect(contact?.firstName).toBe("Ada");
    expect(contact?.lastName).toBe("Lovelace");
    expect(contact?.email).toBe(input.email);

    const activity = await prisma.activity.findFirst({ where: { investorId: investor.id } });
    expect(activity?.subject).toContain("self-registered");
  });

  it("rejects a duplicate contact email", async () => {
    await expect(registerInvestor({ ...input, fundName: `Other ${UNIQ}` })).rejects.toThrow(RegistrationError);
  });

  it("confirmRegistrationOtp stamps verification with the demo code", async () => {
    const investor = await prisma.investor.findFirstOrThrow({ where: { name: { contains: UNIQ } } });
    await expect(confirmRegistrationOtp(investor.id, "123456", DEMO_OTP)).rejects.toThrow(RegistrationError);
    await confirmRegistrationOtp(investor.id, DEMO_OTP, DEMO_OTP);
    const updated = await prisma.investor.findUniqueOrThrow({ where: { id: investor.id } });
    expect(updated.emailVerifiedAt).toBeInstanceOf(Date);
    expect(updated.phoneVerifiedAt).toBeInstanceOf(Date);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/onboarding/__tests__/register-investor.smoke.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/server/onboarding/register-investor.ts`**

```ts
// register-investor.ts — the testable core of public investor registration.
// Plain server module (no "use server"): the /register server actions are thin
// wrappers that parse FormData and delegate here (same split as
// portal/partner/refer/submit-referral.ts).
//
// Registration lands in PendingReview: a NobleStride team member must approve
// every investor before any deal visibility (anti-broker guardrail, SOW §06).

import type { Investor } from "@prisma/client";
import { prisma } from "@/lib/db";
import { registrationSchema } from "@/lib/schemas/registration";
import { ticketBand } from "@/lib/ticket-bands";

/** DEMO ONLY — static OTP; no email/SMS is sent (see repo:memory/remaining-tasks.md). */
export const DEMO_OTP = "000000";

export class RegistrationError extends Error {}

export async function registerInvestor(raw: unknown): Promise<Investor> {
  const input = registrationSchema.parse(raw);

  const existing = await prisma.person.findFirst({
    where: { email: { equals: input.email, mode: "insensitive" }, investorId: { not: null } },
  });
  if (existing) {
    throw new RegistrationError("A registration with this contact email already exists. Contact NobleStride if you need access.");
  }

  const band = ticketBand(input.dealSizeBand);
  const [firstName, ...restName] = input.contactPerson.split(/\s+/);

  return prisma.$transaction(async (tx) => {
    const investor = await tx.investor.create({
      data: {
        name: input.fundName,
        investorType: input.investorType,
        sectorFocus: input.sectorPreference,
        instruments: [input.dealType],
        ticketMin: band?.min,
        ticketMax: band?.max ?? undefined,
        onboardingStatus: "PendingReview",
        registeredAt: new Date(),
        createdSource: "API",
      },
    });
    await tx.person.create({
      data: {
        firstName,
        lastName: restName.join(" ") || null,
        email: input.email,
        phone: input.phone,
        isPrimaryContact: true,
        investorId: investor.id,
      },
    });
    await tx.activity.create({
      data: {
        type: "Note",
        subject: `Investor self-registered via portal: ${input.fundName}`,
        body: `Contact: ${input.contactPerson} <${input.email}>, ${input.phone}. Awaiting team review.`,
        investorId: investor.id,
        createdSource: "API",
      },
    });
    return investor;
  });
}

/**
 * DEMO 2FA: both codes must equal DEMO_OTP; stamps email/phone verification.
 * Only meaningful while the registration is PendingReview.
 */
export async function confirmRegistrationOtp(investorId: string, emailCode: string, phoneCode: string): Promise<void> {
  if (emailCode.trim() !== DEMO_OTP || phoneCode.trim() !== DEMO_OTP) {
    throw new RegistrationError("Invalid verification code.");
  }
  const now = new Date();
  await prisma.investor.update({
    where: { id: investorId },
    data: { emailVerifiedAt: now, phoneVerifiedAt: now },
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/onboarding/__tests__/register-investor.smoke.test.ts`
Expected: PASS (local Postgres must be up).

- [ ] **Step 5: Commit**

```bash
git add src/server/onboarding
git commit -m "feat(onboarding): registerInvestor core + demo OTP confirmation"
```

---

### Task 4: `/register` public flow (form → demo OTP → confirmation)

**Files:**
- Create: `src/app/register/page.tsx`
- Create: `src/app/register/actions.ts`

**Interfaces:**
- Consumes: `registerInvestor`, `confirmRegistrationOtp`, `RegistrationError`, `DEMO_OTP` (Task 3); `options()` from `@/lib/vocab`; `TICKET_BANDS` (Task 2).
- Produces: public routes `/register`, `/register?step=verify&rid=<id>`, `/register?step=done`.

Known demo limitation (acceptable — the app has no auth at all): the `rid` query param means anyone with the URL can stamp OTP verification. Note this in `repo:memory/remaining-tasks.md` during Task 10.

- [ ] **Step 1: Implement `src/app/register/actions.ts`**

```ts
"use server";
// Server actions for the public /register flow. Thin wrappers over the
// testable core in src/server/onboarding/register-investor.ts.
// Errors round-trip via query params (same convention as portal/partner/refer).

import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { registerInvestor, confirmRegistrationOtp, RegistrationError } from "@/server/onboarding/register-investor";

export async function registerAction(formData: FormData): Promise<void> {
  const raw = {
    fundName: String(formData.get("fundName") ?? "").trim(),
    contactPerson: String(formData.get("contactPerson") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    investorType: String(formData.get("investorType") ?? "").trim(),
    sectorPreference: formData.getAll("sectorPreference").map(String),
    dealType: String(formData.get("dealType") ?? "").trim(),
    dealSizeBand: String(formData.get("dealSizeBand") ?? "").trim(),
  };

  let investorId: string;
  try {
    const investor = await registerInvestor(raw);
    investorId = investor.id;
  } catch (err) {
    if (err instanceof ZodError) {
      const first = err.issues[0];
      redirect(`/register?error=${encodeURIComponent(first?.message ?? "Check the form and try again")}`);
    }
    if (err instanceof RegistrationError) {
      redirect(`/register?error=${encodeURIComponent(err.message)}`);
    }
    throw err;
  }
  redirect(`/register?step=verify&rid=${investorId}`);
}

export async function verifyOtpAction(formData: FormData): Promise<void> {
  const rid = String(formData.get("rid") ?? "");
  if (!rid) redirect("/register");
  try {
    await confirmRegistrationOtp(rid, String(formData.get("emailOtp") ?? ""), String(formData.get("phoneOtp") ?? ""));
  } catch (err) {
    if (err instanceof RegistrationError) {
      redirect(`/register?step=verify&rid=${rid}&error=${encodeURIComponent(err.message)}`);
    }
    throw err;
  }
  redirect("/register?step=done");
}
```

Zod v4 note: if `ZodError.issues` is named differently in this project's Zod version, check how other code reads Zod issues (`src/components/ui/use-entity-form.ts` maps them) and match it.

- [ ] **Step 2: Implement `src/app/register/page.tsx`**

A standalone public page (no CRM/portal shell). Style with the app's existing Tailwind idiom (zinc canvas, white cards, rounded-xl borders — mirror `portal/partner/refer/page.tsx` form classes; read it first). Structure:

```tsx
// register/page.tsx — public investor registration (design spec §6).
// Step A: six mandatory fields (+ fund type). Step B: DEMO OTP. Step C: pending confirmation.
// No viewpoint/auth — this is the pre-approval front door; visibility stays zero
// until a team member approves (anti-broker gate).

import { options } from "@/lib/vocab";
import { TICKET_BANDS } from "@/lib/ticket-bands";
import { DEMO_OTP } from "@/server/onboarding/register-investor";
import { registerAction, verifyOtpAction } from "./actions";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ step?: string; rid?: string; error?: string }>;
}

export default async function RegisterPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const step = sp.step === "verify" && sp.rid ? "verify" : sp.step === "done" ? "done" : "form";
  // render one of the three steps below
}
```

Requirements per step (implementer writes the JSX following the refer-page form idiom):

- **Step "form"**: heading "Register as an Investor", subtitle "NobleStride Capital — investor access request". Error banner when `sp.error` (rose-tinted card, text from the param). `<form action={registerAction}>` with: `fundName` (text), `contactPerson` (text), `email` (type email, helper text "Corporate email only — free providers are not accepted"), `phone` (tel, helper "Used for OTP verification"), `investorType` (select over `options("InvestorType")`), `sectorPreference` (checkbox grid over `options("Sector")`, name repeated for getAll), `dealType` (select over `options("Instrument")`), `dealSizeBand` (select over `TICKET_BANDS` `key`/`label`). Every input has `required`. Submit button "Continue to verification".
- **Step "verify"**: hidden `rid` input; two 6-char inputs `emailOtp`, `phoneOtp` (`inputMode="numeric"`, `maxLength={6}`); an amber demo notice box: `Demo mode — OTP delivery is not wired yet. Use code {DEMO_OTP} for both fields.`; error banner when `sp.error`; submit "Verify". Form `action={verifyOtpAction}`.
- **Step "done"**: emerald check icon (lucide `CheckCircle2`), heading "Registration received", body: "Your registration is under review by the NobleStride team. You will be contacted at your corporate email once approved. No deal information is visible before approval."

- [ ] **Step 3: Smoke-verify the flow end-to-end with curl**

```bash
curl -s http://localhost:3000/register | grep -o "Register as an Investor"
```
Expected: `Register as an Investor`. Then drive a full registration in the browser-less way: submit via the running dev server is hard with curl (server actions); instead verify visually in Step 4 of Task 10, and here just confirm all three step variants render:

```bash
curl -s "http://localhost:3000/register?step=done" | grep -o "Registration received"
```
Expected: `Registration received`.

- [ ] **Step 4: Commit**

```bash
git add src/app/register
git commit -m "feat(onboarding): public /register flow with demo OTP + pending confirmation"
```

---

### Task 5: Visibility — onboarding block, teaser masking, NDA-aware VDR docs

**Files:**
- Create: `src/server/visibility/codename.ts`
- Create: `src/server/domain/nda-guard.ts`
- Modify: `src/server/visibility/tiers.ts`
- Modify: `src/server/visibility/project.ts`
- Modify: `src/server/visibility/load.ts`
- Modify: existing tests in `src/server/visibility/__tests__/` (fixtures gain `onboardingStatus: "Approved"`; DD-tier doc tests pass `ndaSatisfied: true`)
- Test: `src/server/visibility/__tests__/onboarding-gating.test.ts` (new), `src/server/domain/__tests__/nda-guard.test.ts` (new)

**Interfaces:**
- Consumes: `OnboardingStatus` (Task 1).
- Produces:
  - `investorTier(investor: { engagementClassification; onboardingStatus }, engagement?)` — signature gains required `onboardingStatus`.
  - `isOnboardingBlocked(status: OnboardingStatus): boolean` from `tiers.ts`.
  - `dealCodename(dealId: string): string` from `codename.ts` (deterministic, e.g. "Project Amber Falcon").
  - `projectDealForInvestor(deal, tier, opts?: { ndaSatisfied?: boolean })` — VDR docs need tier DD **and** `ndaSatisfied`; PRE_INTEREST masks `name` + `companyProfile.clientName` with the codename. Default `ndaSatisfied: false` (secure default).
  - From `nda-guard.ts`: `stageRequiresNda(stage: EngagementStage): boolean`; `ndaSatisfied(investor: { ndaStatus: InvestorNdaStatus }, engagement?: { ndaType: NdaType | null } | null): boolean`; `assertStageAllowed(stage, investor, engagement): void` (throws `NdaGuardError`); `class NdaGuardError extends Error`.
  - `DiscoveryInvestor` gains `onboardingStatus`; `discoverableDealsForInvestor` returns `[]` when not Approved.

- [ ] **Step 1: Write the failing tests**

`src/server/domain/__tests__/nda-guard.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { stageRequiresNda, ndaSatisfied, assertStageAllowed, NdaGuardError } from "@/server/domain/nda-guard";

describe("stageRequiresNda", () => {
  it.each(["Shared", "TeaserSent", "Declined"] as const)("%s does not require an NDA", (s) => {
    expect(stageRequiresNda(s)).toBe(false);
  });
  it.each(["NDASigned", "IMShared", "Meeting", "InfoRequest", "TermSheet", "Offer", "VDRAccess", "DueDiligence", "Invested"] as const)(
    "%s requires an NDA",
    (s) => expect(stageRequiresNda(s)).toBe(true),
  );
});

describe("ndaSatisfied", () => {
  it("open NDA satisfies every deal", () => {
    expect(ndaSatisfied({ ndaStatus: "OpenNDA" }, null)).toBe(true);
    expect(ndaSatisfied({ ndaStatus: "OpenNDA" }, { ndaType: null })).toBe(true);
  });
  it("closed NDA satisfies only the engagement that has it", () => {
    expect(ndaSatisfied({ ndaStatus: "ClosedNDA" }, { ndaType: "Closed" })).toBe(true);
    expect(ndaSatisfied({ ndaStatus: "ClosedNDA" }, { ndaType: null })).toBe(false);
    expect(ndaSatisfied({ ndaStatus: "ClosedNDA" }, null)).toBe(false);
  });
  it("no NDA satisfies nothing", () => {
    expect(ndaSatisfied({ ndaStatus: "None" }, { ndaType: null })).toBe(false);
  });
});

describe("assertStageAllowed", () => {
  it("blocks VDRAccess without an NDA", () => {
    expect(() => assertStageAllowed("VDRAccess", { ndaStatus: "None" }, { ndaType: null })).toThrow(NdaGuardError);
  });
  it("allows VDRAccess with an open NDA", () => {
    expect(() => assertStageAllowed("VDRAccess", { ndaStatus: "OpenNDA" }, { ndaType: null })).not.toThrow();
  });
  it("allows TeaserSent without an NDA", () => {
    expect(() => assertStageAllowed("TeaserSent", { ndaStatus: "None" }, null)).not.toThrow();
  });
});
```

`src/server/visibility/__tests__/onboarding-gating.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { investorTier, isOnboardingBlocked } from "@/server/visibility/tiers";
import { projectDealForInvestor, discoverableDealsForInvestor, type DealInput } from "@/server/visibility/project";
import { dealCodename } from "@/server/visibility/codename";

const deal: DealInput = {
  id: "deal-1",
  name: "Acme Foods – Series B",
  stage: "InvestorOutreach",
  sector: ["Agribusiness"],
  targetRaise: 3_000_000,
  client: {
    name: "Acme Foods Ltd",
    sector: ["Agribusiness"],
    countries: ["EastAfrica"],
    revenueLastYear: 2_000_000,
  },
  documents: [
    { id: "d1", name: "Teaser", type: "Teaser", accessLevel: "InvestorShared" },
    { id: "d2", name: "Data room pack", type: "AuditedAccounts", accessLevel: "VDR" },
  ],
};

describe("onboarding gate", () => {
  it("PendingReview and Rejected are blocked", () => {
    expect(isOnboardingBlocked("PendingReview")).toBe(true);
    expect(isOnboardingBlocked("Rejected")).toBe(true);
    expect(isOnboardingBlocked("Approved")).toBe(false);
  });
  it("pending investor resolves to tier NONE even when Active", () => {
    expect(investorTier({ engagementClassification: "Active", onboardingStatus: "PendingReview" }, null)).toBe("NONE");
  });
  it("pending investor discovers nothing", () => {
    const pending = { engagementClassification: "Active", onboardingStatus: "PendingReview" } as const;
    expect(discoverableDealsForInvestor({ ...pending }, [deal])).toEqual([]);
  });
});

describe("teaser masking (PRE_INTEREST)", () => {
  const projected = projectDealForInvestor(deal, "PRE_INTEREST")!;
  it("masks the deal and client names with a deterministic codename", () => {
    const code = dealCodename("deal-1");
    expect(projected.name).toBe(code);
    expect(projected.companyProfile.clientName).toBe(code);
    expect(code).toMatch(/^Project /);
    expect(dealCodename("deal-1")).toBe(code); // deterministic
  });
  it("unmasks after NDA", () => {
    const after = projectDealForInvestor(deal, "AFTER_NDA")!;
    expect(after.name).toBe("Acme Foods – Series B");
    expect(after.companyProfile.clientName).toBe("Acme Foods Ltd");
  });
});

describe("NDA-aware VDR docs", () => {
  it("hides VDR docs at DD without a satisfied NDA", () => {
    const withoutNda = projectDealForInvestor(deal, "DD")!;
    expect(withoutNda.documents.some((d) => d.id === "d2")).toBe(false);
  });
  it("shows VDR docs at DD with a satisfied NDA", () => {
    const withNda = projectDealForInvestor(deal, "DD", { ndaSatisfied: true })!;
    expect(withNda.documents.some((d) => d.id === "d2")).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/server/domain/__tests__/nda-guard.test.ts src/server/visibility/__tests__/onboarding-gating.test.ts`
Expected: FAIL — modules/exports missing.

- [ ] **Step 3: Implement `src/server/domain/nda-guard.ts`**

```ts
// nda-guard.ts — pure NDA gating rules (design spec §4, SOW §06 guardrail:
// "No VDR access without internal approval AND the correct signed NDA").
//
// Open NDA (investor ↔ NobleStride): satisfies the NDA requirement on EVERY
// deal. Closed NDA (investor ↔ NobleStride ↔ one client): satisfies it only
// for the engagement that carries it. An engagement-level ndaType of "Open"
// also counts (it records that the investor's open NDA covers this deal).

import type { EngagementStage, InvestorNdaStatus, NdaType } from "@prisma/client";

/** Stages that presuppose a signed NDA (everything at AFTER_NDA/DD tier). */
const NDA_REQUIRED: Record<EngagementStage, boolean> = {
  Shared: false,
  TeaserSent: false,
  Declined: false,
  NDASigned: true,
  IMShared: true,
  Meeting: true,
  InfoRequest: true,
  TermSheet: true,
  Offer: true,
  VDRAccess: true,
  DueDiligence: true,
  Invested: true,
};

export function stageRequiresNda(stage: EngagementStage): boolean {
  return NDA_REQUIRED[stage];
}

export function ndaSatisfied(
  investor: { ndaStatus: InvestorNdaStatus },
  engagement?: { ndaType: NdaType | null } | null,
): boolean {
  if (investor.ndaStatus === "OpenNDA") return true;
  return (engagement?.ndaType ?? null) !== null;
}

export class NdaGuardError extends Error {}

/** Throw when moving to `stage` is not allowed without the correct NDA. */
export function assertStageAllowed(
  stage: EngagementStage,
  investor: { ndaStatus: InvestorNdaStatus },
  engagement?: { ndaType: NdaType | null } | null,
): void {
  if (stageRequiresNda(stage) && !ndaSatisfied(investor, engagement)) {
    throw new NdaGuardError(
      `Stage "${stage}" requires a signed NDA. Record an Open NDA on the investor, or a Closed NDA on this engagement, first.`,
    );
  }
}
```

- [ ] **Step 4: Implement `src/server/visibility/codename.ts`**

```ts
// codename.ts — deterministic pre-NDA teaser codenames ("Project Amber Falcon").
// Company identity is masked at PRE_INTEREST and unmasks after NDA (design
// spec §5; flagged for client confirmation in memory/client-meeting-questions.md).

const ADJECTIVES = [
  "Amber", "Cobalt", "Crimson", "Golden", "Indigo", "Ivory",
  "Jade", "Onyx", "Opal", "Scarlet", "Silver", "Umber",
] as const;

const NOUNS = [
  "Acacia", "Baobab", "Falcon", "Harrier", "Ibis", "Kudu",
  "Marula", "Meridian", "Nile", "Oryx", "Sable", "Savanna",
] as const;

/** Stable, non-identifying codename derived from the deal id. */
export function dealCodename(dealId: string): string {
  let h = 0;
  for (let i = 0; i < dealId.length; i++) h = (h * 31 + dealId.charCodeAt(i)) >>> 0;
  const adj = ADJECTIVES[h % ADJECTIVES.length];
  const noun = NOUNS[(h >>> 8) % NOUNS.length];
  return `Project ${adj} ${noun}`;
}
```

- [ ] **Step 5: Modify `src/server/visibility/tiers.ts`**

Import `OnboardingStatus` type; add after `isBlockedClassification`:

```ts
/** Onboarding gate (design spec §5): only Approved investors see anything. */
export function isOnboardingBlocked(status: OnboardingStatus): boolean {
  return status !== "Approved";
}
```

Change `investorTier` to require the field and check it first:

```ts
export function investorTier(
  investor: {
    engagementClassification: InvestorEngagementClassification;
    onboardingStatus: OnboardingStatus;
  },
  engagement?: { engagementStage: EngagementStage } | null,
): Tier {
  if (isOnboardingBlocked(investor.onboardingStatus)) return "NONE";
  if (CLASSIFICATION_BLOCKED[investor.engagementClassification]) return "NONE";
  if (!engagement) return "PRE_INTEREST";
  return STAGE_TIER[engagement.engagementStage];
}
```

- [ ] **Step 6: Modify `src/server/visibility/project.ts`**

1. Import `dealCodename` and `OnboardingStatus`.
2. `projectDocuments` gains an `ndaSatisfied` param; change the VDR line:

```ts
function projectDocuments(
  documents: DocumentInput[],
  tier: Exclude<Tier, "NONE">,
  ndaSatisfied: boolean,
): ProjectedDocument[] {
  // ... unchanged except:
      // VDR files: hidden until tier DD AND the correct signed NDA (SOW §06).
      if (doc.accessLevel === "VDR") return fieldAccess("vdrFiles", tier) === "full" && ndaSatisfied;
```

3. `projectDealForInvestor` gains options and masks at PRE_INTEREST:

```ts
export interface ProjectDealOptions {
  /** Open NDA on the investor, or a Closed NDA on THIS deal's engagement. */
  ndaSatisfied?: boolean;
}

export function projectDealForInvestor(
  deal: DealInput,
  tier: Tier,
  opts: ProjectDealOptions = {},
): ProjectedDeal | null {
  if (tier === "NONE") return null;
  const ndaSatisfied = opts.ndaSatisfied ?? false;
  const masked = tier === "PRE_INTEREST";
  const displayName = masked ? dealCodename(deal.id) : deal.name;
  // ...
  return {
    id: deal.id,
    name: displayName,
    // ...
    companyProfile: {
      clientName: masked ? displayName : (client?.name ?? deal.name),
      // ... rest unchanged
    },
    // ...
    documents: projectDocuments(deal.documents ?? [], tier, ndaSatisfied),
    // ... rest unchanged
  };
}
```

4. `DiscoveryInvestor` gains `onboardingStatus: OnboardingStatus;` and `discoverableDealsForInvestor` starts with:

```ts
  if (isOnboardingBlocked(investor.onboardingStatus)) return [];
  if (isBlockedClassification(investor.engagementClassification)) return [];
```

(import `isOnboardingBlocked` from `./tiers`).

- [ ] **Step 7: Modify `src/server/visibility/load.ts`**

Import `ndaSatisfied` from `@/server/domain/nda-guard` and `isOnboardingBlocked` from `./tiers`. In `loadInvestorPortalData`, the loaded `investor` already carries `ndaStatus` and `onboardingStatus` (full record). Pass NDA context per deal:

```ts
    const projection = projectDealForInvestor(deal, investorTier(investor, engagement), {
      ndaSatisfied: ndaSatisfied(investor, engagement),
    });
```

In `loadInvestorPipeline`, add the onboarding block next to the classification block:

```ts
  if (isOnboardingBlocked(investor.onboardingStatus)) return [];
  if (isBlockedClassification(investor.engagementClassification)) return [];
```

and pass the same option where it projects:

```ts
    const deal = projectDealForInvestor(engagement.transaction, dealTier, {
      ndaSatisfied: ndaSatisfied(investor, engagement),
    });
```

- [ ] **Step 8: Update existing visibility tests' fixtures**

Run `npx vitest run src/server/visibility` — fixture investors now need `onboardingStatus: "Approved"`, and any DD-tier test asserting VDR docs visible must pass `{ ndaSatisfied: true }`. Update ONLY fixtures/call-sites; do not weaken any assertion. Every previously-passing behavioral expectation must still hold.

- [ ] **Step 9: Run all tests**

Run: `npm run test`
Expected: PASS (modulo pre-existing known failures). The GraphQL layer may also call `investorTier`/`discoverableDealsForInvestor` — `npx tsc --noEmit` (or `npm run build` — remember the DLL quirk: use `npx next build` if schema unchanged) to catch missed call-sites; fix them the same way (records loaded from Prisma already carry the new fields).

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(onboarding): visibility gate for pending investors, teaser codenames, NDA-aware VDR docs"
```

---

### Task 6: NDA services, onboarding-status service, restage guard, GraphQL mutations

**Files:**
- Create: `src/server/services/nda.ts`
- Modify: `src/server/services/investors.ts` (add `setOnboardingStatus`)
- Modify: `src/server/services/engagements-crud.ts` (wire the guard)
- Modify: `src/graphql/builder.ts` (register `OnboardingStatusEnum` — follow the existing enum registrations exactly)
- Modify: `src/graphql/mutations.ts`
- Test: `src/server/onboarding/__tests__/nda-services.smoke.test.ts`

**Interfaces:**
- Consumes: `assertStageAllowed`, `NdaGuardError`, `stageRequiresNda` (Task 5); `actorSource`/`Actor` (existing `./crud` + `@/graphql/context`).
- Produces:
  - `recordOpenNda(investorId: string, actor: Actor): Promise<Investor>` — sets `ndaStatus: "OpenNDA"`, `openNdaSignedAt: now`, logs `NDASigned` Activity.
  - `recordClosedNda(engagementId: string, actor: Actor): Promise<Engagement>` — sets `ndaType: "Closed"`, `ndaSignedAt: now`; bumps investor `ndaStatus` `None → ClosedNDA`; logs `NDASigned` Activity.
  - `setOnboardingStatus(id: string, status: OnboardingStatus, actor: Actor): Promise<Investor>` — updates + logs Activity ("Investor approved" / "Investor rejected" / "Investor set to pending review").
  - GraphQL mutations: `setInvestorOnboardingStatus(id, status)`, `recordOpenNda(investorId)`, `recordClosedNda(engagementId)`.
  - `createEngagement`/`updateEngagement` throw `NdaGuardError` on NDA-requiring stage without the correct NDA.

- [ ] **Step 1: Write the failing smoke test**

`src/server/onboarding/__tests__/nda-services.smoke.test.ts` (same DB-backed pattern as Task 3; create a throwaway investor + client + transaction + engagement in `beforeAll`, clean up in `afterAll` — mirror how existing smoke tests build fixtures):

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { recordOpenNda, recordClosedNda } from "@/server/services/nda";
import { setOnboardingStatus } from "@/server/services/investors";
import { updateEngagement } from "@/server/services/engagements-crud";
import { NdaGuardError } from "@/server/domain/nda-guard";

const ACTOR = { type: "HUMAN", label: "test" } as const;
const UNIQ = `nda-smoke-${Date.now()}`;
let investorId: string, engagementId: string, txnId: string;

beforeAll(async () => {
  const investor = await prisma.investor.create({
    data: { name: `Fund ${UNIQ}`, investorType: "PrivateEquity", onboardingStatus: "PendingReview" },
  });
  const client = await prisma.client.create({ data: { name: `Client ${UNIQ}` } });
  const txn = await prisma.transaction.create({ data: { name: `Deal ${UNIQ}`, clientId: client.id } });
  const engagement = await prisma.engagement.create({
    data: { name: `Eng ${UNIQ}`, transactionId: txn.id, investorId: investor.id },
  });
  investorId = investor.id; engagementId = engagement.id; txnId = txn.id;
});

afterAll(async () => {
  await prisma.activity.deleteMany({ where: { investorId } });
  await prisma.engagement.deleteMany({ where: { investorId } });
  await prisma.transaction.deleteMany({ where: { name: { contains: UNIQ } } });
  await prisma.client.deleteMany({ where: { name: { contains: UNIQ } } });
  await prisma.investor.deleteMany({ where: { id: investorId } });
});

describe("onboarding + NDA services", () => {
  it("setOnboardingStatus approves and logs an activity", async () => {
    const inv = await setOnboardingStatus(investorId, "Approved", ACTOR);
    expect(inv.onboardingStatus).toBe("Approved");
    const act = await prisma.activity.findFirst({ where: { investorId, subject: { contains: "approved" } } });
    expect(act).not.toBeNull();
  });

  it("blocks restage to NDASigned without any NDA", async () => {
    await expect(updateEngagement(engagementId, { engagementStage: "NDASigned" })).rejects.toThrow(NdaGuardError);
  });

  it("recordClosedNda unlocks that engagement only", async () => {
    await recordClosedNda(engagementId, ACTOR);
    const eng = await prisma.engagement.findUniqueOrThrow({ where: { id: engagementId } });
    expect(eng.ndaType).toBe("Closed");
    expect(eng.ndaSignedAt).toBeInstanceOf(Date);
    const inv = await prisma.investor.findUniqueOrThrow({ where: { id: investorId } });
    expect(inv.ndaStatus).toBe("ClosedNDA");
    await expect(updateEngagement(engagementId, { engagementStage: "NDASigned" })).resolves.toBeTruthy();
  });

  it("recordOpenNda stamps the investor", async () => {
    const inv = await recordOpenNda(investorId, ACTOR);
    expect(inv.ndaStatus).toBe("OpenNDA");
    expect(inv.openNdaSignedAt).toBeInstanceOf(Date);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/onboarding/__tests__/nda-services.smoke.test.ts`
Expected: FAIL — `src/server/services/nda.ts` not found.

- [ ] **Step 3: Implement `src/server/services/nda.ts`**

```ts
// NDA service — records NDAs manually (SOW §06: no automatic signing).
// Open NDA lives on the investor; Closed NDA lives on one engagement.

import type { Engagement, Investor } from "@prisma/client";
import { prisma } from "@/lib/db";
import { actorSource } from "./crud";
import type { Actor } from "@/graphql/context";

export async function recordOpenNda(investorId: string, actor: Actor): Promise<Investor> {
  return prisma.$transaction(async (tx) => {
    const investor = await tx.investor.update({
      where: { id: investorId },
      data: { ndaStatus: "OpenNDA", openNdaSignedAt: new Date() },
    });
    await tx.activity.create({
      data: {
        type: "NDASigned",
        subject: `Open NDA recorded — ${investor.name}`,
        investorId,
        createdSource: actorSource(actor),
      },
    });
    return investor;
  });
}

export async function recordClosedNda(engagementId: string, actor: Actor): Promise<Engagement> {
  return prisma.$transaction(async (tx) => {
    const engagement = await tx.engagement.update({
      where: { id: engagementId },
      data: { ndaType: "Closed", ndaSignedAt: new Date() },
      include: { investor: true },
    });
    if (engagement.investor.ndaStatus === "None") {
      await tx.investor.update({
        where: { id: engagement.investorId },
        data: { ndaStatus: "ClosedNDA" },
      });
    }
    await tx.activity.create({
      data: {
        type: "NDASigned",
        subject: `Closed NDA recorded — ${engagement.name}`,
        engagementId,
        investorId: engagement.investorId,
        transactionId: engagement.transactionId,
        createdSource: actorSource(actor),
      },
    });
    return engagement;
  });
}
```

- [ ] **Step 4: Add `setOnboardingStatus` to `src/server/services/investors.ts`**

```ts
const ONBOARDING_ACTIVITY_SUBJECT: Record<OnboardingStatus, string> = {
  Approved: "Investor approved",
  Rejected: "Investor rejected",
  PendingReview: "Investor set to pending review",
};

/** Approve/reject a registration; logs the decision on the timeline. */
export async function setOnboardingStatus(id: string, status: OnboardingStatus, actor: Actor) {
  return prisma.$transaction(async (tx) => {
    const investor = await tx.investor.update({ where: { id }, data: { onboardingStatus: status } });
    await tx.activity.create({
      data: {
        type: "Note",
        subject: `${ONBOARDING_ACTIVITY_SUBJECT[status]} — ${investor.name}`,
        investorId: id,
        createdSource: actorSource(actor),
      },
    });
    return investor;
  });
}
```

(import `OnboardingStatus` from `@prisma/client`.)

- [ ] **Step 5: Wire the guard into `src/server/services/engagements-crud.ts`**

Import `assertStageAllowed`, `stageRequiresNda` from `@/server/domain/nda-guard`. In `createEngagement`, after parsing:

```ts
  if (input.engagementStage && stageRequiresNda(input.engagementStage)) {
    const investor = await prisma.investor.findUniqueOrThrow({
      where: { id: input.investorId },
      select: { ndaStatus: true },
    });
    assertStageAllowed(input.engagementStage, investor, { ndaType: input.ndaType ?? null });
  }
```

In `updateEngagement`, after loading `existing` and before the update — only when the stage is actually changing:

```ts
  if (input.engagementStage && input.engagementStage !== existing.engagementStage) {
    const investor = await prisma.investor.findUniqueOrThrow({
      where: { id: existing.investorId },
      select: { ndaStatus: true },
    });
    const mergedNdaType = "ndaType" in input ? (input.ndaType ?? null) : existing.ndaType;
    assertStageAllowed(input.engagementStage, investor, { ndaType: mergedNdaType });
  }
```

- [ ] **Step 6: GraphQL — enum + mutations**

In `src/graphql/builder.ts`, register the enum exactly like the existing ones (e.g. `MandateStageEnum`); read the file and copy the pattern:

```ts
export const OnboardingStatusEnum = builder.enumType(OnboardingStatus, { name: "OnboardingStatus" });
```

In `src/graphql/mutations.ts`, import `OnboardingStatusEnum`, `setOnboardingStatus`, `recordOpenNda`, `recordClosedNda`, and add inside the mutation fields (next to the Investor block):

```ts
  setInvestorOnboardingStatus: t.prismaField({
    type: "Investor", nullable: false,
    args: {
      id: t.arg.id({ required: true }),
      status: t.arg({ type: OnboardingStatusEnum, required: true }),
    },
    resolve: (_q, _r, args, ctx) => setOnboardingStatus(String(args.id), args.status, ctx.actor),
  }),
  recordOpenNda: t.prismaField({
    type: "Investor", nullable: false,
    args: { investorId: t.arg.id({ required: true }) },
    resolve: (_q, _r, args, ctx) => recordOpenNda(String(args.investorId), ctx.actor),
  }),
  recordClosedNda: t.prismaField({
    type: "Engagement", nullable: false,
    args: { engagementId: t.arg.id({ required: true }) },
    resolve: (_q, _r, args, ctx) => recordClosedNda(String(args.engagementId), ctx.actor),
  }),
```

- [ ] **Step 7: Run tests**

Run: `npx vitest run src/server/onboarding/__tests__/nda-services.smoke.test.ts` → PASS. Then `npm run test` → no new failures. Then verify the GraphQL schema builds: `curl -s http://localhost:3000/api/graphql -H "content-type: application/json" -d "{\"query\":\"{ __type(name: \\\"Mutation\\\") { fields { name } } }\"}" | grep recordOpenNda` → contains `recordOpenNda`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(onboarding): NDA recording services, approval service, NDA restage guard, GraphQL mutations"
```

---

### Task 7: Portal pending/rejected gate

**Files:**
- Modify: `src/app/portal/investor/layout.tsx`

**Interfaces:**
- Consumes: `Investor.onboardingStatus` (Task 1).
- Produces: pending/rejected investors see a status screen instead of the portal shell — zero content leaks.

- [ ] **Step 1: Modify the layout**

In `src/app/portal/investor/layout.tsx`, widen the select to `{ name: true, onboardingStatus: true }` and, after fetching, short-circuit before rendering the shell:

```tsx
  if (investor && investor.onboardingStatus !== "Approved") {
    const pending = investor.onboardingStatus === "PendingReview";
    return (
      <div className="flex h-screen flex-col overflow-hidden bg-zinc-50">
        <div className="flex-shrink-0">
          <ViewingBanner />
        </div>
        <main className="flex flex-1 items-center justify-center p-6">
          <div className="max-w-md rounded-xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
            <h1 className="text-xl font-semibold text-zinc-900">
              {pending ? "Registration under review" : "Registration not approved"}
            </h1>
            <p className="mt-3 text-sm text-zinc-500">
              {pending
                ? `Thank you for registering ${investor.name}. The NobleStride team reviews every investor before granting deal visibility. You will be contacted at your corporate email once approved.`
                : "This registration was not approved. Contact NobleStride Capital if you believe this is an error."}
            </p>
            <p className="mt-6 text-xs text-zinc-400">
              No opportunity information is visible before approval.
            </p>
          </div>
        </main>
      </div>
    );
  }
```

(Keep the `ViewingBanner` so the demo lens can still switch away.)

- [ ] **Step 2: Smoke-verify with the viewpoint cookie**

Get a pending investor id (after Task 10's plant script exists, or create one via `/register` in the browser; for now use Prisma directly):

```bash
cd noblestride-crm && npx tsx -e "import { prisma } from './src/lib/db'; prisma.investor.findFirst({ where: { onboardingStatus: 'PendingReview' }, select: { id: true } }).then(r => { console.log(r?.id ?? 'NONE'); process.exit(0); });"
```

If `NONE`, register one through `/register` first. Then:

```bash
curl -s -L "http://localhost:3000/api/viewpoint?role=investor&recordId=<PENDING_ID>&next=/portal/investor" | grep -o "Registration under review"
```
Expected: `Registration under review`.

- [ ] **Step 3: Commit**

```bash
git add src/app/portal/investor/layout.tsx
git commit -m "feat(onboarding): portal gate — pending/rejected investors see a status screen only"
```

---

### Task 8: Admin — onboarding queue, investor panels, engagement NDA row

**Files:**
- Modify: `src/server/services/investors.ts` (`investorSegments` gains onboarding counts; type in `src/server/domain/types.ts`)
- Modify: `src/app/(crm)/investors/page.tsx` (onboarding strip + filter param)
- Modify: `src/components/crm/record-table.tsx` (onboarding chip column)
- Create: `src/components/crm/onboarding-actions.tsx` (client: Approve / Reject / Greylist)
- Create: `src/components/crm/nda-actions.tsx` (client: Record Open NDA / Record Closed NDA buttons)
- Modify: `src/app/(crm)/investors/[id]/page.tsx` (Onboarding panel + NDA panel)
- Modify: `src/app/(crm)/engagement/[id]/page.tsx` (NDA row + Record Closed NDA)

Read each file before editing and match its exact idiom (Card/CardHeader/CardBody, chips via `label()`, client mutation components modeled on `restage-select.tsx` / `delete-confirm.tsx` — urql `useMutation` + `router.refresh()`).

**Interfaces:**
- Consumes: GraphQL mutations from Task 6; vocab `OnboardingStatus` labels (Task 1).
- Produces: `/investors?onboarding=PendingReview` filtered queue; `InvestorSegments` gains `{ pendingReview: number; rejected: number }`.

- [ ] **Step 1: Extend `investorSegments`**

Add to the `Promise.all` in `src/server/services/investors.ts`:

```ts
    prisma.investor.groupBy({ by: ["onboardingStatus"], _count: { _all: true } }),
```

and to the returned object (extend `InvestorSegments` in `src/server/domain/types.ts` accordingly):

```ts
    pendingReview: byOnboarding["PendingReview"] ?? 0,
    rejected: byOnboarding["Rejected"] ?? 0,
```

(build `byOnboarding` the same way as `byType`).

- [ ] **Step 2: Investors list page**

In `src/app/(crm)/investors/page.tsx`:
- Parse `sp.onboarding` into `filter.onboardingStatus` (typed as `OnboardingStatus`).
- Under the `SegmentRow`, when `segments.pendingReview > 0`, render an amber callout strip:

```tsx
      {segments.pendingReview > 0 && (
        <a
          href="/investors?onboarding=PendingReview"
          className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 hover:bg-amber-100"
        >
          <span>
            <strong>{segments.pendingReview}</strong> investor registration{segments.pendingReview === 1 ? "" : "s"} awaiting review
          </span>
          <span className="font-medium">Review queue →</span>
        </a>
      )}
```

- [ ] **Step 3: Onboarding chip in the record table**

In `src/components/crm/record-table.tsx`, add an "Onboarding" column rendering the status via the existing chip/status-dot idiom (`label("OnboardingStatus", inv.onboardingStatus)` + `STATUS_DOT[inv.onboardingStatus]`). Match how the table renders the existing status column exactly.

- [ ] **Step 4: `src/components/crm/onboarding-actions.tsx`**

Client component (model on the existing urql mutation button components — read `delete-confirm.tsx`/`restage-select.tsx` first):

```tsx
"use client";
// Approve / Reject / Greylist actions for a pending investor registration.
// Greylist = engagementClassification "Greylisted" via the existing
// updateInvestor mutation (zero visibility everywhere, SOW §06).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "urql";

const SET_STATUS = `
  mutation SetOnboarding($id: ID!, $status: OnboardingStatus!) {
    setInvestorOnboardingStatus(id: $id, status: $status) { id onboardingStatus }
  }
`;
const GREYLIST = `
  mutation Greylist($id: ID!, $input: InvestorInput!) {
    updateInvestor(id: $id, input: $input) { id engagementClassification }
  }
`;

export function OnboardingActions({ investorId }: { investorId: string }) {
  const router = useRouter();
  const [, setStatus] = useMutation(SET_STATUS);
  const [, greylist] = useMutation(GREYLIST);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(label: string, fn: () => Promise<{ error?: { message: string } }>) {
    setPending(label);
    setError(null);
    const res = await fn();
    setPending(null);
    if (res.error) setError(res.error.message);
    else router.refresh();
  }

  const btn = "rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50";
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button
          className={`${btn} bg-emerald-600 text-white hover:bg-emerald-700`}
          disabled={pending !== null}
          onClick={() => run("approve", () => setStatus({ id: investorId, status: "Approved" }))}
        >
          {pending === "approve" ? "Approving…" : "Approve"}
        </button>
        <button
          className={`${btn} bg-rose-600 text-white hover:bg-rose-700`}
          disabled={pending !== null}
          onClick={() => run("reject", () => setStatus({ id: investorId, status: "Rejected" }))}
        >
          {pending === "reject" ? "Rejecting…" : "Reject"}
        </button>
        <button
          className={`${btn} border border-zinc-300 text-zinc-700 hover:bg-zinc-100`}
          disabled={pending !== null}
          onClick={() => run("greylist", () => greylist({ id: investorId, input: { engagementClassification: "Greylisted" } }))}
        >
          {pending === "greylist" ? "…" : "Greylist"}
        </button>
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
```

(If `InvestorInput` field naming differs, check `src/graphql/inputs.ts` and match.)

- [ ] **Step 5: `src/components/crm/nda-actions.tsx`**

```tsx
"use client";
// Record NDA buttons — manual recording only (SOW §06: no automatic signing).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "urql";

const RECORD_OPEN = `
  mutation RecordOpenNda($investorId: ID!) {
    recordOpenNda(investorId: $investorId) { id ndaStatus openNdaSignedAt }
  }
`;
const RECORD_CLOSED = `
  mutation RecordClosedNda($engagementId: ID!) {
    recordClosedNda(engagementId: $engagementId) { id ndaType ndaSignedAt }
  }
`;

export function RecordOpenNdaButton({ investorId }: { investorId: string }) {
  const router = useRouter();
  const [{ fetching }, record] = useMutation(RECORD_OPEN);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button
        className="rounded-lg border border-sky-300 bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-700 hover:bg-sky-100 disabled:opacity-50"
        disabled={fetching}
        onClick={async () => {
          const res = await record({ investorId });
          if (res.error) setError(res.error.message);
          else router.refresh();
        }}
      >
        {fetching ? "Recording…" : "Record Open NDA"}
      </button>
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}

export function RecordClosedNdaButton({ engagementId }: { engagementId: string }) {
  const router = useRouter();
  const [{ fetching }, record] = useMutation(RECORD_CLOSED);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button
        className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
        disabled={fetching}
        onClick={async () => {
          const res = await record({ engagementId });
          if (res.error) setError(res.error.message);
          else router.refresh();
        }}
      >
        {fetching ? "Recording…" : "Record Closed NDA"}
      </button>
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 6: Investor detail page panels**

In `src/app/(crm)/investors/[id]/page.tsx` (match the existing Card layout), add two sections:

**Onboarding panel** (render prominently — first card — when `investor.onboardingStatus !== "Approved"`, otherwise as a normal card):
- Status chip (`label("OnboardingStatus", …)` + dot), `registeredAt` ("Self-registered <date>" or "Team-created"), `emailVerifiedAt`/`phoneVerifiedAt` ("Email verified ✓ <date>" / "Not verified"), primary contact (name/email/phone from `investor.contacts` where `isPrimaryContact`).
- `<OnboardingActions investorId={investor.id} />` when status is `PendingReview` (also show for `Rejected` so a rejection can be reversed).

**NDA panel**:
- `ndaStatus` chip + `openNdaSignedAt` date when present.
- List of closed-NDA engagements: from `investor.engagements` where `ndaType` set — engagement name, `ndaType` chip, `ndaSignedAt` date, link to `/engagement/<id>`.
- `<RecordOpenNdaButton investorId={investor.id} />` when `ndaStatus !== "OpenNDA"`.
- Caption: "Open NDA covers every data room (per-deal access still requires internal approval). Closed NDA covers one deal only."

- [ ] **Step 7: Engagement detail page**

In `src/app/(crm)/engagement/[id]/page.tsx`, add an NDA row/section: `ndaType` chip (or "No NDA recorded"), `ndaSignedAt` date, investor-level `ndaStatus` (needs `investor` already included by `getEngagement` — it is), and `<RecordClosedNdaButton engagementId={engagement.id} />` when `ndaType` is null. Add a short caption: "Stage changes past Teaser require an NDA (Open on the investor, or Closed here)."

- [ ] **Step 8: Verify in the browser**

With the dev server running (admin viewpoint is the default): visit `/investors` (chip column + amber strip when a pending exists), `/investors?onboarding=PendingReview`, a pending investor's detail page (approve/reject buttons render), an engagement page (NDA row renders). Quick curl checks:

```bash
curl -s "http://localhost:3000/investors" | grep -o "Onboarding" | head -1
```
Expected: `Onboarding`.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(onboarding): admin queue, onboarding + NDA panels, engagement NDA row"
```

---

### Task 9: Dashboard — Investor Onboarding stat group

**Files:**
- Modify: `src/server/services/dashboard.ts` (add `onboardingStats()`)
- Modify: `src/app/(crm)/dashboard/page.tsx` (render the group)

**Interfaces:**
- Produces: `onboardingStats(now?: Date): Promise<{ pendingReview: number; approvedThisMonth: number; ndaOpen: number; ndaClosed: number; ndaNone: number }>`.

- [ ] **Step 1: Implement `onboardingStats` in `src/server/services/dashboard.ts`**

```ts
/** Investor-onboarding dashboard stats (design spec §7). */
export async function onboardingStats(now: Date = new Date()) {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [pendingReview, approvedThisMonth, ndaGroups] = await Promise.all([
    prisma.investor.count({ where: { onboardingStatus: "PendingReview" } }),
    prisma.activity.count({
      where: { subject: { startsWith: "Investor approved" }, occurredAt: { gte: monthStart } },
    }),
    prisma.investor.groupBy({
      by: ["ndaStatus"],
      where: { engagementClassification: "Active", onboardingStatus: "Approved" },
      _count: { _all: true },
    }),
  ]);
  const byNda: Record<string, number> = {};
  for (const row of ndaGroups) byNda[row.ndaStatus] = row._count._all;
  return {
    pendingReview,
    approvedThisMonth,
    ndaOpen: byNda["OpenNDA"] ?? 0,
    ndaClosed: byNda["ClosedNDA"] ?? 0,
    ndaNone: byNda["None"] ?? 0,
  };
}
```

- [ ] **Step 2: Render on the dashboard**

In `src/app/(crm)/dashboard/page.tsx` (read it first; add `onboardingStats()` to the existing `Promise.all`), add an "Investor Onboarding" section using the page's existing stat-card idiom: Pending review (links to `/investors?onboarding=PendingReview`), Approved this month, NDA coverage ("`ndaOpen` open · `ndaClosed` closed · `ndaNone` none"). If the page uses `AnimatedStatCard`, use it; otherwise match whatever the neighboring cards use.

- [ ] **Step 3: Verify**

```bash
curl -s "http://localhost:3000/dashboard" | grep -o "Investor Onboarding" | head -1
```
Expected: `Investor Onboarding`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(onboarding): dashboard investor-onboarding stat group"
```

---

### Task 10: Demo data, full verification, field audit, trackers

**Files:**
- Create: `scripts/plant-onboarding-data.ts`
- Modify: `repo:memory/remaining-tasks.md`, `repo:memory/client-meeting-questions.md`
- Verification artifacts: screenshots in the session scratchpad

- [ ] **Step 1: Plant script (idempotent)**

`scripts/plant-onboarding-data.ts` (run with `npx tsx scripts/plant-onboarding-data.ts`; model the header/bootstrapping on `scripts/plant-portal-data.ts` — read it first):

1. **Pending investor:** upsert-by-name "Meridian Frontier Capital" — `investorType: "PrivateEquity"`, `sectorFocus: ["Agribusiness","Technology"]`, `instruments: ["Equity"]`, `ticketMin: 1_000_000`, `ticketMax: 5_000_000`, `onboardingStatus: "PendingReview"`, `registeredAt: now`, `emailVerifiedAt: now`, `phoneVerifiedAt: now`, `createdSource: "API"` + primary-contact Person ("Amina Okonkwo", `amina@meridianfrontier.com`, `+254722000111`) + "self-registered" Activity — skip all if the investor already exists.
2. **Open-NDA investor:** pick the first Active+Approved investor with `ndaStatus: "None"` and at least one engagement; set `ndaStatus: "OpenNDA"`, `openNdaSignedAt: now`; log the `NDASigned` activity. Skip if an OpenNDA investor already exists.
3. **Closed-NDA engagement:** pick one engagement at stage `NDASigned`/`IMShared` whose `ndaType` is null and whose investor is not the open-NDA investor; set `ndaType: "Closed"`, `ndaSignedAt: now`. Skip if any engagement already has `ndaSignedAt`.
4. **Coherence backfill:** every engagement at an NDA-requiring stage (use `stageRequiresNda`) with `ndaType: null` and an investor whose `ndaStatus` is not `OpenNDA` → set `ndaType: "Closed"` (leave `ndaSignedAt` null — legacy record). Print a count. This keeps the restage guard from tripping on pre-existing seed data.
5. Print a summary of everything planted/skipped.

Run it: `npx tsx scripts/plant-onboarding-data.ts`. Expected: summary lines, second run prints "skipped" everywhere.

- [ ] **Step 2: Full test suite + typecheck**

```bash
npm run test
npx tsc --noEmit
```
Expected: all green except the pre-existing known failures listed in Global Constraints. Fix anything new.

- [ ] **Step 3: End-to-end smoke via viewpoint cookie (all five investor states)**

Extract ids (pending / approved-no-NDA / open-NDA / closed-NDA investor / greylisted — query via `npx tsx -e` one-liners against prisma). For each, chain the cookie + target in ONE navigation:

- Pending → `/api/viewpoint?role=investor&recordId=<id>&next=/portal/investor` contains "Registration under review".
- Approved, no NDA → portal opportunities grid shows codenames ("Project ") for PRE_INTEREST deals; a deal page at DD tier (if any) does NOT list VDR docs.
- Open NDA → engaged deals at `NDASigned`+ show real client names; VDR docs visible on `VDRAccess`/`DueDiligence` engagements.
- Closed NDA → real name + (at DD) VDR docs on the closed-NDA deal only.
- Greylisted → empty portal (no deals).

Use curl piped to grep for each check and record the outputs.

- [ ] **Step 4: Playwright visual verification (user-requested)**

Check availability: `npx playwright --version`. If missing: `npm i -D playwright && npx playwright install chromium`. Screenshot each URL to the session scratchpad (`playwright screenshot --full-page <url> <out.png>`; for portal/admin pages chain the viewpoint: `"http://localhost:3000/api/viewpoint?role=investor&recordId=<id>&next=<path>"`):

1. `/register` (form), `/register?step=verify&rid=<pendingId>` (demo OTP notice visible), `/register?step=done`
2. `/dashboard` — Investor Onboarding stat group
3. `/investors` — chip column + amber pending strip; `/investors?onboarding=PendingReview`
4. Pending investor detail — Onboarding + NDA panels
5. An engagement detail — NDA row
6. Portal as pending investor — "Registration under review"
7. Portal as approved investor — masked "Project …" teaser cards
8. A deal page after NDA — real name visible

Read each screenshot with the Read tool and confirm the expected element is actually rendered (not an error page). If Playwright cannot be installed, fall back to `chrome.exe --headless=new --screenshot=<out> --window-size=1440,900 --virtual-time-budget=8000 <url>` per repo dev-quirks memory.

- [ ] **Step 5: Field audit — no dead data**

Confirm each new field is written AND read somewhere in admin (grep for each): `onboardingStatus` (queue/chips/panel/dashboard), `emailVerifiedAt`/`phoneVerifiedAt` (onboarding panel), `registeredAt` (onboarding panel), `openNdaSignedAt` (NDA panel), `Engagement.ndaSignedAt` (NDA panel + engagement page). Fix any gap.

- [ ] **Step 6: Update trackers**

`repo:memory/remaining-tasks.md` — append: OTP `rid` query param is unauthenticated (anyone with the URL can stamp verification — acceptable only while the whole app is demo-auth); registration has no rate-limiting/captcha.
`repo:memory/client-meeting-questions.md` — append: (d) confirm the registration form's added "Fund type" (investor type) dropdown is acceptable; (e) confirm ticket-band boundaries for the deal-size dropdown.

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "feat(onboarding): demo data plant script, verification artifacts, tracker updates"
```

---

## Execution notes for the orchestrator

- Per user instruction: implement each task with a **Sonnet** subagent, review each task with an **Opus** subagent, and run the final whole-branch review as **Fable** (the main session), looping on fixes until clean.
- Tasks 1→6 are strictly ordered. Task 7 depends on 1; Tasks 8–9 depend on 6; Task 10 depends on everything.
- After the final review, use superpowers:finishing-a-development-branch.
