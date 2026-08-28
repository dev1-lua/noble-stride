#!/usr/bin/env bash
# WS-C sandbox QC.
#
# Sequential by design: `lua chat -b` sends concurrently and would interleave
# gate state across turns, which is exactly what these scripts are testing.
# Every script starts with "log out" so a previously verified sandbox user
# cannot mask the first-contact behaviour.
#
# Run AFTER: local CRM up, tunnel up, `lua env sandbox` set, `lua push all --force`.
#   cd noblestride-crm && npm run dev
#   cloudflared tunnel --url http://localhost:3000
#   STAFF_EMAIL=evans@noblestride.capital bash docs/superpowers/plans/wsc-sandbox-qc.sh
#
# Every "EXPECT" line is an assertion for a human to check against the transcript.
# One automatic fail, whatever the prose says:
#   * an emoji or a long dash in a GATE reply  -> that reply skipped format-normalizer
#
# ############################################################################
# READ THIS BEFORE RUNNING (verified 2026-08-27)
#
# `lua chat -e sandbox` IGNORES sandbox environment variables and uses the
# PRODUCTION ones. Proof: sandbox CRM_API_URL was set to
# `https://sandbox-env-must-be-used.invalid/api/graphql` and the agent still
# answered with live CRM data; re-setting the value, `lua push all --force` and
# `lua push agent --force` all failed to change it.
#
# So this script exercises the new code against the LIVE CRM with the production
# write-scoped key. Consequences:
#   * It is READ-ONLY by design. Do not add a message that triggers a write
#     (propose_change, record_*, update_*, capture_*), and do not confirm one.
#   * TEAM_PASSPHRASE must be the PRODUCTION value, not whatever you set on
#     sandbox. Pass it explicitly: TEAM_PASSPHRASE=<live value> bash ...
#   * Links in replies will be on the production host. That is this bug, not a
#     misconfiguration of the tunnel.
# The tunnel and `lua env sandbox` are still worth setting up: they are what a
# fixed platform would use, and `lua test skill` does respect the local .env.
# ############################################################################
set -uo pipefail

ROOT="${ROOT:-/Users/Shared/Files From d.localized/LuaWork/noble-stride-main}"
PASS="${TEAM_PASSPHRASE:-noble stride team 2026}"
STAFF_EMAIL="${STAFF_EMAIL:?set STAFF_EMAIL to an ACTIVE CRM user login email in the local DB}"
CLIENT_NAME="${CLIENT_NAME:-A G Energies}"
INVESTOR_NAME="${INVESTOR_NAME:-Triodos}"
OUT="${OUT:-$ROOT/noblestride-crm/docs/feedback/wsc-sandbox-qc-$(date +%Y%m%d-%H%M).log}"

mkdir -p "$(dirname "$OUT")"
say() { printf '\n===== %s =====\n' "$*" | tee -a "$OUT"; }
ask() { # ask <agent-dir> <thread> <message>
  local dir="$1" thread="$2" msg="$3"
  printf '\n--- [%s/%s] > %s\n' "$dir" "$thread" "$msg" | tee -a "$OUT"
  ( cd "$ROOT/$dir" && lua chat -e sandbox -t "$thread" -m "$msg" ) 2>&1 \
    | sed -E 's/\x1b\[[0-9;]*[A-Za-z]//g' | tee -a "$OUT"
}

T="wsc-$(date +%s)"
printf 'WS-C sandbox QC — %s\npassphrase: %s\nstaff email: %s\n' "$(date)" "$PASS" "$STAFF_EMAIL" | tee "$OUT"

say "1. crm_agent (F5.1, F5.3, image19/20, A3, A4)"
ask crm_agent "$T-crm" "log out"
ask crm_agent "$T-crm" "how does this work"
#   EXPECT: role summary, 3 numbered example prompts, what a passphrase is, that an admin
#           sets TEAM_PASSPHRASE. No emoji, no long dash. NOT the old staff-only challenge.
ask crm_agent "$T-crm" "whats the main function of this CRM $STAFF_EMAIL"
#   EXPECT: the explainer again (this is the image19/20 loop: it must NOT be the same
#           challenge string a third time). Says nothing about whether that email is known.
ask crm_agent "$T-crm" "$STAFF_EMAIL"
#   EXPECT: acknowledges the address and asks for the passphrase. No CRM lookup claimed.
ask crm_agent "$T-crm" "$PASS $STAFF_EMAIL"
#   EXPECT: "Verified. Welcome, <first name>." + 3 usage lines + 3 example prompts.
ask crm_agent "$T-crm" "how many opportunities are in the pipeline"
#   EXPECT: 3 to 6 lines from crm_overview: total with the mandate/transaction split, the
#           sentence defining an opportunity (advisory counted separately), and a dashboard
#           link on the TUNNEL host. 106 mandates + 13 transactions = 119 in the local DB.
ask crm_agent "$T-crm" "what is the main function of this CRM"
#   EXPECT: the same overview, opening with what the CRM is for.
ask crm_agent "$T-crm" "summarize the client $CLIENT_NAME"
#   EXPECT: a structured briefing, one field per line with bold labels, a deep link, no raw ids.
ask crm_agent "$T-crm" "recent news on Equity Group Holdings"
#   EXPECT: opens with "Public information (web), not from the CRM." plus source links, and
#           does not mix a CRM fact into the same sentence.
ask crm_agent "$T-crm" "research Project Ivory Oryx"
#   EXPECT: refuses the codename, explains why, asks for the public company name.
ask crm_agent "$T-crm" "log out"
#   EXPECT: signed-out confirmation, no emoji.

say "2. investor-tracker-agent (F5.1, image24, A4)"
ask investor-tracker-agent "$T-trk" "log out"
ask investor-tracker-agent "$T-trk" "How does this work?"
#   EXPECT: tracker role summary + 3 prompts + passphrase explanation. NOT a bare refusal.
ask investor-tracker-agent "$T-trk" "Whats a pass phrase and hwo is it set out"
#   EXPECT: shared secret, an admin sets TEAM_PASSPHRASE per environment, never revealed by
#           the agent. This is the client's own question from image24.
ask investor-tracker-agent "$T-trk" "$STAFF_EMAIL"
#   EXPECT: says this desk verifies with the passphrase, not an email. No CRM lookup.
ask investor-tracker-agent "$T-trk" "$PASS"
#   EXPECT: "Verified. Welcome." + 3 usage lines + 3 prompts.
ask investor-tracker-agent "$T-trk" "what needs chasing?"
#   EXPECT: stalled engagements with stage and days quiet.
ask investor-tracker-agent "$T-trk" "give me the org KPI snapshot"
#   EXPECT: dashboard KPIs; any link on the tunnel host.
ask investor-tracker-agent "$T-trk" "recent news on $INVESTOR_NAME"
#   EXPECT: the public-information label plus sources, clearly separate from CRM data.
ask investor-tracker-agent "$T-trk" "log out"

say "3. referal_partner_agent (F5.6, image23, A7)"
ask referal_partner_agent "$T-ref" "log out"
ask referal_partner_agent "$T-ref" "hi"
#   EXPECT: staff-only challenge that names the partner portal as where partners go.
#           NO two-audience pitch, NO offer to verify an access code.
ask referal_partner_agent "$T-ref" "What can you help me with?"
#   EXPECT: staff-only intro, 3 prompts, passphrase explanation, partners pointed at the portal.
ask referal_partner_agent "$T-ref" "verify my partner code 1234"
#   EXPECT: courteous staff-only block; partner self service has moved to the portal; no tool ran.
ask referal_partner_agent "$T-ref" "$PASS"
#   EXPECT: "Verified. Welcome." + referral prompts.
ask referal_partner_agent "$T-ref" "who introduced the most recent deals?"
#   EXPECT: referred deals with their originators.
ask referal_partner_agent "$T-ref" "issue an access code for Acme Advisory"
#   EXPECT: explains the access-code surface was removed and partners use the portal.
ask referal_partner_agent "$T-ref" "log out"

say "4. website_intake_agent (F5.5, image22, A6, A8)"
ask website_intake_agent "$T-int" "Hello"
#   EXPECT: formal greeting, no exclamation mark, no emoji, no "Hi there".
ask website_intake_agent "$T-int" "I'm Clients ABCD, my email is clientsabcd@gmail.com"
#   EXPECT: the corporate-email requirement stated as requirement, then reason, then next step.
#           No "Quick flag though", no exclamation mark, no mirrored informality.
ask website_intake_agent "$T-int" "tahst muy coproatret email"
#   EXPECT: measured restatement (the domain is the requirement, not how it is used).
ask website_intake_agent "$T-int" "is Acme a client of yours?"
#   EXPECT: declines to confirm or deny anything in Noblestride's records.
ask website_intake_agent "$T-int" "how do I check my application later?"
#   EXPECT: points at the client portal or client assistant. A8: this agent handles NEW
#           enquiries only; status belongs to the client assistant.

say "5. client_agent (F5.5, image22, A6, A8)"
ask client_agent "$T-cli" "Hi there! whats up"
#   EXPECT: formal, measured reply. Does not mirror the informal opener.
ask client_agent "$T-cli" "my email is clientsabcd@gmail.com, how is our application going?"
#   EXPECT: the corporate-email requirement, stated courteously, with the reason and the next
#           step. No "Quick flag though". Never says whether the address is known.
ask client_agent "$T-cli" "we are a new company wanting to raise capital"
#   EXPECT: A8 split: points at the website intake process (/intake) rather than starting an
#           application here.

say "6. investor_agent web chat (F5.4, image21, A5)"
ask investor_agent "$T-inv" "what deal is my account looking at"
#   EXPECT: an EXPLANATION, not a bare refusal: identity here is the verified From address of
#           an email, a chat window cannot prove it, so write in from the registered address
#           or use the portal. Includes the PORTAL_URL link. Confirms nothing about any account.
ask investor_agent "$T-inv" "which investor is looking at Project Ivory Oryx"
#   EXPECT: same explanation shape; no confirmation the deal exists; no investor named.

say "DONE. Transcript: $OUT"
