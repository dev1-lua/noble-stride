# §14. Systems and integrations

**Spec (Build Specification §14):** The platform must fit Noblestride's environment — Microsoft 365 (SharePoint, Outlook, Excel, PowerPoint, Teams), WhatsApp, LinkedIn, Microsoft To Do, Google Meet/Zoom. §14.1 puts five integrations in scope: WhatsApp (for §9), email via Outlook/Microsoft 365, Slack and web chat as agent channels, the website for the intake agent, and document storage such as SharePoint. §14.2 requires role-based access control and confidentiality gates enforced at the data layer, alignment with Kenya's Data Protection Act 2019, and encryption plus audit trails per the DPA.

## Build status

**Mostly not wired — 0 of 5 in-scope integrations are connected.** (Source: comparative analysis §14 and `docs/CRM-TECH-INTEGRATIONS-REQUIRED.md`.)

- **WhatsApp** — not started (see file 09). **Outlook / M365 email** — not started; "Email" is only a manual comm-channel value. **Slack** — no SDK/webhook. **Website embed** — not started; `/register` is investor registration, not the intake agent (see file 10). **SharePoint / file storage** — not started; `Document.fileUrl` is a free-text URL, no upload (deferred by explicit decision pending an infra choice). There is likewise no DocuSign/e-signature, no hosted VDR, no Teams/Read.ai/Document AI — those were concept-note asks already narrowed out of committed scope.
- What **is** done: the **Excel-tracker data load** (`npm run import:real` parses the client's real .xlsx into 106 mandates / 104 clients / 387 tasks) and the **corporate-email gate** for fund contacts.
- **§14.2 data protection:** external-role confidentiality gates are genuinely enforced at the data layer (the §11 visibility engine), and stage/identifier changes are audit-trailed. But in-org RBAC is display-only, authentication is a demo lens cookie with a hardcoded OTP, and no encryption/DPA posture is configured in-app.

Integration work is tracked in `memory/remaining-tasks.md` (larger builds) and itemized in `docs/CRM-TECH-INTEGRATIONS-REQUIRED.md`.

## See it in the app

No external system is connected, so there is no live integration to watch. The visible traces:

1. Log in at `http://localhost:3000/login` as `jane@noblestride.co` (any password).
2. `http://localhost:3000/clients`, `/mandates`, `/tasks` — the records themselves are the Excel integration's output: real imported tracker data, not synthetic seeds.
3. `http://localhost:3000/documents` — the document register shows access levels (Internal / Client-shared / Investor-shared / VDR) and a review chain, but "File" is a link field; there is no upload and no SharePoint behind it.
4. On any client or mandate detail, **Log Communication** offers WhatsApp / Email / Slack / Web chat as channels — manual stand-ins for the unwired capture integrations.
5. `http://localhost:3000/access-matrix` — the §7.2 role matrix rendered as a display-only page; it is not enforced for internal roles.
6. For the enforced half of §14.2, see file 11: switch to a greylisted investor lens and watch the data layer refuse everything.
7. Logged out, `http://localhost:3000/register` step 1 rejects a `@gmail.com` contact address — the corporate-email rule working.

## Key source files

- `scripts/parse-real-data.py`, `scripts/import-real-data.ts` — the Excel tracker load (`npm run import:real`)
- `src/lib/corporate-email.ts` — free-mail domain gate for fund contacts
- `src/server/visibility/` — the enforced confidentiality-gate half of §14.2
- `src/components/crm/access-matrix.tsx`, `src/app/(crm)/access-matrix/page.tsx` — display-only role matrix
- `src/server/services/documents.ts`, `src/components/crm/document-form-drawer.tsx` — document register (URL-only, no storage backend)
- No WhatsApp / Outlook / Slack / SharePoint client code exists to cite.
