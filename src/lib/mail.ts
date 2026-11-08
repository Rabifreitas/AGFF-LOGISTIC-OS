import nodemailer, { type Transporter } from "nodemailer";

export type MailMessage = { to: string; subject: string; text: string; html?: string };

let transporter: Transporter | null = null;
export const sentMails: MailMessage[] = [];

function getTransporter(): Transporter | null {
  const mode = process.env.MAIL_TRANSPORT ?? (process.env.NODE_ENV === "test" ? "memory" : "smtp");
  if (mode !== "smtp") return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? "localhost",
      port: Number(process.env.SMTP_PORT ?? 1025),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined,
    });
  }
  return transporter;
}

export async function sendMail(message: MailMessage): Promise<void> {
  const t = getTransporter();
  if (!t) {
    sentMails.push(message);
    if (process.env.MAIL_TRANSPORT === "log") console.info("[mail]", message.to, message.subject, "\n" + message.text);
    return;
  }
  await t.sendMail({ from: process.env.MAIL_FROM ?? "no-reply@agff.local", ...message });
}
