"use client";

// disbursement-period-chart.tsx — grouped bars: disbursed vs pending per
// calendar quarter (SPEC §13). Same SVG/CSS + motion conventions as
// pipeline-chart.tsx; retoned to the Twenty tag-palette series set.

import { motion } from "motion/react";
import { EASE } from "@/components/ui/motion";
import { formatMoney } from "@/lib/money";

const DISBURSED_COLOR = "#10b981"; // emerald (brand accent) — primary/active series
const PENDING_COLOR = "#0ea5e9"; // sky

export interface DisbursementPeriodPoint {
  year: number;
  quarter: number;
  disbursed: number;
  pending: number;
}

export function DisbursementPeriodChart({ data }: { data: DisbursementPeriodPoint[] }) {
  const W = 520;
  const H = 210;
  const PAD_LEFT = 44;
  const PAD_RIGHT = 10;
  const PAD_TOP = 14;
  const PAD_BOTTOM = 30;

  const plotW = W - PAD_LEFT - PAD_RIGHT;
  const plotH = H - PAD_TOP - PAD_BOTTOM;

  const maxVal = Math.max(...data.flatMap((d) => [d.disbursed, d.pending]), 1);
  const n = data.length;
  const groupW = plotW / Math.max(n, 1);
  const barW = Math.min(22, groupW * 0.32);
  const baseline = PAD_TOP + plotH;

  const barH = (v: number) => (v / maxVal) * plotH;
  const yTicks = [0, maxVal / 2, maxVal];

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center gap-5">
        <LegendDot color={DISBURSED_COLOR} label="Disbursed" />
        <LegendDot color={PENDING_COLOR} label="Pending" />
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 210 }} aria-label="Disbursements by quarter chart">
        {yTicks.map((tick) => {
          const y = baseline - barH(tick);
          return (
            <g key={tick}>
              <line x1={PAD_LEFT} y1={y} x2={W - PAD_RIGHT} y2={y} stroke="#e9ecef" strokeWidth="1" />
              <text x={PAD_LEFT - 6} y={y + 3.5} textAnchor="end" fontSize="9.5" fill="#868e96">
                {formatMoney(tick)}
              </text>
            </g>
          );
        })}

        {data.map((d, i) => {
          const cx = PAD_LEFT + groupW * i + groupW / 2;
          const dh = barH(d.disbursed);
          const ph = barH(d.pending);
          return (
            <g key={`${d.year}-${d.quarter}`}>
              <motion.rect
                x={cx - barW - 1.5}
                width={barW}
                rx={3}
                fill={DISBURSED_COLOR}
                initial={{ y: baseline, height: 0 }}
                animate={{ y: baseline - dh, height: dh }}
                transition={{ duration: 0.7, delay: 0.1 + i * 0.06, ease: EASE }}
              >
                <title>{`Q${d.quarter} ${d.year} disbursed: ${formatMoney(d.disbursed)}`}</title>
              </motion.rect>
              <motion.rect
                x={cx + 1.5}
                width={barW}
                rx={3}
                fill={PENDING_COLOR}
                initial={{ y: baseline, height: 0 }}
                animate={{ y: baseline - ph, height: ph }}
                transition={{ duration: 0.7, delay: 0.16 + i * 0.06, ease: EASE }}
              >
                <title>{`Q${d.quarter} ${d.year} pending: ${formatMoney(d.pending)}`}</title>
              </motion.rect>
              <text x={cx} y={H - 6} textAnchor="middle" fontSize="9.5" fill="#868e96">
                {`Q${d.quarter} ${String(d.year).slice(2)}`}
              </text>
            </g>
          );
        })}
      </svg>
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
