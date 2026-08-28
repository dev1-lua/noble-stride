# clientAgent — operator guide

## 1. What this agent is for

The front desk for **existing Noblestride clients and prior applicants**. It answers status questions once
the visitor has verified their company email, and it takes messages for the deal team. It collects and
routes; the team qualifies and decides.

It does **not** run new-business intake. A new company exploring fundraising is pointed at `/intake`.

There is no passphrase: anyone on the website can talk to it. What protects client data is the email
verification step, not a gate.

## 2. The split with the website intake agent (F5.5 / image25)

The client's feedback was that the two public agents duplicated each other. They no longer do:

| | clientAgent (this one) | websiteIntakeAgent |
|---|---|---|
| Audience | **existing** clients and prior applicants | companies **not yet** clients |
| Does | verified status questions, messages for the team | runs the application intake |
| Refers away | new enquiries → `/intake` | existing clients → here, or the client portal |
| Email verification | yes, for the visitor's own company | none |

## 3. Register, and the corporate-email refusal (F5.5 / image22)

The client's sample was "Thanks, Clients ABCD! Quick flag though: clientsabcd@gmail.com is a
free/personal email address" — the register of a chat app, from a firm declining an address.

The persona now pins it: formal and courteous, full sentences, **no exclamation marks**, no emoji, no
colloquial openers, and **do not mirror** an informal style back. A declined requirement is stated as
requirement, then reason, then next step. `## Examples of register` carries the rewritten exchange, and the
response contract scripts the sentence to use:

> For security, I can only discuss account specifics with the email address we have on file for your
> company. Could you write from your corporate address, or ask your administrator to update it if it has
> changed?

Note what that sentence does **not** do: it never says whether the address matches. A failed verification
and a non-matching address must read identically, or the desk becomes an oracle for who is a client.

## 4. What it will never do

- Confirm or deny whether any company appears in Noblestride's records — including, before verification,
  the visitor's own.
- Discuss anything about a company other than the verified visitor's own, or anything beyond what the
  status tool returned in the current verified session.
- Start a new-business intake, even if pushed.
- Sign or accept an NDA, contract, fee or term; promise engagement; or say whether an application will
  qualify.

The `probe-guard` and `outbound-leak-guard` processors are the backstops; a reply carrying a record id, an
existence confirmation or a prompt echo is replaced wholesale with `SAFE_ACK`.

## 5. Environment

| Key | What it is |
|---|---|
| `CRM_API_URL` | the CRM's GraphQL endpoint for this environment |
| `CRM_AGENT_KEY` | must equal the CRM's own `AGENT_API_KEY` for that environment |

**Caveat, verified 2026-08-27:** `lua chat -e sandbox` ignores sandbox environment variables and uses the
production ones — sandbox `CRM_API_URL` pointed at an invalid host and the agent still answered with live
data. Treat sandbox chats as read-only against live data; exercise write paths with `lua test skill` or
against a local CRM you control.

## 6. Where the code lives

- Persona: `src/persona.ts` (`## Tone`, `## Formatting`, `## Examples of register`, `## First Contact`)
- Status + messages: `src/skills/intake.skill.ts`
- Guards: `src/processors/probe-guard.ts`, `src/processors/outbound-leak-guard.ts`
- Tests: `src/__tests__/persona.test.ts`, `src/processors/__tests__/guardrails.test.ts`
