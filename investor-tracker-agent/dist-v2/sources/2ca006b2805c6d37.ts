import { AI, type LuaTool } from "lua-cli";
import { z } from "zod";
import { crmClientFromEnv } from "../../lib/crm-client";
import { generateDigestMarkdown, type DigestRunnerDeps, type PipelineChoice } from "../../lib/digest-runner";

// Unlike summarizerAgent's version there is no useStored branch: stored weekly
// digests live in that agent's Data collections, which are agent-scoped.

const inputSchema = z.object({
  days: z.number().int().min(1).max(90).default(7).describe("Lookback window in days"),
  pipeline: z.enum(["mandates", "transactions", "both"]).default("both"),
});

export class PipelineDigestTool implements LuaTool {
  name = "pipeline_digest";
  description =
    "Pipeline movement digest: what moved stage, what's new, what's stalled, and totals by stage — for mandates, transactions, or both.";
  inputSchema = inputSchema;

  constructor(private deps?: DigestRunnerDeps) {}

  private getDeps(): DigestRunnerDeps {
    return this.deps ?? { crm: crmClientFromEnv(), generate: (p: string) => AI.generate(p) };
  }

  async execute(input: z.infer<typeof inputSchema>) {
    const digest = await generateDigestMarkdown(this.getDeps(), input.days, input.pipeline as PipelineChoice);
    return { status: "ok" as const, digest };
  }
}
