// src/server/integrations/esign/provider.ts
import { docusignConfigured } from "../config";
import { ManualESignProvider } from "./manual";
import { DocuSignProvider } from "./docusign";

export type ESignKind = "OpenNda" | "ClosedNda" | "TermSheet";

export interface SendEnvelopeInput {
  kind: ESignKind;
  documentBase64: string;
  documentName: string;
  signer: { email: string; name: string };
  subject: string;
  linkRecord: { investorId?: string; engagementId?: string; transactionId?: string };
}
export interface EnvelopeResult { externalId: string; status: string }

export interface ESignProvider {
  sendEnvelope(input: SendEnvelopeInput): Promise<EnvelopeResult>;
  getEnvelope(externalId: string): Promise<{ status: string; completedAt?: Date }>;
}

export function getESignProvider(): ESignProvider {
  if (docusignConfigured()) return new DocuSignProvider();
  return new ManualESignProvider();
}
