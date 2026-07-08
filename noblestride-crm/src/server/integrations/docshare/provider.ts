// src/server/integrations/docshare/provider.ts
import { boxConfigured } from "../config";
import { NullDocShareProvider } from "./null";
import { BoxProvider } from "./box";

export interface ShareDocumentInput {
  documentId: string;
  bytes: Buffer;
  filename: string;
  contentType: string;
  watermark: boolean;
  password?: string;
  expiresAt?: Date;
  allowDownload: boolean;
}
export interface ShareResult { externalFileId: string; sharedUrl: string; watermarkApplied: boolean }

export interface DocShareProvider {
  shareDocument(input: ShareDocumentInput): Promise<ShareResult>;
  revokeShare(externalFileId: string): Promise<void>;
}

export function getDocShareProvider(): DocShareProvider {
  if (boxConfigured()) return new BoxProvider();
  return new NullDocShareProvider();
}
