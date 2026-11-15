import { beforeEach, describe, expect, it } from "vitest";
import type { ActorContext } from "@/modules/iam/rbac";
import { partnerSchema, verificationSchema } from "@/modules/mkt/schemas";
import {
  addVerification,
  createPartner,
  getPartner,
  reviewVerification,
  transitionPartner,
} from "@/modules/mkt/services/partner.service";
import { itemSchema, legSchema, shipmentSchema, stopSchema } from "@/modules/shp/schemas";
import {
  addItem,
  addLeg,
  addStop,
  createShipment,
  getShipment,
  removeLeg,
  transitionShipment,
  updateShipment,
} from "@/modules/shp/services/shipment.service";
import { prisma } from "@/lib/db";
import { createActiveCompany, resetDatabase } from "./helpers";

type Company = Awaited<ReturnType<typeof createActiveCompany>>;
let A: Company;
let B: Company;

const pickup = stopSchema.parse({ type: "PICKUP", address: "Fábrica, Viana", country: "AO" });
const port = stopSchema.parse({ type: "PORT", address: "Porto de Luanda", country: "AO" });
const delivery = stopSchema.parse({ type: "DELIVERY", address: "Armazém, Soyo", country: "AO" });
const item = itemSchema.parse({ description: "Contentor de equipamento", quantity: "1", cargoType: "CONTAINER" });
const leg = (o: Record<string, unknown>) => legSchema.parse({ origin: "Luanda", destination: "Soyo", ...o });

async function verified(ctx: ActorContext, o: Record<string, unknown>) {
  const p = await createPartner(ctx, partnerSchema.parse({ name: "Parceiro", country: "AO", ...o }));
  const v = await addVerification(ctx, p.id, verificationSchema.parse({ kind: "TRANSPORT_LICENSE" }));
  await reviewVerification(ctx, v.id, "APPROVED");
  await transitionPartner(ctx, p.id, "submit");
  return transitionPartner(ctx, p.id, "verify");
}

async function readyShipment(ctx: ActorContext, o: Record<string, unknown>) {
  const s = await createShipment(ctx, shipmentSchema.parse({ currency: "AOA", ...o }));
  await addStop(ctx, s.id, pickup);
  await addStop(ctx, s.id, port);
  await addStop(ctx, s.id, delivery);
  await addItem(ctx, s.id, item);
  return s;
}

beforeEach(async () => {
  await resetDatabase();
  A = await createActiveCompany();
  B = await createActiveCompany();
});

describe("Parceiros multimodais", () => {
  it("guarda modos e serviços (armador, estiva, armazém)", async () => {
    const line = await createPartner(
      A.ctx,
      partnerSchema.parse({ type: "SHIPPING_LINE", name: "Linha Atlântica", country: "AO", modes: ["SEA", "COASTAL"] }),
    );
    const stevedore = await createPartner(
      A.ctx,
      partnerSchema.parse({ type: "STEVEDORE", name: "Estiva Luanda", country: "AO", services: ["STEVEDORING"] }),
    );
    expect((await getPartner(A.ctx, line.id)).modes).toEqual(["SEA", "COASTAL"]);
    expect((await getPartner(A.ctx, stevedore.id)).services).toEqual(["STEVEDORING"]);
    await expect(
      createShipment(A.ctx, shipmentSchema.parse({ mode: "SEA", currency: "AOA", carrierPartnerId: stevedore.id })),
    ).rejects.toThrow("shp.carrierType");
  });
});

describe("Reserva por modo", () => {
  it("não reserva um transportador que não opera o modo da expedição", async () => {
    const trucker = await verified(A.ctx, { type: "TRANSPORTER", name: "Camiões" });
    const s = await readyShipment(A.ctx, { mode: "AIR", carrierPartnerId: trucker.id });
    await transitionShipment(A.ctx, s.id, "request");
    await expect(transitionShipment(A.ctx, s.id, "book")).rejects.toThrow("shp.carrierModeMismatch");

    const airline = await verified(A.ctx, { type: "AIRLINE", name: "Cargo Air" });
    const s2 = await readyShipment(A.ctx, {
      mode: "AIR",
      carrierPartnerId: airline.id,
      services: ["CUSTOMS_CLEARANCE"],
    });
    await transitionShipment(A.ctx, s2.id, "request");
    expect(await transitionShipment(A.ctx, s2.id, "book")).toBe("BOOKED");
    expect((await getShipment(A.ctx, s2.id)).services).toEqual(["CUSTOMS_CLEARANCE"]);
  });
});

describe("Pernas multimodais", () => {
  it("camião → navio → barcaça: valida modos, transportadores e bloqueia após reserva", async () => {
    const forwarder = await verified(A.ctx, { type: "FREIGHT_FORWARDER", name: "Transitário" });
    const trucker = await verified(A.ctx, { type: "TRANSPORTER", name: "Camiões" });
    const line = await verified(A.ctx, { type: "SHIPPING_LINE", name: "Linha" });
    const barge = await createPartner(
      A.ctx,
      partnerSchema.parse({ type: "BARGE_OPERATOR", name: "Barcaças Zaire", country: "AO" }),
    );
    const s = await readyShipment(A.ctx, { mode: "MULTIMODAL", carrierPartnerId: forwarder.id });

    await expect(addLeg(A.ctx, s.id, leg({ mode: "SEA", carrierPartnerId: trucker.id }))).rejects.toThrow(
      "shp.legCarrierModeMismatch",
    );
    await addLeg(A.ctx, s.id, leg({ mode: "ROAD", carrierPartnerId: trucker.id, vehiclePlate: "LD-12-34-AB" }));
    await transitionShipment(A.ctx, s.id, "request");
    await expect(transitionShipment(A.ctx, s.id, "book")).rejects.toThrow("shp.multimodalNeedsLegs");

    await addLeg(
      A.ctx,
      s.id,
      leg({ mode: "SEA", carrierPartnerId: line.id, vesselName: "Kianda", voyageNumber: "V12" }),
    );
    const bargeLeg = await addLeg(A.ctx, s.id, leg({ mode: "INLAND_WATERWAY", carrierPartnerId: barge.id }));
    await expect(transitionShipment(A.ctx, s.id, "book")).rejects.toThrow("shp.legCarrierNotVerified");
    await removeLeg(A.ctx, bargeLeg.id);

    expect(await transitionShipment(A.ctx, s.id, "book")).toBe("BOOKED");
    const booked = await getShipment(A.ctx, s.id);
    expect(booked.legs.map((l) => [l.sequence, l.mode])).toEqual([
      [1, "ROAD"],
      [2, "SEA"],
    ]);
    await expect(addLeg(A.ctx, s.id, leg({ mode: "ROAD" }))).rejects.toThrow("shp.notEditable");
    await expect(removeLeg(A.ctx, booked.legs[0]!.id)).rejects.toThrow("shp.notEditable");

    const audits = await prisma.auditLog.findMany({ where: { entityType: "ShipmentLeg" } });
    expect(audits.map((a) => a.action).sort()).toEqual([
      "shipment.leg.added",
      "shipment.leg.added",
      "shipment.leg.added",
      "shipment.leg.removed",
    ]);
  });

  it("pernas de expedições unimodais têm o mesmo modo, e o modo não muda com pernas diferentes", async () => {
    const s = await readyShipment(A.ctx, { mode: "MULTIMODAL" });
    await expect(
      addLeg(A.ctx, (await readyShipment(A.ctx, { mode: "ROAD" })).id, leg({ mode: "SEA" })),
    ).rejects.toThrow("shp.legModeMismatch");
    await addLeg(A.ctx, s.id, leg({ mode: "SEA" }));
    await expect(updateShipment(A.ctx, s.id, shipmentSchema.parse({ mode: "ROAD", currency: "AOA" }))).rejects.toThrow(
      "shp.legModeMismatch",
    );
  });

  it("empresa B não vê, adiciona nem remove pernas de A, nem usa transportadores de A", async () => {
    const line = await verified(A.ctx, { type: "SHIPPING_LINE", name: "Linha de A" });
    const s = await readyShipment(A.ctx, { mode: "SEA" });
    const l = await addLeg(A.ctx, s.id, leg({ mode: "SEA", carrierPartnerId: line.id }));
    await expect(addLeg(B.ctx, s.id, leg({ mode: "SEA" }))).rejects.toThrow();
    await expect(removeLeg(B.ctx, l.id)).rejects.toThrow();
    const sB = await readyShipment(B.ctx, { mode: "SEA" });
    await expect(addLeg(B.ctx, sB.id, leg({ mode: "SEA", carrierPartnerId: line.id }))).rejects.toThrow(
      "shp.carrierNotFound",
    );
    expect(await prisma.shipmentLeg.count({ where: { organizationId: B.organization.id } })).toBe(0);
  });
});
