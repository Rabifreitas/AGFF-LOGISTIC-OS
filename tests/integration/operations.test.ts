import { beforeEach, describe, expect, it } from "vitest";
import { ForbiddenError, InvalidStateError, NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/db";
import { loadActorContext } from "@/modules/iam/context-loader";
import { acceptInviteAsNewUser, createInvite } from "@/modules/iam/services/invite.service";
import type { RoleKey } from "@/modules/iam/permissions";
import type { ActorContext } from "@/modules/iam/rbac";
import { partnerSchema, verificationSchema } from "@/modules/mkt/schemas";
import {
  addVerification,
  createPartner,
  getPartner,
  listPartners,
  reviewVerification,
  transitionPartner,
  updatePartner,
} from "@/modules/mkt/services/partner.service";
import { itemSchema, shipmentSchema, stopSchema } from "@/modules/shp/schemas";
import {
  addItem,
  addStop,
  createShipment,
  getShipment,
  listShipments,
  moveStop,
  removeItem,
  removeStop,
  transitionShipment,
  updateShipment,
} from "@/modules/shp/services/shipment.service";
import { createCostCenter } from "@/modules/org/services/org.service";
import { incidentSchema, trackingEventSchema } from "@/modules/trk/schemas";
import { listIncidents, openIncident, transitionIncident } from "@/modules/trk/services/incident.service";
import { listTrackingEvents, recordTrackingEvent } from "@/modules/trk/services/tracking.service";
import { createActiveCompany, PASSWORD, resetDatabase } from "./helpers";

type Company = Awaited<ReturnType<typeof createActiveCompany>>;
let A: Company;
let B: Company;

async function memberWithRole(company: Company, roleKey: RoleKey): Promise<ActorContext> {
  const email = `${roleKey.toLowerCase()}@${company.organization.id}.test`;
  const { token } = await createInvite(company.ctx, { email, roleKey });
  const { user } = await acceptInviteAsNewUser(token, { name: roleKey, password: PASSWORD });
  return (await loadActorContext(user.id, company.organization.id))!;
}

const partner = (o: Record<string, unknown> = {}) =>
  partnerSchema.parse({ type: "TRANSPORTER", name: "Trans Kwanza", country: "AO", ...o });
const shipment = (o: Record<string, unknown> = {}) => shipmentSchema.parse({ mode: "ROAD", currency: "AOA", ...o });
const pickup = stopSchema.parse({ type: "PICKUP", address: "Porto de Luanda", city: "Luanda", country: "AO" });
const delivery = stopSchema.parse({ type: "DELIVERY", address: "Zona Industrial", city: "Lobito", country: "AO" });
const item = itemSchema.parse({ description: "Tubagem de aço", quantity: "12", weightKg: "3400" });
const event = (code: string) => trackingEventSchema.parse({ code });

async function verifiedCarrier(ctx: ActorContext) {
  const p = await createPartner(ctx, partner());
  const v = await addVerification(ctx, p.id, verificationSchema.parse({ kind: "TRANSPORT_LICENSE" }));
  await reviewVerification(ctx, v.id, "APPROVED");
  await transitionPartner(ctx, p.id, "submit");
  return transitionPartner(ctx, p.id, "verify");
}

beforeEach(async () => {
  await resetDatabase();
  A = await createActiveCompany();
  B = await createActiveCompany();
});

describe("Parceiros e verificação", () => {
  it("cria, verifica e suspende um transportador com auditoria", async () => {
    const p = await createPartner(A.ctx, partner());
    expect(p.organizationId).toBe(A.organization.id);
    expect(p.status).toBe("DRAFT");

    await transitionPartner(A.ctx, p.id, "submit");
    await expect(transitionPartner(A.ctx, p.id, "verify")).rejects.toThrow("partners.needsApprovedVerification");

    const v = await addVerification(A.ctx, p.id, verificationSchema.parse({ kind: "TAX_CERTIFICATE" }));
    await reviewVerification(A.ctx, v.id, "APPROVED");
    await expect(reviewVerification(A.ctx, v.id, "REJECTED")).rejects.toBeInstanceOf(InvalidStateError);
    expect((await transitionPartner(A.ctx, p.id, "verify")).status).toBe("VERIFIED");
    expect((await transitionPartner(A.ctx, p.id, "suspend")).status).toBe("SUSPENDED");
    await expect(transitionPartner(A.ctx, p.id, "verify")).rejects.toBeInstanceOf(InvalidStateError);

    const audit = await prisma.auditLog.findMany({ where: { entityId: p.id }, orderBy: { createdAt: "asc" } });
    expect(audit.map((a) => a.action)).toEqual([
      "partner.created",
      "partner.submit",
      "partner.verify",
      "partner.suspend",
    ]);
    expect(audit[3].before).toEqual({ status: "VERIFIED" });
    expect(audit[3].after).toEqual({ status: "SUSPENDED" });
  });

  it("não aprova verificações expiradas", async () => {
    const p = await createPartner(A.ctx, partner());
    const v = await addVerification(
      A.ctx,
      p.id,
      verificationSchema.parse({ kind: "INSURANCE", expiresAt: "2020-01-01" }),
    );
    await expect(reviewVerification(A.ctx, v.id, "APPROVED")).rejects.toThrow("partners.verificationExpired");
  });
});

describe("Validade das verificações", () => {
  it("não reserva nem reactiva transportadores com a verificação expirada", async () => {
    const carrier = await verifiedCarrier(A.ctx);
    const s = await createShipment(A.ctx, shipment({ carrierPartnerId: carrier.id }));
    await addStop(A.ctx, s.id, pickup);
    await addStop(A.ctx, s.id, delivery);
    await addItem(A.ctx, s.id, item);
    await transitionShipment(A.ctx, s.id, "request");
    await prisma.partnerVerification.updateMany({
      where: { partnerId: carrier.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await expect(transitionShipment(A.ctx, s.id, "book")).rejects.toThrow("shp.carrierNotVerified");
    await transitionPartner(A.ctx, carrier.id, "suspend");
    await expect(transitionPartner(A.ctx, carrier.id, "reactivate")).rejects.toThrow(
      "partners.needsApprovedVerification",
    );
  });
});

describe("Expedições: ciclo completo", () => {
  it("rascunho → pedido → reservada → trânsito ⇄ alfândega → entregue, via tracking", async () => {
    const carrier = await verifiedCarrier(A.ctx);
    const cc = await createCostCenter(A.ctx, { code: "OPS", name: "Operações", departmentId: null });
    const s = await createShipment(A.ctx, shipment({ costCenterId: cc.id }));
    expect(s.reference).toMatch(/^SHP-\d{4}-000001$/);
    expect(s.status).toBe("DRAFT");
    expect((await createShipment(A.ctx, shipment())).reference).toMatch(/-000002$/);

    await expect(transitionShipment(A.ctx, s.id, "request")).rejects.toThrow("shp.needsStops");
    await addStop(A.ctx, s.id, delivery);
    const first = await addStop(A.ctx, s.id, pickup);
    await moveStop(A.ctx, first.id, "up");
    await expect(transitionShipment(A.ctx, s.id, "request")).rejects.toThrow("shp.needsItems");
    await addItem(A.ctx, s.id, item);
    await transitionShipment(A.ctx, s.id, "request");
    await expect(transitionShipment(A.ctx, s.id, "book")).rejects.toThrow("shp.needsCarrier");
    await updateShipment(A.ctx, s.id, shipment({ carrierPartnerId: carrier.id, costCenterId: cc.id }));
    await transitionShipment(A.ctx, s.id, "book");

    // Reservada: rota e carga ficam congeladas.
    await expect(addItem(A.ctx, s.id, item)).rejects.toThrow("shp.notEditable");
    // Salto inválido: não se entrega sem estar em trânsito.
    await expect(recordTrackingEvent(A.ctx, s.id, event("DELIVERED"))).rejects.toThrow("trk.invalidForStatus");

    expect((await recordTrackingEvent(A.ctx, s.id, event("PICKED_UP"))).status).toBe("IN_TRANSIT");
    expect((await recordTrackingEvent(A.ctx, s.id, event("DEPARTED"))).status).toBe("IN_TRANSIT");
    expect((await recordTrackingEvent(A.ctx, s.id, event("CUSTOMS_IN"))).status).toBe("AT_CUSTOMS");
    expect((await recordTrackingEvent(A.ctx, s.id, event("CUSTOMS_CLEARED"))).status).toBe("IN_TRANSIT");
    expect((await recordTrackingEvent(A.ctx, s.id, event("DELIVERED"))).status).toBe("DELIVERED");
    await expect(recordTrackingEvent(A.ctx, s.id, event("NOTE"))).rejects.toThrow("trk.notTrackable");
    await expect(transitionShipment(A.ctx, s.id, "cancel")).rejects.toBeInstanceOf(InvalidStateError);

    const full = await getShipment(A.ctx, s.id);
    expect(full.stops.map((x) => x.type)).toEqual(["PICKUP", "DELIVERY"]);
    expect(full.trackingEvents).toHaveLength(5);
    expect(full.costCenter?.code).toBe("OPS");

    const transitions = await prisma.auditLog.findMany({
      where: { entityId: s.id, action: { startsWith: "shipment." } },
      orderBy: { createdAt: "asc" },
    });
    expect(transitions.map((a) => a.action)).toEqual([
      "shipment.created",
      "shipment.request",
      "shipment.updated",
      "shipment.book",
      "shipment.dispatch",
      "shipment.enterCustoms",
      "shipment.clearCustoms",
      "shipment.deliver",
    ]);
  });

  it("não reserva com transportador não verificado e permite cancelar antes do trânsito", async () => {
    const unverified = await createPartner(A.ctx, partner({ name: "Sem verificação" }));
    const s = await createShipment(A.ctx, shipment({ carrierPartnerId: unverified.id }));
    await addStop(A.ctx, s.id, pickup);
    await addStop(A.ctx, s.id, delivery);
    const it1 = await addItem(A.ctx, s.id, item);
    await removeItem(A.ctx, it1.id);
    await addItem(A.ctx, s.id, item);
    await transitionShipment(A.ctx, s.id, "request");
    await expect(transitionShipment(A.ctx, s.id, "book")).rejects.toThrow("shp.carrierNotVerified");
    await transitionShipment(A.ctx, s.id, "cancel");
    expect((await getShipment(A.ctx, s.id)).status).toBe("CANCELLED");
  });

  it("rejeita cliente como transportador e entrega antes da recolha", async () => {
    const customer = await createPartner(A.ctx, partner({ type: "CUSTOMER", name: "Cliente" }));
    await expect(createShipment(A.ctx, shipment({ carrierPartnerId: customer.id }))).rejects.toThrow("shp.carrierType");
    await expect(
      createShipment(A.ctx, shipment({ plannedPickupAt: "2026-05-02", plannedDeliveryAt: "2026-05-01" })),
    ).rejects.toThrow("shp.deliveryBeforePickup");
  });
});

describe("Incidentes", () => {
  it("abre, investiga, resolve (com resolução), reabre e fecha", async () => {
    const s = await createShipment(A.ctx, shipment());
    const inc = await openIncident(
      A.ctx,
      incidentSchema.parse({ shipmentId: s.id, title: "Avaria", severity: "HIGH" }),
    );
    await transitionIncident(A.ctx, inc.id, "investigate");
    await expect(transitionIncident(A.ctx, inc.id, "resolve", " ")).rejects.toThrow("incidents.resolutionRequired");
    const resolved = await transitionIncident(A.ctx, inc.id, "resolve", "Camião substituído");
    expect(resolved.resolvedAt).not.toBeNull();
    const reopened = await transitionIncident(A.ctx, inc.id, "reopen");
    expect(reopened.resolvedAt).toBeNull();
    await transitionIncident(A.ctx, inc.id, "resolve", "Resolvido de novo");
    expect((await transitionIncident(A.ctx, inc.id, "close")).status).toBe("CLOSED");
    await expect(transitionIncident(A.ctx, inc.id, "reopen")).rejects.toBeInstanceOf(InvalidStateError);
    expect(await listIncidents(A.ctx, { shipmentId: s.id })).toHaveLength(1);
  });
});

describe("RBAC operacional no servidor", () => {
  it("Motorista lê expedições e regista tracking, mas não cria nem altera expedições", async () => {
    const carrier = await verifiedCarrier(A.ctx);
    const s = await createShipment(A.ctx, shipment({ carrierPartnerId: carrier.id }));
    await addStop(A.ctx, s.id, pickup);
    await addStop(A.ctx, s.id, delivery);
    await addItem(A.ctx, s.id, item);
    await transitionShipment(A.ctx, s.id, "request");
    await transitionShipment(A.ctx, s.id, "book");

    const driver = await memberWithRole(A, "DRIVER");
    expect(await listShipments(driver)).toHaveLength(1);
    await expect(createShipment(driver, shipment())).rejects.toBeInstanceOf(ForbiddenError);
    await expect(transitionShipment(driver, s.id, "cancel")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(createPartner(driver, partner())).rejects.toBeInstanceOf(ForbiddenError);
    const { event: ev, status } = await recordTrackingEvent(driver, s.id, event("PICKED_UP"));
    expect(status).toBe("IN_TRANSIT");
    expect(ev.reportedById).toBe(driver.userId);
  });

  it("Auditor só lê; Cliente não regista tracking nem gere parceiros", async () => {
    const s = await createShipment(A.ctx, shipment());
    const auditor = await memberWithRole(A, "AUDITOR");
    expect(await listShipments(auditor)).toHaveLength(1);
    await expect(addStop(auditor, s.id, pickup)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      openIncident(auditor, incidentSchema.parse({ title: "x x x", severity: "LOW" })),
    ).rejects.toBeInstanceOf(ForbiddenError);
    const customer = await memberWithRole(A, "CUSTOMER");
    await expect(recordTrackingEvent(customer, s.id, event("NOTE"))).rejects.toBeInstanceOf(ForbiddenError);
    await expect(updatePartner(customer, "x", partner())).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("Isolamento multi-tenant das operações", () => {
  it("empresa A não lê nem altera parceiros, expedições, paragens, carga, tracking ou incidentes de B", async () => {
    const carrierB = await verifiedCarrier(B.ctx);
    const ccB = await createCostCenter(B.ctx, { code: "B1", name: "B", departmentId: null });
    const sB = await createShipment(B.ctx, shipment({ carrierPartnerId: carrierB.id }));
    const stopB = await addStop(B.ctx, sB.id, pickup);
    await addStop(B.ctx, sB.id, delivery);
    const itemB = await addItem(B.ctx, sB.id, item);
    await transitionShipment(B.ctx, sB.id, "request");
    await transitionShipment(B.ctx, sB.id, "book");
    await recordTrackingEvent(B.ctx, sB.id, event("PICKED_UP"));
    const incB = await openIncident(
      B.ctx,
      incidentSchema.parse({ shipmentId: sB.id, title: "Atraso", severity: "LOW" }),
    );

    // Leituras
    expect(await listPartners(A.ctx)).toHaveLength(0);
    expect(await listShipments(A.ctx)).toHaveLength(0);
    expect(await listTrackingEvents(A.ctx)).toHaveLength(0);
    expect(await listIncidents(A.ctx)).toHaveLength(0);
    await expect(getPartner(A.ctx, carrierB.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(getShipment(A.ctx, sB.id)).rejects.toBeInstanceOf(NotFoundError);

    // Escritas sobre entidades de B
    await expect(updatePartner(A.ctx, carrierB.id, partner())).rejects.toBeInstanceOf(NotFoundError);
    await expect(transitionPartner(A.ctx, carrierB.id, "suspend")).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      addVerification(A.ctx, carrierB.id, verificationSchema.parse({ kind: "OTHER" })),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(transitionShipment(A.ctx, sB.id, "dispatch")).rejects.toBeInstanceOf(NotFoundError);
    await expect(addStop(A.ctx, sB.id, pickup)).rejects.toBeInstanceOf(NotFoundError);
    await expect(moveStop(A.ctx, stopB.id, "down")).rejects.toBeInstanceOf(NotFoundError);
    await expect(removeStop(A.ctx, stopB.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(removeItem(A.ctx, itemB.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(recordTrackingEvent(A.ctx, sB.id, event("NOTE"))).rejects.toBeInstanceOf(NotFoundError);
    await expect(transitionIncident(A.ctx, incB.id, "investigate")).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      openIncident(A.ctx, incidentSchema.parse({ shipmentId: sB.id, title: "Intrusão", severity: "LOW" })),
    ).rejects.toBeInstanceOf(NotFoundError);

    // A não pode ligar parceiros ou centros de custo de B às suas expedições
    await expect(createShipment(A.ctx, shipment({ carrierPartnerId: carrierB.id }))).rejects.toThrow(
      "shp.carrierNotFound",
    );
    await expect(createShipment(A.ctx, shipment({ customerPartnerId: carrierB.id }))).rejects.toThrow(
      "shp.customerNotFound",
    );
    await expect(createShipment(A.ctx, shipment({ costCenterId: ccB.id }))).rejects.toThrow("shp.costCenterNotFound");

    // Os dados de B ficaram intactos
    const after = await getShipment(B.ctx, sB.id);
    expect(after.status).toBe("IN_TRANSIT");
    expect(after.stops).toHaveLength(2);
    expect(after.items).toHaveLength(1);
    expect(after.trackingEvents).toHaveLength(1);
    expect((await listIncidents(B.ctx))[0].status).toBe("OPEN");

    // Referências são sequenciais por empresa
    expect((await createShipment(A.ctx, shipment())).reference).toMatch(/-000001$/);
  });
});
