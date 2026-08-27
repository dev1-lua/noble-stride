"use client";
// setting-toggle.tsx — one boolean AppSetting row with an on/off switch.
// Authorisation happens in toggleSettingAction (requireRealAdmin); this
// component only renders the current value and posts the flip.

import { useActionState } from "react";
import { toggleSettingAction, type SettingActionState } from "./actions";

const initialState: SettingActionState = {};

export function SettingToggle({
  settingKey,
  label,
  description,
  value,
  updatedAt,
}: {
  settingKey: string;
  label: string;
  description: string;
  value: "true" | "false";
  updatedAt: string | null;
}) {
  const [state, submitAction, isPending] = useActionState(toggleSettingAction, initialState);
  const current = (state.value as "true" | "false" | undefined) ?? value;
  const on = current === "true";
  const next = on ? "false" : "true";

  return (
    <div
      data-testid={`setting-${settingKey}`}
      className="flex items-start justify-between gap-6 border-b border-[var(--border-subtle)] px-4 py-4 last:border-0"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-[var(--text-primary)]">{label}</p>
        <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">{description}</p>
        <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">
          <code className="rounded bg-[var(--bg-secondary)] px-1 py-0.5">{settingKey}</code>
          {updatedAt ? <> · last changed {updatedAt}</> : <> · default</>}
        </p>
        {state.error ? <p className="mt-1 text-xs text-[var(--t-tag-text-rose)]">{state.error}</p> : null}
      </div>
      <form action={submitAction} className="flex shrink-0 items-center gap-2 pt-0.5">
        <input type="hidden" name="key" value={settingKey} />
        <input type="hidden" name="next" value={next} />
        <span className="text-xs text-[var(--text-secondary)]">{on ? "On" : "Off"}</span>
        <button
          type="submit"
          role="switch"
          aria-checked={on}
          aria-label={`${label}: ${on ? "on" : "off"}`}
          disabled={isPending}
          className={
            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-60 " +
            (on ? "bg-emerald-500" : "bg-[var(--border-strong)]")
          }
        >
          <span
            className={
              "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform " +
              (on ? "translate-x-5" : "translate-x-0.5")
            }
          />
        </button>
      </form>
    </div>
  );
}
