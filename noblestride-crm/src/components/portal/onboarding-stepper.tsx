// The investor portal's onboarding stepper (§2c: Aika's post-login home is a
// checklist of what the fund still owes, not a set of finance numbers).
//
// It takes the place of the finance KPI tiles, which image30 asked to be hidden
// by default. Every incomplete step links to the page that completes it — the
// point is that the fund can finish onboarding without emailing anyone.

import Link from "next/link";

export interface OnboardingStep {
  key: string;
  label: string;
  done: boolean;
  href: string;
  /** Shown under the label while the step is outstanding. */
  hint: string;
  /** True when the step is not the fund's to complete (approval). */
  waiting?: boolean;
}

function Mark({ done, waiting }: { done: boolean; waiting?: boolean }) {
  if (done) {
    return (
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-white">
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden>
          <path
            d="M4.5 8.5l2.5 2.5 4.5-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }
  return (
    <span
      className={
        "mt-0.5 h-5 w-5 shrink-0 rounded-full border " +
        (waiting ? "border-dashed border-[var(--border-strong)]" : "border-[var(--border-strong)]")
      }
    />
  );
}

export function OnboardingStepper({ steps }: { steps: OnboardingStep[] }) {
  const done = steps.filter((s) => s.done).length;
  const complete = done === steps.length;

  return (
    <section
      data-testid="portal-onboarding-stepper"
      className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] px-5 py-3">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">
          {complete ? "Your account is fully set up" : "Finish setting up your account"}
        </h2>
        <span className="text-xs text-[var(--text-tertiary)]">
          <span className="font-semibold text-[var(--text-secondary)]">
            {done} of {steps.length}
          </span>{" "}
          complete
        </span>
      </div>
      <ol className="px-5 py-2">
        {steps.map((step) => (
          <li
            key={step.key}
            data-testid={`onboarding-step-${step.key}`}
            data-done={step.done ? "true" : "false"}
            className="flex items-start gap-3 border-b border-[var(--border-subtle)] py-3 last:border-0"
          >
            <Mark done={step.done} waiting={step.waiting} />
            <div className="min-w-0">
              <p
                className={
                  "text-sm " +
                  (step.done
                    ? "font-medium text-[var(--text-primary)]"
                    : "font-medium text-[var(--text-secondary)]")
                }
              >
                {step.label}
              </p>
              {!step.done && <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">{step.hint}</p>}
            </div>
            {!step.done && !step.waiting && (
              <Link
                href={step.href}
                className="ml-auto shrink-0 self-center rounded border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2.5 py-1 text-xs font-medium text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)]"
              >
                Continue
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
