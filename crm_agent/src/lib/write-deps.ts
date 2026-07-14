import type { CrmClient } from "./crm-client";

/** Shared dependency shape for the propose/commit/cancel write tools. */
export interface WriteDeps {
  crm: CrmClient;
  getUser: () => Promise<{ staffEmail?: string } | undefined>;
}
