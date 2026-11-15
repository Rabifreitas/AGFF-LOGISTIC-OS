import type { AuctionStatus, ProviderStatus } from "@prisma/client";

export const AUCTION_MIN_MINUTES = 15;
export const AUCTION_MAX_DAYS = 30;

/** Janela de fecho permitida: entre 15 minutos e 30 dias a partir de agora. */
export function closesAtError(closesAt: Date, now = new Date()): string | null {
  const ms = closesAt.getTime() - now.getTime();
  if (ms < AUCTION_MIN_MINUTES * 60_000) return "mkt.auction.closesTooSoon";
  if (ms > AUCTION_MAX_DAYS * 86_400_000) return "mkt.auction.closesTooLate";
  return null;
}

type AuctionTiming = { status: AuctionStatus; closesAt: Date };

export function isBiddingOpen(a: AuctionTiming, now = new Date()) {
  return a.status === "OPEN" && a.closesAt > now;
}

/** Estado no fecho: com propostas fica CLOSED (aguarda adjudicação), sem propostas expira. */
export function closeOutcome(activeBids: number): AuctionStatus {
  return activeBids > 0 ? "CLOSED" : "EXPIRED";
}

export function effectiveAuctionStatus(a: AuctionTiming, activeBids: number, now = new Date()): AuctionStatus {
  return a.status === "OPEN" && a.closesAt <= now ? closeOutcome(activeBids) : a.status;
}

/** Leilão cego: o expedidor só vê as propostas depois do fecho. */
export function bidsVisibleToOwner(a: AuctionTiming, now = new Date()) {
  return a.status === "CLOSED" || a.status === "AWARDED" || (a.status === "OPEN" && a.closesAt <= now);
}

type ProviderLike = {
  status: ProviderStatus;
  modes: readonly string[];
  services: readonly string[];
  validUntil: Date | null;
};

export function isProviderActive(p: Pick<ProviderLike, "status" | "validUntil">, now = new Date()) {
  return p.status === "VERIFIED" && (!p.validUntil || p.validUntil > now);
}

/** Prestador verificado, que opera pelo menos um modo aceite e todos os serviços exigidos. */
export function providerEligibleFor(
  p: ProviderLike,
  a: { modes: readonly string[]; services: readonly string[] },
  now = new Date(),
) {
  return (
    isProviderActive(p, now) &&
    a.modes.some((m) => p.modes.includes(m)) &&
    a.services.every((s) => p.services.includes(s))
  );
}

export type ProviderTransition = "submit" | "verify" | "reject" | "suspend" | "reactivate";

const PROVIDER_TRANSITIONS: Record<ProviderTransition, { from: readonly ProviderStatus[]; to: ProviderStatus }> = {
  submit: { from: ["DRAFT", "REJECTED"], to: "PENDING" },
  verify: { from: ["PENDING"], to: "VERIFIED" },
  reject: { from: ["PENDING"], to: "REJECTED" },
  suspend: { from: ["VERIFIED"], to: "SUSPENDED" },
  reactivate: { from: ["SUSPENDED"], to: "VERIFIED" },
};

export const PROVIDER_REVIEW_TRANSITIONS = ["verify", "reject", "suspend", "reactivate"] as const;

export function nextProviderStatus(from: ProviderStatus, t: ProviderTransition): ProviderStatus | null {
  return PROVIDER_TRANSITIONS[t].from.includes(from) ? PROVIDER_TRANSITIONS[t].to : null;
}

export function availableProviderReviews(from: ProviderStatus) {
  return PROVIDER_REVIEW_TRANSITIONS.filter((t) => nextProviderStatus(from, t));
}

type SnapshotShipment = {
  plannedPickupAt: Date | null;
  plannedDeliveryAt: Date | null;
  stops: { type: string; city: string | null; country: string }[];
  items: {
    description: string;
    quantity: unknown;
    unit: string;
    weightKg: unknown;
    volumeM3: unknown;
    dangerousGoods: boolean;
    cargoType: string;
    containerType: string | null;
  }[];
};

const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));

/** Versão anonimizada que os prestadores vêem: cidades e países, datas e resumo da carga. Sem moradas nem contactos. */
export function buildAuctionSnapshot(s: SnapshotShipment) {
  const origin = s.stops.find((x) => x.type === "PICKUP") ?? s.stops[0];
  const destination = [...s.stops].reverse().find((x) => x.type === "DELIVERY") ?? s.stops[s.stops.length - 1];
  if (!origin || !destination || s.items.length === 0) return null;
  const weight = s.items.reduce((acc, i) => acc + num(i.weightKg), 0);
  const volume = s.items.reduce((acc, i) => acc + num(i.volumeM3), 0);
  const cargoSummary = s.items
    .map(
      (i) =>
        `${num(i.quantity)} ${i.unit} ${i.description.slice(0, 60)}${i.containerType ? ` (${i.containerType})` : ""}`,
    )
    .join("; ")
    .slice(0, 500);
  return {
    originCity: origin.city,
    originCountry: origin.country,
    destinationCity: destination.city,
    destinationCountry: destination.country,
    pickupFrom: s.plannedPickupAt,
    deliveryBy: s.plannedDeliveryAt,
    cargoSummary,
    totalWeightKg: weight > 0 ? weight : null,
    totalVolumeM3: volume > 0 ? volume : null,
    hazardous: s.items.some((i) => i.dangerousGoods || i.cargoType === "DANGEROUS"),
  };
}
