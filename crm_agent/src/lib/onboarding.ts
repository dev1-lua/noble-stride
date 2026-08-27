// First-contact copy for the staff gate (F5.1, image19/image20).
//
// The client's own transcript shows a first-time user asking "how does this
// work" and "whats the main function of this CRM solomon@noblestride.capital"
// and getting the identical staff-only challenge five times. The gate had one
// answer for everything that was not the passphrase, so a reasonable question
// looked like a broken bot. These are the two replies it now sends instead:
// an explanation when someone asks for one, and an acknowledgement when an
// email arrives without the passphrase.
//
// EMOJI- AND DASH-FREE, deliberately. A preprocessor returning
// {action:"block"} short-circuits the pipeline, so format-normalizer (the
// postprocessor that repairs typographic dashes) never runs on these strings.
// Hyphens are allowed only inside email addresses, URLs and identifiers.

export const INTRO = `I am the Noblestride CRM assistant, an internal desk for the deal team.
I can brief you on any client, investor, mandate, transaction, engagement or partner, read the pipeline as a whole, and propose CRM updates that you confirm before anything is written.
Access is limited to Noblestride staff, so there is one verification step before I can answer.

Once you are verified you can ask things like:
1. What is the main function of this CRM?
2. How many opportunities are in the pipeline?
3. Summarize the Busoga transaction.`;

export const PASSPHRASE_EXPLAINER = `A team passphrase is one shared secret that Noblestride sets for this assistant. It is not your CRM login password, and I never send it to you.
A Noblestride admin sets it on the agent as the environment variable TEAM_PASSPHRASE and shares it with the deal team, so ask an admin or a colleague if you do not have it yet.
To verify, send the passphrase and your CRM login email in one message, for example: openSesame you@noblestride.capital
Say "log out" at any time to end your staff session.`;

export const HELP_REPLY = `${INTRO}\n\n${PASSPHRASE_EXPLAINER}`;

export function WELCOME_GUIDE(name: string): string {
  const who = name.trim() ? `Verified. Welcome, ${name.trim()}.` : "Verified. Welcome.";
  return `${who}
Ask me for a briefing on any record by name, and I will pull its status, recent activity, open items and risks.
Ask about the pipeline as a whole for totals, stalls and concentration, or tell me what to change and I will propose it first and write it only after your yes.

Try one of these:
1. What is the main function of this CRM?
2. How many opportunities are in the pipeline?
3. Which investors fit the Busoga transaction?`;
}

/**
 * An email arrived without the passphrase. Echo the address back so the person
 * can see it was read, and say what is still needed.
 *
 * It deliberately does NOT say whether the address belongs to a CRM user: the
 * gate is reachable by anyone who can open the chat, and confirming an address
 * would turn it into an account oracle.
 */
export function HINT_EMAIL_NO_PASSPHRASE(email: string): string {
  return `Thanks. I have your CRM email as ${email}, but I still need the team passphrase before I can answer.
The passphrase is a shared secret a Noblestride admin sets for this assistant, and it is separate from your CRM login. Ask an admin or a colleague if you do not have it.
Send it together with your email in one message, for example: openSesame ${email}
Reply "help" if you would like the full explanation first.`;
}

// Only the listed phrasings count. There is deliberately no bare "how"
// alternative, so "how many opportunities are in the pipeline" stays a real
// request rather than being answered with the guide.
//
// The "main function" / "what does this CRM do" alternatives are here because
// they are the client's OWN test question from image20 ("whats the main function
// of this CRM solomon@noblestride.capital"), which was one of the messages
// answered with the challenge five times. It asks what the assistant is for,
// which the explainer can answer without verifying anybody.
export const HELP_INTENT =
  /(^|\b)(help|how does (this|it) work|how do i (use|start|verify|get started)|what (can|do) you do|what is this|who are you|what are your capabilities|guide me|getting started|what(?:.?s| is)? (the )?main (function|purpose)|what (is|does) (this|the) (crm|assistant|agent|tracker)( do| for)?|what is a pass ?phrase|whats a pass ?phrase|what.s a pass ?phrase|where (do i|does one) (get|find) the pass ?phrase|how (is|was) the pass ?phrase (set|determined|chosen)|why do you need a pass ?phrase)(\b|$)/i;

export function isHelpRequest(text: string | undefined): boolean {
  return typeof text === "string" && text.trim().length > 0 && HELP_INTENT.test(text);
}

/**
 * Passphrase generation (G5). Verification used to be permanent, so rotating
 * TEAM_PASSPHRASE left everyone who had already verified still verified — the
 * rotation protected nobody. Bumping PASSPHRASE_VERSION alongside the phrase
 * re-challenges every existing session.
 */
export function currentPassphraseVersion(raw: string | undefined): string {
  const v = (raw ?? "").trim();
  return v === "" ? "1" : v;
}

/** Anyone verified before versioning existed counts as v1, so adding the variable signs nobody out. */
export function isVerifiedForVersion(
  verified: boolean,
  storedVersion: string | undefined,
  currentVersion: string,
): boolean {
  if (!verified) return false;
  return (storedVersion ?? "1") === currentVersion;
}
