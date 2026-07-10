"use client";

import { cn } from "@/lib/cn";
import { Input, Select } from "@/components/ui";
import type { SelectOption } from "@/components/ui";

const labelText = (label: string, required?: boolean) => (required ? `${label} *` : label);

export function TextField({ label, value, onChange, error, required, placeholder }: {
  label: string; value?: string; onChange: (v: string) => void;
  error?: string; required?: boolean; placeholder?: string;
}) {
  return (
    <Input
      label={labelText(label, required)}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      error={error}
      placeholder={placeholder}
    />
  );
}

export function TextAreaField({ label, value, onChange, error, rows = 3 }: {
  label: string; value?: string; onChange: (v: string) => void; error?: string; rows?: number;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-[var(--text-secondary)]">{label}</label>
      <textarea
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full resize-none rounded-md border border-[var(--border-strong)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent"
      />
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}

export function NumberField({ label, value, onChange, error, required, placeholder, min, max }: {
  label: string; value?: number; onChange: (v: number | undefined) => void;
  error?: string; required?: boolean; placeholder?: string; min?: number; max?: number;
}) {
  return (
    <Input
      label={labelText(label, required)}
      type="number"
      inputMode="decimal"
      min={min}
      max={max}
      value={value ?? ""}
      onChange={(e) => {
        if (e.target.value === "") { onChange(undefined); return; }
        let n = Number(e.target.value);
        if (min != null) n = Math.max(min, n);
        if (max != null) n = Math.min(max, n);
        onChange(n);
      }}
      error={error}
      placeholder={placeholder}
    />
  );
}

export const MoneyField = NumberField;

export function SelectField({ label, value, onChange, options, error, required, placeholder, disabled }: {
  label: string; value?: string; onChange: (v: string) => void; options: SelectOption[];
  error?: string; required?: boolean; placeholder?: string; disabled?: boolean;
}) {
  return (
    <Select
      label={labelText(label, required)}
      value={value ?? ""}
      onChange={onChange}
      options={options}
      placeholder={placeholder ?? "Select…"}
      error={error}
      disabled={disabled}
    />
  );
}

// RelationSelect is a SelectField fed dynamic record options (clients, users, …).
export const RelationSelect = SelectField;

export function DateField({ label, value, onChange, error, disabled }: {
  label: string; value?: string; onChange: (v: string) => void; error?: string; disabled?: boolean;
}) {
  // value is a yyyy-mm-dd string
  return (
    <Input label={label} type="date" value={value ?? ""} onChange={(e) => onChange(e.target.value)} error={error} disabled={disabled} />
  );
}

export function CheckboxField({ label, value, onChange }: {
  label: string; value?: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
      <input
        type="checkbox"
        checked={!!value}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-[var(--border-strong)] text-[var(--accent)] focus:ring-accent"
      />
      {label}
    </label>
  );
}

export function MultiSelectField({ label, value, onChange, options }: {
  label: string; value?: string[]; onChange: (v: string[]) => void; options: SelectOption[];
}) {
  const selected = new Set<string>(value ?? []);
  const toggle = (v: string) => {
    const next = new Set(selected);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    onChange(Array.from(next));
  };
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-[var(--text-secondary)]">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => toggle(o.value)}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs ring-1 ring-inset transition-colors",
              selected.has(o.value)
                ? "bg-[var(--t-tag-bg-emerald)] text-[var(--t-tag-text-emerald)] ring-[var(--accent)]"
                : "bg-[var(--bg-primary)] text-[var(--text-secondary)] ring-[var(--border-subtle)] hover:bg-[var(--bg-secondary)]"
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
