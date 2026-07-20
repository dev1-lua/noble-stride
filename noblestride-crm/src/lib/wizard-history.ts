// Multi-step wizards keep their step in component state, which the browser
// Back button knows nothing about — Back used to leave the page and restart
// the questionnaire at step 1. These helpers mirror the step into
// history.state so Back/Forward move within the wizard while the component
// (and everything typed into it) stays mounted. Existing state is spread
// through untouched because the Next.js App Router stores its own keys there.
export function stepFromHistoryState(state: unknown): number | null {
  if (state && typeof state === "object" && "wizardStep" in state) {
    const raw = (state as { wizardStep: unknown }).wizardStep;
    if (typeof raw === "number" && Number.isInteger(raw) && raw >= 0) return raw;
  }
  return null;
}

export function withWizardStep(state: unknown, step: number): Record<string, unknown> {
  const base = state && typeof state === "object" ? { ...(state as Record<string, unknown>) } : {};
  return { ...base, wizardStep: step };
}
