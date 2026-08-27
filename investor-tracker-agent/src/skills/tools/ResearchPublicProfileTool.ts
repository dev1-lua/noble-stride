import { AI, env, type LuaTool } from "lua-cli";
import { z } from "zod";
import {
  PUBLIC_LABEL,
  RESEARCH_SYSTEM,
  buildResearchPrompt,
  isConfidentialLeak,
  shapeResearch,
  type ResearchShape,
  type ResearchSource,
} from "../../lib/research";

export interface ResearchDeps {
  generate: (opts: {
    model: string;
    system: string;
    prompt: string;
  }) => Promise<{ text: string; sources?: ResearchSource[] }>;
  model?: string;
}

// Google Search grounding is what populates `sources`, and a brief without
// sources is refused by shapeResearch — so the model family is not incidental.
// RESEARCH_MODEL overrides it without a code change.
const DEFAULT_MODEL = "google/gemini-2.5-flash";

const inputSchema = z.object({
  name: z.string().min(2).describe("Public name of the company, investor or person"),
  kind: z.enum(["company", "investor", "person"]),
  focus: z.string().optional().describe("Optional angle, e.g. 'recent news', 'ownership', 'leadership'"),
});

/**
 * A4 / F5.2: "use AI and public resources for summaries and news about clients
 * and investors."
 *
 * Read-only and outward-facing, which makes two things non-negotiable: the query
 * is refused before any network call if it carries a codename or an amount, and
 * every result is labelled as public web material so it can never be mistaken
 * for a CRM fact. It also never throws — an outage returns `unavailable` with
 * copy the persona can relay.
 */
export class ResearchPublicProfileTool implements LuaTool {
  name = "research_public_profile";
  description =
    "Search public web sources for a background brief or recent news on a company, investor or person, and return it clearly labelled as public information rather than CRM data. Pass the entity name exactly as the user said it, its kind, and an optional focus such as 'recent news' or 'ownership'. Never pass a deal codename, an amount, or anything else confidential: this leaves Noblestride for a public search. The result is read-only context and must never be fed into propose_change.";

  inputSchema = inputSchema;

  constructor(private deps?: ResearchDeps) {}

  private getDeps(): ResearchDeps {
    return (
      this.deps ?? {
        generate: (o) =>
          AI.generate({ model: o.model, system: o.system, prompt: o.prompt }).then((r) => ({
            text: r.text,
            sources: r.sources as ResearchSource[] | undefined,
          })),
        model: env("RESEARCH_MODEL") || DEFAULT_MODEL,
      }
    );
  }

  async execute(input: z.infer<typeof inputSchema>): Promise<ResearchShape> {
    // Before the network call, not after: once the query is sent it has left.
    if (isConfidentialLeak(input.name) || (input.focus && isConfidentialLeak(input.focus))) {
      return {
        status: "unavailable",
        label: PUBLIC_LABEL,
        brief: null,
        sources: [],
        message:
          "That query carries a deal codename or an amount, which must never leave Noblestride in a public search. Give me the public company or investor name instead.",
      };
    }

    const { generate, model } = this.getDeps();
    try {
      const r = await generate({
        model: model ?? DEFAULT_MODEL,
        system: RESEARCH_SYSTEM,
        prompt: buildResearchPrompt(input),
      });
      return shapeResearch(r.text, r.sources);
    } catch {
      return {
        status: "unavailable",
        label: PUBLIC_LABEL,
        brief: null,
        sources: [],
        message: "Public search is not available right now. Please try again shortly.",
      };
    }
  }
}
