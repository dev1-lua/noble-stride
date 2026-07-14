// outreach-webhook.ts — plain server module (deliberately NOT a "use server"
// file: exporting this helper from the action module would register it as a
// client-invocable server action, i.e. an unauthenticated SSRF primitive that
// POSTs to an arbitrary URL with a caller-chosen secret header).
//
// The lua-cli LuaWebhook that backs this endpoint
// (investor_agent/src/webhooks/draft-outreach.webhook.ts) always answers
// HTTP 200 with a JSON `{ ok: boolean, error?: string }` body — an
// unauthorized/bad-secret call is STILL a 200 with `{ ok: false, error:
// "unauthorized" }`. Checking only `res.ok` (HTTP status) would report a
// rejected request as a success; this also parses the body and requires
// `body.ok === true`. A 10s AbortSignal.timeout guards against the agent
// hanging instead of answering at all.

export interface OutreachWebhookResult {
  error?: string;
  ok?: boolean;
}

export async function callOutreachWebhook(
  url: string,
  secret: string,
  transactionId: string,
  fetchFn: typeof fetch = fetch,
): Promise<OutreachWebhookResult> {
  try {
    const res = await fetchFn(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-webhook-secret": secret },
      body: JSON.stringify({ transactionId }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return { error: `Agent webhook returned ${res.status}` };
    const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (!body || body.ok !== true) {
      const detail = !body
        ? "unexpected response"
        : body.error === "unauthorized"
          ? "check the webhook secret"
          : body.error;
      return { error: `Agent rejected the request${detail ? ` — ${detail}` : ""}` };
    }
    return { ok: true };
  } catch {
    return { error: "Could not reach the investor agent" };
  }
}
