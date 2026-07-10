import { describe, it, expect, beforeEach, vi } from "vitest";
import { getGraphToken, __resetGraphTokenCache } from "../auth";

function fakeFetch(body: unknown, ok = true, status = 200) {
  return vi.fn(async () => ({ ok, status, json: async () => body, text: async () => JSON.stringify(body) })) as unknown as typeof fetch;
}

beforeEach(() => {
  __resetGraphTokenCache();
  process.env.MSGRAPH_TENANT_ID = "tid";
  process.env.MSGRAPH_CLIENT_ID = "cid";
  process.env.MSGRAPH_CLIENT_SECRET = "secret";
});

describe("getGraphToken", () => {
  it("posts client-credentials with .default scope and returns the token", async () => {
    const f = fakeFetch({ access_token: "abc", expires_in: 3600 });
    const token = await getGraphToken(f);
    expect(token).toBe("abc");
    const [url, init] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("https://login.microsoftonline.com/tid/oauth2/v2.0/token");
    expect(String(init.body)).toContain("grant_type=client_credentials");
    expect(String(init.body)).toContain(encodeURIComponent("https://graph.microsoft.com/.default"));
  });

  it("caches the token across calls", async () => {
    const f = fakeFetch({ access_token: "abc", expires_in: 3600 });
    await getGraphToken(f);
    await getGraphToken(f);
    expect((f as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
  });

  it("throws IntegrationError on a non-ok token response", async () => {
    const f = fakeFetch({ error: "invalid_client" }, false, 401);
    await expect(getGraphToken(f)).rejects.toThrow(/graph token/i);
  });
});
