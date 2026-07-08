import type { Readable } from "node:stream";
import { LocalDiskProvider } from "./local";
import { SharePointProvider } from "./sharepoint";

export interface StoredObject {
  stream: Readable;
  contentType: string;
  size: number;
}

export interface StorageProvider {
  put(key: string, bytes: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<StoredObject>;
  delete(key: string): Promise<void>;
}

export class StorageError extends Error {
  constructor(message: string, readonly status: number = 502) {
    super(message);
    this.name = "StorageError";
  }
}

export function sharePointConfigured(): boolean {
  return Boolean(
    process.env.SHAREPOINT_TENANT_ID &&
      process.env.SHAREPOINT_CLIENT_ID &&
      process.env.SHAREPOINT_CLIENT_SECRET &&
      process.env.SHAREPOINT_SITE_ID &&
      process.env.SHAREPOINT_DRIVE_ID,
  );
}

export function getStorageProvider(): StorageProvider {
  if ((process.env.STORAGE_PROVIDER ?? "local") === "sharepoint" && sharePointConfigured()) {
    return new SharePointProvider({
      tenantId: process.env.SHAREPOINT_TENANT_ID!,
      clientId: process.env.SHAREPOINT_CLIENT_ID!,
      clientSecret: process.env.SHAREPOINT_CLIENT_SECRET!,
      siteId: process.env.SHAREPOINT_SITE_ID!,
      driveId: process.env.SHAREPOINT_DRIVE_ID!,
    });
  }
  return new LocalDiskProvider(process.env.STORAGE_LOCAL_DIR ?? "./.storage");
}
