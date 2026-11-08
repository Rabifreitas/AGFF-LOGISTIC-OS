import { PrismaClient } from "@prisma/client";
import { ensurePlatform, syncRbac } from "./seed-core";

// Seed apenas com dados de sistema (RBAC + organização da plataforma + Super Admin).
// Sem dados fictícios.
const prisma = new PrismaClient();

async function main() {
  await syncRbac(prisma);
  const email = process.env.SEED_SUPERADMIN_EMAIL;
  const password = process.env.SEED_SUPERADMIN_PASSWORD;
  if (!email || !password) {
    console.warn("SEED_SUPERADMIN_EMAIL/PASSWORD not set — skipping Super Administrator creation.");
    return;
  }
  const { user } = await ensurePlatform(prisma, {
    email,
    password,
    name: process.env.SEED_SUPERADMIN_NAME ?? "Super Administrator",
  });
  console.info(`RBAC synced. Super Administrator: ${user.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
