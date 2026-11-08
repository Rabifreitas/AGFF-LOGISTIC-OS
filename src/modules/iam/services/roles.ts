import type { Prisma, PrismaClient } from "@prisma/client";
import { NotFoundError } from "@/lib/errors";
import type { RoleKey } from "../permissions";

type RoleReader = { role: Pick<PrismaClient["role"], "findFirst"> } | Prisma.TransactionClient;

export async function getSystemRole(db: RoleReader, key: RoleKey) {
  const role = await db.role.findFirst({ where: { key, organizationId: null } });
  if (!role) throw new NotFoundError(`Role ${key} not seeded`);
  return role;
}
