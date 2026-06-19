// pipeline-chart.tsx — Inline SVG/CSS chart components for the Dashboard.
// NO chart library — React-19 compatible. Pure presentational (no hooks).

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGE_COLORS = [
  "#10b981", // emerald-500
  "#14b8a6", // teal-500
  "#0ea5e9", // sky-500
  "#6366f1", // indigo-500
  "#8b5cf6", // violet-500
  "#a78bfa", // violet-400
  "#f59e0b", // amber-500
  "#f97316", // orange-500
];

// ─── DealPipelineTrendChart ───────────────────────────────────────────────────

interface TrendPoint {
  month: string;
  active: number;
  closed: number;
}

interface DealPipelineTrendChartProps {
  data: TrendPoint[];
}

export function DealPipelineTrendChart({ data }: DealPipelineTrendChartProps) {
  const W = 520;
  const H = 180;
  const PAD_LEFT = 36;
  const PAD_RIGHT = 16;
  const PAD_TOP = 16;
  const PAD_BOTTOM = 32;

  const plotW = W - PAD_LEFT - PAD_RIGHT;
  const plotH = H - PAD_TOP - PAD_BOTTOM;

  const allVals = data.flatMap((d) => [d.active, d.closed]);
  const maxVal = Math.max(...allVals, 1);
  const n = data.length;

  function xPos(i: number) {
    return PAD_LEFT + (i / Math.max(n - 1, 1)) * plotW;
  }

  function yPos(v: number) {
    return PAD_TOP + plotH - (v / maxVal) * plotH;
  }

  // Build SVG path strings
  function buildPath(vals: number[]) {
    return vals
      .map((v, i) => `${i === 0 ? "M" : "L"}${xPos(i).toFixed(1)},${yPos(v).toFixed(1)}`)
      .join(" ");
  }

  function buildArea(vals: number[]) {
    const baseline = PAD_TOP + plotH;
    const path = vals
      .map((v, i) => `${i === 0 ? "M" : "L"}${xPos(i).toFixed(1)},${yPos(v).toFixed(1)}`)
      .join(" ");
    const closeRight = ` L${xPos(n - 1).toFixed(1)},${baseline}`;
    const closeLeft = ` L${xPos(0).toFixed(1)},${baseline} Z`;
    return path + closeRight + closeLeft;
  }

  const activePath = buildPath(data.map((d) => d.active));
  const closedPath = buildPath(data.map((d) => d.closed));
  const activeArea = buildArea(data.map((d) => d.active));
  const closedArea = buildArea(data.map((d) => d.closed));

  // Y-axis grid lines (3 levels: 0, half, max)
  const yTicks = [0, Math.round(maxVal / 2), maxVal];

  return (
    <div className="w-full">
      {/* Legend */}
      <div className="flex items-center gap-4 mb-3">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm bg-teal-500 opacity-80 inline-block" />
          <span className="text-xs text-zinc-500">Active</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm bg-emerald-300 opacity-80 inline-block" />
          <span className="text-xs text-zinc-500">Closed</span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: 180 }}
        aria-label="Deal pipeline trend chart"
      >
        {/* Grid lines */}
        {yTicks.map((tick) => {
          const y = yPos(tick);
          return (
            <g key={tick}>
              <line
                x1={PAD_LEFT}
                y1={y}
                x2={W - PAD_RIGHT}
                y2={y}
                stroke="#e4e4e7"
                strokeWidth="1"
                strokeDasharray="4 3"
              />
              <text x={PAD_LEFT - 4} y={y + 4} textAnchor="end" fontSize="10" fill="#a1a1aa">
                {tick}
              </text>
            </g>
          );
        })}

        {/* Closed area (bottom, lighter) */}
        <path d={closedArea} fill="#6ee7b7" fillOpacity="0.35" />
        {/* Active area (on top, stronger) */}
        <path d={activeArea} fill="#14b8a6" fillOpacity="0.25" />

        {/* Closed line */}
        <path d={closedPath} fill="none" stroke="#6ee7b7" strokeWidth="2" strokeLinejoin="round" />
        {/* Active line */}
        <path d={activePath} fill="none" stroke="#0d9488" strokeWidth="2.5" strokeLinejoin="round" />

        {/* Data dots */}
        {data.map((d, i) => (
          <g key={i}>
            <circle cx={xPos(i)} cy={yPos(d.active)} r="3" fill="#0d9488" />
            <circle cx={xPos(i)} cy={yPos(d.closed)} r="2.5" fill="#6ee7b7" />
          </g>
        ))}

        {/* X-axis month labels */}
        {data.map((d, i) => (
          <text
            key={i}
            x={xPos(i)}
            y={H - 6}
            textAnchor="middle"
            fontSize="10"
            fill="#a1a1aa"
          >
            {d.month}
          </text>
        ))}
      </svg>
    </div>
  );
}

// ─── PipelineOverviewChart ───────────────────────────────────────────────────

interface StageCount {
  stage: string;
  label: string;
  count: number;
}

interface PipelineOverviewChartProps {
  mandatesByStage: StageCount[];
  transactionsByStage: StageCount[];
}

function StageGroupChart({
  heading,
  stages,
}: {
  heading: string;
  stages: StageCount[];
}) {
  const total = stages.reduce((sum, s) => sum + s.count, 0);
  const nonZero = stages.filter((s) => s.count > 0);

  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 mb-2">
        {heading}
      </p>

      {/* Stacked horizontal bar */}
      <div className="flex h-5 w-full overflow-hidden rounded-full bg-zinc-100 mb-3">
        {total === 0 ? (
          <div className="h-full w-full rounded-full bg-zinc-200" />
        ) : (
          stages.map((s, i) => {
            if (s.count === 0) return null;
            const pct = (s.count / total) * 100;
            return (
              <div
                key={s.stage}
                style={{
                  width: `${pct}%`,
                  backgroundColor: STAGE_COLORS[i % STAGE_COLORS.length],
                }}
                title={`${s.label}: ${s.count}`}
              />
            );
          })
        )}
      </div>

      {/* Legend grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
        {(nonZero.length > 0 ? nonZero : stages.slice(0, 3)).map((s, i) => {
          const colorIdx = stages.findIndex((orig) => orig.stage === s.stage);
          return (
            <div key={s.stage} className="flex items-center gap-1.5 min-w-0">
              <span
                className="h-2 w-2 flex-shrink-0 rounded-full"
                style={{
                  backgroundColor: STAGE_COLORS[(colorIdx >= 0 ? colorIdx : i) % STAGE_COLORS.length],
                }}
              />
              <span className="text-xs text-zinc-600 truncate">
                {s.label}
              </span>
              <span className="text-xs font-semibold text-zinc-900 ml-auto flex-shrink-0">
                {s.count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PipelineOverviewChart({
  mandatesByStage,
  transactionsByStage,
}: PipelineOverviewChartProps) {
  return (
    <div className="space-y-6">
      <StageGroupChart heading="Mandates Pipeline" stages={mandatesByStage} />
      <StageGroupChart heading="Active Transactions" stages={transactionsByStage} />
    </div>
  );
}
