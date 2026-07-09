# Investor Onboarding Wizard + Wave-1 Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/register` as a polished 6-step wizard and fix the nine Wave-1 QA bugs, leaving the tree uncommitted for review.

**Architecture:** A `"use client"` wizard component holds all answers in React state and submits once at the end through an additive server action (`registerWizardAction`) that returns inline errors instead of redirecting — the existing server core (`register-investor.ts`) and OTP/done stages are untouched. Bug fixes are localized, each with its own test where a pure function exists.

**Tech Stack:** Next.js 16 (App Router, RSC + server actions), React 19 (`useActionState`), Prisma 6, Zod 4, Tailwind 4, `motion` (v12, `motion/react`), Vitest 4.

## Global Constraints

- **DO NOT COMMIT.** Leave the working tree dirty; the user commits only on explicit go-ahead. (Every "Commit" step in the standard template is replaced by a "Verify" step here — there are no `git commit` steps in this plan.)
- **Server core is untouched:** `src/server/onboarding/register-investor.ts` (`registerInvestor`, `confirmRegistrationOtp`, `DEMO_OTP="000000"`) and the existing `registerAction` / `verifyOtpAction` in `src/app/register/actions.ts` stay as-is. All new server code is additive.
- **Reuse, don't duplicate:** `options()` + `label()` from `@/lib/vocab`; `TICKET_BANDS` from `@/lib/ticket-bands`; `registrationSchema` + `isCorporateEmail` from `@/lib/schemas/registration`.
- **Preserve behaviour:** corporate-email rejection, DEMO OTP `000000`, and the "registration under review" outcome (creates a `PendingReview` investor → OTP → review queue).
- **Style:** match the current page — emerald palette (`emerald-950` buttons, `emerald-600` focus), `zinc` neutrals, the existing `inputClass` / `labelClass`. Animations via `import { motion } from "motion/react"` and the `EASE` curve from `@/components/ui/motion`.
- **Tests:** run a single file with `pnpm exec vitest run <path>`; full suite with `pnpm test`. Pre-existing lint/test failures in `clients-table.tsx`, `count-up.tsx`, `prisma/seed.ts`, `investors-crud.smoke.test.ts` are NOT ours — ignore them.
- **Windows/Prisma quirk:** if `prisma generate`/`migrate` throws EPERM (client DLL locked), stop the dev server first. The dev server is usually already running on :3000 — don't restart it needlessly. No schema changes are required by this plan.

---

## File Structure

**A — Wizard**
- Modify `src/app/register/page.tsx` — render `<RegisterWizard />` for the initial stage; keep `verify`/`done` stages (light restyle only).
- Create `src/app/register/register-steps.ts` — pure step definitions + per-step validation (`validateStep`) built from `registrationSchema.pick()`. Testable.
- Create `src/app/register/register-steps.test.ts` — unit tests for `validateStep`.
- Modify `src/app/register/actions.ts` — add `registerWizardAction` (additive; existing actions untouched).
- Create `src/app/register/register-wizard.tsx` — `"use client"` wizard component (state, steps, progress, motion, a11y, final submit via `useActionState`).

**B — Bug fixes**
- Modify `src/server/visibility/project.ts` — BUG-01 (mask document titles + fileUrl at PRE_INTEREST).
- Extend `src/server/visibility/__tests__/project.test.ts` — BUG-01 tests.
- (BUG-04, 10, 11, 12, 13, 14, 15 files pinned in their tasks below.)

---

## Task 1: BUG-01 — mask pre-interest document titles (P1 confidentiality)

**Files:**
- Modify: `src/server/visibility/project.ts` (`projectDocuments` ~200-225; call site line 299)
- Test: `src/server/visibility/__tests__/project.test.ts`

**Interfaces:**
- Consumes: `label` from `@/lib/vocab`; `dealCodename` from `@/server/visibility/codename` (already imported); the `displayName` local in `projectDealForInvestor` (equals `dealCodename(deal.id)` at PRE_INTEREST).
- Produces: `projectDocuments(documents, tier, ndaSatisfied, codename)` — same return shape (`ProjectedDocument[]`); at PRE_INTEREST each `name` becomes `` `${label("DocumentType", doc.type)} — ${codename}` `` and `fileUrl` becomes `null`.

- [ ] **Step 1: Write the failing tests**

Add to `src/server/visibility/__tests__/project.test.ts` (import `label` at top: `import { label } from "@/lib/vocab";`):

```ts
describe("BUG-01 — document titles must not leak client identity at PRE_INTEREST (§11)", () => {
  it("masks the document title with the deal codename and drops fileUrl", () => {
    const deal = makeDealFixture();
    deal.documents = [
      {
        id: "doc-teaser",
        name: "Teaser — SECRETCO Holdings Ltd",
        type: "Teaser",
        accessLevel: "InvestorShared",
        fileUrl: "https://vdr.example/SECRETCO-teaser.pdf",
      },
    ];
    const p = projectDealForInvestor(deal, "PRE_INTEREST");
    const teaser = p!.documents.find((d) => d.id === "doc-teaser")!;
    expect(teaser.name).toBe(`Teaser — ${dealCodename("txn-1")}`);
    expect(teaser.fileUrl).toBeNull();
    expect(JSON.stringify(p)).not.toContain("SECRETCO");
  });

  it("shows the real document title + fileUrl once past PRE_INTEREST", () => {
    const deal = makeDealFixture();
    deal.documents = [
      {
        id: "doc-teaser",
        name: "Teaser — Acme Agri Ltd",
        type: "Teaser",
        accessLevel: "InvestorShared",
        fileUrl: "https://vdr.example/acme.pdf",
      },
    ];
    const p = projectDealForInvestor(deal, "AFTER_NDA");
    const teaser = p!.documents.find((d) => d.id === "doc-teaser")!;
    expect(teaser.name).toBe("Teaser — Acme Agri Ltd");
    expect(teaser.fileUrl).toBe("https://vdr.example/acme.pdf");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/server/visibility/__tests__/project.test.ts`
Expected: the first new test FAILS — `teaser.name` is `"Teaser — SECRETCO Holdings Ltd"` (raw), `fileUrl` is the raw URL, and the JSON contains `"SECRETCO"`.

- [ ] **Step 3: Implement the mask**

In `src/server/visibility/project.ts`, add the vocab import near the other imports:

```ts
import { label } from "@/lib/vocab";
```

Change `projectDocuments` to take the codename and mask at PRE_INTEREST:

```ts
function projectDocuments(
  documents: DocumentInput[],
  tier: Exclude<Tier, "NONE">,
  ndaSatisfied: boolean,
  codename: string,
): ProjectedDocument[] {
  const masked = tier === "PRE_INTEREST";
  return documents
    .filter((doc) => {
      if (NEVER_SHARED_DOC_TYPES.includes(doc.type)) return false;
      if (doc.accessLevel === "Internal" || doc.accessLevel === "ClientShared") return false;
      if (doc.accessLevel === "VDR") return fieldAccess("vdrFiles", tier) === "full" && ndaSatisfied;
      if (tier === "PRE_INTEREST") return PRE_INTEREST_DOC_TYPES.includes(doc.type);
      return true;
    })
    .map((doc) => ({
      id: doc.id,
      // §11: at PRE_INTEREST the document label must not carry the real client
      // identity — replace it with the doc-type label + deal codename, and drop
      // fileUrl (a path could embed the real name).
      name: masked ? `${label("DocumentType", doc.type)} — ${codename}` : doc.name,
      type: doc.type,
      version: doc.version ?? null,
      status: doc.status ?? null,
      fileUrl: masked ? null : (doc.fileUrl ?? null),
    }));
}
```

Update the call site (line ~299) to pass the codename (`displayName` is the codename at PRE_INTEREST):

```ts
    documents: projectDocuments(deal.documents ?? [], tier, ndaSatisfied, displayName),
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/server/visibility/__tests__/project.test.ts`
Expected: PASS (all existing tests in the file still pass — the existing PRE_INTEREST doc-gating tests only assert on `id`, which is unchanged).

- [ ] **Step 5: Verify (no commit)**

Run: `pnpm exec vitest run src/server/visibility` — whole visibility suite green. Leave changes uncommitted.

---

## Task 2: Wizard foundations — step definitions, per-step validation, and the submit action

**Files:**
- Create: `src/app/register/register-steps.ts`
- Test: `src/app/register/register-steps.test.ts`
- Modify: `src/app/register/actions.ts` (add `registerWizardAction`)

**Interfaces:**
- Consumes: `registrationSchema`, `RegistrationInput` from `@/lib/schemas/registration`; `registerInvestor`, `RegistrationError` from `@/server/onboarding/register-investor`.
- Produces:
  - `type WizardValues` (8 string/string[] fields matching the registration input).
  - `EMPTY_WIZARD_VALUES: WizardValues`.
  - `STEP_FIELDS: readonly (readonly (keyof WizardValues)[])[]` — 5 input steps (review step has no entry).
  - `STEP_COUNT = 6`.
  - `validateStep(stepIndex: number, values: WizardValues): { ok: true } | { ok: false; errors: Partial<Record<keyof WizardValues, string>> }`.
  - `type WizardActionState = { error?: string }` and `registerWizardAction(prev: WizardActionState, formData: FormData): Promise<WizardActionState>` — redirects to `?step=verify&rid=…` on success, returns `{ error }` on failure.

- [ ] **Step 1: Write the failing tests**

Create `src/app/register/register-steps.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { validateStep, EMPTY_WIZARD_VALUES, STEP_FIELDS, STEP_COUNT } from "./register-steps";

const filled = {
  fundName: "Savannah Growth Partners",
  contactPerson: "Ada Obi",
  email: "ada@savannah.com",
  phone: "+254700111222",
  investorType: "PrivateEquity",
  sectorPreference: ["Technology"],
  dealType: "Equity",
  dealSizeBand: "1m-5m",
};

describe("wizard step config", () => {
  it("has 5 input steps + a review step", () => {
    expect(STEP_FIELDS.length).toBe(5);
    expect(STEP_COUNT).toBe(6);
  });
});

describe("validateStep", () => {
  it("step 0 (fund name) rejects empty, accepts filled", () => {
    expect(validateStep(0, EMPTY_WIZARD_VALUES).ok).toBe(false);
    expect(validateStep(0, { ...EMPTY_WIZARD_VALUES, fundName: "X" }).ok).toBe(true);
  });

  it("step 1 (contact) rejects a free-provider email with a field error", () => {
    const res = validateStep(1, { ...filled, email: "ada@gmail.com" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.email).toMatch(/corporate email/i);
  });

  it("step 1 accepts a corporate email", () => {
    expect(validateStep(1, filled).ok).toBe(true);
  });

  it("step 3 (sectors) requires at least one sector", () => {
    expect(validateStep(3, { ...filled, sectorPreference: [] }).ok).toBe(false);
    expect(validateStep(3, filled).ok).toBe(true);
  });

  it("step 4 (deal prefs) validates type + band together", () => {
    expect(validateStep(4, { ...filled, dealSizeBand: "" }).ok).toBe(false);
    expect(validateStep(4, filled).ok).toBe(true);
  });

  it("review step (index 5) has nothing to validate", () => {
    expect(validateStep(5, EMPTY_WIZARD_VALUES).ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/app/register/register-steps.test.ts`
Expected: FAIL — `Cannot find module './register-steps'`.

- [ ] **Step 3: Implement `register-steps.ts`**

Create `src/app/register/register-steps.ts`:

```ts
// Pure wizard config + per-step validation for /register.
// Validation reuses registrationSchema so client checks are identical to the
// server's (including the corporate-email refinement). No React here.
import { registrationSchema } from "@/lib/schemas/registration";

export interface WizardValues {
  fundName: string;
  contactPerson: string;
  email: string;
  phone: string;
  investorType: string;
  sectorPreference: string[];
  dealType: string;
  dealSizeBand: string;
}

export const EMPTY_WIZARD_VALUES: WizardValues = {
  fundName: "",
  contactPerson: "",
  email: "",
  phone: "",
  investorType: "",
  sectorPreference: [],
  dealType: "",
  dealSizeBand: "",
};

/** Fields shown on each input step (light grouping). Review = index 5, no entry. */
export const STEP_FIELDS = [
  ["fundName"],
  ["contactPerson", "email", "phone"],
  ["investorType"],
  ["sectorPreference"],
  ["dealType", "dealSizeBand"],
] as const satisfies readonly (readonly (keyof WizardValues)[])[];

/** 5 input steps + 1 review step. */
export const STEP_COUNT = STEP_FIELDS.length + 1;

type StepValidation =
  | { ok: true }
  | { ok: false; errors: Partial<Record<keyof WizardValues, string>> };

export function validateStep(stepIndex: number, values: WizardValues): StepValidation {
  const fields = STEP_FIELDS[stepIndex];
  if (!fields) return { ok: true }; // review step

  const pickShape = Object.fromEntries(fields.map((f) => [f, true]));
  const schema = registrationSchema.pick(pickShape as Parameters<typeof registrationSchema.pick>[0]);
  const subset = Object.fromEntries(fields.map((f) => [f, values[f]]));

  const res = schema.safeParse(subset);
  if (res.success) return { ok: true };

  const errors: Partial<Record<keyof WizardValues, string>> = {};
  for (const issue of res.error.issues) {
    const key = issue.path[0] as keyof WizardValues | undefined;
    if (key && !errors[key]) errors[key] = issue.message;
  }
  return { ok: false, errors };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/app/register/register-steps.test.ts`
Expected: PASS (all 7 assertions).

- [ ] **Step 5: Add `registerWizardAction` to `actions.ts`**

Append to `src/app/register/actions.ts` (keep the existing imports/actions; the raw-parse block mirrors `registerAction` exactly):

```ts
export interface WizardActionState {
  error?: string;
}

/**
 * Wizard submit: same core as registerAction, but returns an inline error
 * (so the client wizard keeps its state) instead of redirecting to ?error=.
 * Redirects to the OTP step on success.
 */
export async function registerWizardAction(
  _prev: WizardActionState,
  formData: FormData,
): Promise<WizardActionState> {
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
      return { error: err.issues[0]?.message ?? "Check the form and try again" };
    }
    if (err instanceof RegistrationError) {
      return { error: err.message };
    }
    throw err;
  }
  redirect(`/register?step=verify&rid=${investorId}`);
}
```

- [ ] **Step 6: Verify (no commit)**

Run: `pnpm exec vitest run src/app/register/register-steps.test.ts` and `pnpm exec tsc --noEmit` (typecheck). Expected: tests pass; no NEW type errors in `register-steps.ts` / `actions.ts`. Leave uncommitted.

---

## Task 3: Wizard component + wire into the register page

**Files:**
- Create: `src/app/register/register-wizard.tsx`
- Modify: `src/app/register/page.tsx`

**Interfaces:**
- Consumes: `WizardValues`, `EMPTY_WIZARD_VALUES`, `STEP_FIELDS`, `STEP_COUNT`, `validateStep` from `./register-steps`; `registerWizardAction`, `WizardActionState` from `./actions`; `options` + `label` from `@/lib/vocab`; `TICKET_BANDS` from `@/lib/ticket-bands`; `EASE` from `@/components/ui/motion`; `motion`, `AnimatePresence` from `motion/react`.
- Produces: default-exported `<RegisterWizard />` (no props). Renders the 6-step flow; on final submit navigates to `?step=verify&rid=…`.

- [ ] **Step 1: Implement `register-wizard.tsx`**

Create `src/app/register/register-wizard.tsx`:

```tsx
"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { options, label } from "@/lib/vocab";
import { TICKET_BANDS } from "@/lib/ticket-bands";
import { EASE } from "@/components/ui/motion";
import { registerWizardAction, type WizardActionState } from "./actions";
import {
  EMPTY_WIZARD_VALUES,
  STEP_COUNT,
  STEP_FIELDS,
  validateStep,
  type WizardValues,
} from "./register-steps";

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 " +
  "placeholder:text-zinc-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600";
const labelClass = "block text-xs font-medium uppercase tracking-wide text-zinc-500";
const errorClass = "mt-1 text-xs text-rose-600";

const STEP_TITLES = [
  "What's your fund or entity called?",
  "How do we reach you?",
  "What kind of investor are you?",
  "Which sectors interest you?",
  "What deals are you looking for?",
  "Review your details",
];

export default function RegisterWizard() {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<WizardValues>(EMPTY_WIZARD_VALUES);
  const [errors, setErrors] = useState<Partial<Record<keyof WizardValues, string>>>({});
  const [serverState, submitAction, isPending] = useActionState<WizardActionState, FormData>(
    registerWizardAction,
    {},
  );
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const isReview = step === STEP_FIELDS.length; // index 5
  const set = <K extends keyof WizardValues>(key: K, value: WizardValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const goNext = () => {
    const res = validateStep(step, values);
    if (!res.ok) {
      setErrors(res.errors);
      return;
    }
    setErrors({});
    setStep((s) => Math.min(s + 1, STEP_COUNT - 1));
  };
  const goBack = () => setStep((s) => Math.max(s - 1, 0));
  const goTo = (target: number) => {
    setErrors({});
    setStep(target);
  };

  // Enter advances on non-textarea single inputs.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isReview) {
      e.preventDefault();
      goNext();
    }
  };

  const progress = Math.round(((step + 1) / STEP_COUNT) * 100);

  return (
    <div className="w-full max-w-2xl space-y-6">
      {/* Progress */}
      <div>
        <div className="flex items-center justify-between text-xs font-medium text-zinc-500">
          <span aria-live="polite">Step {step + 1} of {STEP_COUNT}</span>
          <a href="/login" className="text-emerald-800 hover:underline">
            Already registered? Sign in
          </a>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200">
          <motion.div
            className="h-full rounded-full bg-emerald-600"
            initial={false}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4, ease: EASE }}
          />
        </div>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.28, ease: EASE }}
          >
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="text-xl font-bold text-zinc-900 outline-none"
            >
              {STEP_TITLES[step]}
            </h2>

            <div className="mt-5 space-y-4" onKeyDown={onKeyDown}>
              {step === 0 && (
                <Field label="Fund / entity name" error={errors.fundName}>
                  <input
                    autoFocus
                    className={inputClass}
                    placeholder="e.g. Savannah Growth Partners"
                    value={values.fundName}
                    onChange={(e) => set("fundName", e.target.value)}
                  />
                </Field>
              )}

              {step === 1 && (
                <>
                  <Field label="Contact person" error={errors.contactPerson}>
                    <input
                      autoFocus
                      className={inputClass}
                      placeholder="Full name"
                      value={values.contactPerson}
                      onChange={(e) => set("contactPerson", e.target.value)}
                    />
                  </Field>
                  <Field
                    label="Corporate email"
                    error={errors.email}
                    hint="Corporate email only — free providers are not accepted"
                  >
                    <input
                      type="email"
                      className={inputClass}
                      placeholder="name@fund.com"
                      value={values.email}
                      onChange={(e) => set("email", e.target.value)}
                    />
                  </Field>
                  <Field label="Phone" error={errors.phone} hint="Used for OTP verification">
                    <input
                      type="tel"
                      className={inputClass}
                      placeholder="+254 700 000000"
                      value={values.phone}
                      onChange={(e) => set("phone", e.target.value)}
                    />
                  </Field>
                </>
              )}

              {step === 2 && (
                <Field label="Investor type" error={errors.investorType}>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {options("InvestorType").map((o) => (
                      <RadioCard
                        key={o.value}
                        name="investorType"
                        checked={values.investorType === o.value}
                        onSelect={() => set("investorType", o.value)}
                        labelText={o.label}
                      />
                    ))}
                  </div>
                </Field>
              )}

              {step === 3 && (
                <Field
                  label="Sector preference"
                  error={errors.sectorPreference}
                  hint="Select all that apply"
                >
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {options("Sector").map((o) => {
                      const active = values.sectorPreference.includes(o.value);
                      return (
                        <button
                          type="button"
                          key={o.value}
                          onClick={() =>
                            set(
                              "sectorPreference",
                              active
                                ? values.sectorPreference.filter((s) => s !== o.value)
                                : [...values.sectorPreference, o.value],
                            )
                          }
                          aria-pressed={active}
                          className={
                            "rounded-md border px-2 py-1.5 text-left text-sm transition " +
                            (active
                              ? "border-emerald-600 bg-emerald-50 text-emerald-900"
                              : "border-zinc-200 text-zinc-700 hover:border-zinc-300")
                          }
                        >
                          {o.label}
                        </button>
                      );
                    })}
                  </div>
                </Field>
              )}

              {step === 4 && (
                <>
                  <Field label="Deal type" error={errors.dealType}>
                    <select
                      className={inputClass}
                      value={values.dealType}
                      onChange={(e) => set("dealType", e.target.value)}
                    >
                      <option value="" disabled>— Select deal type —</option>
                      {options("Instrument").map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Deal size" error={errors.dealSizeBand}>
                    <select
                      className={inputClass}
                      value={values.dealSizeBand}
                      onChange={(e) => set("dealSizeBand", e.target.value)}
                    >
                      <option value="" disabled>— Select deal size —</option>
                      {TICKET_BANDS.map((b) => (
                        <option key={b.key} value={b.key}>{b.label}</option>
                      ))}
                    </select>
                  </Field>
                </>
              )}

              {isReview && (
                <Review values={values} onEdit={goTo} serverError={serverState.error} />
              )}
            </div>

            {/* Nav */}
            <div className="mt-6 flex items-center justify-between border-t border-zinc-100 pt-4">
              <button
                type="button"
                onClick={goBack}
                disabled={step === 0}
                className="rounded-full px-4 py-2 text-sm font-medium text-zinc-600 hover:text-emerald-950 disabled:opacity-0"
              >
                ← Back
              </button>

              {!isReview ? (
                <button
                  type="button"
                  onClick={goNext}
                  className="rounded-full bg-emerald-950 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-900"
                >
                  Next →
                </button>
              ) : (
                <form action={submitAction}>
                  <input type="hidden" name="fundName" value={values.fundName} />
                  <input type="hidden" name="contactPerson" value={values.contactPerson} />
                  <input type="hidden" name="email" value={values.email} />
                  <input type="hidden" name="phone" value={values.phone} />
                  <input type="hidden" name="investorType" value={values.investorType} />
                  {values.sectorPreference.map((s) => (
                    <input key={s} type="hidden" name="sectorPreference" value={s} />
                  ))}
                  <input type="hidden" name="dealType" value={values.dealType} />
                  <input type="hidden" name="dealSizeBand" value={values.dealSizeBand} />
                  <button
                    type="submit"
                    disabled={isPending}
                    className="rounded-full bg-emerald-950 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-60"
                  >
                    {isPending ? "Submitting…" : "Submit registration"}
                  </button>
                </form>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </section>
    </div>
  );
}

function Field({
  label: labelText,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <span className={labelClass}>{labelText}</span>
      <div className="mt-1">{children}</div>
      {hint && !error && <p className="mt-1 text-xs text-zinc-400">{hint}</p>}
      {error && <p className={errorClass}>{error}</p>}
    </div>
  );
}

function RadioCard({
  name,
  checked,
  onSelect,
  labelText,
}: {
  name: string;
  checked: boolean;
  onSelect: () => void;
  labelText: string;
}) {
  return (
    <label
      className={
        "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition " +
        (checked
          ? "border-emerald-600 bg-emerald-50 text-emerald-900"
          : "border-zinc-200 text-zinc-700 hover:border-zinc-300")
      }
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onSelect}
        className="h-4 w-4 text-emerald-600 focus:ring-emerald-600"
      />
      {labelText}
    </label>
  );
}

function Review({
  values,
  onEdit,
  serverError,
}: {
  values: WizardValues;
  onEdit: (step: number) => void;
  serverError?: string;
}) {
  const rows: { label: string; value: string; step: number }[] = [
    { label: "Fund / entity", value: values.fundName, step: 0 },
    { label: "Contact", value: `${values.contactPerson} · ${values.email} · ${values.phone}`, step: 1 },
    { label: "Investor type", value: label("InvestorType", values.investorType), step: 2 },
    {
      label: "Sectors",
      value: values.sectorPreference.map((s) => label("Sector", s)).join(", "),
      step: 3,
    },
    {
      label: "Deal preference",
      value: `${label("Instrument", values.dealType)} · ${
        TICKET_BANDS.find((b) => b.key === values.dealSizeBand)?.label ?? ""
      }`,
      step: 4,
    },
  ];
  return (
    <div className="space-y-3">
      {serverError && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {serverError}
        </div>
      )}
      <dl className="divide-y divide-zinc-100 rounded-lg border border-zinc-200">
        {rows.map((r) => (
          <div key={r.label} className="flex items-start justify-between gap-4 px-4 py-3">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">{r.label}</dt>
              <dd className="mt-0.5 text-sm text-zinc-900">{r.value || "—"}</dd>
            </div>
            <button
              type="button"
              onClick={() => onEdit(r.step)}
              className="shrink-0 text-xs font-medium text-emerald-800 hover:underline"
            >
              Edit
            </button>
          </div>
        ))}
      </dl>
      <p className="text-xs text-zinc-400">
        After you submit, we'll verify your email and phone, then a NobleStride team member reviews
        your request. No deal information is visible before approval.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Wire the wizard into `page.tsx`**

In `src/app/register/page.tsx`, add the import and replace the `step === "form"` block. Add near the top imports:

```tsx
import RegisterWizard from "./register-wizard";
```

Replace the entire `{step === "form" && ( ... )}` `<section>...</section>` block (lines ~53-216) with:

```tsx
        {step === "form" && <RegisterWizard />}
```

Then remove the now-duplicated centered `<h1>`/subtitle for the form step so headings don't double up — change the header block so the big `<h1>` and its subtitle only render for `verify`/`done`:

```tsx
        {step !== "form" && (
          <div className="text-center">
            <h1 className="text-2xl font-bold text-zinc-900">
              {step === "verify" && "Verify your registration"}
              {step === "done" && "Registration received"}
            </h1>
          </div>
        )}
```

Leave the `sp.error` banner, and the `verify` and `done` `<section>`s exactly as they are. (Note: the `options`, `TICKET_BANDS`, and `labelClass`/`inputClass` consts in `page.tsx` are still used by the `verify` section's inputs — keep them.)

- [ ] **Step 3: Typecheck + build sanity**

Run: `pnpm exec tsc --noEmit`
Expected: no NEW errors from `register-wizard.tsx` / `page.tsx`.

- [ ] **Step 4: Verify live (deferred to final Playwright pass)**

The wizard's runtime behaviour (step nav, corporate-email rejection with state preserved, submit → OTP → done) is covered in the final Playwright verification section. Leave uncommitted.

---
## Task 4: BUG-04 — bind the org-role lens `<select>` to the active viewpoint

**Files:**
- Modify: `src/components/shell/viewpoint-switcher.tsx` (props + initial state)
- Modify: `src/components/shell/topbar.tsx` (thread props through)
- Modify: `src/app/(crm)/layout.tsx` (pass the active viewpoint down)

**Interfaces:**
- Consumes: `getViewpoint()` result `vp` (already in `layout.tsx`) — `vp.orgRole` (`"Admin"|"DealLead"|"TeamMember"`) and `vp.userId`.
- Produces: `ViewpointSwitcher` gains optional props `activeOrgRole?: string` (default `"Admin"`) and `activeUserId?: string`; initializes the org-role select from `activeOrgRole` and the team-member picker from `activeUserId`.

**Note:** In the CRM shell `vp.role` is always `"admin"` (investor/partner viewpoints redirect to their portal at `layout.tsx:18-19`), so only the org-role and user pickers need binding.

- [ ] **Step 1: Add props + initialize state in `viewpoint-switcher.tsx`**

Change the component signature and the `orgRole` initial state:

```tsx
export function ViewpointSwitcher({
  investors,
  partners,
  users = [],
  activeOrgRole = "Admin",
  activeUserId,
}: {
  investors: ViewpointOption[];
  partners: ViewpointOption[];
  users?: ViewpointOption[];
  activeOrgRole?: string;
  activeUserId?: string;
}) {
  const [role, setRole] = useState<"admin" | "investor" | "partner">("admin");
  const [orgRole, setOrgRole] = useState<string>(activeOrgRole);
```

And bind the team-member picker to the active user — change its `defaultValue=""` (line ~82) to:

```tsx
          defaultValue={activeUserId ?? ""}
```

- [ ] **Step 2: Thread the props through `topbar.tsx`**

Add the two props to `Topbar` and forward them. Change the `Topbar` signature:

```tsx
export function Topbar({
  investors = [],
  partners = [],
  users = [],
  activeOrgRole,
  activeUserId,
}: {
  investors?: ViewpointOption[];
  partners?: ViewpointOption[];
  users?: ViewpointOption[];
  activeOrgRole?: string;
  activeUserId?: string;
}) {
```

And the render (line ~107):

```tsx
        <ViewpointSwitcher
          investors={investors}
          partners={partners}
          users={users}
          activeOrgRole={activeOrgRole}
          activeUserId={activeUserId}
        />
```

- [ ] **Step 3: Pass the active viewpoint from `layout.tsx`**

Change the `<Topbar ... />` render (line ~39) to:

```tsx
        <Topbar
          investors={investors}
          partners={partners}
          users={users}
          activeOrgRole={vp.orgRole ?? "Admin"}
          activeUserId={vp.userId}
        />
```

- [ ] **Step 4: Verify (typecheck; live in final pass)**

Run: `pnpm exec tsc --noEmit` — no NEW errors. Behaviour verified in the Playwright pass (Task 11): switch to Team Member → the dropdown reads "Team Member", not "Admin". Leave uncommitted.

---

## Task 5: BUG-10 — require at least one linked record on task create

**Files:**
- Modify: `src/lib/schemas/task.ts` (refine create schema)
- Test: `src/lib/schemas/task.test.ts` (create)
- Modify: `src/components/crm/task-form-drawer.tsx` (render the form-level error)

**Interfaces:**
- Consumes: `taskCreateSchema` / `taskUpdateSchema` are already imported by `task-form-drawer.tsx` and re-parsed server-side in `src/server/services/tasks.ts` (so the refine enforces server-side too, for free).
- Produces: `taskCreateSchema` now rejects input with no linked record; the error has **no path** so `useEntityForm` maps it to `errors["_"]`, which the drawer renders.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/schemas/task.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { taskCreateSchema, taskUpdateSchema } from "./task";

describe("taskCreateSchema — linked record required (§3.8)", () => {
  it("rejects a task with no linked record", () => {
    const res = taskCreateSchema.safeParse({ title: "Follow up" });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0].message).toMatch(/at least one record/i);
      expect(res.error.issues[0].path).toEqual([]); // form-level, no field path
    }
  });

  it("accepts a task linked to an investor", () => {
    expect(taskCreateSchema.safeParse({ title: "Follow up", investorId: "inv-1" }).success).toBe(true);
  });

  it("accepts a task linked to a mandate/transaction/client", () => {
    expect(taskCreateSchema.safeParse({ title: "x", mandateId: "m1" }).success).toBe(true);
    expect(taskCreateSchema.safeParse({ title: "x", transactionId: "t1" }).success).toBe(true);
    expect(taskCreateSchema.safeParse({ title: "x", clientId: "c1" }).success).toBe(true);
  });

  it("update schema does NOT require a link (partial edits)", () => {
    expect(taskUpdateSchema.safeParse({ title: "renamed" }).success).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/lib/schemas/task.test.ts`
Expected: FAIL — the first test currently passes parsing (no link required today).

- [ ] **Step 3: Refine the schema**

Rewrite `src/lib/schemas/task.ts` so the base object is refined only for create (update stays partial + unrefined):

```ts
import { z } from "zod";
import { TaskStatus, TaskSource } from "@prisma/client";

// Spec §3.8: a task must be linked to at least one record (mandate,
// transaction, investor, or client). `escalated` is intentionally NOT a field
// (spec §3.8 marks it Auto — computed by the task service, never caller-set).
const taskBaseSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  status: z.nativeEnum(TaskStatus).optional(),
  source: z.nativeEnum(TaskSource).optional(),
  dueAt: z.coerce.date().optional(),
  body: z.string().trim().optional(),
  assigneeId: z.string().trim().optional(),
  assistantId: z.string().trim().optional(),
  mandateId: z.string().trim().optional(),
  transactionId: z.string().trim().optional(),
  investorId: z.string().trim().optional(),
  clientId: z.string().trim().optional(),
  activityId: z.string().trim().optional(),
});

const hasLinkedRecord = (v: {
  mandateId?: string;
  transactionId?: string;
  investorId?: string;
  clientId?: string;
}) => Boolean(v.mandateId || v.transactionId || v.investorId || v.clientId);

export const taskCreateSchema = taskBaseSchema.refine(hasLinkedRecord, {
  message: "Link the task to at least one record (mandate, transaction, investor, or client).",
});
export const taskUpdateSchema = taskBaseSchema.partial();
export type TaskCreateInput = z.infer<typeof taskCreateSchema>;
export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/lib/schemas/task.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Surface the error in the drawer**

In `src/components/crm/task-form-drawer.tsx`, render the form-level error (`f.errors._`) just above the linked-record selects. Insert immediately before the Mandate `RelationSelect` (line ~74):

```tsx
          {f.errors._ && (
            <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-600">{f.errors._}</p>
          )}
          <RelationSelect label="Mandate" value={v.mandateId as string} onChange={(x) => f.setValue("mandateId", x)} options={mandates} placeholder="Select mandate…" />
```

(Leave the existing `{f.formError && ...}` at line ~84 as-is — it still surfaces server errors.)

- [ ] **Step 6: Verify (typecheck; live in final pass)**

Run: `pnpm exec tsc --noEmit` and `pnpm exec vitest run src/lib/schemas/task.test.ts`. Expected: green. Live: saving a task with no link shows the message and does not close the drawer (Task 11). Leave uncommitted.

---

## Task 6: BUG-11 — pluralize the tasks header count

**Files:**
- Modify: `src/app/(crm)/tasks/page.tsx` (line ~75)

- [ ] **Step 1: Fix the copy**

Replace the header count line (line ~75):

```tsx
      {tasks.length} action points across the team
```

with:

```tsx
      {tasks.length} action point{tasks.length === 1 ? "" : "s"} across the team
```

- [ ] **Step 2: Check for sibling occurrences**

Run: `pnpm exec rg -n "action points|actions across" src/` (or the Grep tool). If another header hard-codes the plural against a count of 1, apply the same `count === 1 ? "" : "s"` guard. (Only fix real count-driven strings; leave static labels alone.)

- [ ] **Step 3: Verify (live in final pass)**

Verified in Task 11: seed a state with exactly one task (or read the current count) → header reads "1 action point". Leave uncommitted.

---

## Task 7: BUG-12 — condition the portal footer on NDA status

**Files:**
- Modify: `src/app/portal/investor/layout.tsx` (select at ~23-24; footer at ~91-93)

**Interfaces:**
- Consumes: `Investor.ndaStatus` (`InvestorNdaStatus` = `None | OpenNDA | ClosedNDA`, `prisma/schema.prisma`).

- [ ] **Step 1: Select `ndaStatus`**

In the `prisma.investor.findUnique` `select` (line ~23-24), add `ndaStatus`:

```tsx
          select: { name: true, onboardingStatus: true, engagementClassification: true, ndaStatus: true },
```

- [ ] **Step 2: Branch the footer copy**

Replace the footer paragraph (line ~91-93):

```tsx
            <p className="pt-8 text-xs text-zinc-400">
              Confidential — shared under the terms of your NDA with NobleStride Capital.
            </p>
```

with:

```tsx
            <p className="pt-8 text-xs text-zinc-400">
              {investor && investor.ndaStatus !== "None"
                ? "Confidential — shared under the terms of your NDA with NobleStride Capital."
                : "Confidential — for your review only. Please do not distribute."}
            </p>
```

- [ ] **Step 3: Verify (typecheck; live in final pass)**

Run: `pnpm exec tsc --noEmit` — no NEW errors. Live: a just-approved investor with `ndaStatus = None` (e.g. the wizard-created fund) shows the neutral copy; an OpenNDA/ClosedNDA investor shows the NDA copy (Task 11). Leave uncommitted.

---

## Task 8: BUG-13 — one `<h1>` on the investor Opportunities page

**Files:**
- Modify: `src/app/portal/investor/page.tsx` (line ~31)

**Note:** The persistent portal topbar (`investor-topbar.tsx:19`) renders `<h1>{title}</h1>` on every page, so the page body's `<h1>` is the duplicate. Demote the page-body heading (keeps the topbar as the single `<h1>`).

- [ ] **Step 1: Demote the page heading**

Replace (line ~31):

```tsx
      <h1 className="text-2xl font-bold text-zinc-900">Investment Opportunities</h1>
```

with:

```tsx
      <h2 className="text-2xl font-bold text-zinc-900">Investment Opportunities</h2>
```

- [ ] **Step 2: Verify (live in final pass)**

Verified in Task 11: `document.querySelectorAll('h1')` on `/portal/investor` returns exactly one. Leave uncommitted. (The same topbar+page `<h1>` pattern exists on other portal pages — out of scope for this bug; flag to user.)

---

## Task 9: BUG-14 — express-interest keeps the form and shows a banner

**Files:**
- Modify: `src/app/portal/investor/deals/[id]/page.tsx` (section at ~236-272)

**Note:** The `?interest=` search param (read at line ~66) currently swaps the form OUT for a confirmation. Change it to show a banner ABOVE a form that always renders.

- [ ] **Step 1: Render banner + form together**

Replace the interest section (line ~236-272) with:

```tsx
        <section className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-emerald-700/70">
            {journey ? "Request More Information" : "Express Interest"}
          </h2>
          {interest && (
            <p className="mt-2 rounded-md bg-emerald-100/70 px-3 py-2 text-sm font-medium text-emerald-900">
              Thank you — your request has been sent to the NobleStride team. They will follow up
              shortly.
            </p>
          )}
          <p className="mt-2 text-sm text-emerald-900">
            {journey
              ? "Need something specific — data room access, a management call, updated financials? Let the deal team know."
              : "Interested in this opportunity? Register your interest and the NobleStride team will start your process."}
          </p>
          <form action={expressInterest} className="mt-3 space-y-3">
            <input type="hidden" name="dealId" value={deal.id} />
            <textarea
              name="message"
              rows={3}
              placeholder="Optional message for the deal team…"
              className="w-full rounded-md border border-emerald-200 bg-white px-3 py-2 text-sm text-emerald-950 placeholder:text-emerald-700/40 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-emerald-800/70">{deal.contact}</span>
              <button
                type="submit"
                className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
              >
                {journey ? "Send request" : "Express interest"}
              </button>
            </div>
          </form>
        </section>
```

> The `textarea` className above reproduces the existing styling — if the current file's `textarea` class differs, keep the file's exact class string; only the structure (banner + always-rendered form) is the change.

- [ ] **Step 2: Verify (live in final pass)**

Verified in Task 11: send a request → banner appears AND the form remains, so a second request is possible without reload. Leave uncommitted.

---

## Task 10: BUG-15 — gate the impersonation switcher to admin; clear test-junk investors

**Files:**
- Modify: `src/lib/viewpoint.ts` (add `impersonating` flag to type + parse + serialize)
- Test: `src/lib/__tests__/viewpoint.test.ts` (extend)
- Modify: `src/app/api/viewpoint/route.ts` (mark portal switches as impersonation)
- Modify: `src/components/portal/viewing-banner.tsx` (show switcher only when impersonating)
- Verify: reseed clears runtime junk (no seed-file edit needed — see note)

**Interfaces:**
- Produces: `Viewpoint.impersonating?: boolean` — present (`true`) only for admin-initiated portal impersonation; absent for a real `/login`. `parseViewpoint` adds it only when true (keeps existing round-trip tests green).

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/__tests__/viewpoint.test.ts`:

```ts
describe("viewpoint impersonation flag (BLOCKER-A gate)", () => {
  it("round-trips impersonating=true for a portal role", () => {
    const raw = serializeViewpoint({ role: "investor", recordId: "i1", impersonating: true });
    expect(parseViewpoint(raw)).toEqual({ role: "investor", recordId: "i1", impersonating: true });
  });

  it("a real login (no flag) has no impersonating key", () => {
    const raw = serializeViewpoint({ role: "investor", recordId: "i1" });
    expect(parseViewpoint(raw)).toEqual({ role: "investor", recordId: "i1" });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/lib/__tests__/viewpoint.test.ts`
Expected: the first new test FAILS (impersonating is dropped today).

- [ ] **Step 3: Add the flag to `viewpoint.ts`**

Add to the `Viewpoint` type (after `userId`):

```ts
  /** True only for admin-initiated portal impersonation (via /api/viewpoint);
   *  absent for a real /login. Gates the in-portal "view as" switcher. */
  impersonating?: boolean;
```

In `parseViewpoint`, widen the parsed shape to include `impersonating?: boolean`, and change the investor/partner branch to preserve it (added ONLY when true, so existing round-trip tests stay exact):

```ts
    if (parsed.role === "investor" || parsed.role === "partner") {
      if (!parsed.recordId) return ADMIN_VIEWPOINT;
      const vp: Viewpoint = { role: parsed.role, recordId: parsed.recordId };
      if (parsed.impersonating === true) vp.impersonating = true;
      return vp;
    }
```

In `serializeViewpoint`, include it for non-admin when set:

```ts
  if (vp.role !== "admin") {
    return JSON.stringify(
      vp.impersonating
        ? { role: vp.role, recordId: vp.recordId, impersonating: true }
        : { role: vp.role, recordId: vp.recordId },
    );
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/lib/__tests__/viewpoint.test.ts`
Expected: PASS (existing + 2 new tests).

- [ ] **Step 5: Mark portal switches as impersonation in the route**

In `src/app/api/viewpoint/route.ts`, set the flag when the requested role is a portal role (reaching this route to assume a portal identity is an admin action; `/login` sets its cookie directly and never hits this):

```ts
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
```

- [ ] **Step 6: Gate the switcher + "Return to Admin" in the banner**

In `src/components/portal/viewing-banner.tsx`, only render `<PortalSwitcher>` when impersonating; otherwise show a static fund name. Replace the `{vp.role === "investor" || vp.role === "partner" ? (...) : (...)}` block (lines ~42-51):

```tsx
          {vp.role === "investor" || vp.role === "partner" ? (
            vp.impersonating ? (
              <PortalSwitcher
                role={vp.role}
                recordId={vp.recordId ?? ""}
                investors={investorOptions}
                partners={partnerOptions}
              />
            ) : (
              <span className="font-semibold">{current?.name ?? "Your account"}</span>
            )
          ) : (
            <span className="font-semibold capitalize">{vp.role}</span>
          )}
```

And gate the "Return to Admin" link so a real portal user has no admin escape hatch (keep "Sign out" always). Replace the right-side controls (lines ~59-72):

```tsx
      <span className="inline-flex items-center gap-2">
        {vp.impersonating && (
          <Link
            href="/api/viewpoint?role=admin"
            className="rounded-md border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
          >
            Return to Admin
          </Link>
        )}
        <Link
          href="/api/viewpoint?role=signout"
          className="rounded-md border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
        >
          Sign out
        </Link>
      </span>
```

- [ ] **Step 7: Clear the runtime test-junk investors (no seed-file edit)**

**Finding (confirmed):** none of the seven names (`asd`, `abc23`, `test2`, `Test1`, `E2E Probe Capital`, `Gate Check Capital`, `Meridian Frontier Capital`) exist in `prisma/seed-data.json` or `prisma/seed.ts`. Six are runtime-created QA rows that live only in the DB; `Meridian Frontier Capital` is created solely by the manual `scripts/plant-onboarding-data.ts` (not the seed). `prisma/seed.ts` does `investor.deleteMany()` then recreates only from `seed-data.json`, so a reseed clears all seven.

Action: reseed the dev DB (this is also the BUG-15 reseed the final verification needs):

```bash
cd noblestride-crm && pnpm db:reset && pnpm seed
```

(Stop the dev server first if `prisma migrate reset` hits an EPERM DLL lock, then restart it after.) Do NOT run `scripts/plant-onboarding-data.ts` (it would re-plant "Meridian Frontier Capital"). **Flag to user:** if a named PendingReview investor is wanted for the approval-queue demo, it should be added to `seed-data.json` with a realistic name rather than re-running the plant script — out of scope for this task.

- [ ] **Step 8: Verify (live in final pass)**

Verified in Task 11: `/login` as a real investor (`cmiriti@ifc.org`) → the portal banner shows the fund name with NO "view as" dropdown and NO "Return to Admin"; an admin impersonating via the CRM switcher DOES see both. Junk investors absent from `/investors`. Leave uncommitted.

---

## Task 11: Live end-to-end verification (Playwright) — no code, evidence only

Run against the dev server on `http://localhost:3000` (start with `cd noblestride-crm && pnpm dev` if needed; reseed already done in Task 10 Step 7). Capture a screenshot or DOM assertion for each. This task produces the before/after evidence report; it changes no code.

- [ ] **Step 1: Full suite + typecheck gate**

Run: `cd noblestride-crm && pnpm test` (whole vitest suite) and `pnpm exec tsc --noEmit`. Expected: our new tests pass; only the pre-existing known failures (clients-table.tsx, count-up.tsx, seed.ts, investors-crud.smoke.test.ts) remain — no NEW failures.

- [ ] **Step 2: Wizard happy path**

Navigate `/register`. Walk all 6 steps with a corporate email (e.g. `founder@savannahgrowth.com`). Confirm: progress bar advances, Back preserves entered values, Review shows all answers with working Edit jumps. Submit → OTP screen → enter `000000` / `000000` → "Registration received" / "under review". Screenshot each distinct screen.

- [ ] **Step 3: Wizard validation (BUG-08 proof)**

On step 2, enter `founder@gmail.com` → Next shows the corporate-email error inline and does NOT advance; other fields (fund name from step 1) remain intact when navigating Back. Screenshot.

- [ ] **Step 4: Approve → portal access**

As admin, open the newly-created investor at `/investors`, open its detail, click **Approve**. Then impersonate it (CRM switcher → Investor → the fund) and confirm the portal loads opportunities (no "under review" screen).

- [ ] **Step 5: BUG-01 masking**

Impersonate **IFC**, open **Project Amber Harrier** (`/portal/investor/deals/cmr4hci4o009p95ek4mynlet3`). Confirm the Documents section shows a masked label like `Teaser — Project <codename>` and NOT `Teaser — Chipori Ltd (Sabor A' Mexico)`. Screenshot.

- [ ] **Step 6: Remaining bugs spot-check**

- BUG-04: `/api/viewpoint?role=admin&orgRole=TeamMember&next=/investors` → the lens dropdown reads "Team Member" (not "Admin").
- BUG-10: `/tasks` → New Task with Title only → Save shows "Link the task to at least one record…" and the drawer stays open; adding a link lets it save.
- BUG-11: `/tasks` header pluralization correct for the current count (and "1 action point" when count is 1).
- BUG-12: the wizard-created (NDA-less) investor's portal footer reads the neutral copy; an OpenNDA investor reads the NDA copy.
- BUG-13: `document.querySelectorAll('h1').length === 1` on `/portal/investor`.
- BUG-14: express interest on a deal → success banner shows AND the form is still present.
- BUG-15: real `/login` as `cmiriti@ifc.org` → banner shows fund name, no "view as" switcher, no "Return to Admin"; junk investors gone from `/investors`.

- [ ] **Step 7: Report**

Summarize each check with before/after evidence (screenshots + assertions). Working tree stays uncommitted; hand to the user for review and commit go-ahead.

---

## Self-review notes (author checklist — completed)

- **Spec coverage:** wizard (§3) → Tasks 2-3; BUG-01 → Task 1; BUG-04 → Task 4; BUG-08 → structural in Tasks 2-3; BUG-10 → Task 5; BUG-11 → Task 6; BUG-12 → Task 7; BUG-13 → Task 8; BUG-14 → Task 9; BUG-15 → Task 10; verification → Task 11. All covered.
- **Placeholder scan:** no TBD/TODO; every code step shows real code; test steps show real assertions.
- **Type consistency:** `WizardValues`/`validateStep`/`STEP_FIELDS`/`STEP_COUNT` names match across Tasks 2-3; `registerWizardAction`/`WizardActionState` match between `actions.ts` and the wizard; `impersonating` name matches across `viewpoint.ts`, the route, and the banner; `projectDocuments(…, codename)` signature matches its single call site.
- **Correction vs. handover:** BUG-15's "remove junk from seed" is reframed — the seven names are not in the seed; a reseed clears them (Task 10 Step 7), and one comes from a manual script (flagged).

