import { describe, it, expect, vi } from "vitest";
import { makeCrmClient, CrmError, CRM_DOWN_MESSAGE } from "../crm-client";

const OPTS = { apiUrl: "https://crm.example/api/graphql", agentKey: "k-123" };

function fetchReturning(status: number, body: unknown): typeof fetch {
  return vi.fn(async () =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }),
  ) as unknown as typeof fetch;
}

describe("makeCrmClient", () => {
  it("derives baseUrl by stripping /api/graphql", () => {
    expect(makeCrmClient(OPTS).baseUrl).toBe("https://crm.example");
  });

  it("POSTs the document with the x-agent-key header and returns data", async () => {
    const fetchFn = fetchReturning(200, { data: { ping: "pong" } });
    const client = makeCrmClient({ ...OPTS, fetchFn });
    const data = await client.query<{ ping: string }>("{ ping }");
    expect(data.ping).toBe("pong");
    const [url, init] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe(OPTS.apiUrl);
    expect(init.method).toBe("POST");
    expect(init.headers["x-agent-key"]).toBe("k-123");
    expect(JSON.parse(init.body).query).toBe("{ ping }");
  });

  it("maps network failure to the friendly CRM-down error", async () => {
    const fetchFn = vi.fn(async () => { throw new Error("ECONNREFUSED"); }) as unknown as typeof fetch;
    const client = makeCrmClient({ ...OPTS, fetchFn });
    await expect(client.query("{ ping }")).rejects.toThrow(CRM_DOWN_MESSAGE);
  });

  it("maps non-200 to the friendly CRM-down error with detail", async () => {
    const client = makeCrmClient({ ...OPTS, fetchFn: fetchReturning(502, {}) });
    const err = (await client.query("{ ping }").catch((e: unknown) => e)) as CrmError;
    expect(err).toBeInstanceOf(CrmError);
    expect(err.message).toBe(CRM_DOWN_MESSAGE);
    expect(err.detail).toContain("502");
  });

  it("surfaces the response body on a non-2xx so the real GraphQL error is logged", async () => {
    // A yoga request-error (e.g. required variable missing) comes back as 400
    // with the reason in the body. detail must carry it, not just "HTTP 400".
    const client = makeCrmClient({
      ...OPTS,
      fetchFn: fetchReturning(400, {
        errors: [{ message: 'Variable "$transactionId" of required type "String!" was not provided.' }],
      }),
    });
    const err = (await client.query("{ ping }").catch((e: unknown) => e)) as CrmError;
    expect(err).toBeInstanceOf(CrmError);
    expect(err.message).toBe(CRM_DOWN_MESSAGE);
    expect(err.detail).toContain("400");
    expect(err.detail).toContain("$transactionId");
  });

  it("surfaces GraphQL errors distinctly (auth/validation are not 'CRM down')", async () => {
    const client = makeCrmClient({
      ...OPTS,
      fetchFn: fetchReturning(200, { errors: [{ message: "Unauthorized: authentication required" }] }),
    });
    await expect(client.query("{ ping }")).rejects.toThrow(/Unauthorized/);
  });

  it("maps a non-JSON 2xx response to the friendly CRM-down error", async () => {
    const fetchFn = vi.fn(async () =>
      new Response("<html>login page</html>", { status: 200, headers: { "content-type": "text/html" } }),
    ) as unknown as typeof fetch;
    const client = makeCrmClient({ ...OPTS, fetchFn });
    const err = (await client.query("{ ping }").catch((e: unknown) => e)) as CrmError;
    expect(err).toBeInstanceOf(CrmError);
    expect(err.message).toBe(CRM_DOWN_MESSAGE);
    expect(err.detail).toContain("invalid JSON");
  });
});
