import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isConfigured, docusignConfigured, teamsConfigured, outlookConfigured } from "../config";
import { IntegrationError } from "../errors";

const KEYS = [
  "DOCUSIGN_ENABLED","DOCUSIGN_INTEGRATION_KEY","DOCUSIGN_USER_ID","DOCUSIGN_ACCOUNT_ID",
  "DOCUSIGN_RSA_PRIVATE_KEY","DOCUSIGN_AUTH_SERVER",
  "TEAMS_ENABLED","OUTLOOK_ENABLED","MSGRAPH_TENANT_ID","MSGRAPH_CLIENT_ID","MSGRAPH_CLIENT_SECRET",
  "MSGRAPH_ORGANIZER_ID","OUTLOOK_MAILBOXES",
];
let saved: Record<string, string | undefined>;
beforeEach(() => { saved = {}; for (const k of KEYS) { saved[k] = process.env[k]; delete process.env[k]; } });
afterEach(() => { for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } });

describe("isConfigured", () => {
  it("is false for every integration when no env is set", () => {
    for (const id of ["docusign","box","teams","outlook"] as const) expect(isConfigured(id)).toBe(false);
  });

  it("docusign requires ENABLED=true AND all vars", () => {
    process.env.DOCUSIGN_INTEGRATION_KEY = "ik";
    process.env.DOCUSIGN_USER_ID = "uid";
    process.env.DOCUSIGN_ACCOUNT_ID = "aid";
    process.env.DOCUSIGN_RSA_PRIVATE_KEY = "pk";
    process.env.DOCUSIGN_AUTH_SERVER = "account-d.docusign.com";
    expect(docusignConfigured()).toBe(false);          // ENABLED not set
    process.env.DOCUSIGN_ENABLED = "true";
    expect(docusignConfigured()).toBe(true);
    delete process.env.DOCUSIGN_ACCOUNT_ID;
    expect(docusignConfigured()).toBe(false);          // missing a var
  });

  it("teams and outlook each require ENABLED + the shared MSGRAPH vars", () => {
    process.env.MSGRAPH_TENANT_ID = "t";
    process.env.MSGRAPH_CLIENT_ID = "c";
    process.env.MSGRAPH_CLIENT_SECRET = "s";
    process.env.TEAMS_ENABLED = "true";
    process.env.MSGRAPH_ORGANIZER_ID = "org@x.com";
    expect(teamsConfigured()).toBe(true);
    expect(outlookConfigured()).toBe(false);           // OUTLOOK_ENABLED + mailboxes missing
    process.env.OUTLOOK_ENABLED = "true";
    process.env.OUTLOOK_MAILBOXES = "a@x.com";
    expect(outlookConfigured()).toBe(true);
  });
});

describe("IntegrationError", () => {
  it("defaults to status 502 and carries a custom status", () => {
    expect(new IntegrationError("x").status).toBe(502);
    expect(new IntegrationError("y", 503).status).toBe(503);
  });
});
