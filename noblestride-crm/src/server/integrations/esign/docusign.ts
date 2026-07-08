// src/server/integrations/esign/docusign.ts
// DocuSign eSignature via JWT Grant (server-to-server). RS256 JWT signed with
// jose (already a dependency). Bearer + account base URI cached in-memory.
import { importPKCS8, SignJWT } from "jose";
import { docusignEnv } from "../config";
import { IntegrationError } from "../errors";
import type { ESignProvider, SendEnvelopeInput, EnvelopeResult } from "./provider";

export function buildEnvelopeBody(i: SendEnvelopeInput): object {
  return {
    emailSubject: i.subject,
    documents: [{ documentBase64: i.documentBase64, name: i.documentName, fileExtension: "pdf", documentId: "1" }],
    recipients: {
      signers: [{
        email: i.signer.email, name: i.signer.name, recipientId: "1", routingOrder: "1",
        tabs: { signHereTabs: [{ anchorString: "/sig1/", anchorUnits: "pixels", anchorXOffset: "0", anchorYOffset: "0" }] },
      }],
    },
    status: "sent",
  };
}

let auth: { token: string; basePath: string; expiresAt: number } | null = null;

async function getAuth(fetchImpl: typeof fetch): Promise<{ token: string; basePath: string }> {
  const now = Date.now();
  if (auth && auth.expiresAt > now + 60_000) return auth;
  const env = docusignEnv();

  const key = await importPKCS8(env.rsaPrivateKey, "RS256");
  const assertion = await new SignJWT({ scope: "signature impersonation" })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(env.integrationKey)
    .setSubject(env.userId)
    .setAudience(env.authServer)
    .setIssuedAt()
    .setExpirationTime("55m")
    .sign(key);

  const tokRes = await fetchImpl(`https://${env.authServer}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!tokRes.ok) throw new IntegrationError(`DocuSign token failed (${tokRes.status})`, 502);
  const tok = (await tokRes.json()) as { access_token: string; expires_in: number };

  const infoRes = await fetchImpl(`https://${env.authServer}/oauth/userinfo`, {
    headers: { Authorization: `Bearer ${tok.access_token}` },
  });
  if (!infoRes.ok) throw new IntegrationError(`DocuSign userinfo failed (${infoRes.status})`, 502);
  const info = (await infoRes.json()) as { accounts: { account_id: string; base_uri: string; is_default: boolean }[] };
  const account = info.accounts.find((a) => a.account_id === env.accountId) ?? info.accounts.find((a) => a.is_default);
  if (!account) throw new IntegrationError("DocuSign account not found for userinfo", 502);

  auth = { token: tok.access_token, basePath: `${account.base_uri}/restapi`, expiresAt: now + tok.expires_in * 1000 };
  return auth;
}

export class DocuSignProvider implements ESignProvider {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async sendEnvelope(input: SendEnvelopeInput): Promise<EnvelopeResult> {
    const { token, basePath } = await getAuth(this.fetchImpl);
    const env = docusignEnv();
    const res = await this.fetchImpl(`${basePath}/v2.1/accounts/${env.accountId}/envelopes`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(buildEnvelopeBody(input)),
    });
    if (!res.ok) throw new IntegrationError(`DocuSign envelope create failed (${res.status})`, 502);
    const json = (await res.json()) as { envelopeId: string; status: string };
    return { externalId: json.envelopeId, status: json.status };
  }

  async getEnvelope(externalId: string): Promise<{ status: string; completedAt?: Date }> {
    const { token, basePath } = await getAuth(this.fetchImpl);
    const env = docusignEnv();
    const res = await this.fetchImpl(`${basePath}/v2.1/accounts/${env.accountId}/envelopes/${externalId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new IntegrationError(`DocuSign envelope get failed (${res.status})`, 502);
    const json = (await res.json()) as { status: string; completedDateTime?: string };
    return { status: json.status, completedAt: json.completedDateTime ? new Date(json.completedDateTime) : undefined };
  }
}
