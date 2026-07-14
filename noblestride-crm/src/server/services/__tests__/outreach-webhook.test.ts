// MINOR b: requestOutreachDraftsAction previously only checked the HTTP
// status of the investor-agent webhook call. The webhook (lua-cli
// LuaWebhook, see investor_agent/src/webhooks/draft-outreach.webhook.ts)
// always answers 200 with a JSON `{ ok: boolean, error?: string }` body —
// even an unauthorized/bad-secret call gets `{ ok: false, error:
// "unauthorized" }` with a 200 status — so the old `!res.ok` check silently
// treated a rejected request as success. `callOutreachWebhook` is the pure,
// injectable core (extracted so tests don't need to mock Next-runtime
// concerns like cookies/viewpoint). It lives in a PLAIN module (not the
// "use server" action file) so it is never registered as a client-invocable
// server action — that would be an unauthenticated SSRF primitive.
import { describe, it, expect, vi } from "vitest";
import { callOutreachWebhook } from "../outreach-webhook";

describe("callOutreachWebhook (MINOR b)", () => {
  it("returns ok:true when the webhook body reports ok:true", async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const r = await callOutreachWebhook("http://agent.example/webhook", "secret", "txn1", fetchFn as unknown as typeof fetch);
    expect(r).toEqual({ ok: true });
  });

  it("treats a 200 response with body.ok !== true as a rejection (bad secret)", async () => {
    const fetchFn = vi.fn(
      async () => new Response(JSON.stringify({ ok: false, error: "unauthorized" }), { status: 200 }),
    );
    const r = await callOutreachWebhook("http://agent.example/webhook", "wrong-secret", "txn1", fetchFn as unknown as typeof fetch);
    expect(r.ok).toBeUndefined();
    expect(r.error).toBe("Agent rejected the request — check the webhook secret");
  });

  it("treats a non-JSON 200 body as a rejection too", async () => {
    const fetchFn = vi.fn(async () => new Response("not json", { status: 200 }));
    const r = await callOutreachWebhook("http://agent.example/webhook", "secret", "txn1", fetchFn as unknown as typeof fetch);
    expect(r.error).toBe("Agent rejected the request — unexpected response");
  });

  it("still surfaces a real HTTP failure by status", async () => {
    const fetchFn = vi.fn(async () => new Response("boom", { status: 502 }));
    const r = await callOutreachWebhook("http://agent.example/webhook", "secret", "txn1", fetchFn as unknown as typeof fetch);
    expect(r.error).toBe("Agent webhook returned 502");
  });

  it("catches a timeout/network failure with a clear connectivity error", async () => {
    const fetchFn = vi.fn(async () => {
      throw new DOMException("The operation was aborted.", "TimeoutError");
    });
    const r = await callOutreachWebhook("http://agent.example/webhook", "secret", "txn1", fetchFn as unknown as typeof fetch);
    expect(r.error).toBe("Could not reach the investor agent");
  });

  it("passes a 10s AbortSignal.timeout on the fetch call", async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    await callOutreachWebhook("http://agent.example/webhook", "secret", "txn1", fetchFn as unknown as typeof fetch);
    const init = (fetchFn.mock.calls[0] as unknown[])[1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});
