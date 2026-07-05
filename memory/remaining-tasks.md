# Remaining tasks / known demo shortcuts — Noblestride CRM

Things intentionally stubbed or deferred; each needs real implementation before production.

- **No real authentication anywhere in the app.** Access is the demo viewpoint cookie (`ns_viewpoint` via `/api/viewpoint`), which is a lens, not auth. Registration/login, sessions, and RBAC enforcement are all pending.
- **2FA/OTP is a static demo.** The `/register` flow shows an OTP step with a fixed code (`000000`) and stamps `emailVerifiedAt`/`phoneVerifiedAt`; nothing is actually sent to email or phone. Needs a real OTP provider (email + SMS) when auth lands.
- **NDA e-signing not wired.** NDAs are recorded manually by the team (status fields + optional Document link). DocuSign (or similar) integration is future scope per the concept note.
- **Investor matching is a heuristic stub** (`src/server/domain/ranking.ts` + `aiMatchInvestors`), not LLM/AI-backed.
- **Document storage is external links only** (`Document.fileUrl`); no upload, watermarking, or VDR activity tracking.

*(Update this file whenever a new shortcut/deferral is introduced.)*
