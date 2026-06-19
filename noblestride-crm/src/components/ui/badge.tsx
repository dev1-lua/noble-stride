import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
  {
    variants: {
      tone: {
        success: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
        danger: "bg-rose-50 text-rose-700 ring-rose-600/20",
        warning: "bg-amber-50 text-amber-700 ring-amber-600/20",
        info: "bg-sky-50 text-sky-700 ring-sky-600/20",
        neutral: "bg-zinc-100 text-zinc-700 ring-zinc-500/20",
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
