# 01 — Lua Primitives

Reference for every Lua building block, with the **real schema shape** and a
minimal example of each, drawn from <https://docs.heylua.ai>. Everything is
plain TypeScript; tools use **Zod** for input schemas. There is no YAML to hand-
edit — `lua.skill.yaml` is generated from your code.

All primitives import from `lua-cli` (or `lua-cli/skill` for the in-tool runtime
helpers `AI` and `Agents`).

---

## 1. Agent — `LuaAgent`

The top-level assistant. Composes skills + optional webhooks/jobs/processors/MCP.

```ts
import { LuaAgent } from 'lua-cli';

export const agent = new LuaAgent({
  // required
  name: 'noblestride-assistant',
  persona: 'You are a capital-advisory analyst for NobleStride...',

  // optional
  skills:        [],   // LuaSkill[]
  webhooks:      [],   // LuaWebhook[]
  jobs:          [],   // LuaJob[]
  preProcessors: [],   // PreProcessor[]
  postProcessors:[],   // PostProcessor[]
  mcpServers:    [],   // LuaMCPServer[]
  model: 'google/gemini-2.5-flash',          // default; string or resolver fn
  modelSettings: { temperature: 0.2 },       // optional sampling params
});
```

- `persona` accepts a string or `{ base?, voice?, text? }` (per-channel tone).
- `model` can be a function `(request) => string` for dynamic model selection.
- All component arrays default to empty.

---

## 2. Skill — `LuaSkill`

A named bundle of related tools plus the `context` that tells the model when to
use them.

```ts
import { LuaSkill } from 'lua-cli';

const skill = new LuaSkill({
  name: 'deal-matching',                 // optional; lowercase-hyphen
  description: 'Match investors and find prospects for NobleStride deals.', // required
  context: 'Use match_investors_to_transaction when the user asks who to ' +
           'approach for a deal. Use find_prospects_for_mandate to surface ' +
           'candidate clients for a mandate.',                              // required
  tools: [/* new MatchInvestorsTool(), ... */],                            // optional
});

// also: skill.addTool(tool), skill.addTools([...])
```

`context` may also be `{ base?, voice?, text? }` to vary guidance by channel.

---

## 3. Tool — `LuaTool`

The unit of work. The interface (from the docs):

```ts
interface LuaTool<TInput extends ZodType = ZodType> {
  name: string;                                    // a-z A-Z 0-9 - _
  description: string;                             // one sentence; helps the model choose
  inputSchema: TInput;                             // a Zod schema
  execute: (input: z.infer<TInput>) => Promise<any>;  // returns JSON-serializable value
  condition?: () => Promise<boolean>;              // optional: hide tool dynamically
}
```

Minimal example:

```ts
import { LuaTool } from 'lua-cli';
import { z } from 'zod';

export default class GreetTool implements LuaTool {
  name = 'greet_user';
  description = 'Greet a user by name';

  inputSchema = z.object({
    name: z.string().describe('Person to greet'),
  });

  async execute(input: z.infer<typeof this.inputSchema>) {
    return { message: `Hello, ${input.name}!` };
  }
}
```

Inside `execute()` you can:
- `fetch()` any HTTP API (e.g. the CRM's `/api/graphql`).
- read secrets with `env('NAME')` (import `{ env } from 'lua-cli'`).
- generate text with `AI.generate(...)` (`import { AI } from 'lua-cli/skill'`).
- call another agent with `Agents.invoke(...)` (`import { Agents } from 'lua-cli/skill'`).
- read request context via `Lua.request` (`import { Lua } from 'lua-cli'`) — e.g.
  `Lua.request.channel` (`'web' | 'whatsapp' | 'api' | ...`).
- persist agent-owned state with the `Data` API (`import { Data } from 'lua-cli'`):
  `Data.create(collection, data, searchableText?)`, `Data.get(collection, filter, page, limit)`,
  `Data.getEntry(collection, id)`, `Data.update(collection, id, data)`,
  `Data.search(collection, query, limit, threshold)`.

---

## 4. Webhook — `LuaWebhook`

An inbound HTTP endpoint for external events. **No conversational context** —
you must resolve a user from the payload to message anyone.

```ts
import { LuaWebhook, User } from 'lua-cli';

const webhook = new LuaWebhook({
  name: 'deal-signed-webhook',
  description: 'React to an external "deal signed" event',
  execute: async (event) => {
    const { query, headers, body, timestamp } = event;   // WebhookEvent
    if (body?.type === 'deal.signed') {
      const user = await User.get(body.metadata?.ownerUserId);
      await user.send([{ type: 'text', text: '✅ Deal signed — engagement closing.' }]);
    }
    return { received: true };
  },
});

export default webhook;
```

---

## 5. Job — `LuaJob`

A scheduled task (cron or interval). Also has **no conversational context** —
carry IDs in `metadata` and resolve with `User.get(...)`.

```ts
import { LuaJob, User } from 'lua-cli';

const staleDealsDigest = new LuaJob({
  name: 'stale-deals-digest',
  description: 'Daily 9am digest of deals with no activity in 14 days',
  metadata: { userId: 'user_abc123' },
  schedule: { type: 'cron', expression: '0 9 * * *' },   // or { type:'interval', ... }
  execute: async (job) => {
    const user = await User.get(job.metadata.userId);
    await user.send([{ type: 'text', text: 'Daily stale-deals digest ready.' }]);
    return { success: true };
  },
});

export default staleDealsDigest;
```

Optional fields: `timeout`, `retry`, `activate`.

---

## 6. Preprocessor — `PreProcessor`

Runs **before** the model sees a message: filter, validate, route, or block.

```ts
import { PreProcessor } from 'lua-cli';

const guard = new PreProcessor({
  name: 'pii-guard',
  description: 'Block messages containing raw secrets',
  priority: 10,                                  // lower runs first
  execute: async (user, messages, channel) => {
    const bad = messages.some(m => m.type === 'text' && /api[_-]?key/i.test(m.text));
    return bad
      ? { action: 'block', response: 'Please do not paste credentials here.' }
      : { action: 'proceed' };                   // or { action:'proceed', modifiedMessage:[...] }
  },
});

export default guard;
```

Return `{ action: 'proceed' }` (optionally with `modifiedMessage` / `metadata`)
or `{ action: 'block', response }`.

## 7. Postprocessor — `PostProcessor`

Same shape, but runs **after** the model generates a response — use it to format
or enrich the reply before it reaches the user (e.g. append source citations, the
way `ask-bar.tsx` shows a `sources` list).

---

## 8. MCP server — `LuaMCPServer`

Connects an **external** tool surface (Model Context Protocol) to the agent. Pass
instances in the agent's `mcpServers` array.

```ts
import { LuaMCPServer, env } from 'lua-cli';

const crmMcp = new LuaMCPServer({
  name: 'noblestride-crm',
  transport: 'streamable-http',                  // or 'sse' (legacy)
  url: 'https://crm.noblestride.example/mcp',    // string or () => string
  headers: () => ({ Authorization: `Bearer ${env('CRM_MCP_TOKEN')}` }),
  timeout: 60000,                                // ms, optional
});
```

> NobleStride note: Twenty also *exposes itself* as an MCP server at `/mcp`
> (see `analysis/twenty-appsdk-and-ai.md` §4.4). If the CRM ever runs on Twenty,
> wiring `LuaMCPServer` to that `/mcp` endpoint gives the agent ~250 CRUD tools
> for free instead of writing each tool by hand. For the current bespoke
> Next.js CRM, prefer purpose-built tools that call the GraphQL API.

---

## Where each lives

`lua init` creates one directory per primitive type:

```
src/
  index.ts          # the LuaAgent (composition root)
  tools/            # LuaTool classes
  skills/           # LuaSkill instances (if you split them out)
  webhooks/         # LuaWebhook
  jobs/             # LuaJob
  preprocessors/    # PreProcessor
  postprocessors/   # PostProcessor
  mcp/              # LuaMCPServer configs
```

The runtime helpers split across two import paths:
- `lua-cli` — `LuaAgent, LuaSkill, LuaTool, LuaWebhook, LuaJob, PreProcessor,
  PostProcessor, LuaMCPServer, Data, User, Lua, env`
- `lua-cli/skill` — `AI, Agents` (used inside a tool's `execute()`)
