import { Readable } from "node:stream";
import type { StorageProvider, StoredObject } from "./provider";
import { StorageError } from "./provider";

export interface SharePointConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  siteId: string;
  driveId: string;
}

const GRAPH = "https://graph.microsoft.com/v1.0";

export class SharePointProvider implements StorageProvider {
  private readonly fetchImpl: typeof fetch;
  private token: { value: string; expiresAt: number } | null = null;

  constructor(private readonly config: SharePointConfig, deps?: { fetchImpl?: typeof fetch }) {
    this.fetchImpl = deps?.fetchImpl ?? fetch;
  }

  private async accessToken(): Promise<string> {
    const now = Date.now();
    if (this.token && this.token.expiresAt > now + 60_000) return this.token.value;
    const url = `https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/token`;
    const body = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    });
    const res = await this.fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) throw new StorageError(`SharePoint auth failed (${res.status})`, 502);
    const json = (await res.json()) as { access_token: string; expires_in: number };
    this.token = { value: json.access_token, expiresAt: now + json.expires_in * 1000 };
    return json.access_token;
  }

  private itemUrl(key: string, suffix = ""): string {
    const { siteId, driveId } = this.config;
    return `${GRAPH}/sites/${siteId}/drives/${driveId}/root:/${key}${suffix}`;
  }

  async put(key: string, bytes: Buffer, contentType: string): Promise<void> {
    const token = await this.accessToken();
    const res = await this.fetchImpl(this.itemUrl(key, ":/content"), {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "content-type": contentType },
      body: bytes as unknown as BodyInit,
    });
    if (!res.ok) throw new StorageError(`SharePoint upload failed (${res.status})`, 502);
  }

  async get(key: string): Promise<StoredObject> {
    const token = await this.accessToken();
    const res = await this.fetchImpl(this.itemUrl(key, ":/content"), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 404) throw new StorageError(`Object not found: ${key}`, 410);
    if (!res.ok || !res.body) throw new StorageError(`SharePoint download failed (${res.status})`, 502);
    const contentType = res.headers.get("content-type") ?? "application/octet-stream";
    const size = Number(res.headers.get("content-length") ?? 0);
    return { stream: Readable.fromWeb(res.body as unknown as import("node:stream/web").ReadableStream), contentType, size };
  }

  async delete(key: string): Promise<void> {
    const token = await this.accessToken();
    const res = await this.fetchImpl(this.itemUrl(key), {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok && res.status !== 404) throw new StorageError(`SharePoint delete failed (${res.status})`, 502);
  }
}
