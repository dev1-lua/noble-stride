# investorAgent — operator guide

## 1. What this agent is for

The investor-relations correspondent. It reads inbound investor **email**, keeps the CRM record current,
and makes sure a message reaches the right deal lead. It can identify a sender, show a fund what
Noblestride holds on file for it, capture a change for staff to confirm, log every substantive message,
flag something for review, answer "what deal am I on" from the fund's own engagements, and record genuine
interest in an opportunity.

It never discusses deal specifics over email. Interest and deal-awareness replies share only the deal's
**code name**, its stage phrase, and a portal link; the real client name, figures and terms live behind the
investor portal, where access is gated per deal and per NDA.

## 2. How this agent knows who it is talking to

**The transport-verified `From` address of the inbound email, and nothing else.**

This is the single most important thing to understand about it. `Lua.request.channel` must be `email` and
the address comes from the webhook payload — never from an argument the model supplies. A prompt-injected
inbound message can say anything it likes, including another investor's address, so every
identity-sensitive tool binds to `verifiedSender()` (`src/lib/request-sender.ts`) and refuses when it
returns undefined.

Consequences worth knowing before you test:

- **Web chat cannot identify anybody.** There is no verified sender, so the tools return
  `refusal: "channel_unverified"`. That is by design, not a bug. The refusal now explains why and points
  the visitor at their portal (`PORTAL_URL`) and at emailing from their registered address — the client's
  note on image21 was that the old refusal explained nothing.
- **A parseable `from` field is not proof of email transport.** Webchat payloads can carry a visitor-typed
  `from`, which is exactly why the channel is checked first and anything unknown fails closed.

## 3. Testing it with real mail

Testing from an internal account does not work, and that was the client's second point on image21: the
sender has to BE an investor contact in the CRM, because identity is the email address.

Set up once:

1. Pick a mailbox the team controls (a shared or team address is fine).
2. In the CRM, add that address as a contact on a test investor — ideally a `zz-` prefixed fund so it is
   obviously test data and the cleanup script can find it.
3. Give that investor at least one engagement on a live transaction, so `get_engaged_deals` has something
   to return and `express_deal_interest` has something to match.

Then email the agent's inbound address from that mailbox and watch:

```
lua logs --type skill --name investor-correspondence
```

What to check, in order: the sender was identified; the reply names the deal only by its code name; any
portal link is pasted exactly as the tool returned it; and the exchange was logged with
`log_communication`.

Do NOT test identity by asking the agent to accept an address in the message body. It will refuse, and
that refusal is the security property working.

## 4. Environment

| Key | What it is |
|---|---|
| `CRM_API_URL` | the CRM's GraphQL endpoint for this environment |
| `CRM_AGENT_KEY` | must equal the CRM's own `AGENT_API_KEY` for that environment |
| `PORTAL_URL` | where an unidentifiable visitor is sent; falls back to the production portal if unset |

Set them server side, from this directory:

```
lua env sandbox --list
lua env sandbox -k PORTAL_URL -v "https://<host>/portal/investor"
```

**Never point a sandbox agent at the production CRM.** There is one write-scoped `AGENT_API_KEY`, so a
sandbox test chat would be writing to real records. Run the CRM locally, expose it with a tunnel, and use
the local key.

## 5. What it will never do

- Send anything to an investor on its own initiative. Outbound drafts are staff-reviewed; see
  `src/lib/__tests__/no-send-guarantee.test.ts`, which exists to keep that true.
- Confirm or deny whether any company or person appears in Noblestride's records — including the sender's
  own address, before identification.
- State a real client name, a figure, or deal specifics in an email.
- Change onboarding or classification, grant access, or delete anything.

## 6. Where the code lives

- Identity: `src/lib/request-sender.ts` (`verifiedSender`, `CHANNEL_UNVERIFIED`, `portalUrl`)
- Routing: `src/skills/correspondence.skill.ts` — the numbered rules the model follows
- Deal awareness: `src/skills/tools/GetEngagedDealsTool.ts` + `src/lib/deal-resolver.ts`
- Interest: `src/skills/tools/ExpressDealInterestTool.ts` (records, and mints a one-time portal link)
- Guard sweep: `src/skills/tools/__tests__/transport-guard.test.ts` — every identity-sensitive tool must
  refuse without a verified sender, and this test enumerates them so a new tool cannot quietly skip it.

## 7. The CRM contract this depends on

`get_engaged_deals` calls `investorEngagedDeals(investorEmail:)` and selects `engagementId`, `codename`,
`status` and `stagePhrase`. That query lives in `noblestride-crm/src/graphql/queries.ts`, is guarded by
`assertAutomation`, returns codenames only, and returns `[]` (never an error) for an unknown address so it
cannot be used to test whether somebody is one of our investors. Its smoke test pins the field names,
because if they drift the agent silently stops being able to answer "what deal am I on".
