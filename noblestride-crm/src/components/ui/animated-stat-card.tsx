"use client";

// Premium metric tile: staggered entrance (via parent <Stagger>), count-up value,
// hover lift, and a flat tag-token icon chip. Formatting happens client-side from
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
        "group relative flex flex-col gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-5"
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
          {label}
        </span>
        {icon && (
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--t-tag-bg-emerald)] text-[var(--t-tag-text-emerald)]">
            {icon}
          </span>
        )}
      </div>

      <div className="flex items-end gap-2.5">
        <CountUp
          value={value}
          format={formatters[format]}
          className="text-[1.75rem] font-bold leading-none tracking-tight text-[var(--text-primary)] tabular-nums"
        />
        {deltaText && (
          <span className="mb-0.5 inline-flex items-center gap-0.5 rounded-full bg-[var(--t-tag-bg-emerald)] px-2 py-0.5 text-xs font-semibold text-[var(--t-tag-text-emerald)]">
            <ArrowUpRight className="h-3 w-3" />
            {deltaText}
          </span>
        )}
      </div>

      {sub && <p className="text-xs text-[var(--text-tertiary)]">{sub}</p>}
    </motion.div>
  );
}
