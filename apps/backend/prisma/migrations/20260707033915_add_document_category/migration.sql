-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('BILL', 'BOQ', 'PERMIT', 'BLUEPRINT', 'PURCHASE_ORDER', 'PHOTO', 'OTHER');

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "category" "DocumentCategory" NOT NULL DEFAULT 'BILL';
