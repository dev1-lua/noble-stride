import { AI, Data, type LuaTool } from "lua-cli";
import { z } from "zod";
import { crmClientFromEnv } from "../../lib/crm-client";
import {
  generateDigestMarkdown,
  DIGESTS_COLLECTION,
  type DigestRunnerDeps,
  type PipelineChoice,
} from "../../lib/digest-runner";

const inputSchema = z.object({
  days: z.number().int().min(1).max(90).default(7).describe("Lookback window in days"),
  pipeline: z.enum(["mandates", "transactions", "both"]).default("both"),
  useStored: z
    .boolean()
    .default(false)
    .describe("True when the user asks for 'this week's digest' / 'the weekly digest' — returns the most recent stored digest instead of generating fresh"),
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
    if (input.useStored) {
      const stored = await Data.get(DIGESTS_COLLECTION, {}, 1, 50);
      const latest = [...stored.data].sort((a, b) =>
        String((b as { data?: { generatedAt?: string } }).data?.generatedAt ?? "").localeCompare(
          String((a as { data?: { generatedAt?: string } }).data?.generatedAt ?? ""),
        ),
      )[0] as { data?: { markdown?: string } } | undefined;
      if (latest?.data?.markdown) return { status: "ok" as const, digest: latest.data.markdown };
      return { status: "empty" as const, message: "No stored weekly digest yet — offer to generate a fresh one instead." };
    }

    const digest = await generateDigestMarkdown(this.getDeps(), input.days, input.pipeline as PipelineChoice);
    return { status: "ok" as const, digest };
  }
}
