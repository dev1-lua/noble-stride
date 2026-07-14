import type { CrmClient } from "./crm-client";
import { MATCH_INVESTORS, TEASER_CONTEXT, SAVE_DRAFTS } from "./queries";

export interface TeaserCtx {
  codename: string; sectors: string[]; geographies: string[]; dealType: string | null;
  instruments: string[]; targetRaiseBand: string | null; revenueBand: string | null;
  revenueForecastBand: string | null; description: string | null; contact: string;
}
export interface Match {
  investorId: string; name: string; personId: string | null; contactName: string | null;
  contactEmail: string | null; matchReasons: string[]; hasExistingEngagement: boolean;
}
export interface DraftRunnerDeps {
  crm: CrmClient;
  generate: (prompt: string) => Promise<string>;
}

/**
 * Builds the drafting prompt from ONLY the PRE_INTEREST teaser context + a
 * match's reasons — this is the confidentiality guarantee: the agent never
 * sees full financials, client identity, or other-investor data, so it
 * cannot leak them even if a prompt-injected recipient tries to extract more.
 */
export function buildIntroPrompt(ctx: TeaserCtx, match: Match): string {
  return [
    `Write a short, professional first-contact email introducing an investment opportunity to an investor.`,
    ``,
    `Opportunity (this is ALL you know — never invent more):`,
    `- Code name: ${ctx.codename} (the company is anonymized until NDA)`,
    `- Sectors: ${ctx.sectors.join(", ") || "n/a"}`,
    `- Geography: ${ctx.geographies.join(", ") || "n/a"}`,
    `- Instruments: ${ctx.instruments.join(", ") || "n/a"}`,
    `- Target raise: ${ctx.targetRaiseBand ?? "undisclosed"}`,
    `- Revenue band: ${ctx.revenueBand ?? "undisclosed"}`,
    ctx.description ? `- Description: ${ctx.description}` : ``,
    ``,
    `Recipient: ${match.contactName ?? "the investment team"} at ${match.name}.`,
    `Why it matches them: ${match.matchReasons.join("; ")}.`,
    ``,
    `Rules:`,
    `- 120-180 words, plain text, no markdown.`,
    `- Greet the recipient by name when known.`,
    `- Reference why it fits their mandate (use the match reasons).`,
    `- Use ONLY the facts above. No company names, no promises, no valuation talk, no attachments.`,
    `- Close by inviting them to reply to receive the teaser, and sign off exactly:`,
    `  "NobleStride Advisory"`,
    `Return ONLY the email body.`,
  ].filter(Boolean).join("\n");
}

/** Deterministic template used when generation fails — never sinks the batch. */
export function fallbackIntro(ctx: TeaserCtx, match: Match): { subject: string; body: string } {
  const greeting = match.contactName ? `Dear ${match.contactName.split(" ")[0]},` : "Dear investment team,";
  return {
    subject: `Investment opportunity — ${ctx.codename}`,
    body: [
      greeting,
      ``,
      `NobleStride Capital is advising ${ctx.codename}, a ${ctx.sectors.join("/") || "growth"} opportunity in ${
        ctx.geographies.join(", ") || "Africa"
      } raising ${ctx.targetRaiseBand ?? "growth capital"}${
        ctx.instruments.length ? ` (${ctx.instruments.join("/")})` : ""
      }.`,
      ``,
      `Based on your mandate (${match.matchReasons.join("; ").toLowerCase()}), we believe this could be a fit for ${match.name}.`,
      ``,
      `If you would like the teaser, simply reply to this email and our team will share it along with next steps.`,
      ``,
      `NobleStride Advisory`,
    ].join("\n"),
  };
}

export async function runDraftOutreach(
  deps: DraftRunnerDeps,
  transactionId: string,
): Promise<{ requested: number; saved: number; skipped: number; fallbacks: number }> {
  const [matchesData, ctxData] = await Promise.all([
    deps.crm.query<{ matchInvestorsForTransaction: Match[] }>(MATCH_INVESTORS, { transactionId }),
    deps.crm.query<{ transactionTeaserContext: TeaserCtx }>(TEASER_CONTEXT, { transactionId }),
  ]);
  const matches: Match[] = matchesData.matchInvestorsForTransaction;
  const ctx: TeaserCtx = ctxData.transactionTeaserContext;

  let fallbacks = 0;
  let skipped = 0;
  const drafts: Array<{ investorId: string; personId: string | null; subject: string; body: string; matchRationale: string }> = [];
  for (const match of matches) {
    if (!match.contactEmail) { skipped += 1; continue; }
    let subject = `Investment opportunity — ${ctx.codename}`;
    let body: string;
    try {
      body = (await deps.generate(buildIntroPrompt(ctx, match))).trim();
      if (!body) throw new Error("empty generation");
    } catch {
      const fb = fallbackIntro(ctx, match);
      subject = fb.subject;
      body = fb.body;
      fallbacks += 1;
    }
    drafts.push({ investorId: match.investorId, personId: match.personId, subject, body, matchRationale: match.matchReasons.join("; ") });
  }

  let saved = 0;
  if (drafts.length > 0) {
    const res = await deps.crm.query<{ saveOutreachDrafts: { ok: boolean; created: number; skipped: number } }>(
      SAVE_DRAFTS,
      { input: { transactionId, drafts } },
    );
    saved = res.saveOutreachDrafts.created;
  }
  return { requested: matches.length, saved, skipped, fallbacks };
}
