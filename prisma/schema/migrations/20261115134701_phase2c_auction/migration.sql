-- CreateEnum
CREATE TYPE "ProviderStatus" AS ENUM ('DRAFT', 'PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "AuctionStatus" AS ENUM ('OPEN', 'CLOSED', 'AWARDED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BidStatus" AS ENUM ('SUBMITTED', 'WITHDRAWN', 'ACCEPTED', 'LOST');

-- CreateTable
CREATE TABLE "provider_profiles" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "status" "ProviderStatus" NOT NULL DEFAULT 'DRAFT',
    "modes" "TransportMode"[] DEFAULT ARRAY[]::"TransportMode"[],
    "services" "LogisticsService"[] DEFAULT ARRAY[]::"LogisticsService"[],
    "countries" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "description" TEXT,
    "status_reason" TEXT,
    "verified_at" TIMESTAMP(3),
    "verified_by_id" TEXT,
    "valid_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auctions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "shipment_id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "status" "AuctionStatus" NOT NULL DEFAULT 'OPEN',
    "closes_at" TIMESTAMP(3) NOT NULL,
    "modes" "TransportMode"[],
    "services" "LogisticsService"[] DEFAULT ARRAY[]::"LogisticsService"[],
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "origin_city" TEXT,
    "origin_country" CHAR(2) NOT NULL,
    "destination_city" TEXT,
    "destination_country" CHAR(2) NOT NULL,
    "pickup_from" TIMESTAMP(3),
    "delivery_by" TIMESTAMP(3),
    "cargo_summary" TEXT NOT NULL,
    "total_weight_kg" DECIMAL(14,3),
    "total_volume_m3" DECIMAL(14,3),
    "hazardous" BOOLEAN NOT NULL DEFAULT false,
    "public_notes" TEXT,
    "awarded_bid_id" TEXT,
    "closed_at" TIMESTAMP(3),
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auctions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auction_bids" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "auction_id" TEXT NOT NULL,
    "status" "BidStatus" NOT NULL DEFAULT 'SUBMITTED',
    "amount" DECIMAL(20,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "mode" "TransportMode" NOT NULL,
    "transit_days" INTEGER NOT NULL,
    "valid_until" TIMESTAMP(3),
    "notes" TEXT,
    "submitted_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auction_bids_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "provider_profiles_organization_id_key" ON "provider_profiles"("organization_id");

-- CreateIndex
CREATE INDEX "provider_profiles_status_idx" ON "provider_profiles"("status");

-- CreateIndex
CREATE UNIQUE INDEX "auctions_awarded_bid_id_key" ON "auctions"("awarded_bid_id");

-- CreateIndex
CREATE INDEX "auctions_status_closes_at_idx" ON "auctions"("status", "closes_at");

-- CreateIndex
CREATE INDEX "auctions_organization_id_status_idx" ON "auctions"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "auctions_organization_id_reference_key" ON "auctions"("organization_id", "reference");

-- CreateIndex
CREATE INDEX "auction_bids_organization_id_status_idx" ON "auction_bids"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "auction_bids_auction_id_organization_id_key" ON "auction_bids"("auction_id", "organization_id");

-- AddForeignKey
ALTER TABLE "provider_profiles" ADD CONSTRAINT "provider_profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auctions" ADD CONSTRAINT "auctions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auctions" ADD CONSTRAINT "auctions_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auctions" ADD CONSTRAINT "auctions_awarded_bid_id_fkey" FOREIGN KEY ("awarded_bid_id") REFERENCES "auction_bids"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auction_bids" ADD CONSTRAINT "auction_bids_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auction_bids" ADD CONSTRAINT "auction_bids_auction_id_fkey" FOREIGN KEY ("auction_id") REFERENCES "auctions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
