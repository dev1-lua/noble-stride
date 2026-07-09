# Playwright E2E — File Storage Integration (2026-07-09)

Live run against `http://localhost:3000` (fresh dev server on current working-tree code; local-disk storage provider, no SharePoint creds). Storage plan: `docs/superpowers/plans/2026-07-09-file-storage-integration.md`.

## Results — ALL PASS

| # | Scenario | Expected | Actual | Verdict |
|---|----------|----------|--------|---------|
| 1 | Staff upload via `/documents` → "+ New Document", pick a real PDF, Save | File stored; row appears with a download link + "New version" action | Doc `cmrckrwpj…` created (total 5→6); name links to `/api/documents/<id>/download`; "New version" button present | ✅ |
| 2 | Bytes on disk match the uploaded file | Byte-identical | `.storage/unfiled/unfiled/<id>/v1-e2e-teaser.pdf`, sha256 `eae41f44…c4c3c` == source sha256 | ✅ |
| 3 | Admin downloads the doc (same-origin, authed) | 200, correct headers, byte-identical | 200, `content-type: application/pdf`, `content-disposition: attachment; filename="e2e-teaser.pdf"`, `content-length: 229`, body starts `%PDF-1.4`, contains marker | ✅ |
| 4 | Content-Length correctness (I2 fix) | Set only when size>0 | `content-length: 229` present for local (size known) | ✅ |
| 5 | Investor lens downloads an **Internal** doc | 403, no bytes | Switched to investor viewpoint (`recordId=cmrcaimia…`); `GET …/download` → **403 `{"error":"Not authorized"}`**, no PDF leaked | ✅ |
| 6 | Versioning UI reachable (I4b fix) | Per-row "New version" affordance for stored docs | "New version" button rendered on the uploaded row | ✅ |
| 7 | Delete removes row AND bytes (I4a fix) | Row gone; object deleted from provider | `deleteDocument` → returned id; post-delete download 403; `.storage` file count = 0 | ✅ |

## Notes

- Object key structure verified: `{entityType}/{entityId}/{documentId}/{version}-{filename}`; unlinked upload → `unfiled/unfiled/…` (correct fallback).
- The upload/download/delete request path, the local-disk provider, versioning UI, the audit gate, and delete-cleanup all work end-to-end on the running app.
- SharePoint provider is covered by mocked unit tests only (no live creds); switch-on is config-only per `docs/SHAREPOINT-PROVISIONING.md`. Run the manual smoke checklist there when the client provisions the Azure AD app.
- Unrelated pre-existing failures (NOT this work): 2 `two-factor.smoke.test.ts` OTP-email tests; documented lint baseline (8 errors/3 warnings in unrelated files).
- Deferred (not bugs): M3 staff-upload attribution (demo Admin lens has no userId); N1 "New version" saved with no file falls back to a plain (unlinked) doc.
