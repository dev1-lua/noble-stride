import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      tone: {
        success: "bg-[var(--t-tag-bg-emerald)] text-[var(--t-tag-text-emerald)]",
        danger: "bg-[var(--t-tag-bg-rose)] text-[var(--t-tag-text-rose)]",
        warning: "bg-[var(--t-tag-bg-amber)] text-[var(--t-tag-text-amber)]",
        info: "bg-[var(--t-tag-bg-sky)] text-[var(--t-tag-text-sky)]",
        neutral: "bg-[var(--t-tag-bg-gray)] text-[var(--t-tag-text-gray)]",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  }
);

interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  children: React.ReactNode;
}

/**
 * Badge — semantic pill indicator.
 * tone: success | danger | warning | info | neutral
 */
export function Badge({ tone, className, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone }), className)} {...props}>
      {children}
    </span>
  );
}
