-- CreateEnum
CREATE TYPE "SupplierInvoiceType" AS ENUM ('MATERIAL', 'LABOR');

-- CreateTable
CREATE TABLE "supplier_invoice_records" (
    "id" TEXT NOT NULL,
    "type" "SupplierInvoiceType" NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "supplierName" TEXT NOT NULL,
    "taxId" TEXT,
    "invoiceNumber" TEXT,
    "subtotal" DECIMAL(15,2) NOT NULL,
    "taxAmount" DECIMAL(15,2) NOT NULL,
    "totalAmount" DECIMAL(15,2) NOT NULL,
    "sourceSheet" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_invoice_records_pkey" PRIMARY KEY ("id")
);

