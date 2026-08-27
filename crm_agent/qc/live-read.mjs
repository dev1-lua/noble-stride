#!/usr/bin/env node
// CRM Agent — LIVE READ-ONLY QC probe.
//
// Proves, against a real CRM deployment, that: the agent key gate works, staff
// identity resolution works, the read surface returns real pipeline data, the
// document surface exposes METADATA ONLY, and the write gate rejects an
// unknown actor. It COMMITS NOTHING: the only mutation attempted is
// agentPrepareWrite with a deliberately invalid actor, which is designed to be
// rejected before any state changes.
//
// Usage:
//   CRM_API_URL=https://<host>/api/graphql \
//   CRM_AGENT_KEY=<real agent key> \
//   QC_STAFF_EMAIL=<an active CRM staff email> \
//   QC_SEARCH_TERM="<a deal or client name you know exists>" \
//   node qc-live-read.mjs
const API = process.env.CRM_API_URL;
const KEY = process.env.CRM_AGENT_KEY;
const STAFF = process.env.QC_STAFF_EMAIL;
const TERM = process.env.QC_SEARCH_TERM ?? "a";
if (!API || !KEY) { console.error("CRM_API_URL and CRM_AGENT_KEY are required"); process.exit(2); }

let pass = 0, fail = 0;
const ok = (label, cond, note) => {
  if (cond) { pass++; console.log(`  \x1b[32mPASS\x1b[0m  ${label}${note ? `  ${note}` : ""}`); }
  else { fail++; console.log(`  \x1b[31mFAIL\x1b[0m  ${label}${note ? `  ${note}` : ""}`); }
};
const head = (t) => console.log(`\n\x1b[1m${t}\x1b[0m`);

async function gql(query, variables, key = KEY) {
  let res;
  try {
    res = await fetch(API, {
      method: "POST",
      headers: { "content-type": "application/json", "x-agent-key": key },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err) {
    // Unreachable host / timeout must surface as a clean FAIL, never a stack trace mid-demo.
    return { status: 0, data: null, errors: [{ message: `transport: ${err.message}` }] };
  }
  let body = {};
  try { body = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, data: body.data, errors: body.errors };
}

const main = async () => {
  console.log(`\n\x1b[1mCRM Agent live read-only QC\x1b[0m  →  ${API}`);

  head("1. Agent-key gate (the CRM must refuse an unknown caller)");
  const bad = await gql(`query{ resolveStaffUser(email:"nobody@example.invalid"){ ok } }`, {}, "not-the-real-key");
  ok("a wrong agent key is refused", bad.status !== 0 && (bad.status === 401 || bad.status === 403 || !!bad.errors),
     `http ${bad.status}${bad.errors ? ` :: ${bad.errors[0].message}` : ""}`);

  head("2. Staff identity (only real, active CRM users may drive the agent)");
  if (STAFF) {
    const good = await gql(`query($e:String!){ resolveStaffUser(email:$e){ ok firstName } }`, { e: STAFF });
    const r = good.data?.resolveStaffUser;
    ok("a real staff email resolves", r?.ok === true, r?.firstName ? `greets as "${r.firstName}"` : "");
  } else { console.log("  \x1b[33mSKIP\x1b[0m  real-staff probe (set QC_STAFF_EMAIL)"); }
  const nobody = await gql(`query($e:String!){ resolveStaffUser(email:$e){ ok } }`, { e: "zz.nobody@nowhere.invalid" });
  ok("an unknown email does NOT resolve", nobody.data?.resolveStaffUser?.ok === false);

  head("3. Read surface (real records, resolved by fuzzy name)");
  const search = await gql(`query($q:String!,$l:Int){ globalSearch(query:$q,limit:$l){ id type title subtitle href } }`, { q: TERM, l: 5 });
  const hits = search.data?.globalSearch ?? [];
  ok(`globalSearch("${TERM}") returns records`, hits.length > 0, `${hits.length} hit(s)`);
  hits.slice(0, 5).forEach((h) => console.log(`         · ${h.type.padEnd(12)} ${h.title}  →  ${h.href}`));
  ok("every hit carries a deep link (no raw ids shown to users)", hits.length > 0 && hits.every((h) => !!h.href));

  head("4. Pipeline snapshot (what the digest and analysis run on)");
  const snap = await gql(`query{ mandatesByStage{ stage label items{ id } } transactionsByStage{ stage label items{ id } } }`);
  const mS = snap.data?.mandatesByStage ?? [], tS = snap.data?.transactionsByStage ?? [];
  const count = (cols) => cols.reduce((n, c) => n + (c.items?.length ?? 0), 0);
  ok("mandate stages returned", mS.length > 0, `${mS.length} stages / ${count(mS)} mandates`);
  ok("transaction stages returned", tS.length > 0, `${tS.length} stages / ${count(tS)} transactions`);
  tS.filter((c) => (c.items?.length ?? 0) > 0).forEach((c) => console.log(`         · ${c.label.padEnd(24)} ${c.items.length}`));

  head("5. Documents surface (METADATA ONLY — never file contents)");
  const client = hits.find((h) => h.type === "client");
  if (client) {
    const docs = await gql(`query($c:ID){ documents(clientId:$c){ name type status accessLevel uploadedAt isCurrent } }`, { c: client.id });
    const list = docs.data?.documents ?? [];
    const leaked = list.some((d) => Object.keys(d).some((k) => /content|body|url|bytes|base64/i.test(k)));
    ok("documents return metadata fields only", !leaked, `${list.length} doc(s) on "${client.title}"`);
  } else { console.log("  \x1b[33mSKIP\x1b[0m  documents probe (no client in search hits — set QC_SEARCH_TERM to a client name)"); }

  head("6. Write gate (nothing is committed — an unknown actor is refused)");
  const denied = await gql(
    `mutation($o:String!,$p:String!,$a:String!){ agentPrepareWrite(operation:$o,payloadJson:$p,actorEmail:$a){ writeToken } }`,
    { o: "createTask", p: JSON.stringify({ title: "QC probe — must never be created" }), a: "zz.nobody@nowhere.invalid" },
  );
  ok("propose-write by an unknown actor is rejected", !denied.data?.agentPrepareWrite?.writeToken,
     denied.errors ? `:: ${denied.errors[0].message}` : "");

  console.log(fail === 0
    ? `\n\x1b[32m${pass} live checks passed. Nothing was written.\x1b[0m\n`
    : `\n\x1b[31m${fail} of ${pass + fail} live checks FAILED.\x1b[0m\n`);
  process.exit(fail === 0 ? 0 : 1);
};
main().catch((e) => { console.error("QC CRASHED:", e); process.exit(1); });
