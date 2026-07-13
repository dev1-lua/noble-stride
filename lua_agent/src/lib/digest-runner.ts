import type { CrmClient } from "./crm-client";
import { PIPELINE_SNAPSHOT } from "./queries";
import { computeDigest, buildDigestPrompt, fallbackDigestMarkdown, type StageColumn } from "./format";

export type PipelineChoice = "mandates" | "transactions" | "both";

export const DIGESTS_COLLECTION = "digests";

/** ISO date (YYYY-MM-DD) of the Monday of the week containing `date` (UTC). */
export function weekOf(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay(); // 0 Sun .. 6 Sat
  d.setUTCDate(d.getUTCDate() - ((day + 6) % 7));
  return d.toISOString().slice(0, 10);
}

export interface DigestRunnerDeps {
  crm: CrmClient;
  generate: (prompt: string) => Promise<string>;
  now?: () => Date;
}

export async function generateDigestMarkdown(
  deps: DigestRunnerDeps,
  windowDays: number,
  pipeline: PipelineChoice,
): Promise<string> {
  const now = deps.now ? deps.now() : new Date();
  const snapshot = await deps.crm.query<{
    mandatesByStage: StageColumn[];
    transactionsByStage: StageColumn[];
  }>(PIPELINE_SNAPSHOT);

  const digest = computeDigest({
    mandateColumns: snapshot.mandatesByStage,
    transactionColumns: snapshot.transactionsByStage,
    windowDays,
    now,
  });

  try {
    return await deps.generate(buildDigestPrompt(digest, pipeline));
  } catch {
    return fallbackDigestMarkdown(digest, pipeline);
  }
}
