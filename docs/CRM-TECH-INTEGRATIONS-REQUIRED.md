# NobleStride CRM — Technologies & Integrations They Want (end-to-end)

Every technology/integration named across the `decrypted/` documents, with what it's for, where it's stated, and current build progress. Nothing added beyond what the documents say.

**Grounding keys (source documents in `decrypted/`):**
- **SPEC** — `Lua x Noblestride - Build Specification (INTERNAL).pdf` (v2.0) — the authoritative committed spec.
- **SOW** — `Noblestride_Lua_Phase1_Client_SOW_ Signed.pdf` — the signed client-facing scope.
- **CN** — `Noblestride-CRM-Concept-Note-decrypted.pdf` — the client's original wish-list (some items narrowed out of committed scope).
- **INV** — `Data collected from potential investors_ CRM.docx`.

**Scope legend:** ✅ committed (in SPEC and/or signed SOW) · 🕗 environment only (system they run on, platform "fits" it) · ⚠️ concept-note ask **not** in committed scope (SOW §11 / SPEC §19.2 narrowed it out).

**Progress legend** (current build, branch `test/comparisionAgainstTheBuildSpecs` @ `f58f79a`; grounded in the audits behind `docs/CRM-VS-BUILD-SPEC-COMPARATIVE-ANALYSIS-2026-07-06.md`):
- ✅ **Done** — built and working.
- 🟡 **Partial / demo** — some of it exists (data layer, a manual stand-in, or a demo-grade version).
- ❌ **Not started** — no implementation.
- ➖ **N/A** — superseded or intentionally not being built.

---

## A. Committed channels & integrations (SPEC §14.1 + SOW §05)

| Technology | What they need it for | Scope | Progress | Grounding |
|---|---|---|---|---|
| **WhatsApp** | Capture deal-status updates, task assignments, follow-ups, correspondence into the CRM | ✅ | ❌ Not started — only a manual "WhatsApp" value in the Source/Comm-channel picklists; no webhook/API client | SPEC §9, §14.1; SOW §05 |
| **Email — Outlook / Microsoft 365** | Capture formal correspondence & investor outreach against the right deal | ✅ | ❌ Not started — no IMAP/Graph client; "Email" exists only as a manual comm channel | SPEC §14.1; SOW §05 |
| **SharePoint (document storage)** | Store or link deal documents, VDR material, transaction files | ✅ | ❌ Not started — `Document.fileUrl` is a free-text URL; no upload/storage/SharePoint API | SPEC §14.1; SOW §05 |
| **Website + web chat** | Host the embedded intake & qualification agent for prospective clients | ✅ | ❌ Not started — no embedded widget; `/register` is investor self-registration, not the company-intake agent | SPEC §10, §14.1; SOW §05 |
| **Slack** | Agent channel (internal) | ✅ (to confirm) | ❌ Not started — no Slack SDK/webhook | SPEC §8, §14.1; SOW §05 |
| **Excel trackers** | Starting point for the CRM data load & field validation | ✅ | ✅ Done — `npm run import:real` parses the client's `.xlsx` → 106 mandates, 104 clients, 387 tasks | SOW §05; SPEC §18 |
| **Agent runtime channels (WhatsApp, Slack, email, web chat)** | The four Lua agents run on these channels | ✅ | ❌ Not started — the four agents are unbuilt (heuristic stubs only) | SPEC §8 (p.4) |
| **SMS / voice (telephony)** | Third-party channels (e.g. phone OTP); costs are Noblestride's | ✅ | 🟡 Demo — OTP flow exists but the code is static (`000000`); no SMS/voice provider wired | SPEC §19.1 |

## B. Environment systems the platform must fit (SPEC §14 intro)

| Technology | What they need it for | Scope | Progress | Grounding |
|---|---|---|---|---|
| **Microsoft 365 (SharePoint, Outlook, Excel, PowerPoint, Teams)** | The office environment the platform operates within | 🕗 | ❌ Not integrated — CRM is standalone; SharePoint/Outlook rows tracked under section A | SPEC §14 intro |
| **LinkedIn** | Origination/opportunity source | 🕗 / ✅ (as intake source) | 🟡 Partial — captured only as a manual `Source` picklist value ("Social media (LinkedIn / WhatsApp)"); no LinkedIn integration | SPEC §14 intro, §4.6; SOW §04 |
| **Microsoft To Do** | Task-management tool they currently use | 🕗 | ❌ Not integrated — CRM has its own native Tasks (built this session); no To Do sync | SPEC §14 intro |
| **Google Meet / Zoom** | Meeting tools they currently use | 🕗 | ❌ Not integrated — "Meeting" exists only as a manual comm channel/interaction type | SPEC §14 intro |
| **Microsoft Teams** | Part of their M365 environment (see ⚠️ call-scheduling ask in section D) | 🕗 | ❌ Not integrated | SPEC §14 intro |

## C. Security & data-protection technology (SPEC §7 / §14.2)

| Technology | What they need it for | Scope | Progress | Grounding |
|---|---|---|---|---|
| **Role-based access control + audit trails** | Enforce access at the data layer; keep prior value/timestamp/user on protected fields | ✅ | 🟡 Partial — **stage/status audit trail built** (`StageChange`, this session) + external-role visibility genuinely enforced; but in-org RBAC is display-only and core-identifier immutability + real auth are missing | SPEC §7.1/§7.2, §14.2 |
| **Encryption in transit and at rest** | Protect stored/transmitted deal data per the DPA | ✅ | ❌ Not configured in-app — relies on the host; no app-level at-rest/DPA config | SPEC §14.2; CN (AES-256) |
| **Kenya Data Protection Act 2019 alignment** | Access rights, secure storage, confidentiality, incident response | ✅ | ❌ Not started — no DPA settings/posture configured | SPEC §14.2 |
| **Two-factor authentication / OTP** | Secure investor access; OTP to phone/email | ✅ (phone for OTP) / ⚠️ (2FA scheme) | 🟡 Demo — `/register` OTP is a static `000000` with no real delivery; no true 2FA | SPEC §3.5; INV; CN |
| **Corporate-email gating** | Exclude generic Gmail/Yahoo for fund contacts | ✅ | ✅ Done — `src/lib/corporate-email.ts` blocks free-mail domains at registration | SPEC §3.5; INV |

## D. Concept-note asks NOT in committed scope (expectation-management)

Named by the client in the concept note but narrowed out by the signed SOW (§11) / SPEC (§19.2). Phase-2 candidates.

| Technology | What they wanted it for | Scope | Progress | Grounding |
|---|---|---|---|---|
| **DocuSign / HelloSign (e-signature)** | Investors sign NDAs & term sheets on-platform | ⚠️ | ❌ Not started — NDAs are recorded manually (status fields); no e-sign integration | CN; SPEC §12.1 guardrail |
| **Hosted VDR — Firmex / iDeals** | Access control, activity tracking, watermarked downloads | ⚠️ | 🟡 Partial — VDR exists only as a document access-level + NDA gate; no hosted VDR, watermarking, or download tracking | CN; SOW narrows to access gate + SharePoint |
| **Microsoft Teams API (call scheduling)** | Schedule & hold investor↔management calls in-platform | ⚠️ | ❌ Not started | CN |
| **Read.ai** | Record & transcribe investor calls | ⚠️ | ❌ Not started | CN |
| **Document AI — Google Cloud / Azure AI** | Document extraction & insights, automate document management | ⚠️ | ❌ Not started | CN; SPEC §19.2 |
| **AI behaviour tracking / predictive deal matching / preference memory** | Track investor behaviour, auto-suggest deals, remember each investor's criteria | ⚠️ | 🟡 Partial — investor matching exists as a heuristic stub (`ranking.ts` / `aiMatchInvestors`); behaviour-tracking & preference-memory not built | CN; SPEC §8 commits matching only |
| **HubSpot / Salesforce** | Off-the-shelf CRM integration option | ⚠️ | ➖ N/A — superseded by the custom Lua build | CN |
| **Cloud hosting (Google Cloud)** | Scalability & AI integration | ⚠️ | ➖ N/A — app deploys on the Lua/Vercel stack, not GCP | CN |

---

## Progress at a glance

- **✅ Done:** Excel-tracker data load; corporate-email gating. (Plus, under §7, the stage/status audit-trail slice and external-role visibility enforcement.)
- **🟡 Partial / demo:** OTP (demo code), LinkedIn (manual source tag only), RBAC/audit (audit slice + external gating done; in-org RBAC + immutability pending), VDR (gate only), AI matching (heuristic stub).
- **❌ Not started:** WhatsApp, Outlook/email capture, SharePoint/file storage, website intake agent, Slack, the 4 agent runtimes, all M365/To Do/Meet/Zoom/Teams integrations, encryption/DPA config, DocuSign, hosted VDR, Teams call scheduling, Read.ai, Document AI.
- **➖ N/A:** HubSpot/Salesforce, Google Cloud hosting (both superseded by the custom Lua build).

## Grounding notes

- **This document** cites the source doc + section for every requirement, and every Progress cell reflects the codebase at branch `test/comparisionAgainstTheBuildSpecs` @ `f58f79a` (the same audits behind the comparative analysis). Where the concept note and the signed SOW/SPEC disagree on scope, the SOW/SPEC governs.
- **The comparative analysis** (`docs/CRM-VS-BUILD-SPEC-COMPARATIVE-ANALYSIS-2026-07-06.md`) is grounded the same way: requirements tie to a SPEC section (§n), build claims to a `file:line`. The rows here map one-to-one to its §8 (agents), §9 (WhatsApp), §14 (systems) and §15 (deliverables) — this file is the technology-focused, progress-tracked cut of that analysis.
- **Underlying platform:** the CRM + the four agents are configured on **Lua ("Enterprise AI Operations")** under the Lua Enterprise Agreement (SPEC title page, §8). That is the delivery platform, not an integration, so it is not a row above.
