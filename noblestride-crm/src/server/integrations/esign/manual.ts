// src/server/integrations/esign/manual.ts
// Not-configured provider. The authoritative NDA path when DocuSign is off is
// the manual Record-NDA buttons (unchanged). Sending must never be reachable
// here — the send UI only renders when docusignConfigured(); this throws as
// defense-in-depth.
import { IntegrationError } from "../errors";
import type { ESignProvider } from "./provider";

export class ManualESignProvider implements ESignProvider {
  async sendEnvelope(): Promise<never> {
    throw new IntegrationError("E-signature not configured", 503);
  }
  async getEnvelope(): Promise<never> {
    throw new IntegrationError("E-signature not configured", 503);
  }
}
