# 02 — Creating a Skill

End-to-end: scaffold a project, add a tool, write its Zod schema and handler,
test it, and push it. We'll build a small **`crm-insights`** skill for the
Overview Agent as the running example.

> Commands shown with `--ci` are the non-interactive forms for AI IDEs / CI.
> Drop `--ci` to get interactive prompts locally.

---

## Step 0 — Install & authenticate

```bash
npm install -g lua-cli
lua auth configure          # email OTP, or paste an API key
# CI: export LUA_API_KEY=... ; commands take --ci
```

## Step 1 — Initialize the project

```bash
lua init                    # interactive: name the agent, pick org/model
# or: lua init --with-examples   # includes ~30 example tools to learn from
```

This scaffolds:

```
my-agent/
  src/index.ts        # the LuaAgent
  src/tools/          # tool classes
  src/skills/ src/webhooks/ src/jobs/ src/mcp/
  src/preprocessors/ src/postprocessors/
  lua.skill.yaml      # generated manifest — DO NOT hand-edit
  package.json  tsconfig.json  .env
```

If you used `--with-examples`, delete the template tools you don't need
(`rm src/tools/ProductsTool.ts`, etc.).

## Step 2 — Scaffold a tool

> **Doc ambiguity:** the public CLI overview says scaffolding happens only via
> `lua init` (no `lua new`); the `lua-agent-builder` plugin documents
> `lua new tool` to scaffold one primitive. If `lua new` exists in your CLI
> version, use it; otherwise just create the file by hand under `src/tools/`.

```bash
lua new tool        # if available: scaffolds src/tools/<Name>.ts with a Zod stub
```

## Step 3 — Write the tool (schema + handler)

`src/tools/GetPipelineOverviewTool.ts`:

```ts
import { LuaTool, env } from 'lua-cli';
import { z } from 'zod';

const GRAPHQL_URL = env('CRM_GRAPHQL_URL'); // e.g. https://crm.../api/graphql

export default class GetPipelineOverviewTool implements LuaTool {
  name = 'get_pipeline_overview';
  description = 'Summarize the current deal pipeline and headline CRM stats';

  // Zod schema = runtime validation + auto-typed input
  inputSchema = z.object({
    focus: z
      .enum(['mandates', 'transactions', 'all'])
      .optional()
      .default('all')
      .describe('Which part of the pipeline to summarize'),
  });

  async execute(input: z.infer<typeof this.inputSchema>) {
    const query = /* GraphQL */ `
      query Overview {
        dashboardStats {
          activeMandates { value }
          activeTransactions { value }
          investorsEngagedQtr { value }
          capitalRaisedYtd { value }
        }
        pipelineOverview {
          mandatesByStage { label count }
          transactionsByStage { label count }
        }
      }`;

    const res = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) throw new Error(`CRM GraphQL error: ${res.status} ${res.statusText}`);

    const { data, errors } = await res.json();
    if (errors?.length) throw new Error(errors[0].message);

    return {
      stats: data.dashboardStats,
      mandatesByStage: data.pipelineOverview.mandatesByStage.filter((s: any) => s.count > 0),
      transactionsByStage: data.pipelineOverview.transactionsByStage.filter((s: any) => s.count > 0),
    };
  }
}
```

Notes:
- The query mirrors the existing `dashboardStats` / `pipelineOverview` resolvers
  in `src/graphql/queries.ts`, so the tool reuses logic that already exists.
- Use `.describe()` on Zod fields — the text becomes part of the schema the model
  reads, improving tool-call accuracy.
- Throw on failure; the platform surfaces the error.

## Step 4 — Create the skill and register the tool

`src/index.ts`:

```ts
import { LuaAgent, LuaSkill } from 'lua-cli';
import GetPipelineOverviewTool from './tools/GetPipelineOverviewTool';
import AnswerCrmQuestionTool from './tools/AnswerCrmQuestionTool'; // see 03

const crmInsights = new LuaSkill({
  name: 'crm-insights',
  description: 'Read-only insight and Q&A over the NobleStride CRM pipeline.',
  context: [
    'Use get_pipeline_overview when the user asks about pipeline health, deal',
    'counts by stage, capital raised, or "how are we doing".',
    'Use answer_crm_question for natural-language questions about investors,',
    'mandates, or transactions. Always cite which data you used.',
  ].join(' '),
  tools: [new GetPipelineOverviewTool(), new AnswerCrmQuestionTool()],
});

export const agent = new LuaAgent({
  name: 'noblestride-overview-agent',
  persona:
    'You are NobleStride\'s overview analyst. You summarize the deal pipeline ' +
    'crisply, surface what needs attention, and answer questions about the CRM. ' +
    'Be concise and always ground claims in CRM data.',
  model: 'google/gemini-2.5-flash',
  skills: [crmInsights],
});
```

## Step 5 — Compile & test

```bash
lua compile                      # type-check + bundle (esbuild); --sync for non-interactive
lua test                         # pick a tool, enter input, runs in sandbox
# non-interactive:
lua test skill --name get_pipeline_overview --input '{"focus":"all"}'

lua chat                         # conversational test against the whole agent
lua chat -m "How is the pipeline doing?" -e sandbox   # one-shot
```

`lua test` validates against your Zod schema and runs `execute()` in a sandbox so
you see the exact JSON returned. `lua chat` exercises routing (does the model pick
the right tool for a natural-language request?).

## Step 6 — Set environment variables

Tools read secrets/config via `env('NAME')`. Set them per environment:

```bash
lua env sandbox    -k CRM_GRAPHQL_URL -v "https://crm-stg.noblestride/api/graphql"
lua env production -k CRM_GRAPHQL_URL -v "https://crm.noblestride/api/graphql"
```

## Step 7 — Push (and check drift first)

```bash
lua sync --check                 # exits non-zero if server/local drifted
lua push                         # interactive
# non-interactive: lua --ci push all --force
```

`lua push` compiles, validates, and uploads to the **sandbox** server. It does
**not** release to production.

## Step 8 — Deploy to production

```bash
lua deploy                       # interactive: pick primitive + version, confirm
# non-interactive: lua deploy --skill-name crm-insights --skill-version latest --force
```

Deploy promotes a specific version to production. Roll back with `lua version`.

## Recap of the loop

```
init → write tool (schema + handler) → register in skill → register skill in agent
     → compile → test / chat → env vars → sync --check → push → deploy
```
