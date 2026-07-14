# Making both Lua agents work on the deployed CRM (noble-stride.vercel.app)

Date: 2026-07-14. Covers the env/config changes needed so the summarizerAgent (internal)
and clientAgent (public web chat) both function against the Vercel deployment instead of
the local dev server + cloudflare tunnel.

## The two agents

|                    | **summarizerAgent** (internal)                    | **clientAgent** (public)                          |
|--------------------|---------------------------------------------------|---------------------------------------------------|
| Purpose            | Deal-summary assistant for staff, inside CRM shell | Front-desk intake/message-logging on `/talk-to-us` |
| Agent ID           | `baseAgent_agent_1783976635757_xgvfd9dr3`         | `baseAgent_agent_1783981692495_we70afz23`         |
| Webchat channel    | `4rtza3`                                          | `lt132s`                                          |
| Where it renders   | Floating widget in the logged-in CRM layout       | Iframe embed on the public `/talk-to-us` page     |
| Lua env state (2026-07-14) | **Stale**: old (dead) key + old tunnel URL | Correct key; `CRM_API_URL` points at local tunnel |

## 1. Vercel project → Settings → Environment Variables

Add these five, then **redeploy** — the `NEXT_PUBLIC_*` vars are inlined at build time,
so nothing changes until a fresh build:

```
AGENT_API_KEY=<redacted — see local noblestride-crm/.env / rotation log>
NEXT_PUBLIC_LUA_AGENT_ID=baseAgent_agent_1783976635757_xgvfd9dr3
NEXT_PUBLIC_LUA_CHANNEL_ID=4rtza3
NEXT_PUBLIC_LUA_CLIENT_AGENT_ID=baseAgent_agent_1783981692495_we70afz23
NEXT_PUBLIC_LUA_CLIENT_CHANNEL_ID=lt132s
```

- `AGENT_API_KEY` is server-side: the CRM checks it against the `x-agent-key` header from
  **both** agents (fail-closed — with it unset, every agent call 401s).
- The two `CLIENT` vars fix the "Chat is not configured" fallback on `/talk-to-us`; the
  other two power the internal summarizer widget in the CRM shell.

## 2. Lua production env (per agent, via CLI — work account `shaurya@luaimplementation.ai`)

Point both agents at the deployed CRM instead of the cloudflare tunnel:

From `client_agent/`:

```
npx lua env production -k CRM_API_URL -v https://noble-stride.vercel.app/api/graphql
```

(its `CRM_AGENT_KEY` already holds the rotated key — no change)

From `summariser_agent/`:

```
npx lua env production -k CRM_API_URL -v https://noble-stride.vercel.app/api/graphql
npx lua env production -k CRM_AGENT_KEY -v <redacted — see local noblestride-crm/.env / rotation log>
```

(this is the deferred "summarizerAgent env refresh" — its stored key is the old dead one)

## 3. Lua dashboard (admin.heylua.ai) → allowed websites

Each webchat channel needs the Vercel origin:

- Channel `lt132s` (clientAgent): add `https://noble-stride.vercel.app` — done 2026-07-14.
- Channel `4rtza3` (summarizerAgent): add `https://noble-stride.vercel.app` as well, or the
  internal widget won't authenticate from the deployed CRM.

## Caveats

1. **Data destination follows Vercel's `DATABASE_URL`.** Once `CRM_API_URL` points at
   Vercel, intakes/summaries land in whatever database the Vercel deployment uses — not
   the local Docker DB. If Vercel should share data with local, they need the same
   database; otherwise expect the deployed DB to start empty.
2. **The webchat credits blocker is unresolved.** Even fully configured, both browser
   widgets may still stream "This agent has run out of credits" — open Lua platform
   issue (ticket with Lua support), not config. `npx lua chat -e production` remains the
   working verification path.
3. **Switching `CRM_API_URL` breaks the local-demo path** — the deployed agents stop
   writing to the local DB through the tunnel. If a demo runs against localhost, do
   step 2 *after* the demo, or flip the URL back beforehand.
4. Env changes via `npx lua env` take effect on the deployed agent without a re-promote;
   only the Vercel side needs a rebuild.
