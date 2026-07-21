import { env } from "lua-cli";

export const CRM_DOWN_MESSAGE = "The CRM didn't respond — please try again in a minute.";

export class CrmError extends Error {
  detail?: string;
  constructor(message: string, detail?: string) {
    super(message);
    this.name = "CrmError";
    this.detail = detail;
  }
}

export interface CrmClient {
  baseUrl: string;
  query<T>(document: string, variables?: Record<string, unknown>): Promise<T>;
}

export function makeCrmClient(opts: { apiUrl: string; agentKey: string; fetchFn?: typeof fetch }): CrmClient {
  const { apiUrl, agentKey } = opts;
  const fetchFn = opts.fetchFn ?? fetch;
  const baseUrl = apiUrl.replace(/\/api\/graphql\/?$/, "");

  return {
    baseUrl,
    async query<T>(document: string, variables?: Record<string, unknown>): Promise<T> {
      let res: Response;
      try {
        res = await fetchFn(apiUrl, {
          method: "POST",
          headers: { "content-type": "application/json", "x-agent-key": agentKey },
          body: JSON.stringify({ query: document, variables }),
        });
      } catch (err) {
        throw new CrmError(CRM_DOWN_MESSAGE, err instanceof Error ? err.message : String(err));
      }
      if (!res.ok) {
        // Self-verification instrumentation: a bare "HTTP 400" hides the ONLY
        // diagnostic that names the cause. graphql-yoga returns the reason in
        // the body (e.g. `Variable "$transactionId" ... was not provided` vs
        // `Cannot query field "x"`), so capture it into `detail` (which is what
        // the job logs surface). Truncated + best-effort so a hung/HTML body
        // never masks the status. Never changes the user-facing message.
        let detail = `HTTP ${res.status}`;
        try {
          const text = (await res.text()).trim();
          if (text) detail += `: ${text.slice(0, 500)}`;
        } catch {
          /* body unreadable — status alone still tells us it was non-2xx */
        }
        throw new CrmError(CRM_DOWN_MESSAGE, detail);
      }
      let body: { data?: T; errors?: Array<{ message: string }> };
      try {
        body = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
      } catch (err) {
        throw new CrmError(CRM_DOWN_MESSAGE, `invalid JSON response: ${err instanceof Error ? err.message : String(err)}`);
      }
      if (body.errors?.length) {
        throw new CrmError(`The CRM rejected the request: ${body.errors.map((e) => e.message).join("; ")}`);
      }
      if (body.data === undefined || body.data === null) throw new CrmError(CRM_DOWN_MESSAGE, "empty data");
      return body.data;
    },
  };
}

export function crmClientFromEnv(): CrmClient {
  const apiUrl = env("CRM_API_URL");
  const agentKey = env("CRM_AGENT_KEY");
  if (!apiUrl) throw new CrmError("Agent misconfigured: CRM_API_URL is not set.");
  if (!agentKey) throw new CrmError("Agent misconfigured: CRM_AGENT_KEY is not set.");
  return makeCrmClient({ apiUrl, agentKey });
}
