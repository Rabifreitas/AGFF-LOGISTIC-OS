-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "review_notes" TEXT,
ADD COLUMN     "reviewed_at" TIMESTAMP(3),
ADD COLUMN     "reviewed_by_id" TEXT;

-- CreateIndex
CREATE INDEX "documents_organization_id_expires_at_idx" ON "documents"("organization_id", "expires_at");

-- CreateIndex
CREATE INDEX "documents_organization_id_shipment_id_idx" ON "documents"("organization_id", "shipment_id");
