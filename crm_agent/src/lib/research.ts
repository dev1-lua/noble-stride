// Public web research (A4 / F5.2: "use AI and public resources for summaries and
// news about clients and investors").
//
// The hard part is not the search, it is the boundary. Two rules shape this
// module:
//
//  1. Nothing confidential may leave. A staff member will naturally type what is
//     in front of them — a deal codename, a target raise — and that must be
//     refused BEFORE any network call, not filtered afterwards.
//  2. Nothing may come back unlabelled. A public brief and a CRM fact read
//     identically once they are in the same paragraph, so every result carries a
//     banner saying which it is, and a brief with no sources is not a brief.
//
// Pure: the model call is injected.

export type ResearchKind = "company" | "investor" | "person";

export interface ResearchSource {
  sourceType: "url";
  id: string;
  url: string;
  title?: string;
}

export interface ResearchInput {
  name: string;
  kind: ResearchKind;
  focus?: string;
}

export interface ResearchShape {
  status: "ok" | "no_public_info" | "unavailable";
  label: string;
  brief: string | null;
  sources: { url: string; title: string | null }[];
  message?: string;
}

export const PUBLIC_LABEL = "Public information (web), not from the CRM.";

/** The model says this and only this when it finds nothing it can stand behind. */
export const NO_PUBLIC_INFO_MARKER = "NO_PUBLIC_INFO";

export const RESEARCH_SYSTEM = `You are a research assistant. Use only publicly available web sources. Report what the sources say and attribute nothing you cannot source. If you find nothing reliable about the named entity, reply with exactly ${NO_PUBLIC_INFO_MARKER} and nothing else. Never speculate about finances, ownership, or legal matters. Keep the brief to at most six short lines.`;

const KIND_NOUN: Record<ResearchKind, string> = {
  company: "company",
  investor: "investor or fund",
  person: "person",
};

/**
 * The outbound query. It names the entity and nothing else: no CRM vocabulary,
 * no mention of Noblestride, because the query itself is the thing that leaves.
 */
export function buildResearchPrompt(input: ResearchInput): string {
  const lines = [
    `Research the ${KIND_NOUN[input.kind]} named "${input.name}" using publicly available web sources only.`,
    "Cover, briefly: what they do; notable recent public developments with dates; and anything publicly reported that someone advising on a capital raise would want to know.",
  ];
  if (input.focus) lines.push(`Focus especially on: ${input.focus}.`);
  lines.push(
    `If you cannot find reliable public information about this exact ${KIND_NOUN[input.kind]}, reply with exactly ${NO_PUBLIC_INFO_MARKER}.`,
  );
  return lines.join("\n");
}

// Codename shape and money amounts: both are things a staff member has on screen
// and would paste in without thinking.
//
// The codename check is deliberately CASE-SENSITIVE. With an `i` flag it matched
// ordinary business language — "Project Finance Advisors" is a real firm and
// "project finance track record" is a reasonable focus, and both were refused.
// A Noblestride codename is "Project <Capitalised>", so the capitals are the
// signal, and requiring two capitalised words after "Project" would miss
// "Project Amber". Case alone is the discriminator.
const CODENAME = /\bProject\s+([A-Z][a-z]+)/;

/**
 * Words that make "Project <Word>" ordinary business language rather than a
 * codename, so "Project Finance Advisors" can be researched. Everything else
 * after "Project" is treated as a codename and refused: a false refusal costs a
 * user one clarifying message, a false pass sends a codename to a search engine.
 */
const NOT_A_CODENAME = new Set([
  "Finance",
  "Financing",
  "Management",
  "Manager",
  "Development",
  "Delivery",
  "Director",
  "Officer",
  "Team",
  "Plan",
  "Planning",
  "Portfolio",
  "Pipeline",
  "Update",
  "Status",
]);

// An amount needs a currency, or a number of at least two digits before a scale
// suffix. `[\d,.]+\s?(m|bn|...)` alone matched "3M", which made a real company
// unresearchable.
const AMOUNT =
  /(\$|USD|KES|EUR|GBP)\s?[\d,.]+|\b\d[\d,.]*\s?(?:million|billion|bn)\b|\b\d{2,}[\d,.]*\s?m\b/i;

export function isConfidentialLeak(text: string): boolean {
  const codename = text.match(CODENAME);
  if (codename && !NOT_A_CODENAME.has(codename[1]!)) return true;
  return AMOUNT.test(text);
}

/**
 * A brief with no sources is not a brief — it is the model's prior, which is
 * exactly what F5.2 must not produce. Unsourced prose is reported as
 * no_public_info rather than passed on.
 */
export function shapeResearch(text: string, sources: ResearchSource[] | undefined): ResearchShape {
  const brief = (text ?? "").trim();
  const urls = (sources ?? [])
    .filter((s) => typeof s?.url === "string" && s.url.length > 0)
    .map((s) => ({ url: s.url, title: s.title?.trim() || null }));

  if (!brief || brief === NO_PUBLIC_INFO_MARKER || brief.includes(NO_PUBLIC_INFO_MARKER) || urls.length === 0) {
    return { status: "no_public_info", label: PUBLIC_LABEL, brief: null, sources: urls };
  }
  return { status: "ok", label: PUBLIC_LABEL, brief, sources: urls };
}
