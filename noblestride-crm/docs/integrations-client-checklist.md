# External integrations — client provisioning checklist

NobleStride CRM ships with four external integrations fully coded and ready to
activate: **DocuSign** (e-signature), **Box** (watermarked document sharing),
**Microsoft Teams** (meeting scheduling), and **Outlook / Office 365** (email
correspondence tracking). Every one of them is **OFF by default**. Each only
activates once its `*_ENABLED` flag is set to `true` in the environment
**and** every required variable for that integration is present (see
`.env.example`) — a half-provisioned integration never activates, and all
current manual workflows (Record NDA buttons, free-text document links,
manual meeting/email logging) keep working unchanged whether or not any of
these are configured.

Below is what to request from the client for each integration, so go-live is
unambiguous.

## DocuSign (e-signature)

- A production **integration key**.
- An **RSA keypair registered to that integration key**.
- The **API account id**.
- The **service user id (GUID)** to impersonate.
- **Admin consent** for the `signature impersonation` scope.
- **Go-Live promotion** (moving the integration key from demo to production).
- The **prod auth host** (`account.docusign.com`, vs. `account-d.docusign.com` for demo).
- (Optional) A **Connect HMAC key** + the **webhook URL allowlisted**, for envelope-status callbacks.

## Box (watermarked document sharing)

- Confirmation of a **Business/Enterprise+ plan** (watermarking and admin events both require it).
- A **Platform App with Client Credentials Grant (CCG) enabled**.
- The **client id + secret** and the **enterprise id**.
- The app **authorized in the Box Admin Console**.
- **Scopes**: read/write files, manage webhooks, and reporting for events.
- **Admin 2FA** enabled.
- A decision on the **storage root folder + owning account** for shared copies.

## Microsoft Teams (meeting scheduling)

- An **Entra (Azure AD) app registration** — tenant id, client id, and client secret.
- **Admin-consented `Calendars.ReadWrite` (Application)** permission.
- A **designated, Teams-licensed organizer user** (UPN + object id) whose calendar hosts scheduled meetings.
- Note: Teams call **recording/transcript** ingestion is a documented future hook
  (`/onlineMeetings/{id}/recordings|transcripts`, requiring extra permissions) — it is
  **not built** in this integration.

## Outlook / Office 365 (email correspondence tracking)

- The **same Entra app registration used for Teams** (Microsoft Graph credentials are shared between the two).
- **Admin-consented `Mail.Read` (Application)** permission.
- A **mail-enabled security group** listing exactly the mailboxes the CRM may read.
- An **Exchange Application Access Policy** restricting the app to that group —
  `New-ApplicationAccessPolicy -AccessRight RestrictAccess`, verified with
  `Test-ApplicationAccessPolicy` — so the app cannot read arbitrary mailboxes.
- A **reachable public HTTPS notification URL** for Graph subscription webhooks.
- An **owner and expiry plan for secret rotation**.
