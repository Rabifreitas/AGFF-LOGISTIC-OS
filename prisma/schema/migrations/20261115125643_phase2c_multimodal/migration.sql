-- CreateEnum
CREATE TYPE "LogisticsService" AS ENUM ('TRANSPORT', 'FREIGHT_FORWARDING', 'CUSTOMS_CLEARANCE', 'WAREHOUSING', 'STEVEDORING', 'PORT_HANDLING', 'CONTAINER_DEPOT', 'HEAVY_LIFT', 'COLD_CHAIN', 'LAST_MILE', 'COURIER', 'PACKAGING', 'CARGO_INSURANCE', 'INSPECTION', 'PROJECT_CARGO', 'DANGEROUS_GOODS', 'SHIP_AGENCY');

-- CreateEnum
CREATE TYPE "CargoType" AS ENUM ('GENERAL', 'CONTAINER', 'DRY_BULK', 'LIQUID_BULK', 'BREAKBULK', 'RORO', 'PROJECT', 'REEFER', 'DANGEROUS', 'LIVESTOCK');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PartnerType" ADD VALUE 'SHIPPING_LINE';
ALTER TYPE "PartnerType" ADD VALUE 'SHIP_AGENT';
ALTER TYPE "PartnerType" ADD VALUE 'AIRLINE';
ALTER TYPE "PartnerType" ADD VALUE 'RAIL_OPERATOR';
ALTER TYPE "PartnerType" ADD VALUE 'BARGE_OPERATOR';
ALTER TYPE "PartnerType" ADD VALUE 'PORT_TERMINAL';
ALTER TYPE "PartnerType" ADD VALUE 'STEVEDORE';
ALTER TYPE "PartnerType" ADD VALUE 'CONTAINER_DEPOT';
ALTER TYPE "PartnerType" ADD VALUE 'COURIER';
ALTER TYPE "PartnerType" ADD VALUE 'HEAVY_LIFT';
ALTER TYPE "PartnerType" ADD VALUE 'INSURER';
ALTER TYPE "PartnerType" ADD VALUE 'SURVEYOR';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StopType" ADD VALUE 'PORT';
ALTER TYPE "StopType" ADD VALUE 'AIRPORT';
ALTER TYPE "StopType" ADD VALUE 'RAIL_TERMINAL';
ALTER TYPE "StopType" ADD VALUE 'RIVER_PORT';
ALTER TYPE "StopType" ADD VALUE 'WAREHOUSE';
ALTER TYPE "StopType" ADD VALUE 'TRANSSHIPMENT';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TransportMode" ADD VALUE 'COASTAL';
ALTER TYPE "TransportMode" ADD VALUE 'INLAND_WATERWAY';
ALTER TYPE "TransportMode" ADD VALUE 'PIPELINE';

-- AlterTable
ALTER TABLE "partners" ADD COLUMN     "modes" "TransportMode"[] DEFAULT ARRAY[]::"TransportMode"[],
ADD COLUMN     "services" "LogisticsService"[] DEFAULT ARRAY[]::"LogisticsService"[];

-- AlterTable
ALTER TABLE "shipment_items" ADD COLUMN     "cargo_type" "CargoType" NOT NULL DEFAULT 'GENERAL',
ADD COLUMN     "container_number" TEXT,
ADD COLUMN     "container_type" TEXT,
ADD COLUMN     "imo_class" TEXT,
ADD COLUMN     "seal_number" TEXT,
ADD COLUMN     "temp_max_c" DECIMAL(5,1),
ADD COLUMN     "temp_min_c" DECIMAL(5,1),
ADD COLUMN     "un_number" TEXT;

-- AlterTable
ALTER TABLE "shipments" ADD COLUMN     "services" "LogisticsService"[] DEFAULT ARRAY[]::"LogisticsService"[];

-- CreateTable
CREATE TABLE "shipment_legs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "shipment_id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "mode" "TransportMode" NOT NULL,
    "carrier_partner_id" TEXT,
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "equipment_type" TEXT,
    "vehicle_plate" TEXT,
    "vessel_name" TEXT,
    "voyage_number" TEXT,
    "flight_number" TEXT,
    "transport_doc_number" TEXT,
    "planned_departure_at" TIMESTAMP(3),
    "planned_arrival_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipment_legs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shipment_legs_organization_id_idx" ON "shipment_legs"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "shipment_legs_shipment_id_sequence_key" ON "shipment_legs"("shipment_id", "sequence");

-- AddForeignKey
ALTER TABLE "shipment_legs" ADD CONSTRAINT "shipment_legs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_legs" ADD CONSTRAINT "shipment_legs_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_legs" ADD CONSTRAINT "shipment_legs_carrier_partner_id_fkey" FOREIGN KEY ("carrier_partner_id") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;
