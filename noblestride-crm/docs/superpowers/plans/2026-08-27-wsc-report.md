# WS-C close-out — the six Lua agents

Branch `feedback/2026-08`. All eleven tasks complete. Two of them turned out to be already done on the
server, one was answered differently and better than planned, and the sandbox QC found a platform behaviour
that matters more than anything in the plan.

---

## Verification, as run

| Agent | tests | tsc | `lua sync --check` |
|---|---|---|---|
| crm_agent | **189** | clean | 0 source drift (staged ahead of active, see below) |
| investor-tracker-agent | **189** | clean | 0 source drift |
| referal_partner_agent | **132** | clean | 0 source drift |
| investor_agent | **166** | clean | 0 source drift |
| client_agent | **76** | clean | 0 source drift |
| website_intake_agent | **72** | clean | 0 source drift |

Sandbox chat transcript: `noblestride-crm/docs/feedback/wsc-sandbox-qc-20260827-2241.log`
Re-run it with: `TEAM_PASSPHRASE=<live value> STAFF_EMAIL=<active CRM user> bash docs/superpowers/plans/wsc-sandbox-qc.sh`

`lua sync --check` reports each agent's local source as one version AHEAD of the active server version. That
is the intended staged state under decision D5: `lua push all --force` staged everything and **nothing was
promoted**. No `lua version promote`, no `lua deploy`, no `lua env production` was run at any point. The
client's live agents still run the old code.

---

## READ THIS FIRST: `lua chat -e sandbox` is not sandboxed

Verified 2026-08-27. This is the single most important finding in the workstream.

**`lua chat -e sandbox` ignores sandbox environment variables and uses the production ones.**

The proof: sandbox `CRM_API_URL` was set to `https://sandbox-env-must-be-used.invalid/api/graphql` and the
agent still answered with live CRM data. Re-setting the value, `lua push all --force` and
`lua push agent --force` all failed to change it. The numbers in the transcript (113 mandates, 97
investors, USD 43,000,000 raised) are production's; the local database holds 106, 93 and a different total.

Two consequences, both now written into the QC script header and all six AGENT-GUIDEs:

1. **A passphrase rotation is not in force until proven.** `lua env` reports success and `--list` shows the
   new value while the runtime keeps the old one. After rotating, send the OLD phrase in a fresh chat and
   confirm it is refused **before** telling the team the new one.
2. **A "sandbox" chat is not isolated from production.** It runs locally compiled code against the live CRM
   with the production write-scoped key, so a write tool exercised there writes to real records.

The QC run was therefore **read-only by design and by fact**: every message was a question, the one
write-shaped request ("issue an access code") was refused by the gate before any tool ran, and no
propose-then-confirm flow was confirmed. The plan's mitigation — a cloudflared tunnel plus
`lua env sandbox` pointing at a local CRM — is still the right shape and is documented, but it does not
currently work, so write paths belong in `lua test skill` (local, no LLM, no network) or against a local CRM.

The user was told and ruled: accept the reads, run no writes, document it prominently.

---

## Task 0 — reconciliation, and what the server had already built

Every agent was pulled and committed separately before anything was edited, so no later diff mixes server
drift with our changes. `lua-cli` went `^3.18.0` → `^3.27.0` everywhere.

| agent | version | files really changed (whitespace ignored) | tests before → after |
|---|---|---|---|
| crm_agent | 9 → **12** | 7, plus 3 new tools | 141 → 143 |
| investor-tracker-agent | 12 → **13** | 2 | 155 → 157 |
| referal_partner_agent | 11 → **12** | 2 | 122 → 124 |
| investor_agent | 12 → **13** | 4, plus 2 new files | 162 → 162 |
| client_agent | 9 → **10** | 3 | 73 → 73 |
| website_intake_agent | 3 → **4** | 1 | 69 → 69 |

The server was last pushed **2026-08-27T13:39Z** — somebody worked in the Builder the same day, which is
also why `crm_agent/qc/` appeared untracked and, most likely, why the local database lost rows in the same
window (see plan §5g.1).

Breakages the reconciliation itself introduced, all fixed: four gate tests pinned case-sensitive passphrase
matching or old refusal wording; and lua-cli 3.27 narrowed the SDK's `LuaQuery` type, so
`referal_partner_agent`'s `StageWatchDeps.data.get` no longer accepted `Data.get`. Two local agent names
were aligned to their deployed names (`CRMagent`, `Referal_partner_tracking_agent`) rather than renaming
live agents.

---

## Per item

### A1 — help before the gate (F5.1, image19/image20) — the headline fix

`gateDecision` had one answer for everything that was not the passphrase, so "how does this work" and
"whats the main function of this CRM solomon@noblestride.capital" both came back as the same staff-only
challenge, five times over in the client's screenshots.

Each of the three gated agents now has `src/lib/onboarding.ts` and two new outcomes: `help` (explains the
assistant and where the passphrase comes from) and `hint_missing_passphrase` (echoes an email that arrived
without the passphrase and says what is still needed). Neither verifies anybody, writes anything, or calls
the CRM — asserted.

`HELP_INTENT` deliberately has no bare "how" alternative, so "how many opportunities are in the pipeline"
stays a real request. It **does** match "what is the main function of this CRM", the client's own test
question, which the planned pattern would have missed.

`crm_agent/qc/gate-replay.ts` is the evidence, and it is worth quoting exactly:

| | message shapes answered with the identical challenge |
|---|---|
| before any of this work | **6 of 13** |
| after the server's tolerant matching (Task 0) | 4 of 13 |
| now | **0 of 13** |

Confirmed live on sandbox: "how does this work" returns the full explainer, and so does the client's own
"whats the main function of this CRM <email>".

Every block string is emoji- and dash-free, with a test that walks every outcome the gate can return —
a `{action:"block"}` reply short-circuits the pipeline, so `format-normalizer` never runs on them.

### A2 — passphrase documentation (image24)

`AGENT-GUIDE.md` for all six agents. The three staff guides carry seven sections: what the agent is for,
what the passphrase is and who sets it, how to rotate it, how to verify and sign out, a symptom/cause/fix
table, where the code lives, and the per-user-code roadmap marked explicitly as **not built** so it cannot
be described to the client as shipped. Each also carries the sandbox-environment caveat above.

Verified rather than assumed: `lua env sandbox --list` must be run from the agent's own directory.

### A3 — `crm_overview` (F5.3, image20)

New tool answering the org-level question. The interesting part is not the total but the definition: "how
many opportunities?" was ambiguous because the CRM has three deal-ish tables, so the tool always ships the
number **with** the rule — an opportunity is a Mandate or a Transaction, advisory assignments are tracked
separately and not counted. The skill context forbids dropping that sentence or inventing a total.

Live output: "There are **128 opportunities** in the pipeline: 113 mandates and 15 transactions (an
opportunity is a Mandate or a Transaction; advisory assignments are tracked separately and not counted
here)" — correct shape, correct definition, production numbers (see the sandbox finding).

### A4 — public research (F5.2)

`webSearch` was already Active on both agents (verified with `lua features list`, not assumed).
`research_public_profile` is the tool that uses it. The search is the easy half; two boundaries are the work:

- **Nothing confidential leaves.** `isConfidentialLeak` refuses a codename or a money amount **before** the
  network call. The outbound prompt names the entity and nothing else — no CRM vocabulary, no mention of
  Noblestride, because the query itself is what leaves.
- **Nothing confidential leaves — without refusing real companies.** The branch review caught the first
  version being too blunt: the codename pattern carried an `i` flag, which defeated the capitalisation that
  makes it a codename matcher, so "Project Finance Advisors" was refused; and the amount pattern matched any
  digits before a scale suffix, so "3M" counted as an amount and a real company became unresearchable. The
  codename check is now case-sensitive with a short allow-list of ordinary business words, and an amount
  needs a currency or two digits before a bare "m".
- **Nothing comes back unlabelled.** Every result carries "Public information (web), not from the CRM", and
  a brief with **no sources** is reported as `no_public_info` rather than passed on: unsourced prose is the
  model's prior, which is exactly what this must not deliver as public fact.

Live: "recent news on Equity Group Holdings" returned a sourced brief with dates and figures under the
public-information label; "research Project Ivory Oryx" was refused with an explanation and a request for
the public company name.

Note the server had separately built `research_briefing` (CRM data plus the client's own website). Both now
exist and do different jobs; the persona's claim that no external search was connected has been corrected.

### A5 — investor agent deal context (F5.4, image21) — already built, better than planned

The server had already shipped this, and better-scoped than the plan proposed: a **read-only**
`get_engaged_deals` tool that answers "what deal am I on" without recording anything or minting a portal
link, with identity bound to the transport-verified email sender and a hard refusal on channels with no
verified identity.

Two things were missing and are now done:

- **The CRM contract did not match.** The deployed tool calls `investorEngagedDeals(investorEmail:)` and
  selects `engagementId, codename, status, stagePhrase`; WS-B Task 11 had shipped `(email:)` with a
  different field set. The CRM was aligned to the agent — the deployed contract wins, and its narrower
  projection is safer. `stagePhrase` is the stage as a phrase keyed by the enum, so "IMShared" can never
  reach an investor's inbox. The smoke test pins the contract.
- **The web-chat refusal explained nothing**, which was the client's actual complaint. It now states why
  (a chat window cannot prove identity) and offers both routes: the portal (`PORTAL_URL`) and emailing from
  the registered address. The URL sits inside the message and deliberately **not** in a `portalUrl` field,
  because `express_deal_interest` returns `portalUrl: null` on a refusal and a spread field would have
  silently overwritten that null with a generic link — tsc caught exactly that.

`investor_agent/AGENT-GUIDE.md` answers the client's other point, "hard to test with internal accounts",
with the real procedure: identity **is** the email address, so the test mailbox must be a contact on a test
investor with a live engagement.

### A6 — formal register for the public agents (F5.5, image22)

The sample was "Thanks, Clients ABCD! Quick flag though: clientsabcd@gmail.com is a free/personal email
address" — a chat-app register from a firm declining an address.

Both public personas now pin it: formal and courteous, full sentences, **no exclamation marks**, no emoji,
no colloquial openers ("Quick flag though" named explicitly as a phrase not to write), and **do not mirror**
an informal style back. `website_intake_agent`'s Tone had literally said "Mirror the visitor's language
style", which is the direct cause of the screenshot. A declined requirement is stated as requirement, then
reason, then next step. `## Examples of register` carries the image22 exchange rewritten plus the two
follow-ups it invites. `SAFE_ACK` — what a visitor reads when the leak guard replaces a reply — matches.

Live: "Hello" → "Good day. Thank you for contacting Noblestride Capital." The Gmail refusal came back as
requirement, reason, next step with no exclamation mark; the misspelt push-back got a measured restatement
("the requirement is the domain rather than how the address is used").

### A7 — the referral desk is staff only (F5.6, image23)

Partners now have a real portal login (WS-B F5.6), so "drop the partner usage" is finally safe to do.
Deleted the `partner-self-service` skill and its four tools, dropped it from `src/index.ts` and
`lua.skill.yaml`, removed `issue_partner_access_code`, and rewrote the persona to a single audience. The
gate's `partner` outcome is gone: it used to pass **every** unverified visitor through, and with no partner
surface left an unconfigured passphrase must now admit nobody. The challenge text tells a partner where to
go. `staffRefusal` stays on every staff tool as defence in depth.

**Deviation:** `lua skills delete --skill-name partner-self-service` reported *"has versions and was
deactivated instead of deleted"*. The skill is inactive and unavailable to the agent, which is the desired
end state and better than deletion — rollback stays possible.

Live: "hi" and "verify my partner code 1234" both get the staff-only block naming the partner portal; "issue
an access code for Acme Advisory" explains the surface was retired.

### A8 / D3 — de-duplicating the two public agents (F5.5, image25) — done differently

The server had already resolved this, but by **splitting** the agents rather than retiring one:
`website_intake_agent` handles companies that are not yet clients (status checks and email verification
removed from its contract), and `client_agent` handles existing clients' status and messages and refers new
enquiries to `/intake`.

This was put to the user, who ruled: **keep the split**. It answers the client's complaint with two
non-overlapping agents instead of a deprecated one, and gives clients a real place to check status. D3's
"retire client_agent and re-point `/talk-to-us`" is therefore superseded, and `/talk-to-us` stays as it is.
Both guides document the division of labour from their own side.

Live, both sides: the intake agent sent a status question to the client portal/assistant; the client agent
sent a new-business enquiry to `/intake`.

### A9 — sandbox QC

`docs/superpowers/plans/wsc-sandbox-qc.sh`, sequential by design (`lua chat -b` is concurrent and would
interleave gate state), each agent starting with "log out" so a previously verified user cannot mask first
contact. Every "EXPECT" line is an assertion; the transcript is committed. See the sandbox finding above for
what the run does and does not prove.

### A10 — "how to use me"

All six personas carry a `## First Contact` section (a one-line role statement, a 3-bullet guide and 2 to 3
example prompts, given once per conversation). Five were added by the server; the referral agent's was
rewritten from two audiences to one. All six agents now have an `AGENT-GUIDE.md`.

### G5 — passphrase rotation

Verification was permanent, so rotating `TEAM_PASSPHRASE` protected nobody who had already verified. All
three gates now store the generation alongside the flag and re-challenge when `PASSPHRASE_VERSION` moves;
sessions from before versioning count as generation 1, so adding the variable signs nobody out. **Subject to
the sandbox finding: confirm a rotation took effect before announcing it.**

---

## Two test-hygiene bugs found by counting the database

Neither was in scope, both explain why the restored dump arrived dirty, and both are fixed:

1. **`onboarding-queue.test.ts` leaked one `Person` per run.** It created an investor with a nested contact
   and deleted only the investor; `Person.investorId` is `SetNull`, not `Cascade`, so the contact survived
   as an orphan — and once orphaned nothing could find it, because every cleanup matches on the investor.
   The fixture was also unprefixed, so the prefix sweep could not see it either. **52 orphaned copies** had
   accumulated, about 43 from the dead machine.
2. **Fixture teardown left the auth audit trail behind.** `logAuthEvent` writes an Activity for every
   invite, reset and email change, and those rows hang off no entity. 342 had accumulated in one session.

Local database after both sweeps, all real counts intact: 104 clients, 106 mandates, 13 transactions,
5 advisory, 14 users, 93 investors, 788 persons, 63 engagements, 22 auth accounts.

## Open items

1. **`lua chat -e sandbox` ignores sandbox env** (above). Worth raising with the Lua platform team; until
   fixed, agent write paths cannot be exercised safely through chat.
2. **Five orphaned `zztest` contacts** from the dead machine are left in place deliberately, flagged rather
   than deleted.
3. **Governance mode** shows as drift on every agent (`local (none)` vs `server sdk`). Agent configuration,
   not source; left alone.
4. **Per-user staff codes** remain the right answer to "a shared phrase cannot tell two colleagues apart".
   Both halves already exist in the CRM (`issuePartnerAccessCode`, `resolveStaffUser`). Documented as
   roadmap, explicitly not built.
5. **Nothing is promoted.** Every agent is staged one version ahead of its active version, awaiting the
   user's go-ahead (D5).

## Commits

| Commit | What |
|---|---|
| `1ae962a` … `aa74303` | Task 0, one reconciliation commit per agent |
| `cdb3618` | A5 — CRM aligned to the deployed `investorEngagedDeals` contract |
| `77e06b1` | A1 + A7 + G5 — help before the gate, rotation, staff-only referral desk |
| `efefb05` | A3 — `crm_overview` |
| `d1ec0a5` | A4 — public research in both staff agents |
| `97e193c`, `3f7ea86` | A6 — formal register, client_agent and website_intake_agent |
| `3b39e27` | A2 — AGENT-GUIDE.md for the three staff agents |
| `095016f` | A5 — web-chat explanation and the investor_agent guide |
| `5d05b3d` | A9 — QC script, transcript, and the sandbox finding |
| `05ca3a4` | sandbox backup bookkeeping |
| `22a3ff9` | A10 — guides for the two public agents |
| `cfcf89d`, `e0d8848` | test hygiene: the two leaks, and two ambient-SDK-dependent cases |
