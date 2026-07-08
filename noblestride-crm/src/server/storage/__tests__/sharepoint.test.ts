import { describe, it, expect, vi } from "vitest";
import { SharePointProvider } from "../sharepoint";
import { StorageError } from "../provider";

const config = { tenantId: "t", clientId: "c", clientSecret: "s", siteId: "site", driveId: "drive" };

function tokenResponse() {
  return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), {
    status: 200, headers: { "content-type": "application/json" },
  });
}

describe("SharePointProvider", () => {
  it("puts via the driveItem content endpoint with a bearer token", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      if (String(url).includes("/oauth2/v2.0/token")) return tokenResponse();
      return new Response("{}", { status: 201 });
    }) as unknown as typeof fetch;

    const p = new SharePointProvider(config, { fetchImpl });
    await p.put("a/b/v1-x.pdf", Buffer.from("z"), "application/pdf");

    const putCall = calls.find((c) => c.url.includes("/content"))!;
    expect(putCall.url).toContain("/sites/site/drives/drive/root:/a/b/v1-x.pdf:/content");
    expect((putCall.init!.headers as Record<string, string>).Authorization).toBe("Bearer tok");
  });

  it("maps a Graph 403 on get to StorageError", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      if (String(url).includes("/oauth2/v2.0/token")) return tokenResponse();
      return new Response("denied", { status: 403 });
    }) as unknown as typeof fetch;
    const p = new SharePointProvider(config, { fetchImpl });
    await expect(p.get("k")).rejects.toBeInstanceOf(StorageError);
  });

  it("deletes via the driveItem path", async () => {
    const seen: string[] = [];
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      seen.push(`${init?.method ?? "GET"} ${String(url)}`);
      if (String(url).includes("/oauth2/v2.0/token")) return tokenResponse();
      return new Response(null, { status: 204 });
    }) as unknown as typeof fetch;
    const p = new SharePointProvider(config, { fetchImpl });
    await p.delete("a/b/v1-x.pdf");
    expect(seen.some((s) => s.startsWith("DELETE") && s.includes("/root:/a/b/v1-x.pdf"))).toBe(true);
  });
});
