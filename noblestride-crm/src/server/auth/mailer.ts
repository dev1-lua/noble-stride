// Mail abstraction (spec §3 non-goal: no SMTP yet). ConsoleMailer logs the
// message so reset links are usable in dev. Swap the export for a real
// implementation (Resend/SMTP) without touching callers.

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export async function sendMail(msg: MailMessage): Promise<void> {
  console.log(`\n[mailer] To: ${msg.to}\n[mailer] Subject: ${msg.subject}\n[mailer] ${msg.text}\n`);
}
