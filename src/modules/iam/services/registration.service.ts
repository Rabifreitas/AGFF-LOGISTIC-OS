import { prisma } from "@/lib/db";
import { ConflictError } from "@/lib/errors";
import { hashPassword } from "@/lib/password";
import { recordAudit } from "@/modules/audit/audit.service";
import { notifyUsers, usersWithPermission } from "@/modules/notifications/notification.service";
import type { RegisterInput } from "../schemas";
import { getSystemRole } from "./roles";

/**
 * Registo de empresa: cria organização PENDING_APPROVAL + utilizador
 * Company Administrator. Notifica quem pode aprovar na plataforma.
 */
export async function registerOrganization(input: RegisterInput, meta: { ip?: string; userAgent?: string } = {}) {
  const [nifTaken, emailTaken] = await Promise.all([
    prisma.organization.findUnique({ where: { nif: input.nif } }),
    prisma.user.findUnique({ where: { email: input.adminEmail } }),
  ]);
  if (nifTaken) throw new ConflictError("register.nifTaken");
  if (emailTaken) throw new ConflictError("register.emailTaken");

  const passwordHash = await hashPassword(input.password);

  const result = await prisma.$transaction(async (tx) => {
    const role = await getSystemRole(tx, "COMPANY_ADMIN");
    const organization = await tx.organization.create({
      data: {
        name: input.companyName,
        legalName: input.legalName,
        nif: input.nif,
        type: input.organizationType,
        country: input.country,
        currency: input.currency,
        email: input.companyEmail,
        phone: input.companyPhone || null,
        status: "PENDING_APPROVAL",
      },
    });
    const user = await tx.user.create({
      data: { email: input.adminEmail, name: input.adminName, passwordHash, passwordChangedAt: new Date() },
    });
    const membership = await tx.membership.create({
      data: { userId: user.id, organizationId: organization.id, roleId: role.id },
    });
    const actor = { userId: user.id, organizationId: organization.id, ...meta };
    await recordAudit(tx, actor, {
      action: "organization.registered",
      entityType: "Organization",
      entityId: organization.id,
      after: organization,
    });
    await recordAudit(tx, actor, {
      action: "user.created",
      entityType: "User",
      entityId: user.id,
      after: { id: user.id, email: user.email, name: user.name },
    });
    await recordAudit(tx, actor, {
      action: "membership.created",
      entityType: "Membership",
      entityId: membership.id,
      after: { ...membership, roleKey: role.key },
    });
    return { organization, user };
  });

  const platform = await prisma.organization.findFirst({ where: { type: "PLATFORM" } });
  if (platform) {
    const approvers = await usersWithPermission(platform.id, "platform.organizations.approve");
    await notifyUsers(prisma, platform.id, approvers, {
      type: "organization.pending_approval",
      title: `Nova empresa para aprovação: ${result.organization.name}`,
      body: `NIF ${result.organization.nif}`,
      link: `/admin/organizations/${result.organization.id}`,
    });
  }
  return result;
}
