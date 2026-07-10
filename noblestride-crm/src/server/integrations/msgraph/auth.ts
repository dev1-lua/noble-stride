// src/server/integrations/msgraph/auth.ts
// Shared client-credentials token for all Microsoft Graph integrations
// (Teams meetings + Outlook mail). SharePoint storage keeps its own creds.
import { graphEnv } from "../config";
import { IntegrationError } from "../errors";

let cache: { token: string; expiresAt: number } | null = null;

export function __resetGraphTokenCache(): void { cache = null; }

export async function getGraphToken(fetchImpl: typeof fetch = fetch): Promise<string> {
  const now = Date.now();
  if (cache && cache.expiresAt > now + 60_000) return cache.token;

  const { tenantId, clientId, clientSecret } = graphEnv();
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
  });
  const res = await fetchImpl(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new IntegrationError(`Graph token request failed (${res.status}): ${detail.slice(0, 200)}`, 502);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cache = { token: json.access_token, expiresAt: now + json.expires_in * 1000 };
  return json.access_token;
}
