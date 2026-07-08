// engagement-stage-colors.ts — single source of truth for engagement-stage
// ordering and colors, shared by the focal boards' distribution bars/legends.
import { LABELS } from "@/lib/vocab";

export const ENGAGEMENT_STAGES: string[] = Object.keys(LABELS.EngagementStage);

// Solid bg-* per stage, in vocab order (Shared → … → Declined).
const STAGE_BG: Record<string, string> = {
  Shared: "bg-slate-400",
  TeaserSent: "bg-sky-400",
  NDASigned: "bg-sky-500",
  IMShared: "bg-violet-400",
  VDRAccess: "bg-violet-500",
  Meeting: "bg-amber-400",
  InfoRequest: "bg-amber-500",
  DueDiligence: "bg-orange-500",
  TermSheet: "bg-emerald-400",
  Offer: "bg-emerald-500",
  Invested: "bg-emerald-600",
  Declined: "bg-rose-500",
};

export function stageBarColor(stage: string): string {
  return STAGE_BG[stage] ?? "bg-zinc-300";
}

export function stageColorSwatch(stage: string): string {
  return stageBarColor(stage);
}
