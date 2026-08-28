#!/usr/bin/env bash
# CRM Agent — live QC. Offline: no database, no network, no deployment needed.
# Usage:  bash crm_agent/qc/run.sh
set -uo pipefail
QC="$(cd "$(dirname "$0")" && pwd)"
AGENT="$(dirname "$QC")"
ROOT="$(dirname "$AGENT")"
b() { printf "\n\033[1m%s\033[0m\n" "$1"; }
rc=0

b "== 1/3  Agent side: skills, tools, persona guardrails, staff gate, digest =="
( cd "$AGENT" && npx vitest run --reporter=dot 2>&1 | tail -5 ) || rc=1

b "== 2/3  CRM side: agent auth, write registry, write guards, read surface =="
( cd "$ROOT/noblestride-crm" && npx vitest run --reporter=dot \
    src/graphql/__tests__/agent-context.test.ts \
    src/graphql/__tests__/agent-read-surface.test.ts \
    src/server/services/__tests__/agent-write-registry.test.ts \
    src/server/services/__tests__/agent-write-preview.test.ts \
    src/server/domain/__tests__/agent-write-guards.test.ts 2>&1 | tail -5 ) || rc=1

b "== 3/3  What a first-time user actually gets back (the reported loop) =="
( cd "$AGENT" && npx tsx "$QC/gate-replay.ts" ) || rc=1

if [ $rc -eq 0 ]; then printf "\n\033[32mQC complete: both suites green.\033[0m\n\n"
else printf "\n\033[31mQC finished with failures above.\033[0m\n\n"; fi
exit $rc
