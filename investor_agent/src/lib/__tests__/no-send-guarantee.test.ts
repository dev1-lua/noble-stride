import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as queries from "../queries";

const __dirname = dirname(fileURLToPath(import.meta.url));

// The investor agent must NEVER be able to send/approve/reject outreach — those are
// human-only actions on the CRM side (spec §4.10, D7). This guards against a future
// change silently granting the agent send power.
//
// M5 scope note: the GraphQL-doc check below only covers a send capability introduced as
// a new mutation in queries.ts. A future send capability could just as easily be added as
// a Jobs.create closure or a webhook handler that never touches queries.ts at all — so this
// invariant is pinned to cover BOTH agent-side outreach write surfaces: the GraphQL layer
// (queries.ts) AND the source of the outreach code paths themselves (draft-runner.ts, the
// draft-outreach webhook), source-scanned for the same forbidden verbs.
const SEND_VERB_RE = /sendoutreach|approveoutreach|rejectoutreach|updateoutreachdraft/;

describe("no-send guarantee", () => {
  const allGraphql = Object.values(queries).join("\n").toLowerCase();

  it("only writes outreach via saveOutreachDrafts (drafts), never a send/approve/reject", () => {
    expect(allGraphql).toContain("saveoutreachdrafts");
    expect(allGraphql).not.toMatch(SEND_VERB_RE);
  });

  it("the outreach code paths (draft-runner, draft-outreach webhook) never reference a send/approve/reject verb", () => {
    const draftRunnerSrc = readFileSync(join(__dirname, "../draft-runner.ts"), "utf8").toLowerCase();
    const webhookSrc = readFileSync(
      join(__dirname, "../../webhooks/draft-outreach.webhook.ts"),
      "utf8",
    ).toLowerCase();

    // Sanity check the assertion isn't vacuous: draft-runner really does reference the
    // one permitted write (saveOutreachDrafts).
    expect(draftRunnerSrc).toContain("saveoutreachdrafts");

    expect(draftRunnerSrc).not.toMatch(SEND_VERB_RE);
    expect(webhookSrc).not.toMatch(SEND_VERB_RE);
  });
});
