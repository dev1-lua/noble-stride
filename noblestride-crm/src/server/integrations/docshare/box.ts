// src/server/integrations/docshare/box.ts
// Box Content Cloud via Client Credentials Grant (service account). Upload a
// copy, apply the default watermark, mint a permissioned shared link. Bytes of
// record stay in the CRM's storage seam; Box holds only the shared copy.
import { boxEnv } from "../config";
import { IntegrationError } from "../errors";
import type { DocShareProvider, ShareDocumentInput, ShareResult } from "./provider";

export function buildSharedLinkBody(i: ShareDocumentInput): object {
  return {
    shared_link: {
      access: "open",
      ...(i.password ? { password: i.password } : {}),
      ...(i.expiresAt ? { unshared_at: i.expiresAt.toISOString() } : {}),
      permissions: { can_download: i.allowDownload, can_preview: true },
    },
  };
}

let cache: { token: string; expiresAt: number } | null = null;
async function token(fetchImpl: typeof fetch): Promise<string> {
  const now = Date.now();
  if (cache && cache.expiresAt > now + 60_000) return cache.token;
  const env = boxEnv();
  const res = await fetchImpl("https://api.box.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials", client_id: env.clientId, client_secret: env.clientSecret,
      box_subject_type: env.subjectType, box_subject_id: env.subjectId,
    }),
  });
  if (!res.ok) throw new IntegrationError(`Box token failed (${res.status})`, 502);
  const j = (await res.json()) as { access_token: string; expires_in: number };
  cache = { token: j.access_token, expiresAt: now + j.expires_in * 1000 };
  return j.access_token;
}

export class BoxProvider implements DocShareProvider {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async shareDocument(input: ShareDocumentInput): Promise<ShareResult> {
    const t = await token(this.fetchImpl);
    const env = boxEnv();

    // 1. Upload (multipart; attributes part MUST precede the file part).
    const form = new FormData();
    form.append("attributes", JSON.stringify({ name: input.filename, parent: { id: env.rootFolderId } }));
    form.append("file", new Blob([input.bytes as unknown as BlobPart], { type: input.contentType }), input.filename);
    const upRes = await this.fetchImpl("https://upload.box.com/api/2.0/files/content", {
      method: "POST", headers: { Authorization: `Bearer ${t}` }, body: form,
    });
    if (!upRes.ok) throw new IntegrationError(`Box upload failed (${upRes.status})`, 502);
    const fileId = ((await upRes.json()) as { entries: { id: string }[] }).entries[0].id;

    // 2. Watermark (best-effort; requires Business+ plan).
    let watermarkApplied = false;
    if (input.watermark) {
      const wmRes = await this.fetchImpl(`https://api.box.com/2.0/files/${fileId}/watermark`, {
        method: "PUT", headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
        body: JSON.stringify({ watermark: { imprint: "default" } }),
      });
      watermarkApplied = wmRes.ok;
    }

    // 3. Shared link.
    const slRes = await this.fetchImpl(`https://api.box.com/2.0/files/${fileId}?fields=shared_link`, {
      method: "PUT", headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
      body: JSON.stringify(buildSharedLinkBody(input)),
    });
    if (!slRes.ok) throw new IntegrationError(`Box shared link failed (${slRes.status})`, 502);
    const sharedUrl = ((await slRes.json()) as { shared_link: { url: string } }).shared_link.url;

    return { externalFileId: fileId, sharedUrl, watermarkApplied };
  }

  async revokeShare(externalFileId: string): Promise<void> {
    const t = await token(this.fetchImpl);
    await this.fetchImpl(`https://api.box.com/2.0/files/${externalFileId}?fields=shared_link`, {
      method: "PUT", headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
      body: JSON.stringify({ shared_link: null }),
    }).catch(() => {});
  }
}
