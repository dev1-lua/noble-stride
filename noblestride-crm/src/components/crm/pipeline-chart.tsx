"use client";

// pipeline-chart.tsx — animated, premium SVG/CSS charts for the Dashboard.
// Motion-driven draw-in. Retoned to the Twenty tag-palette series set.

import { useState } from "react";
import { motion } from "motion/react";
import { EASE } from "@/components/ui/motion";

// ─── Palette ────────────────────────────────────────────────────────────────
// Series colors drawn from the shared Twenty tag palette so charts read as one
// system with the pill/tag chrome elsewhere in the app. Stages progress
// sky → blue → violet → amber as they move through the pipeline; terminal
// stages are special-cased: "won/signed" culminates in emerald (brand accent),
// "lost" is a quiet gray. Crisp white dividers between bar segments do the rest.

const RAMP = ["#0ea5e9", "#3b82f6", "#8b5cf6", "#f59e0b", "#f43f5e"];
const WON = "#10b981"; // emerald — deepest culmination (brand accent)
const LOST = "#868e96"; // text-tertiary gray — present but quiet

function stageColor(stage: string, rampIndex: number): string {
  const s = stage.toLowerCase();
  if (s.includes("lost")) return LOST;
  if (s.includes("signed") || s.includes("won")) return WON;
  return RAMP[Math.min(rampIndex, RAMP.length - 1)];
}

const ACTIVE_COLOR = "#0ea5e9"; // sky
const CLOSED_COLOR = "#10b981"; // emerald (brand accent)

// ─── Smooth path (Catmull-Rom → cubic bezier) ────────────────────────────────

interface Pt {
  x: number;
  y: number;
}

function smoothPath(pts: Pt[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M${pts[0].x},${pts[0].y}`;
  const t = 0.18; // tension
  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) * t;
    const c1y = p1.y + (p2.y - p0.y) * t;
    const c2x = p2.x - (p3.x - p1.x) * t;
    const c2y = p2.y - (p3.y - p1.y) * t;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

// ─── DealPipelineTrendChart ───────────────────────────────────────────────────

interface TrendPoint {
  month: string;
  active: number;
  closed: number;
}

export function DealPipelineTrendChart({ data }: { data: TrendPoint[] }) {
  const W = 520;
  const H = 200;
  const PAD_LEFT = 32;
  const PAD_RIGHT = 14;
  const PAD_TOP = 14;
  const PAD_BOTTOM = 30;

  const plotW = W - PAD_LEFT - PAD_RIGHT;
  const plotH = H - PAD_TOP - PAD_BOTTOM;

  const maxVal = Math.max(...data.flatMap((d) => [d.active, d.closed]), 1);
  const n = data.length;

  const xPos = (i: number) => PAD_LEFT + (i / Math.max(n - 1, 1)) * plotW;
  const yPos = (v: number) => PAD_TOP + plotH - (v / maxVal) * plotH;

  const activePts = data.map((d, i) => ({ x: xPos(i), y: yPos(d.active) }));
  const closedPts = data.map((d, i) => ({ x: xPos(i), y: yPos(d.closed) }));

  const baseline = PAD_TOP + plotH;
  const areaFrom = (pts: Pt[]) =>
    `${smoothPath(pts)} L${xPos(n - 1).toFixed(1)},${baseline} L${xPos(0).toFixed(1)},${baseline} Z`;

  const yTicks = [0, Math.round(maxVal / 2), maxVal];

  // ─── Hover tooltip ──────────────────────────────────────────────────────
  // `hover` holds the nearest-month index plus the SVG's live rendered
  // width, so viewBox x can be converted back to CSS px for the HTML
  // overlay (the SVG itself is responsive-width / fixed-height).
  const [hover, setHover] = useState<{ i: number; rectWidth: number } | null>(null);

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    if (mouseY < PAD_TOP || mouseY > PAD_TOP + plotH || mouseX < PAD_LEFT - 5 || mouseX > W - PAD_RIGHT + 5) {
      setHover(null);
      return;
    }

    const frac = (mouseX - PAD_LEFT) / Math.max(plotW, 1);
    const i = Math.min(n - 1, Math.max(0, Math.round(frac * (n - 1))));
    setHover({ i, rectWidth: rect.width });
  };

  const hoveredPoint = hover ? data[hover.i] : null;
  const guideX = hover ? xPos(hover.i) : 0;
  const flip = hover ? (guideX - PAD_LEFT) / Math.max(plotW, 1) > 0.65 : false;
  const cssGuideX = hover ? (guideX * hover.rectWidth) / W : 0;
  const tooltipTop = hoveredPoint
    ? Math.max(4, Math.min(yPos(hoveredPoint.active) - 10, H - 62))
    : 0;

  return (
    <div className="w-full">
      {/* Legend */}
      <div className="mb-3 flex items-center gap-5">
        <LegendDot color={ACTIVE_COLOR} label="Active" />
        <LegendDot color={CLOSED_COLOR} label="Closed" />
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          style={{ height: 200 }}
          aria-label="Deal pipeline trend chart"
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id="ns-active-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={ACTIVE_COLOR} stopOpacity="0.22" />
              <stop offset="100%" stopColor={ACTIVE_COLOR} stopOpacity="0" />
            </linearGradient>
            <linearGradient id="ns-closed-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CLOSED_COLOR} stopOpacity="0.16" />
              <stop offset="100%" stopColor={CLOSED_COLOR} stopOpacity="0" />
            </linearGradient>
          </defs>

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
                  stroke="#e9ecef"
                  strokeWidth="1"
                />
                <text x={PAD_LEFT - 6} y={y + 3.5} textAnchor="end" fontSize="9.5" fill="#868e96">
                  {tick}
                </text>
              </g>
            );
          })}

          {/* Areas (fade in) */}
          <motion.path
            d={areaFrom(closedPts)}
            fill="url(#ns-closed-fill)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.5, ease: EASE }}
          />
          <motion.path
            d={areaFrom(activePts)}
            fill="url(#ns-active-fill)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.55, ease: EASE }}
          />

          {/* Lines (draw in) */}
          <motion.path
            d={smoothPath(closedPts)}
            fill="none"
            stroke={CLOSED_COLOR}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.1, ease: EASE }}
          />
          <motion.path
            d={smoothPath(activePts)}
            fill="none"
            stroke={ACTIVE_COLOR}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.1, ease: EASE }}
          />

          {/* Dots (pop in last) */}
          {data.map((d, i) => (
            <motion.g
              key={i}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: 0.9 + i * 0.05, ease: EASE }}
              style={{ transformOrigin: `${xPos(i)}px ${yPos(d.active)}px` }}
            >
              <circle cx={xPos(i)} cy={yPos(d.closed)} r="3" fill="#fff" stroke={CLOSED_COLOR} strokeWidth="1.5" />
              <circle cx={xPos(i)} cy={yPos(d.active)} r="3.5" fill="#fff" stroke={ACTIVE_COLOR} strokeWidth="2" />
            </motion.g>
          ))}

          {/* X-axis labels */}
          {data.map((d, i) => (
            <text key={i} x={xPos(i)} y={H - 6} textAnchor="middle" fontSize="9.5" fill="#868e96">
              {d.month}
            </text>
          ))}

          {/* Hover guide + highlight dots */}
          {hoveredPoint && (
            <g>
              <line
                x1={guideX}
                y1={PAD_TOP}
                x2={guideX}
                y2={PAD_TOP + plotH}
                stroke="#dee2e6"
                strokeWidth="1"
              />
              <circle
                cx={guideX}
                cy={yPos(hoveredPoint.closed)}
                r="4.5"
                fill="#fff"
                stroke={CLOSED_COLOR}
                strokeWidth="2"
              />
              <circle
                cx={guideX}
                cy={yPos(hoveredPoint.active)}
                r="5"
                fill="#fff"
                stroke={ACTIVE_COLOR}
                strokeWidth="2.5"
              />
            </g>
          )}
        </svg>

        {/* Hover tooltip — HTML overlay positioned in CSS px, flips to the
            left of the guide line once the point sits in the right ~35% of
            the plot so it never overflows the chart's right edge. */}
        {hoveredPoint && hover && (
          <div
            className="pointer-events-none absolute z-10 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2 text-xs shadow-lg"
            style={{
              top: tooltipTop,
              ...(flip
                ? { right: hover.rectWidth - cssGuideX + 12 }
                : { left: cssGuideX + 12 }),
            }}
          >
            <p className="font-medium text-[var(--text-primary)]">{hoveredPoint.month}</p>
            <p style={{ color: ACTIVE_COLOR }}>Active Deals : {hoveredPoint.active}</p>
            <p style={{ color: CLOSED_COLOR }}>Closed Deals : {hoveredPoint.closed}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-xs text-[var(--text-tertiary)]">{label}</span>
    </div>
  );
}

// ─── PipelineOverviewChart ───────────────────────────────────────────────────

interface StageCount {
  stage: string;
  label: string;
  count: number;
  /** Drilldown target (pre-filtered /deals URL), computed server-side —
   * functions can't cross the RSC boundary into this client component. */
  href?: string;
}

function StageGroupChart({
  heading,
  stages,
  active,
}: {
  heading: string;
  stages: StageCount[];
  active: number;
}) {
  const total = stages.reduce((sum, s) => sum + s.count, 0);
  const nonZero = stages.filter((s) => s.count > 0);
  const closed = Math.max(0, total - active);

  return (
    <div>
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
        {heading}
      </p>

      <p className="mb-2 text-xs text-[var(--text-tertiary)]">
        <span className="font-semibold tabular-nums text-[var(--text-primary)]">{active}</span> active
        {" · "}<span className="tabular-nums">{closed}</span> closed
        {" · "}<span className="tabular-nums">{total}</span> total
      </p>

      {/* Stacked bar — wipes in left→right via clip-path */}
      <div className="mb-3 h-2.5 w-full overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
        {total === 0 ? (
          <div className="h-full w-full bg-[var(--border-strong)]" />
        ) : (
          <motion.div
            className="flex h-full w-full"
            initial={{ clipPath: "inset(0 100% 0 0)" }}
            whileInView={{ clipPath: "inset(0 0% 0 0)" }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.9, ease: EASE }}
          >
            {(() => {
              // Index of the last non-zero stage — every segment before it gets a
              // hairline white divider on its right edge so adjacent shades read as
              // distinct blocks (box-border keeps the divider inside the width).
              const lastVisible = stages.reduce((acc, s, i) => (s.count > 0 ? i : acc), -1);
              return stages.map((s, i) => {
                if (s.count === 0) return null;
                const seg = (
                  <div
                    className="box-border h-full w-full"
                    style={{
                      backgroundColor: stageColor(s.stage, i),
                      borderRight: i < lastVisible ? "2px solid #fff" : undefined,
                    }}
                    title={`${s.label}: ${s.count}`}
                  />
                );
                return s.href ? (
                  <a key={s.stage} href={s.href} className="h-full" style={{ width: `${(s.count / total) * 100}%` }}>
                    {seg}
                  </a>
                ) : (
                  <div key={s.stage} className="h-full" style={{ width: `${(s.count / total) * 100}%` }}>
                    {seg}
                  </div>
                );
              });
            })()}
          </motion.div>
        )}
      </div>

      {/* Legend grid — each entry is a discrete tile so dot · label · count read
          as one separated unit and never crowd the neighbouring column. */}
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {(nonZero.length > 0 ? nonZero : stages.slice(0, 3)).map((s) => {
          const colorIdx = stages.findIndex((orig) => orig.stage === s.stage);
          const tile = (
            <>
              <span
                className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                style={{ backgroundColor: stageColor(s.stage, colorIdx) }}
              />
              <span className="truncate text-xs text-[var(--text-secondary)]">{s.label}</span>
              <span className="ml-auto flex-shrink-0 border-l border-[var(--border-subtle)] pl-1.5 text-xs font-semibold tabular-nums text-[var(--text-primary)]">
                {s.count}
              </span>
            </>
          );
          const tileClass = "flex min-w-0 items-center gap-1.5 rounded-md bg-[var(--bg-tertiary)] px-2 py-1.5";
          return s.href ? (
            <a key={s.stage} href={s.href} className={`${tileClass} transition-colors hover:bg-[var(--border-subtle)]`} title={`${s.label}: ${s.count}`}>
              {tile}
            </a>
          ) : (
            <div key={s.stage} className={tileClass} title={`${s.label}: ${s.count}`}>
              {tile}
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
  mandatesActive,
  transactionsActive,
}: {
  mandatesByStage: StageCount[];
  transactionsByStage: StageCount[];
  mandatesActive: number;
  transactionsActive: number;
}) {
  return (
    <div className="space-y-6">
      <StageGroupChart heading="Mandates Pipeline" stages={mandatesByStage} active={mandatesActive} />
      <StageGroupChart heading="Transactions Pipeline" stages={transactionsByStage} active={transactionsActive} />
    </div>
  );
}
