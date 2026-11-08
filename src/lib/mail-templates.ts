import { appUrl } from "./env";
import type { MailMessage } from "./mail";

type Locale = "pt-PT" | "en";
const pick = (locale: string | undefined): Locale => (locale === "en" ? "en" : "pt-PT");

export function inviteEmail(p: { to: string; organization: string; role: string; token: string; inviter: string; locale?: string }): MailMessage {
  const link = `${appUrl()}/invite/${p.token}`;
  return pick(p.locale) === "en"
    ? { to: p.to, subject: `Invitation to join ${p.organization} on AGFF Logistics OS`, text: `${p.inviter} invited you to join ${p.organization} as ${p.role}.\n\nAccept the invitation (valid for 7 days):\n${link}` }
    : { to: p.to, subject: `Convite para ${p.organization} no AGFF Logistics OS`, text: `${p.inviter} convidou-o para a empresa ${p.organization} com o perfil ${p.role}.\n\nAceite o convite (válido 7 dias):\n${link}` };
}

export function resetEmail(p: { to: string; name: string; token: string; locale?: string }): MailMessage {
  const link = `${appUrl()}/reset-password/${p.token}`;
  return pick(p.locale) === "en"
    ? { to: p.to, subject: "Reset your AGFF Logistics OS password", text: `Hello ${p.name},\n\nReset your password (valid for 60 minutes):\n${link}\n\nIf you did not request this, ignore this email.` }
    : { to: p.to, subject: "Recuperação de password — AGFF Logistics OS", text: `Olá ${p.name},\n\nDefina uma nova password (válido 60 minutos):\n${link}\n\nSe não pediu esta alteração, ignore este email.` };
}

export function organizationStatusEmail(p: { to: string; name: string; organization: string; status: string; reason?: string; locale?: string }): MailMessage {
  const pt: Record<string, string> = { ACTIVE: "aprovada", REJECTED: "rejeitada", SUSPENDED: "suspensa" };
  const en: Record<string, string> = { ACTIVE: "approved", REJECTED: "rejected", SUSPENDED: "suspended" };
  const reason = p.reason ? `\n\n${pick(p.locale) === "en" ? "Reason" : "Motivo"}: ${p.reason}` : "";
  return pick(p.locale) === "en"
    ? { to: p.to, subject: `${p.organization} was ${en[p.status] ?? p.status}`, text: `Hello ${p.name},\n\nYour company ${p.organization} was ${en[p.status] ?? p.status} on AGFF Logistics OS.${reason}\n\n${appUrl()}/login` }
    : { to: p.to, subject: `Empresa ${p.organization} ${pt[p.status] ?? p.status}`, text: `Olá ${p.name},\n\nA sua empresa ${p.organization} foi ${pt[p.status] ?? p.status} no AGFF Logistics OS.${reason}\n\n${appUrl()}/login` };
}
