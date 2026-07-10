// src/server/integrations/docshare/null.ts
// Not-configured provider. Document sharing is entirely off when Box is
// unconfigured — no external copy is ever created, and revocation is a no-op
// since nothing was ever shared. The share UI only renders when
// boxConfigured(); this throws as defense-in-depth.
import { IntegrationError } from "../errors";
import type { DocShareProvider } from "./provider";

export class NullDocShareProvider implements DocShareProvider {
  async shareDocument(): Promise<never> {
    throw new IntegrationError("Document sharing (Box) not configured", 503);
  }
  async revokeShare(): Promise<void> {
    /* no-op: nothing was ever shared */
  }
}
