// Replays the exact message shapes a first-time user types, through the REAL
// gateDecision() the deployed agent runs. Pure logic, no network, no CRM.
import { gateDecision, extractCredentials, type GateState } from "../src/processors/passphrase-gate";

const PASS = "noblestride2026";           // stand-in for TEAM_PASSPHRASE
const fresh: GateState = { verified: false };
const verifiedOnly: GateState = { verified: true };

const OUTCOME_MEANING: Record<string, string> = {
  challenge: "BLOCKED, re-sends the same staff-only challenge (this is the loop)",
  verify: "verified, then asks for the CRM email",
  verify_and_identify: "verified AND identified in one message",
  ask_email: "asks for the CRM email",
  try_identify: "looks the email up in the CRM",
  proceed: "reaches the agent and its tools",
  unconfigured: "fails closed, no passphrase configured",
  logout: "signs the user out of staff mode",
};

const rows: Array<[string, GateState, string]> = [
  ["How does this work?",                                    fresh, "a first-time user asking for help"],
  ["What can you do?",                                       fresh, "the capability question the persona answers in full"],
  ["What is the main function of this CRM?",                 fresh, "the client's own test question (F5.3)"],
  [`${PASS} james@noblestride.capital`,                      fresh, "passphrase + email, the documented happy path"],
  [`james@noblestride.capital ${PASS}`,                       fresh, "same, reversed order"],
  [`Hi, here is the passphrase ${PASS} james@noblestride.capital`, fresh, "ONE extra polite word added"],
  [`${PASS.toUpperCase()} james@noblestride.capital`,        fresh, "right passphrase, wrong case"],
  [` ${PASS}  `,                                             fresh, "passphrase alone, padded"],
  ["james@noblestride.capital",                              fresh, "email only, no passphrase"],
  ["james@noblestride.capital",                              verifiedOnly, "email after being verified"],
  ["summarize the Busoga transaction",                       verifiedOnly, "a real request before identifying"],
  ["log out",                                                verifiedOnly, "explicit logout"],
  ["how do I log out of the CRM?",                           verifiedOnly, "logout mentioned inside a question"],
];

const W = 58;
console.log(`\n\x1b[1mGate replay — what a user actually gets back\x1b[0m   (TEAM_PASSPHRASE = "${PASS}")\n`);
console.log(`\x1b[2m${"message typed".padEnd(W)} outcome\x1b[0m`);
console.log("\x1b[2m" + "-".repeat(W + 46) + "\x1b[0m");
let blocked = 0;
for (const [msg, state, note] of rows) {
  const outcome = gateDecision(state, msg, PASS);
  const reachesAgent = outcome === "proceed";
  const isLoop = outcome === "challenge";
  if (isLoop) blocked++;
  const colour = reachesAgent ? "\x1b[32m" : isLoop ? "\x1b[31m" : "\x1b[33m";
  const shown = msg.length > W - 4 ? msg.slice(0, W - 7) + "..." : msg;
  console.log(`"${shown}"`.padEnd(W) + `${colour}${outcome}\x1b[0m  \x1b[2m${OUTCOME_MEANING[outcome]}\x1b[0m`);
  console.log(`\x1b[2m${" ".repeat(2)}^ ${note}\x1b[0m`);
}
console.log(`\n\x1b[1mResult:\x1b[0m ${blocked} of ${rows.length} message shapes are answered with the identical challenge string.`);
console.log(`Only an EXACT match of the passphrase (case-sensitive, no extra words) opens the gate:`);
console.log(`  extractCredentials("Hi, here is ${PASS} a@b.com") -> ${JSON.stringify(extractCredentials(`Hi, here is ${PASS} a@b.com`))}`);
console.log(`  the gate compares rest === passphrase, so "Hi, here is" makes it fail.\n`);
