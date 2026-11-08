import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { applyTenantScope } from "./tenant-scope";

/**
 * Cliente Prisma limitado a uma organização. Toda a leitura/escrita em modelos
 * empresariais recebe organizationId forçado. Usar SEMPRE em serviços de tenant.
 */
export function tenantDb(organizationId: string, client: typeof prisma = prisma) {
  if (!organizationId) throw new Error("tenantDb requires an organizationId");
  return client.$extends(
    Prisma.defineExtension({
      name: "tenancy",
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            return query(applyTenantScope(model, operation, args as Record<string, unknown>, organizationId));
          },
        },
      },
    }),
  );
}

export type TenantDb = ReturnType<typeof tenantDb>;
