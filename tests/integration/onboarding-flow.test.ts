import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { loadActorContext } from "@/modules/iam/context-loader";
import { authenticate } from "@/modules/iam/services/auth.service";
import { acceptInviteAsNewUser, createInvite } from "@/modules/iam/services/invite.service";
import { registerOrganization } from "@/modules/iam/services/registration.service";
import { transitionOrganization } from "@/modules/platform/services/platform.service";
import { PASSWORD, registrationInput, resetDatabase, superAdminContext } from "./helpers";

beforeEach(resetDatabase);

describe("registo → aprovação → convite → login", () => {
  it("percorre o fluxo completo de onboarding", async () => {
    // 1. Empresa regista-se (fica pendente)
    const { organization, user: admin } = await registerOrganization(registrationInput({ companyName: "Transportes Kwanza" }));
    expect(organization.status).toBe("PENDING_APPROVAL");

    // Enquanto pendente, o admin entra mas não tem permissões
    const pendingLogin = await authenticate(admin.email, PASSWORD);
    expect(pendingLogin.ok).toBe(true);
    const pendingCtx = await loadActorContext(admin.id, organization.id);
    expect(pendingCtx?.permissions.size).toBe(0);

    // Super Admin foi notificado
    const sa = await superAdminContext();
    expect(await prisma.notification.count({ where: { userId: sa.userId, type: "organization.pending_approval" } })).toBe(1);

    // 2. Admin da plataforma aprova
    const { organization: approved } = await transitionOrganization(sa, organization.id, "approve");
    expect(approved.status).toBe("ACTIVE");
    expect(approved.approvedById).toBe(sa.userId);

    // 3. Company Administrator convida um Logistics Manager
    const companyCtx = await loadActorContext(admin.id, organization.id);
    expect(companyCtx?.permissions.has("iam.members.invite")).toBe(true);
    const { token, invite } = await createInvite(companyCtx!, { email: "gestor@kwanza.test", roleKey: "LOGISTICS_MANAGER" });
    expect(invite.organizationId).toBe(organization.id);
    expect(invite.tokenHash).not.toBe(token);

    // 4. Convidado aceita e faz login
    const { user: manager } = await acceptInviteAsNewUser(token, { name: "Gestor", password: PASSWORD });
    const login = await authenticate("gestor@kwanza.test", PASSWORD);
    expect(login.ok).toBe(true);
    if (!login.ok) return;
    expect(login.organizationId).toBe(organization.id);
    const managerCtx = await loadActorContext(manager.id, organization.id);
    expect(managerCtx?.roleKey).toBe("LOGISTICS_MANAGER");

    // Convite é de uso único
    await expect(acceptInviteAsNewUser(token, { name: "Outro", password: PASSWORD })).rejects.toThrow();

    // Histórico de acessos registado
    expect(await prisma.accessLog.count({ where: { userId: manager.id, event: "LOGIN_SUCCESS" } })).toBe(1);

    // Auditoria cobre todo o fluxo
    const actions = (await prisma.auditLog.findMany({ where: { organizationId: organization.id } })).map((a) => a.action);
    expect(actions).toEqual(
      expect.arrayContaining(["organization.registered", "organization.approve", "invite.created", "invite.accepted", "membership.created"]),
    );
  });

  it("rejeita NIF ou email duplicados", async () => {
    await registerOrganization(registrationInput({ nif: "5000999999", adminEmail: "dup@x.test" }));
    await expect(registerOrganization(registrationInput({ nif: "5000999999" }))).rejects.toThrow("register.nifTaken");
    await expect(registerOrganization(registrationInput({ adminEmail: "dup@x.test" }))).rejects.toThrow("register.emailTaken");
  });

  it("bloqueia a conta após 5 tentativas falhadas", async () => {
    const { user } = await registerOrganization(registrationInput());
    for (let i = 0; i < 5; i++) await authenticate(user.email, "wrong-password");
    const res = await authenticate(user.email, PASSWORD);
    expect(res).toEqual({ ok: false, code: "temporarily_locked" });
    expect(await prisma.accessLog.count({ where: { userId: user.id, event: "ACCOUNT_LOCKED" } })).toBe(1);
  });

  it("organização suspensa perde todas as permissões", async () => {
    const { organization, user } = await registerOrganization(registrationInput());
    const sa = await superAdminContext();
    await transitionOrganization(sa, organization.id, "approve");
    await transitionOrganization(sa, organization.id, "suspend", "Documentação em falta");
    const ctx = await loadActorContext(user.id, organization.id);
    expect(ctx?.organizationStatus).toBe("SUSPENDED");
    expect(ctx?.permissions.size).toBe(0);
  });
});
