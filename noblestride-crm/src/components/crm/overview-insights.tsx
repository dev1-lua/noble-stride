"use client";

// Client-side staggered list of Overview Agent insights (rows fade/slide in,
// lift slightly on hover). Kept separate so the card shell can stay a server component.

import { motion, type Variants } from "motion/react";
import { TrendingUp, AlertCircle, Lightbulb } from "lucide-react";
import { EASE } from "@/components/ui/motion";
import type { Insight } from "@/server/domain/types";

const KIND_ICON = {
  convert: <TrendingUp className="h-4 w-4 text-emerald-500" />,
  attention: <AlertCircle className="h-4 w-4 text-amber-500" />,
  match: <Lightbulb className="h-4 w-4 text-violet-500" />,
} as const;

const KIND_BG = {
  convert: "bg-emerald-50 ring-emerald-100",
  attention: "bg-amber-50 ring-amber-100",
  match: "bg-violet-50 ring-violet-100",
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
    return <div className="py-5 text-sm text-zinc-400">No insights right now.</div>;
  }

  return (
    <motion.div
      className="divide-y divide-zinc-100"
      variants={container}
      initial="hidden"
      animate="show"
    >
      {insights.map((insight, i) => (
        <motion.div
          key={i}
          variants={row}
          className="-mx-2 flex items-start gap-3 rounded-lg px-2 py-4 transition-colors hover:bg-zinc-50/80"
        >
          <span
            className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ring-1 ring-inset ${KIND_BG[insight.kind]}`}
          >
            {KIND_ICON[insight.kind]}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-zinc-900">{insight.title}</p>
            <p className="mt-0.5 text-sm text-zinc-500">{insight.detail}</p>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
