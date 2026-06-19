"use client";

// Premium metric tile: staggered entrance (via parent <Stagger>), count-up value,
// hover lift, and a refined gradient icon chip. Formatting happens client-side from
// raw numbers (the format discriminator crosses the RSC boundary, a function can't).

import { motion, type Variants } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { CountUp } from "./count-up";
import { EASE } from "./motion";
import { formatCompact } from "@/lib/format";
import { formatMoney } from "@/lib/money";

type Fmt = "compact" | "money";

const formatters: Record<Fmt, (n: number) => string> = {
  compact: (n) => formatCompact(Math.round(n)),
  money: (n) => formatMoney(n),
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } },
};

interface AnimatedStatCardProps {
  label: string;
  value: number;
  format: Fmt;
  delta?: number;
  deltaFormat?: Fmt;
  sub?: string;
  icon?: React.ReactNode;
}

export function AnimatedStatCard({
  label,
  value,
  format,
  delta,
  deltaFormat = "compact",
  sub,
  icon,
}: AnimatedStatCardProps) {
  const showDelta = typeof delta === "number" && delta > 0;
  const deltaText = showDelta
    ? `+${deltaFormat === "money" ? formatMoney(delta) : formatCompact(delta)}`
    : null;

  return (
    <motion.div
      variants={cardVariants}
      whileHover={{ y: -3 }}
      transition={{ type: "spring", stiffness: 380, damping: 26 }}
      className={cn(
        "group relative flex flex-col gap-3 rounded-xl border border-zinc-200/80 bg-white p-5",
        "shadow-[0_1px_2px_rgba(16,24,40,0.04),0_2px_8px_rgba(16,24,40,0.04)]",
        "transition-[box-shadow,border-color] duration-300",
        "hover:border-emerald-200 hover:shadow-[0_4px_20px_-4px_rgba(16,185,129,0.18)]"
      )}
    >
      {/* hairline accent that grows on hover */}
      <span className="pointer-events-none absolute inset-x-5 top-0 h-px origin-left scale-x-0 bg-gradient-to-r from-emerald-400/0 via-emerald-400/70 to-emerald-400/0 transition-transform duration-500 group-hover:scale-x-100" />

      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          {label}
        </span>
        {icon && (
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-50 to-teal-50 text-emerald-600 ring-1 ring-inset ring-emerald-100">
            {icon}
          </span>
        )}
      </div>

      <div className="flex items-end gap-2.5">
        <CountUp
          value={value}
          format={formatters[format]}
          className="text-[1.75rem] font-bold leading-none tracking-tight text-zinc-900 tabular-nums"
        />
        {deltaText && (
          <span className="mb-0.5 inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-100">
            <ArrowUpRight className="h-3 w-3" />
            {deltaText}
          </span>
        )}
      </div>

      {sub && <p className="text-xs text-zinc-400">{sub}</p>}
    </motion.div>
  );
}
