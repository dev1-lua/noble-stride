// First-contact copy for the staff gate (F5.1, image19/image20).
//
// This desk used to answer every unverified visitor in "partner mode", which
// F5.6/image23 retired: partners now log in to the Noblestride partner portal.
// So the gate is a hard block, and these are the replies that make the block
// explicable rather than a wall: an explanation when someone asks for one, and
// an acknowledgement when an email arrives without the passphrase, both of
// which point a partner at the portal.
//
// EMOJI- AND DASH-FREE, deliberately. A preprocessor returning
// {action:"block"} short-circuits the pipeline, so format-normalizer (the
// postprocessor that repairs typographic dashes) never runs on these strings.
// Hyphens are allowed only inside email addresses, URLs and identifiers.

export const INTRO = `I am the Noblestride Referral Partner Tracker, an internal desk for the deal team.
I keep the referral record straight: who introduced which deal, how each partner relationship and fee share is set up, which introductions converted, and what fees are due.
Access is limited to Noblestride staff, so there is one verification step before I can answer. Referral partners do not use this assistant; partners see the status of the deals they introduced by logging in to the Noblestride partner portal.

Once you are verified you can ask things like:
1. Who introduced the Busoga mandate?
2. What has Acme Advisory referred?
3. Which partner brings the best deals?`;

export const PASSPHRASE_EXPLAINER = `A team passphrase is one shared secret that Noblestride sets for this assistant. It is not your CRM login password, and I never send it to you.
A Noblestride admin sets it on the agent as the environment variable TEAM_PASSPHRASE and shares it with the deal team, so ask an admin or a colleague if you do not have it yet.
To verify, send the passphrase on its own as your next message. I do not need your email here.
Say "log out" at any time to end your staff session.`;

export const HELP_REPLY = `${INTRO}\n\n${PASSPHRASE_EXPLAINER}`;

export function WELCOME_GUIDE(name: string): string {
  const who = name.trim() ? `Verified. Welcome, ${name.trim()}.` : "Verified. Welcome.";
  return `${who}
Ask me about any referral partner and I will give their introductions, linked deals, conversion and fee state.
Ask who introduced a named deal, or tell me a confirmed introduction, attribution or fee update and I will state exactly what changes and write it after your yes.

Try one of these:
1. Who introduced the Busoga mandate?
2. What has Acme Advisory referred?
3. Digest the referred deal pipeline for the last 30 days.`;
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
  return `Thanks. I can see the address ${email}, but this desk verifies with the team passphrase rather than an email address.
The passphrase is a shared secret a Noblestride admin sets for this assistant, and it is separate from your CRM login. Ask an admin or a colleague if you do not have it.
Send the passphrase on its own as your next message.
If you are a Noblestride referral partner rather than staff, log in to the Noblestride partner portal instead; that is where you see the deals you introduced.
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
