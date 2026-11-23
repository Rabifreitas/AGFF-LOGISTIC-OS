/**
 * Dados de demonstração (fictícios) para apresentações: um expedidor, dois prestadores verificados com
 * frota e motoristas online em Luanda, um leilão aberto e uma corrida de frete imediato concluída.
 * Uso: DEMO_PASSWORD=... npm run seed:demo   (volte a correr antes da demo para refrescar as posições).
 */
import { PrismaClient } from "@prisma/client";
import { loadActorContext } from "../src/modules/iam/context-loader";
import type { ActorContext } from "../src/modules/iam/rbac";
import type { RoleKey } from "../src/modules/iam/permissions";
import { registerSchema } from "../src/modules/iam/schemas";
import { acceptInviteAsNewUser, createInvite } from "../src/modules/iam/services/invite.service";
import { registerOrganization } from "../src/modules/iam/services/registration.service";
import { auctionSchema, bidSchema, providerProfileSchema } from "../src/modules/mkt/auction-schemas";
import {
  createAuction,
  placeBid,
  reviewProviderProfile,
  saveProviderProfile,
  submitProviderProfile,
} from "../src/modules/mkt/services/auction.service";
import { ensureDefaultTariffs } from "../src/modules/odf/default-tariffs";
import { freightRequestSchema, vehicleSchema } from "../src/modules/odf/schemas";
import {
  advanceTrip,
  createFreightRequest,
  rateRequest,
  respondToOffer,
  saveVehicle,
  setDriverOnline,
} from "../src/modules/odf/services/freight.service";
import { transitionOrganization } from "../src/modules/platform/services/platform.service";
import { itemSchema, shipmentSchema, stopSchema } from "../src/modules/shp/schemas";
import { addItem, addStop, createShipment, transitionShipment } from "../src/modules/shp/services/shipment.service";
import { ensurePlatform, syncRbac } from "./seed-core";

const prisma = new PrismaClient();
const DOMAIN = "demo.agff.ao";
const SHIPPER_NIF = "5417000001";

type Company = { ctx: ActorContext; organizationId: string };

/** Motoristas de demonstração: posição perto do Porto de Luanda / Viana. */
const DRIVERS: { company: "t1" | "t2"; name: string; plate: string; category: string; lat: number; lng: number }[] = [
  { company: "t1", name: "Manuel Kiala", plate: "LD-24-61-AA", category: "CONTAINER_TRUCK", lat: -8.806, lng: 13.247 },
  { company: "t1", name: "Domingos Neto", plate: "LD-18-02-BB", category: "LIGHT_TRUCK_5T", lat: -8.84, lng: 13.24 },
  { company: "t1", name: "Joana Cassoma", plate: "LD-55-90-CC", category: "PICKUP_1_5T", lat: -8.83, lng: 13.25 },
  { company: "t2", name: "Paulo Sebastião", plate: "LD-77-13-DD", category: "CONTAINER_TRUCK", lat: -8.88, lng: 13.33 },
  { company: "t2", name: "Teresa Mbala", plate: "LD-31-48-EE", category: "TIPPER_BULK", lat: -8.9, lng: 13.37 },
  { company: "t2", name: "Rui Fernandes", plate: "LD-09-66-FF", category: "REEFER_10T", lat: -8.79, lng: 13.36 },
];

async function context(userId: string, organizationId: string) {
  const ctx = await loadActorContext(userId, organizationId);
  if (!ctx) throw new Error(`no context for ${userId}`);
  return ctx;
}

async function company(
  root: ActorContext,
  nif: string,
  name: string,
  type: "SHIPPER" | "TRANSPORTER",
  slug: string,
  password: string,
) {
  const { organization, user } = await registerOrganization(
    registerSchema.parse({
      companyName: name,
      legalName: `${name} Lda`,
      nif,
      organizationType: type,
      country: "AO",
      currency: "AOA",
      companyEmail: `geral@${slug}.${DOMAIN}`,
      companyPhone: "+244 923 000 000",
      adminName: `Admin ${name}`,
      adminEmail: `admin@${slug}.${DOMAIN}`,
      password,
      acceptTerms: true,
    }),
  );
  await transitionOrganization(root, organization.id, "approve");
  return { ctx: await context(user.id, organization.id), organizationId: organization.id };
}

async function member(c: Company, roleKey: RoleKey, email: string, name: string, password: string) {
  const { token } = await createInvite(c.ctx, { email, roleKey });
  const { user } = await acceptInviteAsNewUser(token, { name, password });
  return context(user.id, c.organizationId);
}

async function verifyProvider(root: ActorContext, c: Company, modes: string[], services: string[]) {
  const p = await saveProviderProfile(
    c.ctx,
    providerProfileSchema.parse({ modes, services, countries: "AO, CD, ZM, NA" }),
  );
  await submitProviderProfile(c.ctx);
  await reviewProviderProfile(root, p.id, { decision: "verify", validUntil: null, reason: null });
}

/** Antes de nova apresentação: fecha corridas de demo inacabadas e volta a pôr os motoristas online. */
async function refreshPresence() {
  const shipper = await prisma.organization.findFirstOrThrow({ where: { nif: SHIPPER_NIF } });
  const open = await prisma.freightRequest.findMany({
    where: { organizationId: shipper.id, status: { in: ["SEARCHING", "ACCEPTED", "AT_PICKUP", "IN_TRANSIT"] } },
    select: { id: true },
  });
  if (open.length) {
    const ids = open.map((r) => r.id);
    await prisma.freightOffer.updateMany({
      where: { requestId: { in: ids }, status: "PENDING" },
      data: { status: "EXPIRED" },
    });
    await prisma.freightRequest.updateMany({
      where: { id: { in: ids } },
      data: { status: "CANCELLED" },
    });
    console.info(`${open.length} corridas de demo inacabadas canceladas.`);
  }
  const users = await prisma.user.findMany({ where: { email: { endsWith: `@${DOMAIN}` }, vehicles: { some: {} } } });
  for (const u of users) {
    const d = DRIVERS.find((x) => u.email.startsWith(x.plate.toLowerCase()));
    if (!d) continue;
    await prisma.driverPresence.updateMany({
      where: { userId: u.id },
      data: { online: true, latitude: d.lat, longitude: d.lng, locatedAt: new Date() },
    });
  }
  console.info(`Posições de ${users.length} motoristas refrescadas.`);
}

async function main() {
  const password = process.env.DEMO_PASSWORD;
  if (!password) throw new Error("Defina DEMO_PASSWORD (mín. 12 caracteres) para criar as contas de demonstração.");
  if (process.env.NODE_ENV === "production" && process.env.DEMO_ALLOW_PRODUCTION !== "1") {
    throw new Error("Recusado em produção (defina DEMO_ALLOW_PRODUCTION=1 para um ambiente de demonstração).");
  }
  await syncRbac(prisma);
  await ensureDefaultTariffs(prisma);
  if (await prisma.organization.findFirst({ where: { nif: SHIPPER_NIF } })) {
    await refreshPresence();
    return;
  }
  const { user: rootUser, platform } = await ensurePlatform(prisma, {
    email: `plataforma@${DOMAIN}`,
    password,
    name: "AGFF Operações (demo)",
  });
  const root = await context(rootUser.id, platform.id);

  const shipper = await company(root, SHIPPER_NIF, "Kwanza Trading", "SHIPPER", "kwanza", password);
  const t1 = await company(root, "5417000002", "Trans Atlântico", "TRANSPORTER", "transatlantico", password);
  const t2 = await company(root, "5417000003", "Rota do Sul Transportes", "TRANSPORTER", "rotadosul", password);
  await verifyProvider(root, t1, ["ROAD", "RAIL"], ["TRANSPORT", "STEVEDORING", "CARGO_INSURANCE"]);
  await verifyProvider(root, t2, ["ROAD", "SEA"], ["TRANSPORT", "STEVEDORING", "CARGO_INSURANCE", "COLD_CHAIN"]);
  const logistics = await member(shipper, "LOGISTICS_MANAGER", `logistica@kwanza.${DOMAIN}`, "Ana Logística", password);

  const companies = { t1, t2 };
  const drivers: ActorContext[] = [];
  for (const d of DRIVERS) {
    const c = companies[d.company];
    const driver = await member(c, "DRIVER", `${d.plate.toLowerCase()}@${DOMAIN}`, d.name, password);
    await saveVehicle(
      c.ctx,
      vehicleSchema.parse({ plate: d.plate, category: d.category, driverUserId: driver.userId }),
    );
    await setDriverOnline(driver, true, { lat: d.lat, lng: d.lng });
    drivers.push(driver);
  }

  // Corrida concluída e avaliada (histórico, ganhos e TrustScore).
  const done = await createFreightRequest(
    logistics,
    freightRequestSchema.parse({
      category: "CONTAINER_TRUCK",
      pickupPlace: "LUANDA_PORT",
      pickupAddress: "Terminal Multiusos, Cais 4",
      dropoffPlace: "VIANA",
      dropoffAddress: "ZEE Luanda-Bengo, Armazém 12",
      cargoDescription: "Contentor 40' HC — material de construção",
      weightKg: "26500",
      containerType: "40HC",
      stevedores: "2",
      waybill: "on",
    }),
  );
  const offer = await prisma.freightOffer.findFirstOrThrow({ where: { requestId: done.id, status: "PENDING" } });
  const winner = drivers.find((d) => d.userId === offer.driverUserId)!;
  await respondToOffer(winner, offer.id, true);
  await advanceTrip(winner, done.id, "arrive");
  await advanceTrip(winner, done.id, "pickUp");
  await advanceTrip(winner, done.id, "deliver", { deliveryCode: done.deliveryCode });
  await rateRequest(logistics, done.id, { rating: 5, comment: "Pontual e cuidadoso." });
  await setDriverOnline(winner, true, { lat: DRIVERS[0].lat, lng: DRIVERS[0].lng });

  // Leilão aberto (Luanda → Lubumbashi) com uma proposta cega.
  const s = await createShipment(logistics, shipmentSchema.parse({ mode: "ROAD", currency: "USD" }));
  await addStop(
    logistics,
    s.id,
    stopSchema.parse({ type: "PICKUP", address: "Porto de Luanda", city: "Luanda", country: "AO" }),
  );
  await addStop(
    logistics,
    s.id,
    stopSchema.parse({ type: "DELIVERY", address: "Zona Industrial", city: "Lubumbashi", country: "CD" }),
  );
  await addItem(
    logistics,
    s.id,
    itemSchema.parse({ description: "Cátodos de cobre", quantity: "4", unit: "CNT", weightKg: "96000" }),
  );
  await transitionShipment(logistics, s.id, "request");
  const auction = await createAuction(
    logistics,
    auctionSchema.parse({
      shipmentId: s.id,
      closesAt: new Date(Date.now() + 48 * 3600_000).toISOString(),
      modes: ["ROAD", "RAIL"],
      services: ["TRANSPORT"],
      currency: "USD",
    }),
  );
  await placeBid(
    t1.ctx,
    auction.id,
    bidSchema.parse({
      amount: "18500",
      mode: "ROAD",
      transitDays: "9",
      validUntil: new Date(Date.now() + 10 * 86400_000).toISOString().slice(0, 10),
    }),
  );

  console.info(`Demo criada. Contas (password = DEMO_PASSWORD):
  Plataforma AGFF       plataforma@${DOMAIN}
  Expedidor             admin@kwanza.${DOMAIN} · logistica@kwanza.${DOMAIN}
  Prestador 1 (frota)   admin@transatlantico.${DOMAIN}
  Prestador 2 (frota)   admin@rotadosul.${DOMAIN}
  Motoristas            ${DRIVERS.map((d) => `${d.plate.toLowerCase()}@${DOMAIN}`).join(", ")}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
