"use client";

import { cloneElement, isValidElement, useActionState, useId, useRef, useState } from "react";
import type { ReactElement } from "react";
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
  "w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] " +
  "placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]";
const labelClass = "block text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]";
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
  const stepRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="w-full max-w-2xl space-y-6">
      {/* Progress */}
      <div>
        <div className="flex items-center justify-between text-xs font-medium text-[var(--text-tertiary)]">
          <span aria-live="polite">Step {step + 1} of {STEP_COUNT}</span>
          <a href="/login" className="text-[var(--accent)] hover:underline">
            Already registered? Sign in
          </a>
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
                <Field label="Investor type" error={errors.investorType} asGroup>
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
                  asGroup
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
                    className="rounded bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-60"
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
        <div className="rounded-lg border border-[var(--t-tag-bg-rose)] bg-[var(--t-tag-bg-rose)] p-3 text-sm text-[var(--t-tag-text-rose)]">
          {serverError}
        </div>
      )}
      <dl className="divide-y divide-[var(--border-subtle)] rounded-lg border border-[var(--border-subtle)]">
        {rows.map((r) => (
          <div key={r.label} className="flex items-start justify-between gap-4 px-4 py-3">
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
        After you submit, we'll verify your email and phone, then a NobleStride team member reviews
        your request. No deal information is visible before approval.
      </p>
    </div>
  );
}
