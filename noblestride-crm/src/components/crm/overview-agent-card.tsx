// overview-agent-card.tsx — Presentational server component for the Overview Agent panel.
// Shell + header are server-rendered; the insight rows animate client-side (OverviewInsights).

import { Sparkles } from "lucide-react";
import { Card } from "@/components/ui";
import { OverviewInsights } from "./overview-insights";
import type { Insight } from "@/server/domain/types";

interface OverviewAgentCardProps {
  insights: Insight[];
}

export function OverviewAgentCard({ insights }: OverviewAgentCardProps) {
  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-primary)] px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--t-tag-bg-violet)] text-[var(--t-tag-text-violet)]">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Overview Agent</h2>
            <p className="text-xs text-[var(--text-tertiary)]">Analyzing your pipeline and activity</p>
          </div>
        </div>
        {/* Active status with a soft pulsing halo — status dot stays semantic emerald */}
        <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-tertiary)]">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span>Active</span>
        </div>
      </div>

      <div className="px-5 py-1">
        <OverviewInsights insights={insights} />
      </div>

      {/* Footer */}
      <div className="border-t border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-5 py-3 text-center">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--accent)] transition-colors hover:text-[var(--accent-hover)]"
        >
          <Sparkles className="h-3 w-3" />
          Ask the Overview Agent a question
        </button>
      </div>
    </Card>
  );
}
