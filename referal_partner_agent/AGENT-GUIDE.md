# Referral Partner Tracker — operator guide

## 1. What this agent is for

An internal desk for the Noblestride deal team, and **Noblestride staff only**. It keeps the referral
record straight: who introduced which deal, how each partner relationship and fee share is set up, which
introductions converted, and what fees are due. It can brief any partner record, digest the referred-deal
pipeline, rank partner performance, and list greylisted or excluded investors. The `stage-watch` job sends
registered staff a grouped weekday update on referred-deal transitions (staff DMs only).

It writes only through the confirmed-update flow: it states exactly what will change and writes it after an
explicit yes. It never creates a deal from an introduction and never acts on fees without a signed
agreement on file.

**Partner self service was removed** (August 2026 client feedback, F5.6 / image23). Referral partners no
longer use this assistant: they log in to the Noblestride partner portal (`/portal/partner`) to see the
status of the deals they introduced. The gate is therefore a hard block, and it tells a partner who lands
here where to go. See `README.md` for what was deleted and the `lua skills delete` needed to retire the
skill server side.

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

## 4. Verifying, and signing out

- **Verify:** send the passphrase **on its own** as your next message. This desk does not need your email.
- **Sign out:** the WHOLE message must be a logout phrase: "log out", "sign out", "exit staff mode",
  "end staff session", "reset my verification", and this desk also accepts "reset to partner mode" (kept because
  existing users may still type it, though partner mode itself is gone). Mentioning logging out inside a longer
  sentence ("how do I log out of the CRM?") never de-verifies anyone.
- Verification is stored on the Lua user record as `verified: true` plus `passphraseVersion`.

## 5. If it does not work

| Symptom | Cause | Fix |
|---|---|---|
| "not fully configured yet" | `TEAM_PASSPHRASE` unset, or set to punctuation only, on that environment | `lua env <env> -k TEAM_PASSPHRASE -v "..."` |
| Correct phrase still refused | only part of the phrase was sent, or `PASSPHRASE_VERSION` was bumped | `lua env <env> --list`, then resend the whole phrase |
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
