"use client";

import { cn } from "@/lib/cn";
import { forwardRef } from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Optional label rendered above the input */
  label?: string;
  /** Error message rendered below the input */
  error?: string;
}

/**
 * Input — styled text/email/number/search input.
 * Client Component (accepts onChange, onFocus, etc.).
 * Uses forwardRef for DOM access.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-xs font-medium text-zinc-700">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400",
            "focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent",
            "disabled:bg-zinc-50 disabled:text-zinc-400 disabled:cursor-not-allowed",
            error && "border-rose-400 focus:ring-rose-400",
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-rose-600">{error}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";
