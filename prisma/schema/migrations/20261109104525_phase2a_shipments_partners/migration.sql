-- AlterTable
ALTER TABLE "incidents" ADD COLUMN     "resolution" TEXT;

-- AlterTable
ALTER TABLE "partners" ADD COLUMN     "notes" TEXT;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_customer_partner_id_fkey" FOREIGN KEY ("customer_partner_id") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_carrier_partner_id_fkey" FOREIGN KEY ("carrier_partner_id") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_cost_center_id_fkey" FOREIGN KEY ("cost_center_id") REFERENCES "cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
