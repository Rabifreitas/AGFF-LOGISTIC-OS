import { prisma } from "@/lib/db";
import { loadActorContext } from "@/modules/iam/context-loader";
import type { RegisterInput } from "@/modules/iam/schemas";
import { registerOrganization } from "@/modules/iam/services/registration.service";
import { transitionOrganization } from "@/modules/platform/services/platform.service";
import { ensurePlatform, syncRbac } from "../../prisma/seed-core";

export const PASSWORD = "Sup3rSecret!pw";

export async function resetDatabase() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length) {
    await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"public"."${t.tablename}"`).join(", ")} CASCADE`);
  }
  await syncRbac(prisma);
  return ensurePlatform(prisma, { email: "root@agff.test", password: PASSWORD, name: "Root" });
}

export async function superAdminContext() {
  const platform = await prisma.organization.findFirstOrThrow({ where: { type: "PLATFORM" } });
  const user = await prisma.user.findUniqueOrThrow({ where: { email: "root@agff.test" } });
  const ctx = await loadActorContext(user.id, platform.id);
  if (!ctx) throw new Error("no super admin context");
  return ctx;
}

let seq = 0;
export function registrationInput(overrides: Partial<RegisterInput> = {}): RegisterInput {
  seq += 1;
  return {
    companyName: `Empresa ${seq}`,
    legalName: `Empresa ${seq} Lda`,
    nif: `5000${String(seq).padStart(6, "0")}`,
    organizationType: "SHIPPER",
    country: "AO",
    currency: "AOA",
    companyEmail: `geral${seq}@empresa.test`,
    companyPhone: "",
    adminName: `Admin ${seq}`,
    adminEmail: `admin${seq}@empresa.test`,
    password: PASSWORD,
    acceptTerms: true,
    ...overrides,
  };
}

/** Regista e aprova uma empresa; devolve o contexto do Company Administrator. */
export async function createActiveCompany(overrides: Partial<RegisterInput> = {}) {
  const { organization, user } = await registerOrganization(registrationInput(overrides));
  await transitionOrganization(await superAdminContext(), organization.id, "approve");
  const ctx = await loadActorContext(user.id, organization.id);
  if (!ctx) throw new Error("no company admin context");
  return { organization, user, ctx };
}
