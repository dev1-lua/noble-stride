"use client";

import { cloneElement, isValidElement, useActionState, useId, useRef, useState } from "react";
import type { ReactElement } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { options, label } from "@/lib/vocab";
import { EASE } from "@/components/ui/motion";
import { submitIntakeAction, type IntakeActionState } from "./actions";
import {
  EMPTY_INTAKE_VALUES,
  STEP_COUNT,
  STEP_FIELDS,
  validateStep,
  needsLoanBook,
  type IntakeWizardValues,
} from "./intake-steps";

const inputClass =
  "w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] " +
  "placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]";
const labelClass = "block text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]";
const errorClass = "mt-1 text-xs text-rose-600";

const AUDITED_YEARS_OPTIONS = [
  { value: "0", label: "0 — none yet" },
  { value: "1", label: "1 year" },
  { value: "2", label: "2 years" },
  { value: "3", label: "3 years" },
  { value: "4", label: "4 years" },
  { value: "5", label: "5+ years" },
];

const INSTRUMENT_OPTIONS = [
  { value: "Debt", label: "Debt" },
  { value: "Equity", label: "Equity" },
  { value: "Both", label: "Both" },
];

const STEP_TITLES = [
  "Tell us about your company",
  "Who should we contact?",
  "What's your financial snapshot?",
  "What are you raising?",
  "Ownership & compliance",
  "Review your application",
];

const FINANCIAL_SNAPSHOT_HELPER =
  "Audited financial statements and registration documents will be requested securely after an " +
  "NDA is in place — do not paste confidential figures you are not comfortable sharing.";

export default function IntakeWizard() {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<IntakeWizardValues>(EMPTY_INTAKE_VALUES);
  const [errors, setErrors] = useState<Partial<Record<keyof IntakeWizardValues, string>>>({});
  const [serverState, submitAction, isPending] = useActionState<IntakeActionState, FormData>(
    submitIntakeAction,
    {},
  );
  const headingRef = useRef<HTMLHeadingElement>(null);
  const stepRef = useRef<HTMLDivElement>(null);

  const isReview = step === STEP_FIELDS.length; // index 5
  const set = <K extends keyof IntakeWizardValues>(key: K, value: IntakeWizardValues[K]) => {
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

  // Enter advances on non-textarea single inputs; buttons/selects/textareas
  // keep their native Enter behavior (e.g. activating a sector toggle).
  const onKeyDown = (e: React.KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    if (
      e.key === "Enter" &&
      !isReview &&
      tag !== "BUTTON" &&
      tag !== "TEXTAREA" &&
      tag !== "SELECT"
    ) {
      e.preventDefault();
      goNext();
    }
  };

  const progress = Math.round(((step + 1) / STEP_COUNT) * 100);
  const showLoanBook = needsLoanBook(values.sectors);

  return (
    <div className="w-full max-w-2xl space-y-6">
      {/* Progress */}
      <div>
        <div className="flex items-center justify-between text-xs font-medium text-[var(--text-tertiary)]">
          <span aria-live="polite">Step {step + 1} of {STEP_COUNT}</span>
          <Link href="/" className="text-[var(--accent)] hover:underline">
            ← Back to home
          </Link>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--border-subtle)]">
          <motion.div
            className="h-full rounded-full bg-[var(--accent)]"
            initial={false}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4, ease: EASE }}
          />
        </div>
      </div>

      <section className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            ref={stepRef}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.28, ease: EASE }}
            onAnimationComplete={() => {
              const c = stepRef.current;
              if (c && !c.contains(document.activeElement)) headingRef.current?.focus();
            }}
          >
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="text-xl font-bold text-[var(--text-primary)] outline-none"
            >
              {STEP_TITLES[step]}
            </h2>

            <div className="mt-5 space-y-4" onKeyDown={onKeyDown}>
              {step === 0 && (
                <>
                  <Field label="Legal company name" error={errors.legalName}>
                    <input
                      autoFocus
                      className={inputClass}
                      placeholder="e.g. Savannah Foods Ltd"
                      value={values.legalName}
                      onChange={(e) => set("legalName", e.target.value)}
                    />
                  </Field>
                  <Field
                    label="Registration number"
                    error={errors.registrationNo}
                    hint="CR10 / CR12 registration reference"
                  >
                    <input
                      className={inputClass}
                      value={values.registrationNo}
                      onChange={(e) => set("registrationNo", e.target.value)}
                    />
                  </Field>
                  <Field label="Country" error={errors.country}>
                    <select
                      className={inputClass}
                      value={values.country}
                      onChange={(e) => set("country", e.target.value)}
                    >
                      <option value="" disabled>— Select country —</option>
                      {options("Geography").map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Sector" error={errors.sectors} hint="Select all that apply" asGroup>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {options("Sector").map((o) => {
                        const active = values.sectors.includes(o.value);
                        return (
                          <button
                            type="button"
                            key={o.value}
                            onClick={() =>
                              set(
                                "sectors",
                                active
                                  ? values.sectors.filter((s) => s !== o.value)
                                  : [...values.sectors, o.value],
                              )
                            }
                            aria-pressed={active}
                            className={
                              "rounded-md border px-2 py-1.5 text-left text-sm transition " +
                              (active
                                ? "border-[var(--accent)] bg-[var(--t-tag-bg-emerald)] text-[var(--t-tag-text-emerald)]"
                                : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]")
                            }
                          >
                            {o.label}
                          </button>
                        );
                      })}
                    </div>
                  </Field>
                  <Field label="Year founded" error={errors.yearFounded}>
                    <input
                      type="number"
                      className={inputClass}
                      placeholder="e.g. 2015"
                      value={values.yearFounded}
                      onChange={(e) => set("yearFounded", e.target.value)}
                    />
                  </Field>
                  <Field label="Website" error={errors.website} hint="Optional">
                    <input
                      type="url"
                      className={inputClass}
                      placeholder="https://"
                      value={values.website}
                      onChange={(e) => set("website", e.target.value)}
                    />
                  </Field>
                  <Field
                    label="Pitch deck / company profile URL"
                    error={errors.pitchDeckUrl}
                    hint="Optional — a link to your deck or company profile"
                  >
                    <input
                      type="url"
                      className={inputClass}
                      placeholder="https://"
                      value={values.pitchDeckUrl}
                      onChange={(e) => set("pitchDeckUrl", e.target.value)}
                    />
                  </Field>
                </>
              )}

              {step === 1 && (
                <>
                  <Field label="Contact person" error={errors.contactName}>
                    <input
                      autoFocus
                      className={inputClass}
                      placeholder="Full name"
                      value={values.contactName}
                      onChange={(e) => set("contactName", e.target.value)}
                    />
                  </Field>
                  <Field label="Role / position" error={errors.role}>
                    <input
                      className={inputClass}
                      placeholder="e.g. Chief Financial Officer"
                      value={values.role}
                      onChange={(e) => set("role", e.target.value)}
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
                      placeholder="name@company.com"
                      value={values.email}
                      onChange={(e) => set("email", e.target.value)}
                    />
                  </Field>
                  <Field label="Phone" error={errors.phone}>
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
                <>
                  <Field label="Revenue — last full year (USD)" error={errors.revenueUsd}>
                    <input
                      type="number"
                      className={inputClass}
                      value={values.revenueUsd}
                      onChange={(e) => set("revenueUsd", e.target.value)}
                    />
                  </Field>
                  <Field label="EBITDA — last full year (USD)" error={errors.ebitdaUsd}>
                    <input
                      type="number"
                      className={inputClass}
                      value={values.ebitdaUsd}
                      onChange={(e) => set("ebitdaUsd", e.target.value)}
                    />
                  </Field>
                  <Field label="Net profit (USD)" error={errors.netProfitUsd}>
                    <input
                      type="number"
                      className={inputClass}
                      value={values.netProfitUsd}
                      onChange={(e) => set("netProfitUsd", e.target.value)}
                    />
                  </Field>
                  <Field label="Total assets (USD)" error={errors.totalAssetsUsd}>
                    <input
                      type="number"
                      className={inputClass}
                      value={values.totalAssetsUsd}
                      onChange={(e) => set("totalAssetsUsd", e.target.value)}
                    />
                  </Field>
                  <Field label="Years of audited financials" error={errors.auditedYears}>
                    <select
                      className={inputClass}
                      value={values.auditedYears}
                      onChange={(e) => set("auditedYears", e.target.value)}
                    >
                      <option value="" disabled>— Select —</option>
                      {AUDITED_YEARS_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </Field>
                  {showLoanBook && (
                    <Field label="Loan book value (USD)" error={errors.loanBookUsd}>
                      <input
                        type="number"
                        className={inputClass}
                        value={values.loanBookUsd}
                        onChange={(e) => set("loanBookUsd", e.target.value)}
                      />
                    </Field>
                  )}
                  <p className="text-xs text-[var(--text-tertiary)]">{FINANCIAL_SNAPSHOT_HELPER}</p>
                </>
              )}

              {step === 3 && (
                <>
                  <Field label="Amount sought (USD)" error={errors.raiseUsd}>
                    <input
                      type="number"
                      className={inputClass}
                      value={values.raiseUsd}
                      onChange={(e) => set("raiseUsd", e.target.value)}
                    />
                  </Field>
                  <Field label="Instrument" error={errors.instrument}>
                    <select
                      className={inputClass}
                      value={values.instrument}
                      onChange={(e) => set("instrument", e.target.value)}
                    >
                      <option value="" disabled>— Select instrument —</option>
                      {INSTRUMENT_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Use of funds" error={errors.useOfFunds}>
                    <textarea
                      rows={3}
                      className={inputClass}
                      value={values.useOfFunds}
                      onChange={(e) => set("useOfFunds", e.target.value)}
                    />
                  </Field>
                  <Field label="Proposed timeline" error={errors.proposedTimeline}>
                    <input
                      className={inputClass}
                      placeholder="e.g. Close within 6 months"
                      value={values.proposedTimeline}
                      onChange={(e) => set("proposedTimeline", e.target.value)}
                    />
                  </Field>
                </>
              )}

              {step === 4 && (
                <>
                  <Field label="Shareholding / ownership summary" error={errors.ownershipSummary}>
                    <textarea
                      rows={3}
                      className={inputClass}
                      value={values.ownershipSummary}
                      onChange={(e) => set("ownershipSummary", e.target.value)}
                    />
                  </Field>
                  <Field label="Any politically exposed persons (PEPs) involved?" error={errors.pepExposure} asGroup>
                    <div className="grid grid-cols-2 gap-2">
                      <YesNoCard
                        name="pepExposure"
                        checked={values.pepExposure === "yes"}
                        onSelect={() => set("pepExposure", "yes")}
                        labelText="Yes"
                      />
                      <YesNoCard
                        name="pepExposure"
                        checked={values.pepExposure === "no"}
                        onSelect={() => set("pepExposure", "no")}
                        labelText="No"
                      />
                    </div>
                  </Field>
                  <Field label="Any government ownership?" error={errors.governmentOwned} asGroup>
                    <div className="grid grid-cols-2 gap-2">
                      <YesNoCard
                        name="governmentOwned"
                        checked={values.governmentOwned === "yes"}
                        onSelect={() => set("governmentOwned", "yes")}
                        labelText="Yes"
                      />
                      <YesNoCard
                        name="governmentOwned"
                        checked={values.governmentOwned === "no"}
                        onSelect={() => set("governmentOwned", "no")}
                        labelText="No"
                      />
                    </div>
                  </Field>
                  <Field label="Existing debt (USD)" error={errors.existingDebtUsd} hint="Optional">
                    <input
                      type="number"
                      className={inputClass}
                      value={values.existingDebtUsd}
                      onChange={(e) => set("existingDebtUsd", e.target.value)}
                    />
                  </Field>
                </>
              )}

              {isReview && (
                <Review values={values} onEdit={goTo} serverError={serverState.error} />
              )}
            </div>

            {/* Nav */}
            <div className="mt-6 flex items-center justify-between border-t border-[var(--border-subtle)] pt-4">
              <button
                type="button"
                onClick={goBack}
                disabled={step === 0}
                className="rounded border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] disabled:opacity-0"
              >
                ← Back
              </button>

              {!isReview ? (
                <button
                  type="button"
                  onClick={goNext}
                  className="rounded bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]"
                >
                  Next →
                </button>
              ) : (
                <form action={submitAction}>
                  <input type="hidden" name="legalName" value={values.legalName} />
                  <input type="hidden" name="registrationNo" value={values.registrationNo} />
                  <input type="hidden" name="country" value={values.country} />
                  {values.sectors.map((s) => (
                    <input key={s} type="hidden" name="sectors" value={s} />
                  ))}
                  <input type="hidden" name="yearFounded" value={values.yearFounded} />
                  <input type="hidden" name="website" value={values.website} />
                  <input type="hidden" name="pitchDeckUrl" value={values.pitchDeckUrl} />
                  <input type="hidden" name="contactName" value={values.contactName} />
                  <input type="hidden" name="role" value={values.role} />
                  <input type="hidden" name="email" value={values.email} />
                  <input type="hidden" name="phone" value={values.phone} />
                  <input type="hidden" name="revenueUsd" value={values.revenueUsd} />
                  <input type="hidden" name="ebitdaUsd" value={values.ebitdaUsd} />
                  <input type="hidden" name="netProfitUsd" value={values.netProfitUsd} />
                  <input type="hidden" name="totalAssetsUsd" value={values.totalAssetsUsd} />
                  <input type="hidden" name="auditedYears" value={values.auditedYears} />
                  <input type="hidden" name="loanBookUsd" value={values.loanBookUsd} />
                  <input type="hidden" name="raiseUsd" value={values.raiseUsd} />
                  <input type="hidden" name="instrument" value={values.instrument} />
                  <input type="hidden" name="useOfFunds" value={values.useOfFunds} />
                  <input type="hidden" name="proposedTimeline" value={values.proposedTimeline} />
                  <input type="hidden" name="ownershipSummary" value={values.ownershipSummary} />
                  <input type="hidden" name="pepExposure" value={values.pepExposure} />
                  <input type="hidden" name="governmentOwned" value={values.governmentOwned} />
                  <input type="hidden" name="existingDebtUsd" value={values.existingDebtUsd} />
                  <button
                    type="submit"
                    disabled={isPending}
                    className="rounded bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-60"
                  >
                    {isPending ? "Submitting…" : "Submit application"}
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
  asGroup = false,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  /** Set for multi-control groups (radio cards, toggle buttons) that can't
   * use a single htmlFor/id association — uses role="group" + aria-labelledby
   * instead of a real <label>. */
  asGroup?: boolean;
}) {
  const id = useId();
  const labelId = `${id}-label`;
  const child = isValidElement(children)
    ? cloneElement(
        children as ReactElement<Record<string, unknown>>,
        asGroup ? { role: "group", "aria-labelledby": labelId } : { id },
      )
    : children;

  return (
    <div>
      {asGroup ? (
        <span id={labelId} className={labelClass}>
          {labelText}
        </span>
      ) : (
        <label htmlFor={id} className={labelClass}>
          {labelText}
        </label>
      )}
      <div className="mt-1">{child}</div>
      {hint && !error && <p className="mt-1 text-xs text-[var(--text-tertiary)]">{hint}</p>}
      {error && <p className={errorClass}>{error}</p>}
    </div>
  );
}

function YesNoCard({
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
          ? "border-[var(--accent)] bg-[var(--t-tag-bg-emerald)] text-[var(--t-tag-text-emerald)]"
          : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]")
      }
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onSelect}
        className="h-4 w-4 text-[var(--accent)] focus:ring-[var(--accent)]"
      />
      {labelText}
    </label>
  );
}

function formatUsd(raw: string): string {
  if (!raw.trim()) return "—";
  const n = Number(raw);
  return Number.isFinite(n) ? `USD ${n.toLocaleString("en-US")}` : raw;
}

function Review({
  values,
  onEdit,
  serverError,
}: {
  values: IntakeWizardValues;
  onEdit: (step: number) => void;
  serverError?: string;
}) {
  const auditedYearsLabel = AUDITED_YEARS_OPTIONS.find((o) => o.value === values.auditedYears)?.label ?? "—";
  const rows: { label: string; value: string; step: number }[] = [
    {
      label: "Company",
      value: `${values.legalName} · ${values.registrationNo} · ${label("Geography", values.country)}`,
      step: 0,
    },
    {
      label: "Sectors",
      value: values.sectors.map((s) => label("Sector", s)).join(", ") || "—",
      step: 0,
    },
    {
      label: "Founded / links",
      value: `${values.yearFounded || "—"}${values.website ? ` · ${values.website}` : ""}${
        values.pitchDeckUrl ? ` · ${values.pitchDeckUrl}` : ""
      }`,
      step: 0,
    },
    { label: "Contact", value: `${values.contactName} · ${values.role} · ${values.email} · ${values.phone}`, step: 1 },
    {
      label: "Financial snapshot",
      value: `Revenue ${formatUsd(values.revenueUsd)} · EBITDA ${formatUsd(values.ebitdaUsd)} · Net profit ${formatUsd(
        values.netProfitUsd,
      )} · Total assets ${formatUsd(values.totalAssetsUsd)} · Audited years: ${auditedYearsLabel}${
        values.loanBookUsd ? ` · Loan book ${formatUsd(values.loanBookUsd)}` : ""
      }`,
      step: 2,
    },
    {
      label: "Funding need",
      value: `${formatUsd(values.raiseUsd)} · ${values.instrument || "—"} · ${values.proposedTimeline}`,
      step: 3,
    },
    { label: "Use of funds", value: values.useOfFunds || "—", step: 3 },
    {
      label: "Ownership & compliance",
      value: `PEP exposure: ${values.pepExposure || "—"} · Government owned: ${
        values.governmentOwned || "—"
      }${values.existingDebtUsd ? ` · Existing debt ${formatUsd(values.existingDebtUsd)}` : ""}`,
      step: 4,
    },
    { label: "Ownership summary", value: values.ownershipSummary || "—", step: 4 },
  ];
  return (
    <div className="space-y-3">
      {serverError && (
        <div className="rounded-lg border border-[var(--t-tag-bg-rose)] bg-[var(--t-tag-bg-rose)] p-3 text-sm text-[var(--t-tag-text-rose)]">
          {serverError}
        </div>
      )}
      <dl className="divide-y divide-[var(--border-subtle)] rounded-lg border border-[var(--border-subtle)]">
        {rows.map((r, i) => (
          <div key={`${r.label}-${i}`} className="flex items-start justify-between gap-4 px-4 py-3">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]">{r.label}</dt>
              <dd className="mt-0.5 text-sm text-[var(--text-primary)]">{r.value || "—"}</dd>
            </div>
            <button
              type="button"
              onClick={() => onEdit(r.step)}
              className="shrink-0 text-xs font-medium text-[var(--accent)] hover:underline"
            >
              Edit
            </button>
          </div>
        ))}
      </dl>
      <p className="text-xs text-[var(--text-tertiary)]">
        After you submit, a NobleStride team member reviews your application. No verdict or deal
        information is shared before that review is complete.
      </p>
    </div>
  );
}
