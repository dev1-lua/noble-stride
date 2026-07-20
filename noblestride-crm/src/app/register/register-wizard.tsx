"use client";

import { cloneElement, isValidElement, useActionState, useEffect, useId, useRef, useState } from "react";
import type { ReactElement } from "react";
import { motion, AnimatePresence } from "motion/react";
import { PasswordInput } from "@/components/ui";
import { options, label } from "@/lib/vocab";
import { CURRENCY_OPTIONS } from "@/lib/currencies";
import { EASE } from "@/components/ui/motion";
import { stepFromHistoryState, withWizardStep } from "@/lib/wizard-history";
import { registerWizardAction, type WizardActionState } from "./actions";
import {
  EMPTY_WIZARD_VALUES,
  STEP_COUNT,
  TEAM_STEP_INDEX,
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
  "Which sectors and geographies interest you?",
  "What deals are you looking for?",
  "Who else is on your team? (optional)",
  "Review your details",
];

export default function RegisterWizard({ initialEmail = "" }: { initialEmail?: string }) {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<WizardValues>({ ...EMPTY_WIZARD_VALUES, email: initialEmail });
  const [errors, setErrors] = useState<Partial<Record<keyof WizardValues, string>>>({});
  const [serverState, submitAction, isPending] = useActionState<WizardActionState, FormData>(
    registerWizardAction,
    {},
  );
  const headingRef = useRef<HTMLHeadingElement>(null);
  const stepRef = useRef<HTMLDivElement>(null);

  const isReview = step === STEP_COUNT - 1;
  const isTeamStep = step === TEAM_STEP_INDEX;
  const set = <K extends keyof WizardValues>(key: K, value: WizardValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  // mount: stamp step 0 on the current history entry + listen for Back/Forward
  useEffect(() => {
    window.history.replaceState(withWizardStep(window.history.state, 0), "");
    const onPop = (event: PopStateEvent) => {
      const target = stepFromHistoryState(event.state);
      if (target !== null) {
        setErrors({});
        setStep(target);
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goNext = () => {
    const res = validateStep(step, values);
    if (!res.ok) {
      setErrors(res.errors);
      return;
    }
    setErrors({});
    const next = Math.min(step + 1, STEP_COUNT - 1);
    if (next !== step) window.history.pushState(withWizardStep(window.history.state, next), "");
    setStep(next);
  };

  // In-page Back rides the same history entries as the browser button, so the
  // two stay in sync. At step 0 the button is disabled (unchanged).
  const goBack = () => {
    if (step > 0 && stepFromHistoryState(window.history.state) === step) {
      window.history.back();
      return;
    }
    setStep((s) => Math.max(s - 1, 0));
  };

  const goTo = (target: number) => {
    setErrors({});
    if (target !== step) window.history.pushState(withWizardStep(window.history.state, target), "");
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
                <>
                  <Field
                    label="Sector preference"
                    error={errors.sectorPreference}
                    hint="Select all that apply"
                    asGroup
                  >
                    <ToggleChipGrid
                      opts={options("Sector")}
                      selected={values.sectorPreference}
                      onChange={(v) => set("sectorPreference", v)}
                    />
                  </Field>
                  <Field
                    label="Geographic focus"
                    error={errors.geographicFocus}
                    hint="Select all that apply"
                    asGroup
                  >
                    <ToggleChipGrid
                      opts={options("Geography")}
                      selected={values.geographicFocus}
                      onChange={(v) => set("geographicFocus", v)}
                    />
                  </Field>
                </>
              )}

              {step === 4 && (
                <>
                  <Field label="Deal types" error={errors.dealTypes} hint="Select all that apply" asGroup>
                    <ToggleChipGrid
                      opts={options("Instrument")}
                      selected={values.dealTypes}
                      onChange={(v) => set("dealTypes", v)}
                    />
                  </Field>
                  <Field label="Currency" error={errors.currency}>
                    <select
                      className={inputClass}
                      value={values.currency}
                      onChange={(e) => set("currency", e.target.value)}
                    >
                      {CURRENCY_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label={`Minimum ticket (${values.currency})`} error={errors.ticketMin}>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        inputMode="numeric"
                        className={inputClass}
                        placeholder="e.g. 500000"
                        value={values.ticketMin}
                        onChange={(e) => set("ticketMin", e.target.value)}
                      />
                    </Field>
                    <Field label={`Maximum ticket (${values.currency})`} error={errors.ticketMax}>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        inputMode="numeric"
                        className={inputClass}
                        placeholder="e.g. 5000000"
                        value={values.ticketMax}
                        onChange={(e) => set("ticketMax", e.target.value)}
                      />
                    </Field>
                  </div>
                </>
              )}

              {isTeamStep && (
                <TeamMembersEditor
                  members={values.members}
                  error={errors.members}
                  onChange={(members) => set("members", members)}
                />
              )}

              {isReview && (
                <>
                  <Review values={values} onEdit={goTo} serverError={serverState.error} />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Create a password">
                      <PasswordInput
                        name="password"
                        form="register-wizard-submit"
                        required
                        minLength={10}
                        placeholder="At least 10 characters"
                      />
                    </Field>
                    <Field label="Confirm password">
                      <PasswordInput
                        name="confirmPassword"
                        form="register-wizard-submit"
                        required
                        minLength={10}
                        placeholder="Re-enter your password"
                      />
                    </Field>
                  </div>
                </>
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
                <form id="register-wizard-submit" action={submitAction}>
                  <input type="hidden" name="fundName" value={values.fundName} />
                  <input type="hidden" name="contactPerson" value={values.contactPerson} />
                  <input type="hidden" name="email" value={values.email} />
                  <input type="hidden" name="phone" value={values.phone} />
                  <input type="hidden" name="investorType" value={values.investorType} />
                  {values.sectorPreference.map((s) => (
                    <input key={s} type="hidden" name="sectorPreference" value={s} />
                  ))}
                  {values.geographicFocus.map((g) => (
                    <input key={g} type="hidden" name="geographicFocus" value={g} />
                  ))}
                  {values.dealTypes.map((d) => (
                    <input key={d} type="hidden" name="dealTypes" value={d} />
                  ))}
                  <input type="hidden" name="ticketMin" value={values.ticketMin} />
                  <input type="hidden" name="ticketMax" value={values.ticketMax} />
                  <input type="hidden" name="currency" value={values.currency} />
                  <input type="hidden" name="membersJson" value={JSON.stringify(values.members)} />
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

/** Multi-select toggle chips (sectors / geographies / deal types). */
function ToggleChipGrid({
  opts,
  selected,
  onChange,
}: {
  opts: { value: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {opts.map((o) => {
        const active = selected.includes(o.value);
        return (
          <button
            type="button"
            key={o.value}
            onClick={() => onChange(active ? selected.filter((s) => s !== o.value) : [...selected, o.value])}
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
  const fmtNum = (v: string) => (v && Number.isFinite(Number(v)) ? Number(v).toLocaleString() : v || "—");
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
      label: "Geographies",
      value: values.geographicFocus.map((g) => label("Geography", g)).join(", "),
      step: 3,
    },
    {
      label: "Deal preference",
      value: `${values.dealTypes.map((d) => label("Instrument", d)).join(", ")} · ${fmtNum(values.ticketMin)}–${fmtNum(values.ticketMax)} ${values.currency}`,
      step: 4,
    },
    ...(values.members.length
      ? [{
          label: "Team members",
          value: values.members.map((m) => `${m.name} <${m.email}>`).join(", "),
          step: TEAM_STEP_INDEX,
        }]
      : []),
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
        After you submit, we'll verify your email and phone, then a Noblestride team member reviews
        your request. No deal information is visible before approval.
      </p>
    </div>
  );
}

/** Optional team-member rows for the wizard's team step (spec 2026-07-19 §5.2). */
function TeamMembersEditor({
  members,
  error,
  onChange,
}: {
  members: { name: string; email: string; phone: string }[];
  error?: string;
  onChange: (next: { name: string; email: string; phone: string }[]) => void;
}) {
  const update = (i: number, key: "name" | "email" | "phone", value: string) =>
    onChange(members.map((m, idx) => (idx === i ? { ...m, [key]: value } : m)));
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--text-tertiary)]">
        Colleagues you add can get their own sign-in and see everything your fund sees — deals,
        teasers, and engagement progress. You can also do this later from your portal&apos;s Team
        page, or skip this step.
      </p>
      {members.map((m, i) => (
        <div key={i} className="rounded-lg border border-[var(--border-subtle)] p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <input
              className={inputClass}
              placeholder="Full name"
              value={m.name}
              onChange={(e) => update(i, "name", e.target.value)}
            />
            <input
              type="email"
              className={inputClass}
              placeholder="name@yourfund.com"
              value={m.email}
              onChange={(e) => update(i, "email", e.target.value)}
            />
            <input
              type="tel"
              className={inputClass}
              placeholder="Phone (optional)"
              value={m.phone}
              onChange={(e) => update(i, "phone", e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={() => onChange(members.filter((_, idx) => idx !== i))}
            className="mt-2 text-xs font-medium text-rose-600 hover:underline"
          >
            Remove
          </button>
        </div>
      ))}
      {members.length < 10 && (
        <button
          type="button"
          onClick={() => onChange([...members, { name: "", email: "", phone: "" }])}
          className="rounded border border-[var(--border-subtle)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
        >
          + Add a team member
        </button>
      )}
      {error && <p className={errorClass}>{error}</p>}
    </div>
  );
}
