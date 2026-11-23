-- CreateEnum
CREATE TYPE "VehicleCategory" AS ENUM ('PICKUP_1_5T', 'LIGHT_TRUCK_5T', 'CONTAINER_TRUCK', 'TIPPER_BULK', 'REEFER_10T');

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('ACTIVE', 'MAINTENANCE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "FreightRequestStatus" AS ENUM ('SEARCHING', 'ACCEPTED', 'AT_PICKUP', 'IN_TRANSIT', 'DELIVERED', 'NO_DRIVERS', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FreightOfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED');

-- CreateTable
CREATE TABLE "vehicles" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "plate" TEXT NOT NULL,
    "category" "VehicleCategory" NOT NULL,
    "capacity_kg" DECIMAL(12,2),
    "description" TEXT,
    "status" "VehicleStatus" NOT NULL DEFAULT 'ACTIVE',
    "driver_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "driver_presence" (
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "online" BOOLEAN NOT NULL DEFAULT false,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "located_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_presence_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "freight_tariffs" (
    "id" TEXT NOT NULL,
    "category" "VehicleCategory" NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'AOA',
    "base_fee" DECIMAL(20,2) NOT NULL,
    "per_km" DECIMAL(20,2) NOT NULL,
    "minimum_fee" DECIMAL(20,2) NOT NULL,
    "stevedore_fee" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "waybill_fee" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "insurance_rate_pct" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updated_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "freight_tariffs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "freight_requests" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "status" "FreightRequestStatus" NOT NULL DEFAULT 'SEARCHING',
    "category" "VehicleCategory" NOT NULL,
    "pickup_label" TEXT NOT NULL,
    "pickup_address" TEXT,
    "pickup_lat" DECIMAL(9,6) NOT NULL,
    "pickup_lng" DECIMAL(9,6) NOT NULL,
    "dropoff_label" TEXT NOT NULL,
    "dropoff_address" TEXT,
    "dropoff_lat" DECIMAL(9,6) NOT NULL,
    "dropoff_lng" DECIMAL(9,6) NOT NULL,
    "distance_km" DECIMAL(10,2) NOT NULL,
    "cargo_description" TEXT NOT NULL,
    "weight_kg" DECIMAL(12,2),
    "container_type" TEXT,
    "stevedores" INTEGER NOT NULL DEFAULT 0,
    "insurance" BOOLEAN NOT NULL DEFAULT false,
    "waybill" BOOLEAN NOT NULL DEFAULT false,
    "declared_value" DECIMAL(20,2),
    "currency" CHAR(3) NOT NULL DEFAULT 'AOA',
    "price" DECIMAL(20,2) NOT NULL,
    "price_breakdown" JSONB NOT NULL,
    "scheduled_for" TIMESTAMP(3),
    "search_started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "delivery_code" TEXT NOT NULL,
    "delivery_code_attempts" INTEGER NOT NULL DEFAULT 0,
    "provider_organization_id" TEXT,
    "driver_user_id" TEXT,
    "vehicle_id" TEXT,
    "shipment_id" TEXT,
    "rating" INTEGER,
    "rating_comment" TEXT,
    "accepted_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "freight_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "freight_offers" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "driver_user_id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "distance_to_pickup_km" DECIMAL(10,2) NOT NULL,
    "status" "FreightOfferStatus" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "responded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "freight_offers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vehicles_organization_id_idx" ON "vehicles"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_organization_id_plate_key" ON "vehicles"("organization_id", "plate");

-- CreateIndex
CREATE INDEX "driver_presence_online_idx" ON "driver_presence"("online");

-- CreateIndex
CREATE UNIQUE INDEX "freight_tariffs_category_key" ON "freight_tariffs"("category");

-- CreateIndex
CREATE UNIQUE INDEX "freight_requests_shipment_id_key" ON "freight_requests"("shipment_id");

-- CreateIndex
CREATE INDEX "freight_requests_organization_id_status_idx" ON "freight_requests"("organization_id", "status");

-- CreateIndex
CREATE INDEX "freight_requests_provider_organization_id_status_idx" ON "freight_requests"("provider_organization_id", "status");

-- CreateIndex
CREATE INDEX "freight_requests_status_search_started_at_idx" ON "freight_requests"("status", "search_started_at");

-- CreateIndex
CREATE UNIQUE INDEX "freight_requests_organization_id_reference_key" ON "freight_requests"("organization_id", "reference");

-- CreateIndex
CREATE INDEX "freight_offers_driver_user_id_status_idx" ON "freight_offers"("driver_user_id", "status");

-- CreateIndex
CREATE INDEX "freight_offers_status_expires_at_idx" ON "freight_offers"("status", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "freight_offers_request_id_driver_user_id_key" ON "freight_offers"("request_id", "driver_user_id");

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_driver_user_id_fkey" FOREIGN KEY ("driver_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_presence" ADD CONSTRAINT "driver_presence_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_presence" ADD CONSTRAINT "driver_presence_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "freight_requests" ADD CONSTRAINT "freight_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "freight_requests" ADD CONSTRAINT "freight_requests_provider_organization_id_fkey" FOREIGN KEY ("provider_organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "freight_requests" ADD CONSTRAINT "freight_requests_driver_user_id_fkey" FOREIGN KEY ("driver_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "freight_requests" ADD CONSTRAINT "freight_requests_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "freight_requests" ADD CONSTRAINT "freight_requests_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "freight_offers" ADD CONSTRAINT "freight_offers_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "freight_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "freight_offers" ADD CONSTRAINT "freight_offers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "freight_offers" ADD CONSTRAINT "freight_offers_driver_user_id_fkey" FOREIGN KEY ("driver_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "freight_offers" ADD CONSTRAINT "freight_offers_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
