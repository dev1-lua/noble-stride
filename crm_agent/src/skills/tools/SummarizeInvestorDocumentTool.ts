import { AI, type LuaTool } from "lua-cli";
import { z } from "zod";
import { crmClientFromEnv, type CrmClient } from "../../lib/crm-client";
import { GLOBAL_SEARCH, LIST_INVESTOR_DOCUMENTS, DOCUMENT_AGENT_TEXT, INVESTOR_CRITERIA } from "../../lib/queries";
import { resolveRecord, type SearchResult } from "../../lib/resolve";
import { buildDocumentFitPrompt, fallbackDocumentFitMarkdown } from "../../lib/format";

export interface SummarizeDocumentDeps {
  crm: CrmClient;
  generate: (prompt: string) => Promise<string>;
}

const inputSchema = z.object({
  investor: z
    .string()
    .min(1)
    .describe("The fund's name as the user said it, or an exact investor id from a previous candidates list"),
  document: z
    .string()
    .optional()
    .describe(
      "The document's name as the user named it (e.g. 'the pitch deck', 'term sheet'). Omit to use the fund's most recently uploaded document.",
    ),
});

interface InvestorDocRow {
  id: string;
  name: string;
  type: string;
  uploadedAt: string;
  isCurrent: boolean;
  createdSource: string;
}

/**
 * summarize_investor_document (Task 5): the ONLY place crmAgent reads a
 * document's actual file contents — everywhere else (summarize_record's
 * embedded documents) stays metadata-only. Resolves the fund, picks a named
 * or latest document, fetches its extracted text via documentAgentText, and
 * checks it against the fund's stated CRM criteria. Never emailed to the
 * investor — this tool exists only in the staff-facing crmAgent.
 */
export class SummarizeInvestorDocumentTool implements LuaTool {
  name = "summarize_investor_document";
  description =
    "Summarize a document an investor uploaded through the portal (pitch deck, term sheet, etc) and check it against that fund's stated CRM criteria.";
  inputSchema = inputSchema;

  constructor(private deps?: SummarizeDocumentDeps) {}

  private getDeps(): SummarizeDocumentDeps {
    return this.deps ?? { crm: crmClientFromEnv(), generate: (p: string) => AI.generate(p) };
  }

  async execute(input: z.infer<typeof inputSchema>) {
    const { crm, generate } = this.getDeps();

    const search = await crm.query<{ globalSearch: SearchResult[] }>(GLOBAL_SEARCH, {
      query: input.investor,
      limit: 10,
    });
    const resolution = resolveRecord(search.globalSearch, "investor", input.investor);
    if (resolution.kind === "none") {
      return { status: "not_found" as const, message: `No investor matching "${input.investor}" was found in the CRM.` };
    }
    if (resolution.kind === "ambiguous") {
      return {
        status: "ambiguous" as const,
        message: `Multiple investors match "${input.investor}" — ask the user to pick one, then call this tool again with the chosen id as investor.`,
        candidates: resolution.candidates.map((c) => ({ id: c.id, title: c.title, subtitle: c.subtitle ?? null })),
      };
    }
    const investorHit = resolution.result;
    const link = `${crm.baseUrl}${investorHit.href}`;

    const docsResp = await crm.query<{ documents: InvestorDocRow[] | null }>(LIST_INVESTOR_DOCUMENTS, {
      investorId: investorHit.id,
    });
    // Only documents the investor uploaded through their own portal are ever
    // eligible here — a staff- or agent-filed document on the same investor
    // record must never be picked or summarised (C1/I1).
    const docs = [...(docsResp.documents ?? [])]
      .filter((d) => d.createdSource === "API")
      .sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1));
    if (docs.length === 0) {
      return { status: "not_found" as const, message: `${investorHit.title} has no documents on file yet.` };
    }

    let chosen: InvestorDocRow;
    if (input.document) {
      const q = input.document.trim().toLowerCase();
      const exact = docs.find((d) => d.name.trim().toLowerCase() === q);
      const partial = exact ?? docs.find((d) => d.name.toLowerCase().includes(q));
      if (!partial) {
        return {
          status: "not_found" as const,
          message: `No document matching "${input.document}" was found for ${investorHit.title}. On file: ${docs
            .map((d) => d.name)
            .join(", ")}.`,
        };
      }
      chosen = partial;
    } else {
      chosen = docs[0]!;
    }

    const textResp = await crm.query<{
      documentAgentText: { name: string; mimeType: string | null; text: string | null; truncated: boolean } | null;
    }>(DOCUMENT_AGENT_TEXT, { id: chosen.id });
    const docText = textResp.documentAgentText;
    if (!docText || docText.text === null) {
      return {
        status: "no_text" as const,
        message: `"${chosen.name}" could not be read automatically (unsupported file type, or no text could be extracted). Open it in the CRM to review manually.`,
        link,
      };
    }

    const criteriaResp = await crm.query<{ investor: Record<string, unknown> | null }>(INVESTOR_CRITERIA, {
      id: investorHit.id,
    });
    const criteria = criteriaResp.investor ?? {};
    const investorName = typeof criteria.name === "string" && criteria.name ? criteria.name : investorHit.title;

    const promptInput = {
      investorName,
      documentName: chosen.name,
      documentType: chosen.type,
      text: docText.text,
      truncated: docText.truncated,
      criteria,
    };

    let summary: string;
    try {
      summary = await generate(buildDocumentFitPrompt(promptInput));
    } catch {
      summary = fallbackDocumentFitMarkdown(promptInput);
    }

    return { status: "ok" as const, summary, link };
  }
}
