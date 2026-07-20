import { AI, type LuaTool } from "lua-cli";
import { z } from "zod";
import { crmClientFromEnv } from "../../lib/crm-client";
import { PIPELINE_SNAPSHOT } from "../../lib/queries";
import { analyzePipeline, type AnalysisPipelineItem } from "../../lib/analysis";
import { buildPipelinePrompt } from "../../lib/format";
import type { AnalysisDeps } from "./DealHealthTool";

interface StageCol { stage: string; label: string; items: AnalysisPipelineItem[] }

const inputSchema = z.object({
  pipeline: z.enum(["mandates", "transactions", "both"]).default("both"),
});

export class AnalyzePipelineTool implements LuaTool {
  name = "analyze_pipeline";
  description = "Analyse the mandate and/or transaction pipeline: totals and value by stage, stalled deals (aging), and sector concentration, with an insight on where attention is needed.";
  inputSchema = inputSchema;

  constructor(private deps?: AnalysisDeps) {}
  private getDeps(): AnalysisDeps { return this.deps ?? { crm: crmClientFromEnv(), generate: (p) => AI.generate(p) }; }

  async execute(input: z.infer<typeof inputSchema>) {
    const { crm, generate } = this.getDeps();
    const snap = await crm.query<{ mandatesByStage: StageCol[]; transactionsByStage: StageCol[] }>(PIPELINE_SNAPSHOT);
    const cols: StageCol[] = [];
    if (input.pipeline !== "transactions") cols.push(...(snap.mandatesByStage ?? []));
    if (input.pipeline !== "mandates") cols.push(...(snap.transactionsByStage ?? []));

    const analysis = analyzePipeline(cols);
    let summary: string;
    try { summary = await generate(buildPipelinePrompt(analysis, input.pipeline)); }
    catch {
      summary = `## Pipeline analysis (${input.pipeline})\n` +
        analysis.metrics.map((m) => `- ${m.stage}: ${m.count} deal(s)${m.totalValue != null ? `, value ${m.totalValue}` : ""}`).join("\n");
    }
    return { status: "ok" as const, summary, depth: analysis.depth };
  }
}
