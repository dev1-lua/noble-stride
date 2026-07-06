# Remaining tasks / known demo shortcuts — Noblestride CRM

Things intentionally stubbed or deferred; each needs real implementation before production.

- **No real authentication anywhere in the app.** Access is the demo viewpoint cookie (`ns_viewpoint` via `/api/viewpoint`), which is a lens, not auth. Registration/login, sessions, and RBAC enforcement are all pending.
- **2FA/OTP is a static demo.** The `/register` flow shows an OTP step with a fixed code (`000000`) and stamps `emailVerifiedAt`/`phoneVerifiedAt`; nothing is actually sent to email or phone. Needs a real OTP provider (email + SMS) when auth lands.
- **NDA e-signing not wired.** NDAs are recorded manually by the team (status fields + optional Document link). DocuSign (or similar) integration is future scope per the concept note.
- **Investor matching is a heuristic stub** (`src/server/domain/ranking.ts` + `aiMatchInvestors`), not LLM/AI-backed.
- **Document storage is external links only** (`Document.fileUrl`); no upload, watermarking, or VDR activity tracking.
- **The `/register?step=verify&rid=<id>` query param is unauthenticated.** Anyone with the URL (the investor id is guessable/enumerable) can submit the demo OTP and stamp `emailVerifiedAt`/`phoneVerifiedAt` for that registration — acceptable only while the whole app runs on the demo viewpoint lens instead of real auth.
- **Registration has no rate-limiting or captcha.** `/register` accepts unlimited submissions from any client; needs abuse protection before this is public-internet-facing.
- **Landing + login are demo glue.** `/` landing page and `/login` (email lookup, any
  password) ride the viewpoint cookie — no credentials, no sessions, no rate limiting.
  Replace both with real auth (registration/login/sessions/RBAC). Sign-out
  (`/api/viewpoint?role=signout`) just clears the demo cookie. The team-login rule is a bare
  domain regex (any noblestride.* email, including subdomain lookalikes like
  noblestride.attacker.com) — replaced by real auth.

- **`/api/viewpoint` `next` param is an open redirect** (pre-existing, `new URL(next, req.url)` accepts absolute URLs → offsite). Demo lens only, but when real auth lands, constrain to `next.startsWith("/")`.

*(Update this file whenever a new shortcut/deferral is introduced.)*
