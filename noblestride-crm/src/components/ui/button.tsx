"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";
import { forwardRef } from "react";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-medium rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-accent text-white hover:bg-accent-600 active:bg-accent-600",
        secondary: "bg-white text-zinc-800 border border-zinc-200 hover:bg-zinc-50 active:bg-zinc-100",
        ghost: "bg-transparent text-zinc-700 hover:bg-zinc-100 active:bg-zinc-200",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-9 px-4 text-sm",
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
