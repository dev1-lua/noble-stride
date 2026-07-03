# 03 — Creating Tools (and reaching CRM data)

Tools are the only primitive that does real work. This guide covers the tool
anatomy, the two ways a tool reaches NobleStride data, and a complete, ready-to-
build tool spec: **`match_investors_to_transaction`**.

---

## Anatomy (recap)

```ts
import { LuaTool } from 'lua-cli';
import { z } from 'zod';

export default class MyTool implements LuaTool {
  name = 'snake_case_name';                 // a-z A-Z 0-9 - _
  description = 'One sentence the model uses to decide when to call this.';
  inputSchema = z.object({ /* ... */ });    // Zod — validation + types
  async execute(input: z.infer<typeof this.inputSchema>) {
    return { /* JSON-serializable */ };
  }
  // condition?(): Promise<boolean>          // optionally hide the tool at runtime
}
```

Rules of thumb:
- One tool = one verb. Don't overload.
- Put real guidance in `description` and Zod `.describe()` — the model only sees
  those strings.
- Return structured JSON, not prose; let the agent's persona narrate it.
- Throw `Error` on failure.

---

## How a tool reaches CRM data

### Option A — call the CRM's GraphQL API (recommended)

The CRM exposes everything at `POST /api/graphql` (`src/graphql/queries.ts`).
Reuse it instead of re-implementing logic. Pattern:

```ts
import { env } from 'lua-cli';

async function crmQuery<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(env('CRM_GRAPHQL_URL'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // add when the CRM endpoint is authenticated:
      // Authorization: `Bearer ${env('CRM_SERVICE_TOKEN')}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`CRM GraphQL ${res.status}: ${res.statusText}`);
  const { data, errors } = await res.json();
  if (errors?.length) throw new Error(errors.map((e: any) => e.message).join('; '));
  return data as T;
}
```

Store this helper once (e.g. `src/lib/crm.ts` in the agent project) and import it
into every tool.

### Option B — use Lua's `Data` API for agent-owned state

For state the **agent** owns (saved searches, conversation memory, a semantic
index of investor theses) — not the CRM's system-of-record data — use `Data`:

```ts
import { Data } from 'lua-cli';

await Data.create('saved_matches', { transactionId, matches }, /* searchable */ 'investor matches');
const recent = await Data.get('saved_matches', { transactionId }, 1, 10);
const similar = await Data.search('investor_theses', 'renewable energy West Africa', 5, 0.7);
```

> Decision rule: **system-of-record CRM data → GraphQL (Option A).
> Agent memory / semantic layers → `Data` (Option B).**

### In-tool AI generation

When a tool needs the model to draft text (e.g. a match rationale), use `AI`:

```ts
import { AI } from 'lua-cli/skill';

const rationale = await AI.generate(
  'You are a capital-advisory analyst. In one sentence, explain why this investor fits.',
  [{ type: 'text', text: `Investor: ${inv.name}. Reasons: ${reasons.join(', ')}` }],
);
```

---

## Worked example: `match_investors_to_transaction`

This replaces the seam at `aiMatchInvestors(transactionId)` in
`src/server/services/ai.ts` and is what `match-investors-button.tsx` ultimately
drives. The existing scoring logic lives in `src/server/domain/ranking.ts`
(sector 0.5 / geography 0.3 / ticket 0.2 + 0.1 actively-deploying bonus) and is
already exposed through the `aiMatchInvestors` GraphQL resolver — so the simplest,
most faithful tool just **calls that resolver** and returns its ranked output.

`src/tools/MatchInvestorsTool.ts`:

```ts
import { LuaTool, env } from 'lua-cli';
import { z } from 'zod';

const MATCH_QUERY = /* GraphQL */ `
  query MatchInvestors($transactionId: ID!) {
    aiMatchInvestors(transactionId: $transactionId) {
      id
      name
      score
      reasons
    }
  }`;

export default class MatchInvestorsTool implements LuaTool {
  name = 'match_investors_to_transaction';
  description =
    'Rank investors most likely to fund a given transaction, with a fit score and reasons.';

  inputSchema = z.object({
    transactionId: z.string().describe('The CRM transaction (deal) id to match against'),
    limit: z.number().int().min(1).max(20).optional().default(8)
      .describe('How many top matches to return'),
  });

  async execute(input: z.infer<typeof this.inputSchema>) {
    const res = await fetch(env('CRM_GRAPHQL_URL'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: MATCH_QUERY,
        variables: { transactionId: input.transactionId },
      }),
    });
    if (!res.ok) throw new Error(`CRM GraphQL ${res.status}: ${res.statusText}`);

    const { data, errors } = await res.json();
    if (errors?.length) throw new Error(errors[0].message);

    const matches = (data?.aiMatchInvestors ?? []).slice(0, input.limit);
    if (matches.length === 0) {
      return { transactionId: input.transactionId, matches: [], note: 'No matching investors found.' };
    }

    return {
      transactionId: input.transactionId,
      matches: matches.map((m: any) => ({
        investorId: m.id,
        name: m.name,
        scorePct: Math.round(m.score * 100),
        reasons: m.reasons,
      })),
    };
  }
}
```

**Tool spec summary**

| Field | Value |
|---|---|
| name | `match_investors_to_transaction` |
| input | `transactionId: string` (required), `limit: int 1–20` (default 8) |
| output | `{ transactionId, matches: [{ investorId, name, scorePct, reasons[] }] }` |
| data dependency | `aiMatchInvestors` resolver → `rankInvestorMatches` → `Investor`, `Transaction`, `Client.countries` |
| seam replaced | `ai.ts → aiMatchInvestors()` |

**Variant — `find_prospects_for_mandate`** is the same pattern against the
`aiFindProspects(mandateId)` resolver: input `mandateId: string`, output
`{ prospects: [{ name, sector, rationale }] }`, dependency `Mandate.sector` +
`Client`. (Drives `find-prospects-button.tsx`.)

---

## Pure-logic alternative (no resolver dependency)

If you'd rather not depend on the `aiMatchInvestors` resolver (e.g. you want the
agent to score with its own weights), fetch raw records and rank in the tool. The
scoring is a direct port of `ranking.ts`:

```ts
// fetch the transaction (with client.countries) and all investors via GraphQL,
// then:
function score(inv, txn) {
  let s = 0; const reasons = [];
  if (txn.sector.some(x => inv.sectorFocus.includes(x)))      { s += 0.5; reasons.push('Sector match'); }
  if ((txn.geography ?? []).some(g => inv.geographicFocus.includes(g))) { s += 0.3; reasons.push('Geography match'); }
  const okMin = inv.ticketMin == null || txn.targetRaise >= inv.ticketMin;
  const okMax = inv.ticketMax == null || txn.targetRaise <= inv.ticketMax;
  if (okMin && okMax) { s += 0.2; reasons.push('Ticket fits'); }
  if (inv.status === 'ActivelyDeploying') s += 0.1;
  return { score: Math.min(s, 1), reasons };
}
```

Prefer Option A (call the resolver) unless you have a reason to diverge — it keeps
one source of truth for scoring.

---

## Test it

```bash
lua compile
lua test skill --name match_investors_to_transaction --input '{"transactionId":"<id>","limit":5}'
lua chat -m "Who should we approach for the Acme transaction?" -e sandbox
```
