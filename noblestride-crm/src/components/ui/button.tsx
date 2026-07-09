"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";
import { forwardRef } from "react";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-medium rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] active:bg-[var(--accent-hover)]",
        secondary: "bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-subtle)] hover:bg-[var(--bg-secondary)] active:bg-[var(--bg-tertiary)]",
        ghost: "bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] active:bg-[var(--border-subtle)]",
      },
      size: {
        sm: "h-7 px-2.5 text-xs",
        md: "h-8 px-3 text-sm",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

/**
 * Button — primary, secondary, and ghost variants; sm and md sizes.
 * Uses cva for variant logic. Client Component (accepts onClick handlers).
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

const iconButtonVariants = cva(
  "inline-flex items-center justify-center rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none",
  {
    variants: {
      variant: {
        primary: "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] active:bg-[var(--accent-hover)]",
        secondary: "bg-[var(--bg-primary)] text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:bg-[var(--bg-secondary)] active:bg-[var(--bg-tertiary)]",
        ghost: "bg-transparent text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)] active:bg-[var(--border-subtle)]",
      },
      size: {
        sm: "h-7 w-7",
        md: "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "ghost",
      size: "md",
    },
  }
);

/**
 * IconButton — square, icon-only counterpart to Button for toolbar/icon use.
 * Same variant/size matrix shape as Button (primary/secondary/ghost, sm/md).
 */
export const IconButton = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(iconButtonVariants({ variant, size }), className)}
        {...props}
      />
    );
  }
);
IconButton.displayName = "IconButton";
