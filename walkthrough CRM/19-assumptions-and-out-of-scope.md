# §19. Assumptions, dependencies and out of scope

**Spec (Build Specification §19):** §19.1 assumes timely access to systems, channels, data and people via the nominated coordinator; existing trackers/templates/files for the data load; API/admin access for integrated systems (or an agreed alternative); reasonable approval turnaround; and that third-party channel costs (WhatsApp, SMS, voice) are Noblestride's per the Enterprise Agreement. §19.2 excludes: anything beyond the described scope; advisory engagement tracking (§3.3) unless added in discovery; automated *production* of investor documents (the system tracks and stores them, the team produces them); historical-data migration beyond the agreed initial load; outbound automated commercial communication or negotiation; and custom integrations with systems not listed in §14.

## Where this stands

**Assumptions (§19.1):**
- Trackers/files for the data load — held: the client's trackers drove the real-data import in the demo.
- Coordinator, API/admin access, approval turnaround — untested: no integrations connected yet and no coordinator nominated (see §17 items 6–7).
- Channel costs — not yet relevant (no WhatsApp/SMS/voice channels live).

**Out of scope (§19.2) — the build respects the boundaries:**
- Advisory engagement tracking: not built, correctly; whether to add it is open question Q14 (`memory/client-meeting-questions.md`).
- Document production: the system tracks documents (register, review chain, status) and stores external links only — it does not generate teasers/IMs/models. Note the demo currently has *no file upload at all* (`Document.fileUrl` links only), which is narrower than the spec's "tracks and stores"; file storage is the one remaining no-decision gap, deferred pending an infra choice (S3/Azure/SharePoint).
- Outbound automated communication/negotiation: none built.
- Custom integrations beyond §14: none built (nor are the §14 ones yet).
- Historical data: only the agreed trackers were loaded; no restructuring beyond that.

The demo also carries its own *additional* scope shortcuts that the spec doesn't mention — no real authentication (viewpoint-cookie lens), static demo OTP, no NDA e-signing, heuristic (non-AI) investor matching — all listed honestly in `memory/remaining-tasks.md`.

## See it in the app / in the repo

- `docs/SOW.md` §19 — the spec text.
- `memory/remaining-tasks.md` — the demo's own deferral ledger (auth, OTP, e-signing, file storage, matching stub, rate limiting).
- `memory/client-meeting-questions.md` Q14 — the Advisory in/out decision.
- In the app: `/documents` (admin lens) shows link-based document tracking with no upload control — the tracks-vs-produces boundary made visible.
