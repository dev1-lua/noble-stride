# CRMagent — operator guide

## 1. What this agent is for

An internal desk for the Noblestride deal team, and **Noblestride staff only**. It reads the CRM and can
brief you on any client, investor, mandate, transaction, engagement or partner; roster deals by stage;
match investors to a live deal; list greylisted or excluded investors; answer questions about the book as a
whole (`crm_overview`); summarise a document an investor uploaded through their portal; compile a research
briefing; and search public web sources with the result labelled as public information rather than CRM data.
It produces the weekly pipeline digest.

It writes only through a propose-then-confirm flow, attributed to the verified staff member. It never
deletes a record, never changes qualification verdicts or onboarding/greylist status, never grants document
or VDR access, and never sends anything to an external party. Those happen in the CRM UI, by a person.

## 2. The team passphrase

- **What it is:** ONE shared secret for this agent. It is not a CRM password, it is not per user, and the
  agent never sends it to anybody who asks.
- **Who picks it:** a Noblestride admin (whoever owns the Lua org account), agreed with the deal-team lead.
- **Where it is set:** an agent environment variable, per environment, server side:

  ```
  lua env sandbox    -k TEAM_PASSPHRASE -v "<value>"
  lua env production -k TEAM_PASSPHRASE -v "<value>"      # only on an explicit go-ahead
  ```

  It is **not** in git. `env.example` shows the key with a placeholder only.
- **Reading the current keys:** `lua env sandbox --list`. Every `lua env` command must be run from THIS
  agent's directory — it reads `lua.skill.yaml` to know which agent you mean, and fails with
  "No lua.skill.yaml found" anywhere else.
- **Choosing a value:** four or more words reads best. ASCII only, no emoji, no long dashes. The gate
  normalises punctuation and case on both sides before comparing, so "Passphrase: Open Sesame!" matches
  `open sesame` — but a partial phrase never does.

## 3. Rotating the passphrase

```
lua env sandbox -k TEAM_PASSPHRASE    -v "<new value>"
lua env sandbox -k PASSPHRASE_VERSION -v "<old number + 1>"
```

Then tell the team the new phrase out of band, never in the chat channel.

Bumping `PASSPHRASE_VERSION` is what makes a rotation mean anything. Verification is stored per user, so
before versioning existed a rotated phrase left everyone who had already verified still verified — the
rotation protected nobody. Everyone verified against the previous version is re-challenged on their next
message. Unset or empty is treated as `1`, so introducing the variable signs nobody out.

### Important: `lua env sandbox` does not reach `lua chat -e sandbox`

Verified on 2026-08-27, and it changes how you must test a rotation.

`lua env sandbox -k TEAM_PASSPHRASE -v "..."` reports success, and `lua env sandbox --list` shows the new
value, but a `lua chat -e sandbox` session keeps using the **production** environment. The proof: sandbox
`CRM_API_URL` was set to `https://sandbox-env-must-be-used.invalid/api/graphql` and the agent still
answered with live CRM data. Re-setting the value, `lua push all --force` and `lua push agent --force` all
failed to change it.

Two consequences:

1. **A rotation is not in force until you prove it is.** After the two `lua env` commands, send the OLD
   phrase in a fresh chat. If it still verifies, the rotation has not taken effect and the team must not be
   told the new one yet. Do that check before every announcement.
2. **A "sandbox" chat is not isolated from production.** It runs your locally compiled code against the
   production CRM with the production write-scoped key, so a write tool exercised in a sandbox chat writes
   to real records. Treat sandbox chats as read-only against live data until the platform fixes this, and
   test write paths with `lua test skill` (local, no LLM, no network) or against a local CRM you control.

## 4. Verifying, and signing out

- **Verify:** send the passphrase **and your CRM login email in one message**, for example
  `openSesame you@noblestride.capital`. The passphrase alone verifies you but the agent will then ask for
  the email, because a write has to be attributed to a real CRM user.
- **Sign out:** the WHOLE message must be a logout phrase: "log out", "sign out", "exit staff mode",
  "end staff session", "reset my verification". Mentioning logging out inside a longer
  sentence ("how do I log out of the CRM?") never de-verifies anyone.
- Verification is stored on the Lua user record as `verified: true` plus `passphraseVersion`.

## 5. If it does not work

| Symptom | Cause | Fix |
|---|---|---|
| "not fully configured yet" | `TEAM_PASSPHRASE` unset, or set to punctuation only, on that environment | `lua env <env> -k TEAM_PASSPHRASE -v "..."` |
| Correct phrase still refused | only part of the phrase was sent, or `PASSPHRASE_VERSION` was bumped | `lua env <env> --list`, then resend the whole phrase |
| Verified but "I also need your CRM login email" | `staffEmail` not resolved yet | reply with your CRM login email |
| "I could not match that email" | the address is not an active CRM `User` row | use the email you log in to the CRM with |
| Everything answers "the CRM did not respond" | `CRM_API_URL` / `CRM_AGENT_KEY` wrong for that environment | `lua env <env> --list`; the key must equal the CRM's `AGENT_API_KEY` |

## 6. Where the code lives

- Gate: `src/processors/passphrase-gate.ts` — the pure decision is `gateDecision`, side effects live in
  the processor (crm_agent additionally splits them into `runGate`).
- Copy: `src/lib/onboarding.ts` — `INTRO`, `PASSPHRASE_EXPLAINER`, `HELP_REPLY`, `WELCOME_GUIDE`,
  `HINT_EMAIL_NO_PASSPHRASE`.
- Tests: `src/processors/__tests__/passphrase-gate.test.ts`, `src/lib/__tests__/onboarding.test.ts`.
- A `{action:"block"}` reply short-circuits the pipeline, so the `format-normalizer` postprocessor never
  runs on gate strings. Every one of them is therefore written emoji free and long-dash free by hand, and
  a test walks every outcome to prove it.

## 7. Roadmap: per-user access codes

A single shared phrase cannot tell two colleagues apart, so the audit trail says "a verified staff member"
rather than who. The CRM already has both halves of the better answer: `issuePartnerAccessCode` mints a
one-time code verified server side, and `resolveStaffUser(email)` already resolves a staff identity. The
intended next step is a per-user staff code issued from the CRM and checked by the gate, with the shared
phrase retired.

**Not built yet — do not describe it to the client as shipped.**
