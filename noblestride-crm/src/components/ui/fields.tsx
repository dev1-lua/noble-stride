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
      <label className="text-xs font-medium text-zinc-700">{label}</label>
      <textarea
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full resize-none rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent"
      />
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}

export function NumberField({ label, value, onChange, error, required, placeholder }: {
  label: string; value?: number; onChange: (v: number | undefined) => void;
  error?: string; required?: boolean; placeholder?: string;
}) {
  return (
    <Input
      label={labelText(label, required)}
      type="number"
      inputMode="decimal"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
      error={error}
      placeholder={placeholder}
    />
  );
}

export const MoneyField = NumberField;

export function SelectField({ label, value, onChange, options, error, required, placeholder }: {
  label: string; value?: string; onChange: (v: string) => void; options: SelectOption[];
  error?: string; required?: boolean; placeholder?: string;
}) {
  return (
    <Select
      label={labelText(label, required)}
      value={value ?? ""}
      onChange={onChange}
      options={options}
      placeholder={placeholder ?? "Select…"}
      error={error}
    />
  );
}

// RelationSelect is a SelectField fed dynamic record options (clients, users, …).
export const RelationSelect = SelectField;

export function DateField({ label, value, onChange, error }: {
  label: string; value?: string; onChange: (v: string) => void; error?: string;
}) {
  // value is a yyyy-mm-dd string
  return (
    <Input label={label} type="date" value={value ?? ""} onChange={(e) => onChange(e.target.value)} error={error} />
  );
}

export function CheckboxField({ label, value, onChange }: {
  label: string; value?: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-zinc-700">
      <input
        type="checkbox"
        checked={!!value}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-accent"
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
      <label className="text-xs font-medium text-zinc-700">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => toggle(o.value)}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs ring-1 ring-inset transition-colors",
              selected.has(o.value)
                ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                : "bg-white text-zinc-600 ring-zinc-200 hover:bg-zinc-50"
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
