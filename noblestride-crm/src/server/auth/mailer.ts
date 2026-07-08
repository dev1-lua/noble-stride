// Mail abstraction. Resend when RESEND_API_KEY is set, else ConsoleMailer that
// logs the message so codes/links are usable in dev. Callers are unchanged.
// PROD: set RESEND_API_KEY + a verified RESEND_FROM before shipping.

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export function mailProvider(): "resend" | "console" {
  return process.env.RESEND_API_KEY ? "resend" : "console";
}

export function buildResendPayload(msg: MailMessage, from: string) {
  return { from, to: [msg.to], subject: msg.subject, text: msg.text };
}

export async function sendMail(msg: MailMessage): Promise<void> {
  if (mailProvider() === "console") {
    console.log(`\n[mailer] To: ${msg.to}\n[mailer] Subject: ${msg.subject}\n[mailer] ${msg.text}\n`);
    return;
  }
  const from = process.env.RESEND_FROM ?? "NobleStride <onboarding@resend.dev>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildResendPayload(msg, from)),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Resend send failed (${res.status}): ${detail.slice(0, 200)}`);
  }
}
