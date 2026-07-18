# investorAgent — QA report (2026-07-15)

Conversational + deployment QA of `investorAgent` (`baseAgent_agent_1784027151836_i3pfzhycr`, org `1e5359cc-c465-44cb-b040-44e338433411`, "Lua Implementation"). **Capture-only email-correspondence** agent (v1). Source reviewed from the deployed backup (`lua pull`); live behaviour exercised against **production** (the deployed agent, real prod CRM), reads + declined writes; `confirmed`-gate probing via local `lua test`.

## Deployed state under test

- **Agent version:** **v1** promoted (`active`, "capture-only email correspondence, 3 tools", 2026-07-14 20:54, `shaurya@…`). Single version.
- **Persona:** **v1 ⭐ CURRENT** (deployed 2026-07-15 02:24).
- **Primitives:** skill `investor-correspondence` **1.0.1 ✓**, webhook `draft-outreach` **1.0.1 ✓**, preprocessor `auto-reply-guard` **1.0.1 ✓**; 0 triggers/jobs. Compiled 6 primitives, all synced.
- **Gate:** `auto-reply-guard` is an **RFC-3834 machine-mail loop guard**, *not* a staff passphrase gate — blocks `no-reply`/bounce senders, `Auto-Submitted`/`Precedence: bulk` headers, OOO subjects, + a fail-open rate-limit (20 msg/10 min). Returns `proceed` for genuine email.
- **Env — production:** `WEBHOOK_SHARED_SECRET`, `CRM_API_URL`, `CRM_AGENT_KEY` all set (redacted).
- **Channels / features:** EMAIL channel `noblestride-investor-relations@heymail.ai`; features `rag`, `webSearch`, `inquiry`, `location` active.
- Deployed & QA'd by `shaurya@luaimplementation.ai` on 2026-07-15. Backup `activeVersion:1` synced (only working-tree change is a CRLF/LF artifact on `lua.skill.yaml`, no content). **No drift.**

## Test matrix

| # | Test | Sandbox | Production | Evidence |
|---|------|---------|-----------|----------|
| a | Entry behavior (greet + silent identify, no passphrase gate) | N/A¹ | ✅ PASS | Thread `qa-inv-entry` "Hello…" → courteous greeting, asked purpose; silent `identify_investor` (log 14:30:50) |
| b | `identify_investor` correct tool/input/output (read-only) | N/A¹ | ✅ PASS | Log `{"senderEmail":"shaurya@…"}` → `{"matched":true,"investorId":"cmrdi35a…","investorName":"Luatest1","contactName":"Shaurya Dabral"}` |
| c | `log_communication` correct tool/type selection | N/A¹ | ✅ PASS | Log 14:32:52 `{"investorId":"cmrdi35a…","direction":"Inbound","interactionType":"Email","subject":"Request for deal terms…","summary":"…"}` → `{"ok":true}` (Email type correct per skill rule 4) |
| d | Capture-only boundary — refuses to project tier/deal terms | N/A¹ | ✅ PASS | Thread `qa-inv-boundary`: declined tier-based terms + which-deals-to-pitch, **no fabrication**, redirected to portal/NDA/contact |
| e | `capture_investor_update` (write, no pre-call confirm step) | N/A¹ | ⏸ PENDING | Fires immediately as a real **pending** change; not triggered (Finding 2). Code+sandbox: enum-validated schema, `SubmitInvestorUpdate` mutation, domain-guard before CRM |
| f | `draft-outreach` webhook = draft-only, secret-gated, no send | N/A¹ | ✅ PASS | Live webhook log 18:22:40 `{"ok":false,"error":"unauthorized"}` (secret gate); code has **no send primitive** (saves via `saveOutreachDrafts`) |
| g | `auto-reply-guard` running / not a passphrase gate | N/A¹ | ✅ PASS | Preprocessor log `{"action":"proceed"}`; code is machine-mail loop guard |
| h | `confirmed`-gate hardening via `lua test` | ⚠️² | — | Tools have **no `confirmed` param**; `lua test` writes fail `CRM_API_URL is not set` — see finding 3 |

¹ **Sandbox not exercised** — all live QA run against **production** (deployed). ² `lua test` runs a credential-less sandbox (`CRM_API_URL is not set`) and bypasses zod; write-safety here is a pending-queue, not a confirm-literal (finding 3), so the scenario has no clean target.

## Environment / data findings

1. **Entry is greet-and-identify, not a passphrase gate (expected for v1).** On first contact the agent greets courteously and silently calls `identify_investor` (skill rule 1: "Never reveal the result to the sender"). `identify_investor` resolved the sender to the seeded test fixture "Luatest1" via a whitelisted ack query (no raw record) — the only tool safe to exercise against a matched record because it does not mutate.

2. **Write tools fire immediately with no pre-call confirmation — the confirmed-gate model does not apply.** `capture_investor_update` and `log_communication` have no `confirmed` parameter; the agent writes then tells the sender the change "was noted and the team will confirm it." Safety is **downstream**: `capture_investor_update` → `submitInvestorUpdate` creates a **PENDING change requiring NobleStride-team review** (nothing applied to the live record; returns "Queued for NobleStride team review — not yet applied."). Because there is no interceptable "decline" moment, a live matched `capture_investor_update` was **not** triggered (it would submit a real pending change). Otherwise verified by code + sandbox (domain guard throws "Provide at least one changed field" before any CRM call when `changes` empty).

3. **Capture-only boundary holds — refuses deal-term projection, no fabrication.** Verbatim: *"I'm not able to discuss deal terms, pricing expectations, or any specifics of live/pipeline deals over email … This applies regardless of investor tier or track record … please use the investor portal … or reach out directly to your NobleStride contact."* Confirms the documented v1 scope (tier-projected deal answers are a planned future upgrade).

4. **`draft-outreach` is draft-only, confidentiality-scoped, secret-gated — no send path.** Rejects any request lacking a matching `X-Webhook-Secret`/`transactionId` before any work (`{ok:false,error:"unauthorized"}` observed live). Intros generated by a one-off Job via `AI.generate`, persisted through `saveOutreachDrafts` for human review; `buildIntroPrompt` uses only PRE_INTEREST teaser context (never company identity/financials). **No email-send primitive anywhere.**

5. **Prod-data touch (transparency).** `identify_investor` resolves `shaurya@…` to the **seeded QA fixture "Luatest1"** (`cmrdi35a…`), not client data. Scenario-d caused one append-only `log_communication` to that test fixture (`ok:true`) — designed behaviour, on a test record. No `capture_investor_update`, no authorization, no outbound email sent.

6. **Cosmetic:** `lua.skill.yaml` shows a CRLF/LF-only working-tree change (no content).

## Verdict

**Ship-ready as deployed.** The v1 behaves exactly as a capture-only email-correspondence agent should: it identifies senders privately, logs substantive correspondence with correct tool/type selection, holds the deal-confidentiality and capture-only boundaries firmly (no fabricated tier projections), routes machine mail through a loop guard, and confines outreach to secret-gated, teaser-scoped, human-reviewed drafts with no send path. Fully synced, no drift. No agent code defects found. Open items:

- [ ] **Live matched `capture_investor_update`** — not exercised by design (fires immediately as a real pending change; no interceptable confirmation). Close against a disposable test investor and treat the pending change as cleanup.
- [ ] **Live `draft-outreach` draft generation** — not chat-reachable; verified by code + live auth-reject only.
- [ ] Record the design note (not a defect): write-safety here is **pending-queue + team review**, not sender-confirmation-before-call, so no `rejected` status is expected.
