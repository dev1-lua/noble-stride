// src/server/integrations/config.ts
// SINGLE source that reads integration env vars. Everything else asks
// isConfigured(id) or getXProvider(). Each integration is "configured" only
// when its *_ENABLED flag is truthy AND every required var is present, so a
// half-provisioned env never activates a real provider.

export type IntegrationId = "docusign" | "box" | "teams" | "outlook";

const on = (v: string | undefined) => v === "true" || v === "1";
const all = (...vs: (string | undefined)[]) => vs.every((v) => Boolean(v && v.length > 0));

export function docusignConfigured(): boolean {
  return (
    on(process.env.DOCUSIGN_ENABLED) &&
    all(
      process.env.DOCUSIGN_INTEGRATION_KEY,
      process.env.DOCUSIGN_USER_ID,
      process.env.DOCUSIGN_ACCOUNT_ID,
      process.env.DOCUSIGN_RSA_PRIVATE_KEY,
      process.env.DOCUSIGN_AUTH_SERVER,
    )
  );
}

export function boxConfigured(): boolean {
  return (
    on(process.env.BOX_ENABLED) &&
    all(
      process.env.BOX_CLIENT_ID,
      process.env.BOX_CLIENT_SECRET,
      process.env.BOX_SUBJECT_TYPE,
      process.env.BOX_SUBJECT_ID,
    )
  );
}

function graphVarsPresent(): boolean {
  return all(process.env.MSGRAPH_TENANT_ID, process.env.MSGRAPH_CLIENT_ID, process.env.MSGRAPH_CLIENT_SECRET);
}

export function teamsConfigured(): boolean {
  return on(process.env.TEAMS_ENABLED) && graphVarsPresent() && all(process.env.MSGRAPH_ORGANIZER_ID);
}

export function outlookConfigured(): boolean {
  return on(process.env.OUTLOOK_ENABLED) && graphVarsPresent() && all(process.env.OUTLOOK_MAILBOXES);
}

export function isConfigured(id: IntegrationId): boolean {
  switch (id) {
    case "docusign": return docusignConfigured();
    case "box": return boxConfigured();
    case "teams": return teamsConfigured();
    case "outlook": return outlookConfigured();
  }
}

// Typed accessors — ONLY call after the matching xConfigured() is true.
export function docusignEnv() {
  return {
    integrationKey: process.env.DOCUSIGN_INTEGRATION_KEY!,
    userId: process.env.DOCUSIGN_USER_ID!,
    accountId: process.env.DOCUSIGN_ACCOUNT_ID!,
    rsaPrivateKey: process.env.DOCUSIGN_RSA_PRIVATE_KEY!,
    authServer: process.env.DOCUSIGN_AUTH_SERVER!,
    webhookHmacKey: process.env.DOCUSIGN_WEBHOOK_HMAC_KEY ?? "",
  };
}
export function boxEnv() {
  return {
    clientId: process.env.BOX_CLIENT_ID!,
    clientSecret: process.env.BOX_CLIENT_SECRET!,
    subjectType: process.env.BOX_SUBJECT_TYPE!,
    subjectId: process.env.BOX_SUBJECT_ID!,
    rootFolderId: process.env.BOX_ROOT_FOLDER_ID ?? "0",
    webhookPrimary: process.env.BOX_WEBHOOK_SIGNATURE_PRIMARY ?? "",
    webhookSecondary: process.env.BOX_WEBHOOK_SIGNATURE_SECONDARY ?? "",
  };
}
export function graphEnv() {
  return {
    tenantId: process.env.MSGRAPH_TENANT_ID!,
    clientId: process.env.MSGRAPH_CLIENT_ID!,
    clientSecret: process.env.MSGRAPH_CLIENT_SECRET!,
    organizerId: process.env.MSGRAPH_ORGANIZER_ID ?? "",
  };
}
export function outlookEnv() {
  return { mailboxes: (process.env.OUTLOOK_MAILBOXES ?? "").split(",").map((s) => s.trim()).filter(Boolean) };
}
