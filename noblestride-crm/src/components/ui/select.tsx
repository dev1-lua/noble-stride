"use client";

import { cn } from "@/lib/cn";
import { forwardRef } from "react";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "onChange"> {
  options: SelectOption[];
  value?: string;
  onChange?: (value: string) => void;
  /** Optional label rendered above the select */
  label?: string;
  /** Placeholder option rendered as the first (disabled) option */
  placeholder?: string;
  /** Error message rendered below the select */
  error?: string;
}

/**
 * Select — styled native <select>.
 * Client Component (accepts onChange handler).
 * `onChange` receives the string value directly (not a SyntheticEvent).
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ options, value, onChange, label, placeholder, error, className, id, ...props }, ref) => {
    const selectId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={selectId} className="text-xs font-medium text-zinc-700">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          className={cn(
            "h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900",
            "focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent",
            "disabled:bg-zinc-50 disabled:text-zinc-400 disabled:cursor-not-allowed",
            "appearance-none bg-no-repeat bg-right pr-8",
            error && "border-rose-400 focus:ring-rose-400",
            className
          )}
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
            backgroundPosition: "right 0.75rem center",
          }}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="text-xs text-rose-600">{error}</p>}
      </div>
    );
  }
);
Select.displayName = "Select";
