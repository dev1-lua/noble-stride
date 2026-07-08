"use client";

// Client-side staggered list of Overview Agent insights (rows fade/slide in,
// lift slightly on hover). Kept separate so the card shell can stay a server component.

import { motion, type Variants } from "motion/react";
import { TrendingUp, AlertCircle, Lightbulb } from "lucide-react";
import { EASE } from "@/components/ui/motion";
import type { Insight } from "@/server/domain/types";

const KIND_ICON = {
  convert: <TrendingUp className="h-4 w-4 text-[var(--t-tag-text-emerald)]" />,
  attention: <AlertCircle className="h-4 w-4 text-[var(--t-tag-text-amber)]" />,
  match: <Lightbulb className="h-4 w-4 text-[var(--t-tag-text-violet)]" />,
} as const;

const KIND_BG = {
  convert: "bg-[var(--t-tag-bg-emerald)]",
  attention: "bg-[var(--t-tag-bg-amber)]",
  match: "bg-[var(--t-tag-bg-violet)]",
} as const;

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.15 } },
};

const row: Variants = {
  hidden: { opacity: 0, x: -8 },
  show: { opacity: 1, x: 0, transition: { duration: 0.45, ease: EASE } },
};

export function OverviewInsights({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) {
    return <div className="py-5 text-sm text-[var(--text-tertiary)]">No insights right now.</div>;
  }

  return (
    <motion.div
      className="divide-y divide-[var(--border-subtle)]"
      variants={container}
      initial="hidden"
      animate="show"
    >
      {insights.map((insight, i) => (
        <motion.div
          key={i}
          variants={row}
          className="-mx-2 flex items-start gap-3 rounded px-2 py-4 transition-colors hover:bg-[var(--bg-tertiary)]"
        >
          <span
            className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${KIND_BG[insight.kind]}`}
          >
            {KIND_ICON[insight.kind]}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--text-primary)]">{insight.title}</p>
            <p className="mt-0.5 text-sm text-[var(--text-tertiary)]">{insight.detail}</p>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
