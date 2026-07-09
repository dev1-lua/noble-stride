# SharePoint provisioning — what to request from the client

The CRM's file storage runs on local disk by default and switches to SharePoint
with no code change. To enable SharePoint, the client (M365 admin) must create an
Azure AD app registration and provide:

| Value | Env var | Where the admin finds it |
|---|---|---|
| Directory (tenant) ID | `SHAREPOINT_TENANT_ID` | Entra ID → Overview |
| Application (client) ID | `SHAREPOINT_CLIENT_ID` | App registration → Overview |
| Client secret | `SHAREPOINT_CLIENT_SECRET` | App registration → Certificates & secrets |
| Site ID | `SHAREPOINT_SITE_ID` | Graph: `GET /sites/{hostname}:/sites/{path}` |
| Drive ID | `SHAREPOINT_DRIVE_ID` | Graph: `GET /sites/{siteId}/drives` |

Required **application** permissions (admin consent): `Files.ReadWrite.All`, `Sites.ReadWrite.All`.

To go live: fill the five vars, set `STORAGE_PROVIDER=sharepoint`, redeploy.
Run the manual smoke checklist in the file-storage plan (Task 13) against a test document library first.
