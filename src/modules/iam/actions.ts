"use server";

import { AuthError } from "next-auth";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
import { sendMail } from "@/lib/mail";
import { inviteEmail, resetEmail } from "@/lib/mail-templates";
import { getRequestMeta } from "@/lib/request-meta";
import { isLocale, LOCALE_COOKIE } from "@/i18n/config";
import { formToObject, fromZodError, toActionState, type ActionState } from "./action-result";
import { ROLE_DEFINITIONS, isRoleKey } from "./permissions";
import {
  acceptInviteNewUserSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  inviteSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "./schemas";
import { getActorContext, getCurrentSession } from "./session-context";
import { acceptInviteAsExistingUser, acceptInviteAsNewUser, createInvite, revokeInvite } from "./services/invite.service";
import { changeMemberRole, setMemberStatus } from "./services/member.service";
import { changePassword, requestPasswordReset, resetPassword } from "./services/password.service";
import { registerOrganization } from "./services/registration.service";
import { revokeAllUserSessions, revokeSession, switchActiveOrganization } from "./services/session.service";
import { UnauthenticatedError } from "@/lib/errors";

async function actor() {
  const ctx = await getActorContext();
  if (!ctx) throw new UnauthenticatedError();
  return ctx;
}

async function signInOrError(email: string, password: string, redirectTo: string): Promise<ActionState> {
  try {
    await signIn("credentials", { email, password, redirectTo });
    return { ok: true };
  } catch (e) {
    if (e instanceof AuthError) {
      const code = (e as AuthError & { code?: string }).code ?? "invalid_credentials";
      return { ok: false, error: `login.errors.${code}` };
    }
    throw e;
  }
}

export async function loginAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse(formToObject(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  const next = String(formData.get("next") || "/app");
  return signInOrError(parsed.data.email, parsed.data.password, next.startsWith("/") ? next : "/app");
}

export async function registerAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const raw = { ...formToObject(formData), acceptTerms: formData.get("acceptTerms") === "on" };
  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) return fromZodError(parsed.error);
  try {
    await registerOrganization(parsed.data, await getRequestMeta());
  } catch (e) {
    return toActionState(e);
  }
  return signInOrError(parsed.data.adminEmail, parsed.data.password, "/app/pending");
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}

export async function forgotPasswordAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = forgotPasswordSchema.safeParse(formToObject(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  const res = await requestPasswordReset(parsed.data.email, await getRequestMeta());
  if (res) await sendMail(resetEmail({ to: res.user.email, name: res.user.name, token: res.token, locale: res.user.locale }));
  // Resposta idêntica exista ou não o email (sem enumeração de contas).
  return { ok: true, message: "forgot.sent" };
}

export async function resetPasswordAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = resetPasswordSchema.safeParse(formToObject(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  try {
    await resetPassword(String(formData.get("token")), parsed.data.password, await getRequestMeta());
  } catch (e) {
    return toActionState(e);
  }
  redirect("/login?reset=1");
}

export async function changePasswordAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = changePasswordSchema.safeParse(formToObject(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  try {
    const ctx = await actor();
    await changePassword(ctx.userId, ctx.sessionId, parsed.data.currentPassword, parsed.data.password, await getRequestMeta());
    return { ok: true, message: "account.passwordChanged" };
  } catch (e) {
    return toActionState(e);
  }
}

export async function inviteAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = inviteSchema.safeParse(formToObject(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  try {
    const ctx = await actor();
    const { token, role } = await createInvite(ctx, parsed.data);
    await sendMail(
      inviteEmail({ to: parsed.data.email, organization: ctx.organizationName, role: role.name, token, inviter: ctx.name }),
    );
    revalidatePath("/app/team");
    return { ok: true, message: "team.inviteSent" };
  } catch (e) {
    return toActionState(e);
  }
}

export async function revokeInviteAction(formData: FormData) {
  await revokeInvite(await actor(), String(formData.get("inviteId")));
  revalidatePath("/app/team");
}

export async function changeRoleAction(formData: FormData) {
  const roleKey = String(formData.get("roleKey"));
  if (!isRoleKey(roleKey)) return;
  await changeMemberRole(await actor(), String(formData.get("membershipId")), roleKey);
  revalidatePath("/app/team");
}

export async function setMemberStatusAction(formData: FormData) {
  const status = formData.get("status") === "SUSPENDED" ? "SUSPENDED" : "ACTIVE";
  await setMemberStatus(await actor(), String(formData.get("membershipId")), status);
  revalidatePath("/app/team");
}

export async function acceptInviteNewUserAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = acceptInviteNewUserSchema.safeParse(formToObject(formData));
  if (!parsed.success) return fromZodError(parsed.error);
  const token = String(formData.get("token"));
  let email: string;
  try {
    const { user } = await acceptInviteAsNewUser(token, parsed.data, await getRequestMeta());
    email = user.email;
  } catch (e) {
    return toActionState(e);
  }
  return signInOrError(email, parsed.data.password, "/app");
}

export async function acceptInviteExistingUserAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const session = await getCurrentSession();
  if (!session) return { ok: false, error: "auth.required" };
  try {
    const { membership } = await acceptInviteAsExistingUser(String(formData.get("token")), session.userId, await getRequestMeta());
    await switchActiveOrganization(session.id, session.userId, membership.organizationId);
  } catch (e) {
    return toActionState(e);
  }
  redirect("/app");
}

export async function switchOrganizationAction(formData: FormData) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  await switchActiveOrganization(session.id, session.userId, String(formData.get("organizationId")));
  redirect("/app");
}

export async function revokeSessionAction(formData: FormData) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  await revokeSession(session.userId, String(formData.get("sessionId")), await getRequestMeta());
  revalidatePath("/account");
}

export async function revokeOtherSessionsAction() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  await revokeAllUserSessions(session.userId, session.id);
  revalidatePath("/account");
}

export async function setLocaleAction(formData: FormData) {
  const locale = String(formData.get("locale"));
  if (isLocale(locale)) (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 31_536_000, sameSite: "lax" });
  revalidatePath("/", "layout");
}

