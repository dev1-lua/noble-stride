import { AI, type LuaTool } from "lua-cli";
import { z } from "zod";
import { crmClientFromEnv, type CrmClient } from "../../lib/crm-client";
import { GLOBAL_SEARCH, DETAIL_QUERIES } from "../../lib/queries";
import type { SearchResult } from "../../lib/resolve";
import { buildResearchBriefingPrompt, fallbackResearchBriefingMarkdown, type ResearchBriefingWebsite } from "../../lib/format";

/** research_briefing only ever briefs these two entity types (spec WS-H.3). */
type BriefableType = "client" | "investor";
const BRIEFABLE_SEARCH_TYPE: Record<BriefableType, string> = { client: "Client", investor: "Investor" };

const WEBSITE_TIMEOUT_MS = 8_000;
const WEBSITE_TEXT_LIMIT = 6_000;
/** Hard cap on bytes read from a website response body, independent of the
 *  (much smaller) post-extraction WEBSITE_TEXT_LIMIT — this bounds the raw
 *  HTML we ever pull into memory, before stripHtml runs. */
const MAX_BODY_BYTES = 200_000;
const NEWS_UNAVAILABLE_NOTE = "External news search is not yet connected.";

const BLOCKED_HOSTNAMES = new Set(["localhost", "metadata.google.internal"]);
const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

function isPrivateOrLoopbackIPv4(host: string): boolean {
  const m = IPV4_RE.exec(host);
  if (!m) return false;
  const octets = m.slice(1, 5).map(Number);
  if (octets.some((o) => Number.isNaN(o) || o > 255)) return false;
  const [a, b] = octets;
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 10) return true; // 10.0.0.0/8 private
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 private
  if (a === 192 && b === 168) return true; // 192.168.0.0/16 private
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local (incl. cloud metadata 169.254.169.254)
  if (octets.every((o) => o === 0)) return true; // 0.0.0.0
  return false;
}

function isPrivateOrLoopbackIPv6(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "::1" || h === "::") return true; // loopback / unspecified
  if (h.startsWith("fc") || h.startsWith("fd")) return true; // fc00::/7 unique local
  if (/^fe[89ab]/.test(h)) return true; // fe80::/10 link-local
  return false;
}

/**
 * SSRF guard (B1): the website field on a client/investor record is
 * user-supplied CRM data, not a trusted URL. Before we ever hand it to
 * fetch(), reject anything that isn't a plain http/https URL pointed at a
 * public hostname — loopback, private, link-local, and cloud-metadata
 * addresses are all refused, as is "localhost". This is a hostname/IP-literal
 * check only: DNS-rebinding-level protection (re-resolving after the fact) is
 * out of scope for this tool.
 */
export function isFetchableWebsiteUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;

  let hostname = parsed.hostname.toLowerCase();
  if (hostname.startsWith("[") && hostname.endsWith("]")) hostname = hostname.slice(1, -1);
  if (!hostname) return false;
  if (BLOCKED_HOSTNAMES.has(hostname)) return false;
  if (hostname.includes(":")) {
    if (isPrivateOrLoopbackIPv6(hostname)) return false;
  } else if (IPV4_RE.test(hostname)) {
    if (isPrivateOrLoopbackIPv4(hostname)) return false;
  }
  return true;
}

/** Reads a fetch Response body capped at MAX_BODY_BYTES, streaming when the
 *  runtime exposes a body reader so we never buffer an unbounded response,
 *  and falling back to a plain (then-sliced) text read otherwise. */
async function readBodyCapped(res: Response): Promise<string> {
  const contentLengthHeader = res.headers.get("content-length");
  const contentLength = contentLengthHeader ? Number(contentLengthHeader) : NaN;
  if (Number.isFinite(contentLength) && contentLength >= 0 && contentLength <= MAX_BODY_BYTES) {
    return res.text();
  }

  const body = res.body as ReadableStream<Uint8Array> | null | undefined;
  if (!body || typeof body.getReader !== "function") {
    const full = await res.text();
    return full.slice(0, MAX_BODY_BYTES);
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    while (received < MAX_BODY_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        received += value.byteLength;
      }
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      /* best-effort cleanup only */
    }
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c)))
    .subarray(0, MAX_BODY_BYTES)
    .toString("utf-8");
}

export interface ResearchBriefingDeps {
  crm: CrmClient;
  generate: (prompt: string) => Promise<string>;
  /** Injectable for tests; defaults to a real HTTP fetch with a timeout. Returns
   *  null (never throws) when the page cannot be fetched or has no text. */
  fetchWebsite?: (url: string) => Promise<ResearchBriefingWebsite | null>;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/** Real website fetch: same pattern as crm-client (fetch + explicit error handling),
 *  but degrades to null on ANY failure (timeout, non-2xx, network error) rather than
 *  throwing — a dead or slow site must never break the rest of the briefing. */
async function defaultFetchWebsite(url: string): Promise<ResearchBriefingWebsite | null> {
  if (!isFetchableWebsiteUrl(url)) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WEBSITE_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      // Never auto-follow redirects: a same-scheme/host redirect could still
      // land on a private or loopback target. Any 3xx is treated the same as
      // a fetch failure below and degrades to a CRM-only briefing.
      redirect: "manual",
      headers: { "user-agent": "Mozilla/5.0 (compatible; NoblestrideResearchBriefing/1.0)" },
    });
    if (!res.ok) return null;
    const html = await readBodyCapped(res);
    const text = stripHtml(html);
    if (!text) return null;
    const truncated = text.length > WEBSITE_TEXT_LIMIT;
    return { url, text: text.slice(0, WEBSITE_TEXT_LIMIT), truncated };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function normalizeUrl(raw: string): string {
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

const inputSchema = z.object({
  entity: z
    .string()
    .min(1)
    .describe("The client's or investor's name as the user said it, or an exact id from a previous candidates list"),
  newsRequested: z
    .boolean()
    .optional()
    .describe("Set true when the user specifically asked for external news, press coverage, or articles about the entity"),
});

/**
 * research_briefing (Task WS-H.3, client feedback: "plug AI into publicly
 * available resources and offer summary updates/articles about potential
 * clients/investors"). Compiles a briefing from CRM data (profile, recent
 * activity, open deals/engagements, key contacts) for a client or investor,
 * and — when the record has a website on file — fetches that page for a
 * short "From their website" section. There is no external news/press search
 * API available to this platform: when the user asked for news, the reply
 * says so plainly instead of fabricating coverage.
 */
export class ResearchBriefingTool implements LuaTool {
  name = "research_briefing";
  description =
    "Compile a research briefing on a client or investor: CRM profile, recent activity, open deals/engagements, and key contacts, plus a short summary of their website if one is on record. Does NOT search external news or press coverage — say so plainly if the user asked for that.";
  inputSchema = inputSchema;

  constructor(private deps?: ResearchBriefingDeps) {}

  private getDeps(): ResearchBriefingDeps {
    return this.deps ?? { crm: crmClientFromEnv(), generate: (p: string) => AI.generate(p) };
  }

  async execute(input: z.infer<typeof inputSchema>) {
    const { crm, generate } = this.getDeps();
    const fetchSite = this.deps?.fetchWebsite ?? defaultFetchWebsite;

    const search = await crm.query<{ globalSearch: SearchResult[] }>(GLOBAL_SEARCH, { query: input.entity, limit: 10 });
    const briefable = search.globalSearch.filter(
      (r) => r.type === BRIEFABLE_SEARCH_TYPE.client || r.type === BRIEFABLE_SEARCH_TYPE.investor,
    );
    if (briefable.length === 0) {
      return { status: "not_found" as const, message: `No client or investor matching "${input.entity}" was found in the CRM.` };
    }

    let hit: SearchResult | undefined = briefable.find((r) => r.id === input.entity);
    if (!hit) {
      const q = input.entity.trim().toLowerCase();
      const exact = briefable.filter((r) => r.title.trim().toLowerCase() === q);
      if (exact.length === 1) hit = exact[0];
      else if (briefable.length === 1) hit = briefable[0];
    }
    if (!hit) {
      return {
        status: "ambiguous" as const,
        message: `Multiple clients/investors match "${input.entity}" — ask the user to pick one, then call this tool again with the chosen id as entity.`,
        candidates: briefable.slice(0, 5).map((c) => ({ id: c.id, title: c.title, subtitle: c.subtitle ?? null, type: c.type })),
      };
    }

    const entityType: BriefableType = hit.type === BRIEFABLE_SEARCH_TYPE.client ? "client" : "investor";
    const link = `${crm.baseUrl}${hit.href}`;

    const detail = DETAIL_QUERIES[entityType];
    const detailResp = await crm.query<Record<string, unknown>>(detail.document, { id: hit.id });
    const record = detailResp[detail.rootField] as Record<string, unknown> | null | undefined;
    if (!record) {
      return { status: "not_found" as const, message: `${hit.title} could not be loaded from the CRM.` };
    }

    const websiteField = typeof record.website === "string" ? record.website.trim() : "";
    let website: ResearchBriefingWebsite | null = null;
    let websiteFetchFailed = false;
    if (websiteField) {
      try {
        website = await fetchSite(normalizeUrl(websiteField));
        if (!website) websiteFetchFailed = true;
      } catch {
        website = null;
        websiteFetchFailed = true;
      }
    }

    const briefingInput = { entityType, entityName: hit.title, record, website };

    let briefing: string;
    try {
      briefing = await generate(buildResearchBriefingPrompt(briefingInput));
    } catch {
      briefing = fallbackResearchBriefingMarkdown(briefingInput);
    }

    if (input.newsRequested) {
      briefing = `${briefing}\n\n${NEWS_UNAVAILABLE_NOTE}`;
    }

    return { status: "ok" as const, briefing, link, websiteFetchFailed };
  }
}
