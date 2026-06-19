// overview-agent-card.tsx — Presentational server component for the Overview Agent panel.
// Renders the AI insights list with kind-keyed icons, header status, and footer prompt.

import { Sparkles, TrendingUp, AlertCircle, Lightbulb } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui";
import type { Insight } from "@/server/domain/types";

interface OverviewAgentCardProps {
  insights: Insight[];
}

const KIND_ICON = {
  convert: <TrendingUp className="h-4 w-4 text-emerald-500" />,
  attention: <AlertCircle className="h-4 w-4 text-amber-500" />,
  match: <Lightbulb className="h-4 w-4 text-violet-500" />,
} as const;

const KIND_BG = {
  convert: "bg-emerald-50",
  attention: "bg-amber-50",
  match: "bg-violet-50",
} as const;

export function OverviewAgentCard({ insights }: OverviewAgentCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50">
              <Sparkles className="h-5 w-5 text-violet-500" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">Overview Agent</h2>
              <p className="text-xs text-zinc-500">Analyzing your pipeline and activity</p>
            </div>
          </div>
          {/* Active status — far right */}
          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Active</span>
          </div>
        </div>
      </CardHeader>

      <CardBody className="divide-y divide-zinc-100 !py-0">
        {insights.length === 0 ? (
          <div className="py-5 text-sm text-zinc-400">No insights right now.</div>
        ) : (
          insights.map((insight, i) => (
            <div key={i} className="flex items-start gap-3 py-4">
              <div className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${KIND_BG[insight.kind]}`}>
                {KIND_ICON[insight.kind]}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-900">{insight.title}</p>
                <p className="mt-0.5 text-sm text-zinc-500">{insight.detail}</p>
              </div>
            </div>
          ))
        )}
      </CardBody>

      {/* Footer */}
      <div className="border-t border-zinc-100 px-5 py-3 text-center">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-violet-600">
          <Sparkles className="h-3 w-3" />
          Ask the Overview Agent a question
        </span>
      </div>
    </Card>
  );
}
