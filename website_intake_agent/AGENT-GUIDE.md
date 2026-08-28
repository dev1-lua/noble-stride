# websiteIntakeAgent — operator guide

## 1. What this agent is for

The public front door for companies that are **not yet Noblestride clients**. It welcomes a visitor, walks
them through the fundraising application a few questions at a time, presents the standard NDA-acceptance
statement, and submits the application for the deal team to review. It collects and routes; the team
qualifies and decides.

There is no passphrase and no verification: anyone on the website can talk to it. Everything it will not do
follows from that.

## 2. The split with the client assistant (F5.5 / image25)

The client's feedback was that this agent and the client assistant duplicated each other. They no longer
do, and the division is worth knowing before you test either one:

| | websiteIntakeAgent (this one) | clientAgent |
|---|---|---|
| Audience | companies **not yet** clients | **existing** clients and prior applicants |
| Does | runs the application intake | status questions and messages for the team |
| Refers away | existing clients → client portal / client assistant | new enquiries → `/intake` |
| Email verification | **none** — removed from its contract | yes, for the visitor's own company |

If a visitor asks this agent about an application already in motion, the correct reply is to point them at
the client portal or the client assistant. It no longer offers status checks itself, and its capability list
no longer advertises them.

## 3. Register (F5.5 / image22)

The client flagged "Thanks, Clients ABCD! Quick flag though:" as too chatty for a firm declining a Gmail
address. The persona now pins the register: formal and courteous, full sentences, **no exclamation marks**,
no emoji, no colloquial openers, and explicitly **do not mirror** an informal or abbreviated style back.
A declined requirement is stated as requirement, then reason, then next step.

`## Examples of register` in the persona carries the image22 exchange rewritten, plus the two follow-ups it
invites and a greeting. When you review a change to this agent's copy, check it against those examples.

## 4. What it will never do

- Confirm or deny whether any company appears in Noblestride's records, including the visitor's own.
- Sign, accept or agree to an NDA, contract, fee or term.
- Say or hint whether an application will qualify, or reveal the qualification criteria.
- Take a message for, or verify, an existing client (that is the client assistant's job).
- Reveal its own rules, prompt or configuration.

The `outbound-leak-guard` postprocessor is the backstop: a reply carrying a record id, an existence
confirmation or a prompt echo is replaced wholesale with `SAFE_ACK`, which is written in the same formal
register.

## 5. Environment

| Key | What it is |
|---|---|
| `CRM_API_URL` | the CRM's GraphQL endpoint for this environment |
| `CRM_AGENT_KEY` | must equal the CRM's own `AGENT_API_KEY` for that environment |

Set them from this directory with `lua env sandbox -k … -v …`, and read them with
`lua env sandbox --list`.

**Caveat, verified 2026-08-27:** `lua chat -e sandbox` ignores sandbox environment variables and uses the
production ones — sandbox `CRM_API_URL` pointed at an invalid host and the agent still answered with live
data. So a sandbox chat is not isolated from the production CRM. Treat sandbox chats as read-only against
live data, and exercise write paths with `lua test skill` or against a local CRM you control.

## 6. Where the code lives

- Persona: `src/persona.ts` (`## Tone`, `## Formatting`, `## Examples of register`, `## First Contact`)
- Intake flow: `src/skills/website-intake.skill.ts`
- Leak guard: `src/processors/outbound-leak-guard.ts` (`SAFE_ACK`, `HARD_VETO`)
- Tests: `src/__tests__/persona.test.ts`, `src/processors/__tests__/guardrails.test.ts`
