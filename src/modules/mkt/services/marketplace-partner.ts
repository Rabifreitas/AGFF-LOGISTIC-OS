import type { ProviderProfile } from "@prisma/client";
import { InvalidStateError } from "@/lib/errors";
import type { tenantDb } from "@/modules/tenancy/tenant-db";

type Tx = Parameters<Parameters<ReturnType<typeof tenantDb>["$transaction"]>[0]>[0];

export type MarketplaceProvider = {
  id: string;
  name: string;
  nif: string | null;
  country: string;
  email: string | null;
  phone: string | null;
  type: string;
};

/**
 * Garante que o prestador contratado no marketplace (leilão ou frete imediato) existe como parceiro
 * verificado do expedidor, com uma verificação MARKETPLACE válida até ao fim do perfil.
 * `tx` tem de estar no tenant do expedidor.
 */
export async function ensureMarketplacePartner(
  tx: Tx,
  input: {
    shipperOrganizationId: string;
    provider: MarketplaceProvider;
    profile: Pick<ProviderProfile, "modes" | "services" | "validUntil">;
    reviewedById: string;
    note: string;
    now: Date;
  },
) {
  const { provider, profile } = input;
  const existing = await tx.partner.findFirst({ where: { linkedOrganizationId: provider.id } });
  if (existing && (existing.status === "SUSPENDED" || existing.status === "REJECTED")) {
    throw new InvalidStateError("mkt.award.partnerBlocked");
  }
  const partnerData = { modes: profile.modes, services: profile.services, status: "VERIFIED" as const };
  const partner = existing
    ? await tx.partner.update({ where: { id: existing.id }, data: partnerData })
    : await tx.partner.create({
        data: {
          organizationId: input.shipperOrganizationId,
          linkedOrganizationId: provider.id,
          type: provider.type === "FREIGHT_FORWARDER" ? "FREIGHT_FORWARDER" : "TRANSPORTER",
          name: provider.name,
          nif: provider.nif,
          country: provider.country,
          email: provider.email,
          phone: provider.phone,
          ...partnerData,
        },
      });
  await tx.partnerVerification.create({
    data: {
      organizationId: input.shipperOrganizationId,
      partnerId: partner.id,
      kind: "MARKETPLACE",
      status: "APPROVED",
      reviewedById: input.reviewedById,
      reviewedAt: input.now,
      expiresAt: profile.validUntil,
      notes: input.note,
    },
  });
  return partner;
}
