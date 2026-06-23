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
      {/* Header — subtle emerald→violet wash so the AI panel reads as special */}
      <div className="flex items-start justify-between border-b border-zinc-100 bg-gradient-to-r from-emerald-50/60 via-white to-violet-50/50 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-emerald-500 shadow-sm">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Overview Agent</h2>
            <p className="text-xs text-zinc-500">Analyzing your pipeline and activity</p>
          </div>
        </div>
        {/* Active status with a soft pulsing halo */}
        <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-500">
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
      <div className="border-t border-zinc-100 bg-zinc-50/50 px-5 py-3 text-center">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-violet-600 transition-colors hover:text-violet-700"
        >
          <Sparkles className="h-3 w-3" />
          Ask the Overview Agent a question
        </button>
      </div>
    </Card>
  );
}
