import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/modules/audit/audit.service";
import { assertPermission, hasAnyPermission, type ActorContext } from "@/modules/iam/rbac";
import { ForbiddenError } from "@/lib/errors";

export const exchangeRateSchema = z.object({
  baseCurrency: z.string().trim().length(3).toUpperCase(),
  quoteCurrency: z.string().trim().length(3).toUpperCase(),
  rate: z.coerce.number().positive("validation.positive"),
  effectiveDate: z.coerce.date(),
  source: z.string().trim().max(100).optional(),
});
export type ExchangeRateInput = z.infer<typeof exchangeRateSchema>;

/** Taxas visíveis: referência da plataforma + taxas próprias da organização. */
export async function listExchangeRates(ctx: ActorContext) {
  if (!hasAnyPermission(ctx, ["exchange_rates.read", "platform.exchange_rates.manage"])) throw new ForbiddenError();
  return prisma.exchangeRate.findMany({
    where: { OR: [{ organizationId: null }, { organizationId: ctx.organizationId }] },
    orderBy: [{ effectiveDate: "desc" }, { baseCurrency: "asc" }],
    take: 200,
  });
}

async function upsertRate(ctx: ActorContext, organizationId: string | null, input: ExchangeRateInput) {
  return prisma.$transaction(async (tx) => {
    // O índice único não impede duplicados com organization_id NULL: serializa por par/data.
    const lockKey = `fx:${organizationId ?? "platform"}:${input.baseCurrency}:${input.quoteCurrency}:${input.effectiveDate.toISOString()}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
    const existing = await tx.exchangeRate.findFirst({
      where: {
        organizationId,
        baseCurrency: input.baseCurrency,
        quoteCurrency: input.quoteCurrency,
        effectiveDate: input.effectiveDate,
      },
    });
    const data = {
      organizationId,
      baseCurrency: input.baseCurrency,
      quoteCurrency: input.quoteCurrency,
      rate: new Prisma.Decimal(input.rate),
      effectiveDate: input.effectiveDate,
      source: input.source || null,
      createdById: ctx.userId,
    };
    const after = existing
      ? await tx.exchangeRate.update({ where: { id: existing.id }, data })
      : await tx.exchangeRate.create({ data });
    await recordAudit(tx, ctx, {
      organizationId,
      action: existing ? "exchange_rate.updated" : "exchange_rate.created",
      entityType: "ExchangeRate",
      entityId: after.id,
      before: existing,
      after,
    });
    return after;
  });
}

export async function setPlatformExchangeRate(ctx: ActorContext, input: ExchangeRateInput) {
  assertPermission(ctx, "platform.exchange_rates.manage");
  return upsertRate(ctx, null, input);
}

export async function setOrganizationExchangeRate(ctx: ActorContext, input: ExchangeRateInput) {
  assertPermission(ctx, "fin.exchange_rates.manage");
  return upsertRate(ctx, ctx.organizationId, input);
}

/** Taxa em vigor numa data: a da organização tem prioridade sobre a da plataforma. */
export async function resolveExchangeRate(organizationId: string, base: string, quote: string, date = new Date()) {
  if (base === quote) return new Prisma.Decimal(1);
  const find = (orgId: string | null) =>
    prisma.exchangeRate.findFirst({
      where: { organizationId: orgId, baseCurrency: base, quoteCurrency: quote, effectiveDate: { lte: date } },
      orderBy: { effectiveDate: "desc" },
    });
  const rate = (await find(organizationId)) ?? (await find(null));
  return rate?.rate ?? null;
}
